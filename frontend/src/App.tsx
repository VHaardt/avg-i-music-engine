import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Chat } from "./components/Chat";
import { KnobPanel } from "./components/KnobPanel";
import { Recorder } from "./components/Recorder";
import { StrudelPlayer } from "./components/StrudelPlayer";
import { Waveform } from "./components/Waveform";
import { BpmEqPanel } from "./components/BpmEqPanel";
import { PresetDrawer } from "./components/PresetDrawer";
import { CodeEditor } from "./components/CodeEditor";
import { usePresets } from "./hooks/usePresets";
import { useSceneQueue } from "./hooks/useSceneQueue";
import { useTapTempo } from "./hooks/useTapTempo";
import { BeatIndicator } from "./components/BeatIndicator";
import type { AudioFx, AudioFxNodes, ChatMessage, Knob, UpdateMessage } from "./types";
import { makeDriveCurve } from "./lib/audioFx";

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? "ws://localhost:8000/ws";

export const DEFAULT_CODE = `setcpm(120/4)\nsound("bd ~ sd ~, hh*8").gain(0.8)`;

const SETCPM_RE = /setcpm\(([^)]+)\)/;

function extractBpmFromCode(code: string): number | null {
  const m = code.match(SETCPM_RE);
  if (!m) return null;
  const expr = m[1].trim();
  if (/^[\d\s+\-*/().]+$/.test(expr)) {
    try { return Math.round(parseFloat(String(eval(expr))) * 4); } catch { /* */ }
  }
  const v = parseFloat(expr);
  return isNaN(v) ? null : Math.round(v * 4);
}

function applyKnobToCode(code: string, param: string, value: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
  const chained = new RegExp(`\\.${param}\\([^)]*\\)`, "g");
  if (new RegExp(`\\.${param}\\(`).test(code)) return code.replace(chained, `.${param}(${formatted})`);
  return code.replace(new RegExp(`^(\\s*)${param}\\([^)]*\\)`, "gm"), `$1${param}(${formatted})`);
}

function applyBpmToCode(code: string, bpm: number): string {
  const cpm = (bpm / 4).toFixed(3).replace(/\.?0+$/, "");
  if (SETCPM_RE.test(code)) return code.replace(SETCPM_RE, `setcpm(${cpm})`);
  return `setcpm(${cpm})\n${code}`;
}

