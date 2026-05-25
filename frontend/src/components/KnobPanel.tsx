import { useRef, useState } from "react";
import type { Knob } from "../types";

interface Props {
  knobs: Knob[];
  onKnobChange: (strudel_param: string, value: number) => void;
  singleRow?: boolean;
}

function HardwareKnob({ knob, onKnobChange }: { knob: Knob; onKnobChange: (p: string, v: number) => void }) {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const valueRef = useRef(knob.value);
  valueRef.current = knob.value;

  const pct = (knob.value - knob.min) / (knob.max - knob.min);
  const rot = pct * 270 - 135;
  const rad = ((rot - 90) * Math.PI) / 180;
  const cx = 26, cy = 26, r = 18;
  const ix = cx + r * Math.cos(rad);
  const iy = cy + r * Math.sin(rad);
  const startRad = ((-135 - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(startRad);
  const sy = cy + r * Math.sin(startRad);
  const largeArc = pct * 270 > 180 ? 1 : 0;
  const arcPath = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ix} ${iy}`;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.buttons) return;
    const range = knob.max - knob.min;
    const newVal = Math.max(knob.min, Math.min(knob.max,
      valueRef.current - e.movementY * (range / 150)
    ));
    onKnobChange(knob.strudel_param, newVal);
  };

  const handlePointerUp = () => setActive(false);

  const dropShadow = active
    ? `drop-shadow(0 0 7px ${knob.color}cc)`
    : hovered
    ? `drop-shadow(0 0 4px ${knob.color}55)`
    : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", position: "relative" }}>
      {/* Label */}
      <div style={{
        fontSize: "0.48rem", letterSpacing: "1px", fontFamily: "monospace", textAlign: "center",
        color: active ? knob.color : hovered ? "#6a8090" : "#3a5060",
        transition: "color 0.15s",
      }}>
        {knob.name}
      </div>

      {/* Rotary knob */}
      <svg
        width="52" height="52" viewBox="0 0 52 52"
        style={{
          cursor: active ? "grabbing" : "grab",
          filter: dropShadow,
          transition: "filter 0.15s",
          userSelect: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Outer bezel */}
        <circle cx={cx} cy={cy} r="24" fill="#070910" stroke="#16202e" strokeWidth="1" />
        {/* Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0e1622" strokeWidth="3.5" />
        {/* Filled arc */}
        <path d={arcPath} fill="none" stroke={knob.color} strokeWidth="3.5" strokeLinecap="round" opacity={active ? 1 : 0.8} />
        {/* Knob body gradient */}
        <defs>
          <radialGradient id={`kg-${knob.strudel_param}`} cx="38%" cy="32%">
            <stop offset="0%" stopColor="#28334a" />
            <stop offset="100%" stopColor="#080a12" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="13" fill={`url(#kg-${knob.strudel_param})`} stroke="#18222e" strokeWidth="1" />
        {/* Indicator line */}
        <line
          x1={cx + 4 * Math.cos(rad)} y1={cy + 4 * Math.sin(rad)}
          x2={ix} y2={iy}
          stroke={knob.color} strokeWidth="2.5" strokeLinecap="round"
          opacity={active ? 1 : 0.9}
        />
      </svg>

      {/* Value */}
      <div style={{
        fontSize: "0.54rem", fontFamily: "monospace", letterSpacing: "0.5px",
        color: active ? knob.color : "#2e4858",
        transition: "color 0.15s",
      }}>
        {Number(knob.value).toFixed(1)}
      </div>

      {/* Hidden native input — keeps test role queries and a11y working */}
      <input
        type="range"
        role="slider"
        aria-label={knob.name}
        min={knob.min}
        max={knob.max}
        step={(knob.max - knob.min) / 100}
        value={knob.value}
        onChange={(e) => onKnobChange(knob.strudel_param, parseFloat(e.target.value))}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
      />
    </div>
  );
}

export function KnobPanel({ knobs, onKnobChange, singleRow = false }: Props) {
  if (knobs.length === 0) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#3a4a5a", fontSize: "0.7rem", textAlign: "center",
        fontFamily: "monospace", padding: "16px", letterSpacing: "1px",
      }}>
        nessun knob
      </div>
    );
  }

  if (singleRow) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "row",
        gap: "8px",
        padding: "6px 10px",
        alignItems: "center",
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
      }}>
        {knobs.map((knob) => (
          <div key={knob.strudel_param} style={{ flexShrink: 0 }}>
            <HardwareKnob knob={knob} onKnobChange={onKnobChange} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
      gap: "10px",
      padding: "10px 12px",
      alignContent: "start",
      overflowY: "auto",
      height: "100%",
    }}>
      {knobs.map((knob) => (
        <HardwareKnob key={knob.strudel_param} knob={knob} onKnobChange={onKnobChange} />
      ))}
    </div>
  );
}
