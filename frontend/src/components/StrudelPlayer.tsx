import { useEffect, useRef, useState } from "react";
import type { AudioFxNodes } from "../types";
import { makeReverbIR, makeDriveCurve } from "../lib/audioFx";

interface Props {
  code: string;
  onAudioNode: (node: AudioNode | null) => void;
  onAnalyserNode?: (node: AnalyserNode | null) => void;
  onAudioFxNodes?: (nodes: AudioFxNodes | null) => void;
  onError?: (msg: string) => void;
  evaluateNowRef?: React.MutableRefObject<((code: string) => void) | null>;
  onPlayChange?: (playing: boolean) => void;
}

interface AudioChain {
  gainNode: AudioNode;
  compressor: DynamicsCompressorNode;
  convolver: ConvolverNode;
  delayFeedback: GainNode;
  analyser: AnalyserNode;
  fxNodes: AudioFxNodes;
}

function disconnectChain(chain: AudioChain) {
  chain.gainNode.disconnect();
  chain.compressor.disconnect();
  chain.convolver.disconnect();
  chain.delayFeedback.disconnect();
  chain.analyser.disconnect();
  chain.fxNodes.low.disconnect();
  chain.fxNodes.mid.disconnect();
  chain.fxNodes.high.disconnect();
  chain.fxNodes.drive.disconnect();
  chain.fxNodes.reverbWet.disconnect();
  chain.fxNodes.delayNode.disconnect();
  chain.fxNodes.delayWet.disconnect();
  chain.fxNodes.masterVol.disconnect();
}

