import { useRef, useState } from "react";
import type { Preset } from "../types";

const SLOT_COLORS = ["#00d4aa", "#4a9eff", "#c084fc", "#f59e0b", "#f87171", "#34d399", "#fb923c", "#a78bfa"];

interface Props {
  presets: Preset[];
  activeSlot: number | null;
  onSave: (slot: number) => void;
  onLoad: (slot: number) => void;
  onSetActive: (slot: number | null) => void;
  onClear: (slot: number) => void;
  onRename: (slot: number, name: string) => void;
  onColor: (slot: number, color: string) => void;
  queuedSlot?: number | null;
  onQueue?: (slot: number | null) => void;
}

function SlotTile({
  preset, index, isActive, isQueued, onLoad, onSetActive, onSave, onClear, onRename, onColor, onQueue,
}: {
  preset: Preset; index: number; isActive: boolean; isQueued: boolean;
  onLoad: () => void; onSetActive: () => void; onSave: () => void;
  onClear: () => void; onRename: (name: string) => void;
  onColor: (color: string) => void; onQueue?: (q: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accentColor = preset.color ?? (isActive ? "#00d4aa" : preset.code ? "#4abf7a" : "#2a3a4a");
  const bg = isActive ? "#061412" : preset.code ? "#0a1810" : "#080b10";
  const border = isQueued ? "#f59e0b" : isActive ? "#00d4aa" : preset.code ? "#2a6040" : "#1a2230";

  const handleClick = () => {
    onSetActive();
    if (preset.code !== null) onLoad();
  };

  const handleDoubleClick = () => {
    if (!preset.code) return;
    setEditing(true);
    setEditValue(preset.name ?? "");
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editValue.trim()) onRename(editValue.trim());
    setEditing(false);
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        position: "relative",
        minWidth: "72px", height: "68px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "6px",
        padding: "6px 8px",
        cursor: "pointer",
        flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "border-color 0.15s",
        boxShadow: isActive ? `0 0 8px ${accentColor}33` : "none",
        animation: isQueued ? "slot-pulse 1s ease-in-out infinite" : "none",
      }}
    >
      {/* Slot number + color dot */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.55rem", color: "#3a5060", fontFamily: "monospace" }}>{index + 1}</span>
        {preset.code && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(p => !p); }}
            style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: preset.color ?? accentColor,
              cursor: "pointer",
            }}
          />
        )}
      </div>

      {/* Color picker */}
      {showColorPicker && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "22px", right: "2px", zIndex: 100,
            background: "#0d1520", border: "1px solid #2a3a4a",
            borderRadius: "6px", padding: "6px",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px",
          }}
        >
          {SLOT_COLORS.map(c => (
            <div
              key={c}
              onClick={() => { onColor(c); setShowColorPicker(false); }}
              style={{
                width: "14px", height: "14px", borderRadius: "3px",
                background: c, cursor: "pointer",
                border: preset.color === c ? "2px solid #fff" : "1px solid transparent",
              }}
            />
          ))}
        </div>
      )}

      {/* Name */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "transparent", border: "none", borderBottom: "1px solid #00d4aa",
            color: "#c8e6d8", fontFamily: "monospace", fontSize: "0.68rem",
            outline: "none", width: "100%",
          }}
        />
      ) : (
        <div style={{
          fontSize: "0.68rem", color: preset.code ? accentColor : "#2a3a4a",
          fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {preset.name ?? (preset.code ? `P${index + 1}` : "—")}
        </div>
      )}

      {/* BPM badge + Queue button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {preset.code && (
          <span style={{ fontSize: "0.5rem", color: "#3a5060", fontFamily: "monospace" }}>
            {preset.bpm}
          </span>
        )}
        {preset.code && onQueue && (
          <button
            onClick={(e) => { e.stopPropagation(); onQueue(!isQueued); }}
            title="Queue for next cycle"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: isQueued ? "#f59e0b" : "#2a3a4a",
              fontSize: "0.6rem", padding: "0", lineHeight: 1,
            }}
          >
            ⏭
          </button>
        )}
      </div>
    </div>
  );
}

export function PresetDrawer({
  presets, activeSlot, onSave, onLoad, onSetActive,
  onClear, onRename, onColor, queuedSlot = null, onQueue,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "4px 8px", borderBottom: "1px solid #0d1520",
          background: "#04060a", flexShrink: 0,
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: open ? "#0a1a10" : "transparent",
            border: `1px solid ${open ? "#1a4a2a" : "#1a2230"}`,
            borderRadius: "4px", padding: "3px 10px",
            color: open ? "#00d4aa" : "#3a5060",
            fontFamily: "monospace", fontSize: "0.6rem",
            letterSpacing: "1px", cursor: "pointer",
          }}
        >
          ◈ PRESETS
        </button>

        {/* Active slot indicator + save */}
        {activeSlot !== null && (
          <>
            <span style={{ fontSize: "0.55rem", color: "#00d4aa66", fontFamily: "monospace" }}>
              [{presets[activeSlot]?.name ?? `P${activeSlot + 1}`}]
            </span>
            <button
              onClick={() => onSave(activeSlot)}
              style={{
                background: "transparent",
                border: "1px solid #2a6040",
                borderRadius: "4px", padding: "3px 10px",
                color: "#4abf7a",
                fontFamily: "monospace", fontSize: "0.6rem",
                letterSpacing: "1px", cursor: "pointer",
              }}
            >
              ⊡ SAVE
            </button>
          </>
        )}

        {/* Queued indicator */}
        {queuedSlot !== null && (
          <span style={{ fontSize: "0.55rem", color: "#f59e0b", fontFamily: "monospace" }}>
            ⏭ next: {presets[queuedSlot]?.name ?? `P${queuedSlot + 1}`}
          </span>
        )}
      </div>

      {/* Drawer */}
      {open && (
        <div style={{
          display: "flex", flexDirection: "row", overflowX: "auto",
          gap: "6px", padding: "8px 10px",
          background: "#03050a",
          borderBottom: "1px solid #0d1520",
          flexShrink: 0,
        }}>
          {presets.map((preset, i) => (
            <SlotTile
              key={i}
              preset={preset}
              index={i}
              isActive={activeSlot === i}
              isQueued={queuedSlot === i}
              onLoad={() => onLoad(i)}
              onSetActive={() => onSetActive(i)}
              onSave={() => onSave(i)}
              onClear={() => onClear(i)}
              onRename={(name) => onRename(i, name)}
              onColor={(color) => onColor(i, color)}
              onQueue={onQueue ? (q) => onQueue(q ? i : null) : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
