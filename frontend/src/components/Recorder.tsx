import { useRef, useState } from "react";

interface Props {
  audioNode: AudioNode | null;
}

interface PcmChunk { left: Float32Array; right: Float32Array; }

export function encodeWav(chunks: Float32Array[], sampleRate: number, channels: number): Blob {
  const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
  const dataBytes = totalSamples * channels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const toInt16 = (v: number) => clamp(v) < 0 ? clamp(v) * 32768 : clamp(v) * 32767;

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      view.setInt16(offset, toInt16(chunk[i]), true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function Recorder({ audioNode }: Props) {
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const capturedNodeRef = useRef<AudioNode | null>(null);
  const isStartingRef = useRef(false);
  const chunksRef = useRef<PcmChunk[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const start = async () => {
    if (!audioNode || isStartingRef.current || workletRef.current) return;
    isStartingRef.current = true;
    try {
      const ctx = audioNode.context as AudioContext;
      await ctx.audioWorklet.addModule("/pcm-recorder-processor.js");
      const worklet = new AudioWorkletNode(ctx, "pcm-recorder-processor");
      chunksRef.current = [];
      worklet.port.onmessage = (e: MessageEvent<PcmChunk>) => {
        chunksRef.current.push(e.data);
      };
      worklet.port.postMessage("start");
      audioNode.connect(worklet);
      workletRef.current = worklet;
      capturedNodeRef.current = audioNode;
      setIsRecording(true);
    } catch {
      // addModule or worklet construction failed
    } finally {
      isStartingRef.current = false;
    }
  };

  const stop = () => {
    const node = capturedNodeRef.current;
    if (!workletRef.current || !node) return;
    workletRef.current.port.postMessage("stop");
    try { node.disconnect(workletRef.current); } catch { /* already disconnected */ }
    workletRef.current.disconnect();
    workletRef.current = null;
    capturedNodeRef.current = null;
    setIsRecording(false);

    const sampleRate = (node.context as AudioContext).sampleRate;
    const leftChunks = chunksRef.current.map(c => c.left);
    const rightChunks = chunksRef.current.map(c => c.right);

    const totalLen = leftChunks.reduce((a, c) => a + c.length, 0);
    const interleaved = new Float32Array(totalLen * 2);
    let idx = 0;
    for (let i = 0; i < leftChunks.length; i++) {
      for (let j = 0; j < leftChunks[i].length; j++) {
        interleaved[idx++] = leftChunks[i][j];
        interleaved[idx++] = rightChunks[i][j];
      }
    }

    const blob = encodeWav([interleaved], sampleRate, 2);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "stretch" }}>
      {isRecording ? (
        <button
          onClick={stop}
          style={{
            background: "#3a1a1a", border: "1px solid #8a2a2a", borderRadius: "4px",
            padding: "5px 0", color: "#f66", cursor: "pointer",
            fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "1px",
          }}
        >
          ⏹ STOP
        </button>
      ) : (
        <button
          onClick={start}
          disabled={!audioNode}
          style={{
            background: "#2a1a2a", border: "1px solid #5a2a5a", borderRadius: "4px",
            padding: "5px 0", color: !audioNode ? "#4a2a4a" : "#f9c",
            cursor: !audioNode ? "default" : "pointer",
            fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "1px",
          }}
        >
          ⏺ REC
        </button>
      )}
      {isRecording && (
        <span style={{ fontSize: "0.48rem", color: "#f66", fontFamily: "monospace", textAlign: "center", letterSpacing: "1px" }}>
          ● REC
        </span>
      )}
    </div>
  );
}
