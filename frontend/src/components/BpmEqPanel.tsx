import { useRef, useState } from "react";
import type React from "react";
import type { AudioFx } from "../types";

interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  audioFx: AudioFx;
  onAudioFxChange: (param: keyof AudioFx, value: number) => void;
  onTap?: () => void;
}

const EQ_COLORS: Record<string, string> = { low: "#9cf", mid: "#7ca", high: "#c9f" };
const FX_COLORS: Record<string, string> = {
  reverb: "#fa8", delay: "#af8", delayTime: "#8cf", drive: "#f8a", vol: "#eed",
};
const FX_PARAMS: Array<{ param: keyof AudioFx; label: string; min: number; max: number; step: number }> = [
  { param: "reverb",    label: "RVB", min: 0,    max: 1,   step: 0.01 },
  { param: "delay",     label: "DLY", min: 0,    max: 1,   step: 0.01 },
  { param: "delayTime", label: "DLT", min: 0.01, max: 1,   step: 0.01 },
  { param: "drive",     label: "DRV", min: 0,    max: 1,   step: 0.01 },
  { param: "vol",       label: "VOL", min: 0,    max: 2,   step: 0.01 },
];

const TRACK_H = 42;

function VertFader({ value, min, max, step, color, label, ariaLabel, onChange }: {
  value: number; min: number; max: number; step: number;
  color: string; label: string; ariaLabel: string;
  onChange: (v: number) => void;
}) {
  const [active, setActive] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pct = (value - min) / (max - min);
  const centerPct = Math.max(0, Math.min(1, -min / (max - min)));
  const thumbTop = (1 - pct) * TRACK_H;
  const centerTop = (1 - centerPct) * TRACK_H;
  const fillTop = Math.min(thumbTop, centerTop);
  const fillH = Math.abs(thumbTop - centerTop);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.buttons) return;
    const range = max - min;
    onChange(Math.max(min, Math.min(max, valueRef.current - e.movementY * (range / 90))));
  };
  const handlePointerUp = () => setActive(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", position: "relative" }}>
      <div
        style={{ position: "relative", width: "22px", height: `${TRACK_H}px`, cursor: active ? "grabbing" : "ns-resize" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          top: 0, width: "3px", height: "100%",
          background: "#0e1622", borderRadius: "2px",
        }} />
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          top: centerTop - 0.5, width: "10px", height: "1px", background: "#253344",
        }} />
        {fillH > 0.5 && (
          <div style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            top: fillTop, height: fillH, width: "3px",
            background: color, borderRadius: "2px", opacity: active ? 0.95 : 0.7,
          }} />
        )}
        <div style={{
          position: "absolute", left: "50%",
          top: thumbTop, transform: "translate(-50%, -50%)",
          width: "18px", height: "7px",
          background: `linear-gradient(180deg, ${color}bb 0%, ${color}66 100%)`,
          border: `1px solid ${color}99`, borderRadius: "3px",
          boxShadow: active ? `0 0 8px ${color}88` : `0 0 3px ${color}33`,
          transition: "box-shadow 0.12s",
        }} />
      </div>
      <div style={{
        fontSize: "0.48rem", color: active ? color : `${color}88`,
        fontFamily: "monospace", letterSpacing: "1px", transition: "color 0.12s",
      }}>
        {label}
      </div>
      <input
        type="range" aria-label={ariaLabel}
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
      />
    </div>
  );
}

const LABEL: React.CSSProperties = {
  fontSize: "0.5rem", color: "#3a5060", fontFamily: "monospace", letterSpacing: "2px",
};

const VDivider = () => (
  <div style={{ width: "1px", alignSelf: "stretch", background: "#111d28", margin: "0 2px" }} />
);

