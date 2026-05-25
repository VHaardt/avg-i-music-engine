import type React from "react";
import type { Preset } from "../types";

interface Props {
  presets: Preset[];
  activeSlot: number | null;
  onSave: (slot: number) => void;
  onLoad: (slot: number) => void;
  onSetActive: (slot: number | null) => void;
  onClear?: (slot: number) => void;
  onRename?: (slot: number, name: string) => void;
}

function slotColor(preset: Preset, isActive: boolean): { border: string; color: string; background: string } {
  if (isActive) return { border: "#00d4aa", color: "#00d4aa", background: "#061412" };
  if (preset.code !== null) return { border: "#2a6040", color: "#4abf7a", background: "#0a1810" };
  return { border: "#2a3a4a", color: "#3a5060", background: "#0c1018" };
}

export function PresetStrip({ presets, activeSlot, onSave, onLoad, onSetActive, onClear, onRename }: Props) {
  const handleClick = (idx: number) => {
    onSetActive(idx);
    if (presets[idx].code !== null) onLoad(idx);
  };

  const handleContextMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    const action = window.prompt(`Preset ${idx + 1}: rename (type name) or type "clear" to delete`, presets[idx].name ?? "");
    if (action === null) return;
    if (action.toLowerCase() === "clear") { onClear?.(idx); return; }
    if (action.trim()) onRename?.(idx, action.trim());
  };

  const renderSlots = (start: number, end: number) =>
    presets.slice(start, end).map((preset, offset) => {
      const idx = start + offset;
      const { border, color, background } = slotColor(preset, idx === activeSlot);
      return (
        <button
          key={idx}
          onClick={() => handleClick(idx)}
          onContextMenu={(e) => handleContextMenu(e, idx)}
          title={preset.name ?? `Preset ${idx + 1}`}
          style={{
            width: "22px", height: "16px", border: `1px solid ${border}`,
            borderRadius: "2px", background, color,
            fontSize: "0.5rem", fontFamily: "monospace",
            cursor: "pointer", padding: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          {idx + 1}
        </button>
      );
    });

  return (
    <div style={{
      height: "28px", flexShrink: 0,
      display: "flex", alignItems: "center",
      background: "#060810", borderBottom: "1px solid #1a2230",
      padding: "0 10px", gap: "3px",
    }}>
      <span style={{ fontSize: "0.48rem", color: "#3a5060", fontFamily: "monospace", letterSpacing: "2px", marginRight: "4px", flexShrink: 0 }}>
        PRESETS
      </span>
      {renderSlots(0, 8)}
      <div style={{ width: "1px", height: "16px", background: "#1a2a3a", margin: "0 3px", flexShrink: 0 }} />
      {renderSlots(8, 16)}
      <div style={{ marginLeft: "auto", display: "flex", gap: "4px", flexShrink: 0 }}>
        <button
          onClick={() => activeSlot !== null && onSave(activeSlot)}
          disabled={activeSlot === null}
          style={{
            border: `1px solid ${activeSlot !== null ? "#2a6040" : "#1a2a1a"}`,
            padding: "1px 7px", borderRadius: "3px",
            color: activeSlot !== null ? "#4abf7a" : "#2a4a2a",
            background: "transparent", fontSize: "0.48rem",
            fontFamily: "monospace",
            cursor: activeSlot !== null ? "pointer" : "default",
            letterSpacing: "1px",
          }}
        >
          ⊡ SAVE
        </button>
      </div>
    </div>
  );
}
