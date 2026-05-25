# Sprint 4 — Scene System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un pattern attivo + uno slot in coda che swappa automaticamente al prossimo ciclo Strudel — come Ableton's Launch-on-Cycle.

**Architecture:** Nuovo hook `useSceneQueue` gestisce `queuedSlot`. Il ciclo viene misurato tramite `BPM`: interval = `(4 * 60 * 1000) / bpm` ms. Quando il player è in play e `queuedSlot !== null`, un `setInterval` attiva lo swap al prossimo multiple di `cycleLength` dall'avvio del pattern. `PresetDrawer` mostra il ⏭ Queue button (già presente dallo Sprint 2, da attivare passando `onQueue`). `App.tsx` coordina tutto. Il payload WebSocket include `queued_slot` per dare contesto al backend.

**Prerequisito:** Sprint 2 completato (PresetDrawer con `queuedSlot` + `onQueue` props).

**Tech Stack:** React 18, TypeScript

---

## File Map

```
frontend/src/
  hooks/useSceneQueue.ts               NEW  — logica queue + timer ciclo
  components/StrudelPlayer.tsx         MOD  — espone onCycleEnd callback
  App.tsx                              MOD  — integra useSceneQueue, passa onQueue a PresetDrawer
  hooks/useWebSocket.ts                MOD  — aggiunge queued_slot a user_message payload

tests/
  frontend/src/hooks/useSceneQueue.test.ts   NEW
```

---

## Task 1: Hook `useSceneQueue`

**Files:**
- Create: `frontend/src/hooks/useSceneQueue.ts`
- Create: `frontend/src/hooks/useSceneQueue.test.ts`

- [ ] **Step 1.1: Scrivi i test**

```typescript
// frontend/src/hooks/useSceneQueue.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSceneQueue } from "./useSceneQueue";

describe("useSceneQueue", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("starts with no queued slot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    expect(result.current.queuedSlot).toBeNull();
  });

  it("queueScene sets queuedSlot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(3); });
    expect(result.current.queuedSlot).toBe(3);
  });

  it("cancelQueue clears queuedSlot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(3); });
    act(() => { result.current.cancelQueue(); });
    expect(result.current.queuedSlot).toBeNull();
  });

  it("queueing second slot replaces first", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(2); });
    act(() => { result.current.queueScene(5); });
    expect(result.current.queuedSlot).toBe(5);
  });

  it("fires onSwap after one cycle when playing", () => {
    const onSwap = vi.fn();
    const { result } = renderHook(() =>
      useSceneQueue({ bpm: 120, isPlaying: true, onSwap })
    );
    // At 120 BPM: cycle = 4 * 60000 / 120 = 2000ms
    act(() => { result.current.queueScene(1); });
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onSwap).toHaveBeenCalledWith(1);
    expect(result.current.queuedSlot).toBeNull();
  });
});
```

- [ ] **Step 1.2: Esegui i test — devono FALLIRE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose useSceneQueue
```
Expected: `Cannot find module './useSceneQueue'`

- [ ] **Step 1.3: Implementa `useSceneQueue.ts`**

```typescript
// frontend/src/hooks/useSceneQueue.ts
import { useCallback, useEffect, useRef, useState } from "react";

interface UseSceneQueueOptions {
  bpm: number;
  isPlaying: boolean;
  onSwap?: (slot: number) => void;
}

export interface UseSceneQueueReturn {
  queuedSlot: number | null;
  queueScene: (slot: number) => void;
  cancelQueue: () => void;
}

export function useSceneQueue({ bpm, isPlaying, onSwap }: UseSceneQueueOptions): UseSceneQueueReturn {
  const [queuedSlot, setQueuedSlot] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const queueScene = useCallback((slot: number) => {
    setQueuedSlot(slot);
  }, []);

  const cancelQueue = useCallback(() => {
    clearTimer();
    setQueuedSlot(null);
  }, []);

  useEffect(() => {
    if (queuedSlot === null || !isPlaying) {
      clearTimer();
      return;
    }

    const cycleLengthMs = (4 * 60 * 1000) / bpm;
    clearTimer();
    timerRef.current = setInterval(() => {
      const slot = queuedSlot;
      clearTimer();
      setQueuedSlot(null);
      onSwapRef.current?.(slot);
    }, cycleLengthMs);

    return clearTimer;
  }, [queuedSlot, isPlaying, bpm]);

  return { queuedSlot, queueScene, cancelQueue };
}
```

- [ ] **Step 1.4: Esegui i test — devono PASSARE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose useSceneQueue
```
Expected: `5 passed`

- [ ] **Step 1.5: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/hooks/useSceneQueue.ts frontend/src/hooks/useSceneQueue.test.ts
git commit -m "feat: add useSceneQueue hook — queue-on-cycle scene switching"
```

---

## Task 2: Aggiorna WsOutMessage + useWebSocket

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 2.1: Aggiungi `queued_slot` al tipo `WsOutMessage`**

In `frontend/src/types.ts`, modifica il tipo `WsOutMessage`:

```typescript
export type WsOutMessage =
  | { type: "user_message"; message: string; current_code: string; manually_edited: boolean; queued_slot: number | null }
  | { type: "knob_change"; knob_name: string; value: number }
  | { type: "runtime_error"; message: string };
```

- [ ] **Step 2.2: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Se ci sono errori sul sito di chiamata (`App.tsx`), aggiorna la chiamata `sendMessage` in `handleSend` per aggiungere `queued_slot: null` o `queued_slot: queuedSlot` (dopo Task 3).

- [ ] **Step 2.3: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/types.ts
git commit -m "feat: add queued_slot to user_message WebSocket payload"
```

---

## Task 3: Integra in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 3.1: Aggiungi `useSceneQueue` in `App.tsx`**

Aggiungi import:
```typescript
import { useSceneQueue } from "./hooks/useSceneQueue";
```

Aggiungi `isPlaying` state per StrudelPlayer (se non già presente, aggiungilo come prop callback):

```typescript
const [isPlaying, setIsPlaying] = useState(false);
```

Aggiungi `useSceneQueue` dopo gli altri hook:

```typescript
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
```

- [ ] **Step 3.2: Aggiungi `onQueue` a PresetDrawer nel JSX**

Trova `<PresetDrawer ... />` nel JSX e aggiungi le prop:

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
  queuedSlot={queuedSlot}
  onQueue={(slot) => slot !== null ? queueScene(slot) : cancelQueue()}
/>
```

- [ ] **Step 3.3: Passa `queued_slot` nel payload WebSocket**

Trova `handleSend` in `App.tsx` e aggiorna la chiamata `sendMessage`:

```typescript
sendMessage({
  type: "user_message",
  message: text,
  current_code: code,
  manually_edited: manuallyEdited,
  queued_slot: queuedSlot,   // ← aggiunto
});
```

- [ ] **Step 3.4: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 3.5: Esegui test suite**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose
```
Expected: tutti i test passano.

- [ ] **Step 3.6: Commit finale Sprint 4**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/App.tsx
git commit -m "feat: integrate scene queue into App — queue-on-cycle with PresetDrawer"
```