export function App() {
  const { isConnected, lastUpdate, sendMessage, streamingText } = useWebSocket(WS_URL);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", content: "Ciao! Descrivi la musica che vuoi creare." },
  ]);
  const [knobs, setKnobs] = useState<Knob[]>([]);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [aiCode, setAiCode] = useState("");
  const [bpm, setBpm] = useState(120);
  const [audioFx, setAudioFx] = useState<AudioFx>({
    low: 0, mid: 0, high: 0,
    drive: 0, reverb: 0, delay: 0, delayTime: 0.35, vol: 1,
  });
  const audioFxNodesRef = useRef<AudioFxNodes | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [audioNode, setAudioNode] = useState<AudioNode | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const lastUpdateRef = useRef<UpdateMessage | null>(null);
  const evaluateNowRef = useRef<((code: string) => void) | null>(null);

  const { presets, activeSlot, savePreset, loadPreset, clearPreset, setActiveSlot, renamePreset, colorPreset } = usePresets();

  const [isPlaying, setIsPlaying] = useState(false);
  const { queuedSlot, queueScene, cancelQueue } = useSceneQueue({
    bpm,
    isPlaying,
    onSwap: (slot) => {
      const preset = loadPreset(slot);
      if (!preset) return;
      setCode(preset.code!);
      setBpm(preset.bpm);
      setActiveSlot(slot);
    },
  });

  const handlePresetSave = useCallback((slot: number) => {
    savePreset(slot, code, bpm);
    setActiveSlot(slot);
  }, [code, bpm, savePreset, setActiveSlot]);

  const handlePresetLoad = useCallback((slot: number) => {
    const preset = loadPreset(slot);
    if (!preset) return;
    setCode(preset.code!);
    setBpm(preset.bpm);
    setActiveSlot(slot);
  }, [loadPreset, setActiveSlot]);

  // Sync BPM knob when AI generates new code
  useEffect(() => {
    const extracted = extractBpmFromCode(code);
    if (extracted !== null) setBpm(Math.max(40, Math.min(240, extracted)));
  }, [code]);

  useEffect(() => {
    if (!lastUpdate || lastUpdate === lastUpdateRef.current) return;
    lastUpdateRef.current = lastUpdate;
    setIsWaiting(false);
    setCode(lastUpdate.code);
    setAiCode(lastUpdate.code);
    setKnobs(lastUpdate.knobs);
    setActiveSlot(null);
    if (lastUpdate.code_error) {
      setMessages(prev => [...prev, { role: "agent", content: `⚠️ Code generation failed: ${lastUpdate.code_error}` }]);
    }
    if (lastUpdate.message) {
      setMessages(prev => [...prev, { role: "agent", content: lastUpdate.message }]);
    }
    // AI code: evaluate immediately, bypass debounce
    evaluateNowRef.current?.(lastUpdate.code);
  }, [lastUpdate]);

  const handleSend = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setIsWaiting(true);
    sendMessage({
      type: "user_message",
      message: text,
      current_code: code,
      manually_edited: code !== aiCode && code !== "",
      queued_slot: queuedSlot,
    });
  }, [sendMessage, code, aiCode, queuedSlot]);

  const handleKnobChange = useCallback((strudel_param: string, value: number) => {
    setKnobs(prev => prev.map(k => k.strudel_param === strudel_param ? { ...k, value } : k));
    setCode(prev => applyKnobToCode(prev, strudel_param, value));
  }, []);

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
    setCode(prev => applyBpmToCode(prev, newBpm));
  }, []);

  useEffect(() => {
    if (!isConnected) setIsWaiting(false);
  }, [isConnected]);

  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const { tap } = useTapTempo({ onBpm: handleBpmChange });

  useEffect(() => {
    if (isPerformanceMode) {
      document.body.classList.add("performance-mode");
    } else {
      document.body.classList.remove("performance-mode");
    }
    return () => document.body.classList.remove("performance-mode");
  }, [isPerformanceMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "f" && tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) setIsPerformanceMode(p => !p);
      if (e.key === "Escape") setIsPerformanceMode(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleAudioFxChange = useCallback((param: keyof AudioFx, value: number) => {
    setAudioFx(prev => ({ ...prev, [param]: value }));
    const nodes = audioFxNodesRef.current;
    if (!nodes) return;
    switch (param) {
      case "low":       nodes.low.gain.value = value; break;
      case "mid":       nodes.mid.gain.value = value; break;
      case "high":      nodes.high.gain.value = value; break;
      case "drive":     nodes.drive.curve = makeDriveCurve(value); break;
      case "reverb":    nodes.reverbWet.gain.value = value; break;
      case "delay":     nodes.delayWet.gain.value = value; break;
      case "delayTime": nodes.delayNode.delayTime.value = value; break;
      case "vol":       nodes.masterVol.gain.value = value; break;
    }
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#080a0d", color: "#c0ccd8",
      fontFamily: "system-ui, sans-serif", overflow: "hidden",
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", height: "52px", flexShrink: 0,
        borderBottom: "1px solid #1a2230", background: "#04060a", padding: "0 18px", gap: "14px",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{
            fontFamily: "monospace", fontSize: "1.15rem", fontWeight: "bold",
            color: "#d8ecf8", letterSpacing: "8px", lineHeight: 1,
          }}>
            AVG I
          </div>
          <div style={{
            fontFamily: "monospace", fontSize: "0.4rem",
            color: "#2a5a7a", letterSpacing: "5px",
          }}>
            LIVE SYNTHESIS ENGINE
          </div>
        </div>

        <div style={{
          width: "1px", height: "26px",
          background: "linear-gradient(to bottom, transparent, #1e3a5a, transparent)",
          flexShrink: 0,
        }} />

        <div style={{ flex: 1 }} />

        {/* Performance mode toggle */}
        <button
          onClick={() => setIsPerformanceMode(p => !p)}
          title="Performance mode (F)"
          className="pm-hide"
          style={{
            background: "transparent", border: "1px solid #1a2230",
            borderRadius: "4px", padding: "3px 8px",
            color: "#3a5060", fontFamily: "monospace",
            fontSize: "0.55rem", cursor: "pointer",
          }}
        >
          ⛶
        </button>

        {/* Status */}
        <div style={{
          fontSize: "0.5rem", fontFamily: "monospace", letterSpacing: "2px", flexShrink: 0,
          color: isConnected ? "#4abf7a" : "#bf4a4a", display: "flex", alignItems: "center", gap: "5px",
        }}>
          <span style={{ fontSize: "0.65rem" }}>{isConnected ? "●" : "○"}</span>
          {isConnected ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* ── TOP ZONE: Transport | Spectrum | Knobs | BPM+EQ ── */}
      <div style={{
        ...(isPerformanceMode ? { flex: 1 } : { height: "140px", flexShrink: 0 }),
        display: "flex",
        borderBottom: "1px solid #1a2230",
      }}>
        {/* Transport strip */}
        <div style={{
          width: isPerformanceMode ? "120px" : "84px", flexShrink: 0,
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "stretch",
          gap: isPerformanceMode ? "16px" : "6px",
          padding: isPerformanceMode ? "20px 16px" : "8px 8px",
          borderRight: "1px solid #0d1520",
          background: "#04060a",
        }}>
          <StrudelPlayer
            code={code}
            onAudioNode={setAudioNode}
            onAnalyserNode={setAnalyserNode}
            onAudioFxNodes={(nodes) => { audioFxNodesRef.current = nodes; }}
            evaluateNowRef={evaluateNowRef}
            onError={(msg) => {
              setMessages(prev => [...prev, { role: "agent", content: `⚠️ Runtime error: ${msg}` }]);
              sendMessage({ type: "runtime_error", message: msg });
            }}
            onPlayChange={setIsPlaying}
          />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <BeatIndicator isPlaying={isPlaying} bpm={bpm} />
          </div>
          <Recorder audioNode={audioNode} />
          {isWaiting && (
            <span style={{
              color: "#2a7a5a", fontSize: "0.46rem", letterSpacing: "1px",
              display: "flex", alignItems: "center", gap: "3px",
              fontFamily: "monospace",
            }}>
              <span className="spinner" />
              GEN
            </span>
          )}
        </div>

        {/* Spectrum canvas */}
        <div style={{ flex: 1, padding: "6px 8px", background: "#04060a" }}>
          <Waveform analyserNode={analyserNode} />
        </div>

        {/* Knobs — singleRow normal, grid in performance */}
        <div style={{
          width: isPerformanceMode ? "480px" : "320px", flexShrink: 0,
          borderLeft: "1px solid #0d1520",
          background: "#04060a",
          overflow: "hidden",
        }}>
          <KnobPanel knobs={knobs} onKnobChange={handleKnobChange} singleRow={!isPerformanceMode} />
        </div>

        {/* BPM + EQ */}
        <BpmEqPanel bpm={bpm} onBpmChange={handleBpmChange} audioFx={audioFx} onAudioFxChange={handleAudioFxChange} onTap={tap} />
      </div>

      {/* ── PERFORMANCE PRESETS (full-width, solo in perf mode) ── */}
      {isPerformanceMode && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid #1a2230" }}>
          <PresetDrawer
            presets={presets}
            activeSlot={activeSlot}
            onSave={handlePresetSave}
            onLoad={handlePresetLoad}
            onSetActive={setActiveSlot}
            onClear={clearPreset}
            onRename={renamePreset}
            onColor={colorPreset}
            queuedSlot={queuedSlot}
            onQueue={(slot) => slot !== null ? queueScene(slot) : cancelQueue()}
          />
        </div>
      )}

      {/* ── BOTTOM SPLIT: Code | Chat (nascosto in performance mode) ── */}
      <div style={{ flex: 1, display: isPerformanceMode ? "none" : "flex", overflow: "hidden" }}>

        {/* Code column */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          borderRight: "1px solid #1a2230", overflow: "hidden", background: "#05070a",
          minWidth: 0,
        }}>
          {/* Presets — just above code */}
          <PresetDrawer
            presets={presets}
            activeSlot={activeSlot}
            onSave={handlePresetSave}
            onLoad={handlePresetLoad}
            onSetActive={setActiveSlot}
            onClear={clearPreset}
            onRename={renamePreset}
            onColor={colorPreset}
            queuedSlot={queuedSlot}
            onQueue={(slot) => slot !== null ? queueScene(slot) : cancelQueue()}
          />

          <div style={{
            padding: "5px 16px", borderBottom: "1px solid #0d1520", flexShrink: 0,
            fontFamily: "monospace", fontSize: "0.6rem", letterSpacing: "3px",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <span style={{ color: "#3a5060" }}>STRUDEL · CODE</span>
            {activeSlot !== null ? (
              <span style={{ color: "#00d4aa", fontSize: "0.46rem", letterSpacing: "2px" }}>
                [{presets[activeSlot]?.name ?? `PRESET ${activeSlot + 1}`}]
              </span>
            ) : code ? (
              <span style={{ color: "#4a6a5a", fontSize: "0.46rem", letterSpacing: "2px" }}>LIVE</span>
            ) : null}
          </div>
          <CodeEditor
            value={code}
            onChange={(v) => {
              if (!isWaiting) setCode(v);
            }}
            readOnly={isWaiting}
            onEvaluateNow={() => {
              if (evaluateNowRef.current) evaluateNowRef.current(code);
            }}
          />
        </div>

        {/* Chat column — same height as code */}
        <div style={{ width: "400px", flexShrink: 0 }}>
          <Chat messages={messages} onSend={handleSend} isConnected={isConnected} isWaiting={isWaiting} streamingText={streamingText} />
        </div>
      </div>

      {/* ── FOOTER HINTS ── */}
      <div className="pm-hide" style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "3px 18px", flexShrink: 0,
        borderTop: "1px solid #0d1520", background: "#03050a",
      }}>
        <span style={{ fontSize: "0.42rem", color: "#1e3040", fontFamily: "monospace", letterSpacing: "1.5px" }}>
          <kbd style={{ background: "#0d1520", border: "1px solid #1a2a3a", borderRadius: "2px", padding: "0 3px", color: "#2a4a5a" }}>F</kbd>
          {" "}performance mode
        </span>
        <span style={{ fontSize: "0.42rem", color: "#1e3040", fontFamily: "monospace", letterSpacing: "1.5px" }}>
          <kbd style={{ background: "#0d1520", border: "1px solid #1a2a3a", borderRadius: "2px", padding: "0 3px", color: "#2a4a5a" }}>Ctrl+Enter</kbd>
          {" "}evaluate now
        </span>
        <span style={{ fontSize: "0.42rem", color: "#1e3040", fontFamily: "monospace", letterSpacing: "1.5px" }}>
          <kbd style={{ background: "#0d1520", border: "1px solid #1a2a3a", borderRadius: "2px", padding: "0 3px", color: "#2a4a5a" }}>Esc</kbd>
          {" "}exit performance
        </span>
      </div>
    </div>
  );
}

export default App;
