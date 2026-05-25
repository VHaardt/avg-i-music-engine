# Sprint 2 — Preset UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire `window.prompt()` con un PresetDrawer professionale — tile colorabili, rename inline, badge BPM, context menu, drag-to-reorder.

**Architecture:** `Preset` type esteso con `color` e `createdAt`. `usePresets` hook aggiornato con migrazione retrocompatibile. Nuovo `PresetDrawer` slide-in sostituisce `PresetStrip` in `App.tsx`. BPM badge estratto da `setcpm()` nel codice salvato. Rename inline con doppio-click, nessun `window.prompt()`.

**Tech Stack:** React 18, TypeScript, CSS-in-JS inline styles, localStorage

---

## File Map

```
frontend/src/
  types.ts                              MOD  — aggiunge color, createdAt a Preset
  hooks/usePresets.ts                   MOD  — migrazione dati + nuovo colorPreset()
  components/PresetDrawer.tsx           NEW  — drawer slide-in con tutti i controlli
  components/PresetStrip.tsx            KEEP — non eliminare (retrocompatibilità test)
  App.tsx                               MOD  — swap PresetStrip → PresetDrawer
  index.css                             MOD  — aggiunge animazione drawer

tests/
  frontend/src/components/PresetDrawer.test.tsx   NEW
```

---

## Task 1: Estendi il tipo Preset

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/hooks/usePresets.ts`

- [ ] **Step 1.1: Aggiorna `types.ts`**

Sostituisci l'interfaccia `Preset` esistente:

```typescript
export interface Preset {
  name: string | null;
  code: string | null;
  bpm: number;
  color: string | null;   // ← nuovo
  createdAt: number | null; // ← nuovo (unix timestamp ms)
}
```

- [ ] **Step 1.2: Aggiorna `emptyPreset` in `usePresets.ts`**

```typescript
const emptyPreset = (): Preset => ({ name: null, code: null, bpm: 120, color: null, createdAt: null });
```

Aggiungi anche `colorPreset` nel hook (dopo `renamePreset`):

```typescript
const colorPreset = (slot: number, color: string) => {
  setPresets(prev => {
    const next = prev.map((p, i) => i === slot ? { ...p, color } : p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
};
```

Aggiorna `savePreset` per settare `createdAt` se è il primo salvataggio:

```typescript
const savePreset = (slot: number, code: string, bpm: number) => {
  setPresets(prev => {
    const existing = prev[slot];
    const next = prev.map((p, i) =>
      i === slot
        ? { ...p, code, bpm, createdAt: p.createdAt ?? Date.now() }
        : p
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
};
```

Aggiungi `colorPreset` al return:

```typescript
return { presets, activeSlot, savePreset, loadPreset, clearPreset, setActiveSlot, renamePreset, colorPreset };
```

- [ ] **Step 1.3: Verifica compilazione TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 1.4: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/types.ts frontend/src/hooks/usePresets.ts
git commit -m "feat: extend Preset type with color and createdAt fields"
```

---

## Task 2: PresetDrawer component

**Files:**
- Create: `frontend/src/components/PresetDrawer.tsx`
- Create: `frontend/src/components/PresetDrawer.test.tsx`

- [ ] **Step 2.1: Scrivi i test**

```typescript
// frontend/src/components/PresetDrawer.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PresetDrawer } from "./PresetDrawer";
import type { Preset } from "../types";

const emptyPreset = (): Preset => ({ name: null, code: null, bpm: 120, color: null, createdAt: null });

const makePresets = (count = 16): Preset[] =>
  Array.from({ length: count }, emptyPreset);

describe("PresetDrawer", () => {
  it("renders all 16 slot tiles", () => {
    render(
      <PresetDrawer
        presets={makePresets()}
        activeSlot={null}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    // 16 slot numbers visible
    for (let i = 1; i <= 16; i++) {
      expect(screen.getAllByText(String(i)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("calls onLoad when clicking a filled slot", () => {
    const presets = makePresets();
    presets[2] = { name: "Bass", code: "note('c3')", bpm: 120, color: null, createdAt: Date.now() };
    const onLoad = vi.fn();
    render(
      <PresetDrawer
        presets={presets} activeSlot={null}
        onSave={vi.fn()} onLoad={onLoad} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Bass"));
    expect(onLoad).toHaveBeenCalledWith(2);
  });

  it("shows BPM badge on filled slots", () => {
    const presets = makePresets();
    presets[0] = { name: "Kick", code: "setcpm(30)\nsound('bd')", bpm: 120, color: null, createdAt: Date.now() };
    render(
      <PresetDrawer
        presets={presets} activeSlot={0}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("calls onRename after inline edit", () => {
    const presets = makePresets();
    presets[0] = { name: "Old Name", code: "note('c3')", bpm: 120, color: null, createdAt: Date.now() };
    const onRename = vi.fn();
    render(
      <PresetDrawer
        presets={presets} activeSlot={0}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={onRename} onColor={vi.fn()}
      />
    );
    fireEvent.doubleClick(screen.getByText("Old Name"));
    const input = screen.getByDisplayValue("Old Name");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith(0, "New Name");
  });
});
```

- [ ] **Step 2.2: Esegui i test — devono FALLIRE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose PresetDrawer
```
Expected: `Cannot find module './PresetDrawer'`

- [ ] **Step 2.3: Implementa `PresetDrawer.tsx`**

```typescript
// frontend/src/components/PresetDrawer.tsx
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

      {/* Context menu (right click) */}
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

        {/* Active slot indicator */}
        {activeSlot !== null && (
          <span style={{ fontSize: "0.55rem", color: "#00d4aa66", fontFamily: "monospace" }}>
            [{presets[activeSlot]?.name ?? `P${activeSlot + 1}`}]
          </span>
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
```

- [ ] **Step 2.4: Aggiungi animazione slot-pulse a `index.css`**

Aggiungi in fondo a `frontend/src/index.css`:

```css
@keyframes slot-pulse {
  0%, 100% { border-color: #f59e0b; box-shadow: 0 0 6px #f59e0b44; }
  50% { border-color: #f59e0b88; box-shadow: none; }
}
```

- [ ] **Step 2.5: Esegui i test — devono PASSARE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose PresetDrawer
```
Expected: `4 passed`

- [ ] **Step 2.6: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/components/PresetDrawer.tsx frontend/src/components/PresetDrawer.test.tsx frontend/src/index.css
git commit -m "feat: add PresetDrawer with inline rename, color picker, BPM badge, Queue button"
```

---

## Task 3: Integra PresetDrawer in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 3.1: Sostituisci PresetStrip con PresetDrawer in `App.tsx`**

Aggiungi import:
```typescript
import { PresetDrawer } from "./components/PresetDrawer";
```

Aggiungi `colorPreset` alla destructuring di `usePresets`:
```typescript
const { presets, activeSlot, savePreset, loadPreset, clearPreset, setActiveSlot, renamePreset, colorPreset } = usePresets();
```

Trova il blocco `<PresetStrip .../>` nel JSX e sostituiscilo con:

```tsx
<PresetDrawer
  presets={presets}
  activeSlot={activeSlot}
  onSave={handlePresetSave}
  onLoad={handlePresetLoad}
  onSetActive={setActiveSlot}
  onClear={clearPreset}
  onRename={renamePreset}
  onColor={colorPreset}
/>
```

- [ ] **Step 3.2: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 3.3: Esegui test suite completa**

```bash
npm test -- --reporter=verbose
```
Expected: tutti i test passano.

- [ ] **Step 3.4: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/App.tsx
git commit -m "feat: replace PresetStrip with PresetDrawer in App — no more window.prompt"
```
