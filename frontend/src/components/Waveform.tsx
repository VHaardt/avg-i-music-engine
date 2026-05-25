import { useEffect, useRef } from "react";

interface Props {
  analyserNode: AnalyserNode | null;
}

const BAND_LABELS = [
  { label: "BASS", x: 0.03 },
  { label: "MID",  x: 0.27 },
  { label: "LEAD", x: 0.52 },
  { label: "HIGH", x: 0.76 },
];

export function Waveform({ analyserNode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    analyserRef.current = analyserNode;
  }, [analyserNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const syncSize = () => {
      const dpr = window.devicePixelRatio ?? 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.scale(dpr, dpr);
      }
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    let rafId: number;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "#0c1a14";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (h / 4) * i);
        ctx.lineTo(w, (h / 4) * i);
        ctx.stroke();
      }
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((w / 8) * i, 0);
        ctx.lineTo((w / 8) * i, h);
        ctx.stroke();
      }

      // Band labels (faint)
      ctx.font = "7px monospace";
      for (const { label, x } of BAND_LABELS) {
        ctx.fillStyle = "#1e3828";
        ctx.fillText(label, w * x, h - 4);
      }

      const node = analyserRef.current;
      if (!node) {
        ctx.beginPath();
        ctx.strokeStyle = "#1a3a2a";
        ctx.lineWidth = 1;
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      const bufLen = node.fftSize;
      const timeData = new Uint8Array(bufLen);
      node.getByteTimeDomainData(timeData);

      const step = w / bufLen;
      const mid = h / 2;

      // Glow pass
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00ffaa";
      ctx.strokeStyle = "rgba(0,255,170,0.25)";
      for (let i = 0; i < bufLen; i++) {
        const x = i * step;
        const y = mid + ((timeData[i] / 128) - 1) * mid * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Main wave
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      for (let i = 0; i < bufLen; i++) {
        const t = i / bufLen;
        const x = i * step;
        const y = mid + ((timeData[i] / 128) - 1) * mid * 0.85;
        // Hue sweeps teal → blue-violet → pink along X
        const hue = 165 + t * 165;
        ctx.strokeStyle = `hsl(${hue}, 90%, 58%)`;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }
      }
      ctx.shadowBlur = 0;
    };

    draw();
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", borderRadius: "3px" }}
    />
  );
}