export function StrudelPlayer({ code, onAudioNode, onAnalyserNode, onAudioFxNodes, onError, evaluateNowRef, onPlayChange }: Props) {
  const replRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioChainRef = useRef<AudioChain | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (evaluateNowRef) {
      evaluateNowRef.current = (newCode: string) => {
        if (replRef.current && isPlaying) {
          setIsPending(false);
          replRef.current.evaluate(newCode);
        }
      };
    }
  }, [isPlaying, evaluateNowRef]);

  useEffect(() => {
    if (!isPlaying || !replRef.current || !code) return;
    setIsPending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsPending(false);
      replRef.current.evaluate(code);
    }, 3000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, isPlaying]);

  const reportError = (e: any) => {
    const msg = e?.message ?? String(e);
    setError(msg);
    onError?.(msg);
  };

  const handlePlay = async () => {
    setError(null);
    try {
      if (!replRef.current) {
        setIsLoading(true);
        try {
          const { initStrudel, samples, registerSoundfonts } = await import("../lib/strudel-bundle");
          replRef.current = await initStrudel({
            prebake: async () => {
              await Promise.all([
                samples("github:tidalcycles/Dirt-Samples/main"),
                registerSoundfonts(),
              ]);
            },
            onEvalError: (e: Error) => reportError(e),
          });
        } finally {
          setIsLoading(false);
        }
      }
      await replRef.current.evaluate(code);
      setIsPlaying(true);
      onPlayChange?.(true);

      try {
        const { getSuperdoughAudioController } = await import("../lib/strudel-bundle");
        // Audio controller may not be ready immediately on first init — retry once
        let ctrl = getSuperdoughAudioController();
        if (!ctrl?.output?.destinationGain) {
          await new Promise<void>(r => setTimeout(r, 300));
          ctrl = getSuperdoughAudioController();
        }
        const gainNode: AudioNode | null = ctrl?.output?.destinationGain ?? null;
        onAudioNode(gainNode);

        if (gainNode) {
          // Tear down previous chain before rebuilding (avoids orphaned nodes)
          if (audioChainRef.current) {
            disconnectChain(audioChainRef.current);
            audioChainRef.current = null;
          }

          const ctx = gainNode.context as AudioContext;

          // Compressor
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -12;
          compressor.knee.value = 6;
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          // EQ
          const low = ctx.createBiquadFilter();
          low.type = "lowshelf";
          low.frequency.value = 200;
          low.gain.value = 0;

          const mid = ctx.createBiquadFilter();
          mid.type = "peaking";
          mid.frequency.value = 1000;
          mid.Q.value = 1;
          mid.gain.value = 0;

          const high = ctx.createBiquadFilter();
          high.type = "highshelf";
          high.frequency.value = 6000;
          high.gain.value = 0;

          // Drive (soft-clip saturation)
          const drive = ctx.createWaveShaper();
          drive.curve = makeDriveCurve(0);
          drive.oversample = "2x";

          // Reverb
          const convolver = ctx.createConvolver();
          convolver.buffer = makeReverbIR(ctx, 2.5, 3);
          const reverbWet = ctx.createGain();
          reverbWet.gain.value = 0;

          // Delay with feedback
          const delayNode = ctx.createDelay(1.0);
          delayNode.delayTime.value = 0.35;
          const delayFeedback = ctx.createGain();
          delayFeedback.gain.value = 0.4;
          const delayWet = ctx.createGain();
          delayWet.gain.value = 0;

          // Master volume
          const masterVol = ctx.createGain();
          masterVol.gain.value = 1.0;

          // Analyser
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;

          // Series chain: gainNode → compressor → low → mid → high → drive
          gainNode.disconnect();
          gainNode.connect(compressor);
          compressor.connect(low);
          low.connect(mid);
          mid.connect(high);
          high.connect(drive);

          // Drive → dry path → masterVol
          drive.connect(masterVol);

          // Drive → reverb send → masterVol
          drive.connect(convolver);
          convolver.connect(reverbWet);
          reverbWet.connect(masterVol);

          // Drive → delay send (with feedback) → masterVol
          drive.connect(delayNode);
          delayNode.connect(delayFeedback);
          delayFeedback.connect(delayNode);
          delayNode.connect(delayWet);
          delayWet.connect(masterVol);

          // masterVol → analyser → destination
          masterVol.connect(analyser);
          analyser.connect(ctx.destination);

          const fxNodes: AudioFxNodes = { low, mid, high, drive, reverbWet, delayNode, delayWet, masterVol };
          audioChainRef.current = { gainNode, compressor, convolver, delayFeedback, analyser, fxNodes };
          onAnalyserNode?.(analyser);
          onAudioFxNodes?.(fxNodes);
        }
      } catch {
        onAudioNode(null);
      }
    } catch (e: any) {
      reportError(e);
    }
  };

  const handleStop = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try { replRef.current?.stop(); } catch { /* ignore */ }
    if (audioChainRef.current) {
      disconnectChain(audioChainRef.current);
      audioChainRef.current = null;
    }
    setIsPlaying(false);
    onPlayChange?.(false);
    setIsPending(false);
    onAudioNode(null);
    onAnalyserNode?.(null);
    onAudioFxNodes?.(null);
  };

  const playDisabled = isPlaying || !code || isLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "stretch" }}>
      <button
        onClick={handlePlay}
        disabled={playDisabled}
        style={{
          background: playDisabled ? "#0f1a0f" : "#142a14",
          border: `1px solid ${playDisabled ? "#1a2a1a" : "#2a5a2a"}`,
          borderRadius: "4px",
          padding: "5px 0",
          color: playDisabled ? "#2a4a2a" : "#7cc",
          cursor: playDisabled ? "default" : "pointer",
          fontSize: "0.72rem",
          fontFamily: "monospace",
          letterSpacing: "1px",
        }}
      >
        {isLoading ? "⟳ LOAD" : "▶ PLAY"}
      </button>
      <button
        onClick={handleStop}
        disabled={!isPlaying}
        style={{
          background: !isPlaying ? "#150f0f" : "#2a1414",
          border: `1px solid ${!isPlaying ? "#2a1a1a" : "#5a2a2a"}`,
          borderRadius: "4px",
          padding: "5px 0",
          color: !isPlaying ? "#3a2a2a" : "#f77",
          cursor: !isPlaying ? "default" : "pointer",
          fontSize: "0.72rem",
          fontFamily: "monospace",
          letterSpacing: "1px",
        }}
      >
        ■ STOP
      </button>
      {isPlaying && !isPending && (
        <span style={{ fontSize: "0.55rem", color: "#00d4aa", fontFamily: "monospace", letterSpacing: "1px", textAlign: "center" }}>● LIVE</span>
      )}
      {isPlaying && isPending && (
        <span style={{ fontSize: "0.55rem", color: "#8a7a3a", fontFamily: "monospace", letterSpacing: "1px", textAlign: "center" }}>⏳ WAIT</span>
      )}
      {error && (
        <span style={{ fontSize: "0.52rem", color: "#f77", fontFamily: "monospace", lineHeight: 1.2 }}>{error.slice(0, 28)}</span>
      )}
    </div>
  );
}