export function BpmEqPanel({ bpm, onBpmChange, audioFx, onAudioFxChange, onTap }: Props) {
  const [bpmActive, setBpmActive] = useState(false);
  const [bpmHovered, setBpmHovered] = useState(false);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const pct = (bpm - 40) / (240 - 40);
  const rot = pct * 270 - 135;
  const rad = ((rot - 90) * Math.PI) / 180;
  const cx = 20, cy = 20, r = 14;
  const ix = cx + r * Math.cos(rad);
  const iy = cy + r * Math.sin(rad);
  const startRad = ((-135 - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(startRad);
  const sy = cy + r * Math.sin(startRad);
  const largeArc = rot > 0 ? 1 : 0;
  const arcPath = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ix} ${iy}`;

  const handleBpmPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setBpmActive(true);
  };
  const handleBpmPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.buttons) return;
    onBpmChange(Math.round(Math.max(40, Math.min(240, bpmRef.current - e.movementY * (200 / 150)))));
  };
  const handleBpmPointerUp = () => setBpmActive(false);

  const bpmShadow = bpmActive
    ? "drop-shadow(0 0 5px #fc9c)"
    : bpmHovered ? "drop-shadow(0 0 3px #fc955)" : "none";

  return (
    <div style={{
      display: "flex", flexDirection: "row",
      alignItems: "center",
      padding: "6px 12px",
      gap: "12px",
      background: "#080b10",
      borderLeft: "1px solid #1a2230",
      flexShrink: 0,
      height: "100%",
    }}>
      {/* BPM */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
        <div style={LABEL}>BPM</div>
        <svg
          width="40" height="40" viewBox="0 0 40 40"
          style={{ cursor: bpmActive ? "grabbing" : "grab", userSelect: "none", filter: bpmShadow, transition: "filter 0.15s" }}
          onPointerDown={handleBpmPointerDown}
          onPointerMove={handleBpmPointerMove}
          onPointerUp={handleBpmPointerUp}
          onPointerCancel={handleBpmPointerUp}
          onMouseEnter={() => setBpmHovered(true)}
          onMouseLeave={() => setBpmHovered(false)}
        >
          <circle cx={cx} cy={cy} r="18" fill="#070910" stroke="#16202e" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0e1622" strokeWidth="2.5" />
          <path d={arcPath} fill="none" stroke="#fc9" strokeWidth="2.5" strokeLinecap="round" opacity={bpmActive ? 1 : 0.85} />
          <defs>
            <radialGradient id="bpm-kg" cx="38%" cy="32%">
              <stop offset="0%" stopColor="#28334a" />
              <stop offset="100%" stopColor="#080a12" />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r="8" fill="url(#bpm-kg)" stroke="#18222e" strokeWidth="1" />
          <line
            x1={cx + 3 * Math.cos(rad)} y1={cy + 3 * Math.sin(rad)}
            x2={ix} y2={iy}
            stroke="#fc9" strokeWidth="2.5" strokeLinecap="round"
          />
        </svg>
        <div style={{ fontSize: "0.82rem", color: bpmActive ? "#fc9" : "#c8a060", fontFamily: "monospace", transition: "color 0.15s" }}>
          {bpm}
        </div>
        {onTap && (
          <button
            onClick={onTap}
            style={{
              background: "transparent",
              border: "1px solid #2a3a4a",
              borderRadius: "3px",
              padding: "2px 6px",
              color: "#3a5060",
              fontFamily: "monospace",
              fontSize: "0.48rem",
              letterSpacing: "1px",
              cursor: "pointer",
            }}
          >
            TAP
          </button>
        )}
        <input
          type="range" aria-label="bpm"
          min={40} max={240} step={1} value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
        />
      </div>

      <VDivider />

      {/* EQ */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        <div style={LABEL}>EQ</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          {(["low", "mid", "high"] as const).map((band) => (
            <VertFader
              key={band}
              value={audioFx[band]}
              min={-12} max={12} step={0.5}
              color={EQ_COLORS[band]}
              label={band.toUpperCase()}
              ariaLabel={band}
              onChange={(v) => onAudioFxChange(band, v)}
            />
          ))}
        </div>
      </div>

      <VDivider />

      {/* FX */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        <div style={LABEL}>FX</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          {FX_PARAMS.map(({ param, label, min, max, step }) => (
            <VertFader
              key={param}
              value={audioFx[param] as number}
              min={min} max={max} step={step}
              color={FX_COLORS[param]}
              label={label}
              ariaLabel={label.toLowerCase()}
              onChange={(v) => onAudioFxChange(param, v)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
