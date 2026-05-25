# Sprint 5 — Live Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MIDI clock output verso synth/DAW, modalità performance fullscreen, tap tempo, beat indicator visivo.

**Architecture:** `MidiOutputService` in background thread Python invia MIDI Clock 24ppqn + Start/Stop via `python-rtmidi`. FastAPI espone `GET /midi/ports` e gestisce `midi_config` WebSocket message. Frontend: `useTapTempo` hook per calcolo BPM, `BeatIndicator` agganciato all'evento `onBeat` del repl Strudel, classe CSS `.performance-mode` su `<body>` per fullscreen. `useMidi` hook gestisce configurazione porta.

**Tech Stack:** Python `python-rtmidi`, React 18, TypeScript, CSS

---

## File Map

```
backend/
  midi_service.py                       NEW  — MidiOutputService (thread + rtmidi)
  main.py                               MOD  — /midi/ports endpoint + midi_config handler
  requirements.txt                      MOD  — aggiunge python-rtmidi

frontend/src/
  hooks/useTapTempo.ts                  NEW  — media mobile ultimi 4 tap
  hooks/useMidi.ts                      NEW  — midi_config/status WebSocket
  components/BeatIndicator.tsx          NEW  — dot pulsante a tempo
  components/BpmEqPanel.tsx             MOD  — aggiunge TAP button
  App.tsx                               MOD  — performance mode + BeatIndicator + MIDI settings
  index.css                             MOD  — .performance-mode styles + TAP button

tests/
  test_midi_service.py                  NEW
  frontend/src/hooks/useTapTempo.test.ts  NEW
```

---

## Task 1: MidiOutputService backend

**Files:**
- Create: `backend/midi_service.py`
- Modify: `backend/requirements.txt`
- Create: `tests/test_midi_service.py`

- [ ] **Step 1.1: Aggiungi `python-rtmidi` a requirements.txt**

```
python-rtmidi
```

Installa:
```bash
cd /Users/vitto/Desktop/music && source backend/.venv/bin/activate && pip install python-rtmidi
```

- [ ] **Step 1.2: Scrivi i test**

```python
# tests/test_midi_service.py
from unittest.mock import MagicMock, patch


def test_get_ports_returns_list(mocker):
    from backend.midi_service import MidiOutputService

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1", "IAC Bus 2"]

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        ports = svc.get_ports()

    assert isinstance(ports, list)
    assert "IAC Bus 1" in ports


def test_service_starts_and_stops(mocker):
    from backend.midi_service import MidiOutputService
    import time

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1"]
    mock_midiout.is_port_open.return_value = True

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        svc.start(port_index=0, bpm=120.0)
        time.sleep(0.1)
        svc.stop()

    assert mock_midiout.send_message.called


def test_set_bpm_updates_interval(mocker):
    from backend.midi_service import MidiOutputService

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1"]
    mock_midiout.is_port_open.return_value = True

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        svc.start(port_index=0, bpm=120.0)
        svc.set_bpm(140.0)
        assert abs(svc._interval - 60.0 / (140.0 * 24)) < 1e-9
        svc.stop()
```

- [ ] **Step 1.3: Esegui i test — devono FALLIRE**

```bash
pytest tests/test_midi_service.py -v
```
Expected: `ModuleNotFoundError: No module named 'backend.midi_service'`

- [ ] **Step 1.4: Implementa `backend/midi_service.py`**

```python
# backend/midi_service.py
import threading
import time
from typing import Optional

import rtmidi

from backend.logger import logger

MIDI_CLOCK = 0xF8
MIDI_START = 0xFA
MIDI_STOP = 0xFC


class MidiOutputService:
    def __init__(self) -> None:
        self._midiout: Optional[rtmidi.MidiOut] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._bpm = 120.0
        self._interval = 60.0 / (120.0 * 24)
        self._lock = threading.Lock()

    def get_ports(self) -> list[str]:
        tmp = rtmidi.MidiOut()
        return tmp.get_ports()

    def start(self, port_index: int, bpm: float) -> None:
        self.stop()
        self._bpm = bpm
        self._interval = 60.0 / (bpm * 24)
        self._midiout = rtmidi.MidiOut()
        ports = self._midiout.get_ports()
        if not ports:
            logger.warning("[midi] no MIDI output ports available")
            return
        idx = min(port_index, len(ports) - 1)
        self._midiout.open_port(idx)
        self._midiout.send_message([MIDI_START])
        self._running = True
        self._thread = threading.Thread(target=self._clock_loop, daemon=True)
        self._thread.start()
        logger.info(f"[midi] started on port {ports[idx]!r} @ {bpm} BPM")

    def set_bpm(self, bpm: float) -> None:
        with self._lock:
            self._bpm = bpm
            self._interval = 60.0 / (bpm * 24)

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
            self._thread = None
        if self._midiout and self._midiout.is_port_open():
            self._midiout.send_message([MIDI_STOP])
            self._midiout.close_port()
        self._midiout = None
        logger.info("[midi] stopped")

    def _clock_loop(self) -> None:
        while self._running:
            with self._lock:
                interval = self._interval
            if self._midiout and self._midiout.is_port_open():
                self._midiout.send_message([MIDI_CLOCK])
            time.sleep(interval)


_service = MidiOutputService()


def get_midi_service() -> MidiOutputService:
    return _service
```

- [ ] **Step 1.5: Esegui i test — devono PASSARE**

```bash
pytest tests/test_midi_service.py -v
```
Expected: `3 passed`

- [ ] **Step 1.6: Commit**

```bash
cd /Users/vitto/Desktop/music
git add backend/midi_service.py backend/requirements.txt tests/test_midi_service.py
git commit -m "feat: add MidiOutputService with MIDI clock 24ppqn, start/stop, set_bpm"
```

---

## Task 2: FastAPI MIDI endpoints + WebSocket handler

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 2.1: Aggiungi endpoint e handler in `main.py`**

Aggiungi import:
```python
from backend.midi_service import get_midi_service
```

Aggiungi endpoint dopo `/health`:
```python
@app.get("/midi/ports")
def midi_ports():
    return {"ports": get_midi_service().get_ports()}
```

Nel WebSocket handler, aggiungi gestione `midi_config` nel blocco `msg_type`:
```python
elif msg_type == "midi_config":
    enabled = msg.get("enabled", False)
    port = msg.get("port_index", 0)
    svc = get_midi_service()
    if enabled:
        svc.start(port_index=int(port), bpm=state.get("musical_context", {}).get("bpm", 120))
        await websocket.send_json({"type": "midi_status", "connected": True, "port": port})
    else:
        svc.stop()
        await websocket.send_json({"type": "midi_status", "connected": False, "port": ""})
    continue
```

Quando il backend aggiorna il BPM (al termine del grafo), sincronizza il MIDI service:
```python
# Dopo aver ottenuto result da GRAPH.invoke:
new_bpm = result.get("musical_context", {}).get("bpm")
if new_bpm:
    get_midi_service().set_bpm(float(new_bpm))
```

- [ ] **Step 2.2: Esegui test backend**

```bash
cd /Users/vitto/Desktop/music && source backend/.venv/bin/activate && pytest tests/ -v
```
Expected: tutti i test passano.

- [ ] **Step 2.3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add /midi/ports endpoint and midi_config WebSocket handler"
```

---

## Task 3: `useTapTempo` hook

**Files:**
- Create: `frontend/src/hooks/useTapTempo.ts`
- Create: `frontend/src/hooks/useTapTempo.test.ts`

- [ ] **Step 3.1: Scrivi i test**

```typescript
// frontend/src/hooks/useTapTempo.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTapTempo } from "./useTapTempo";

describe("useTapTempo", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("needs 3 taps to emit BPM", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    expect(onBpm).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    expect(onBpm).toHaveBeenCalled();
  });

  it("calculates ~120 BPM from 500ms intervals", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    const bpm = onBpm.mock.calls.at(-1)?.[0];
    expect(bpm).toBeGreaterThan(115);
    expect(bpm).toBeLessThan(125);
  });

  it("resets after 2s timeout", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(2100); result.current.tap(); });
    // Only 1 tap after reset — no BPM emitted
    expect(onBpm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3.2: Esegui i test — devono FALLIRE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose useTapTempo
```
Expected: `Cannot find module './useTapTempo'`

- [ ] **Step 3.3: Implementa `useTapTempo.ts`**

```typescript
// frontend/src/hooks/useTapTempo.ts
import { useCallback, useRef } from "react";

const MAX_TAPS = 4;
const RESET_TIMEOUT_MS = 2000;
const MIN_TAPS_FOR_BPM = 3;

interface UseTapTempoOptions {
  onBpm: (bpm: number) => void;
}

export function useTapTempo({ onBpm }: UseTapTempoOptions) {
  const tapsRef = useRef<number[]>([]);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tap = useCallback(() => {
    const now = performance.now();

    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => { tapsRef.current = []; }, RESET_TIMEOUT_MS);

    tapsRef.current = [...tapsRef.current.slice(-(MAX_TAPS - 1)), now];

    if (tapsRef.current.length < MIN_TAPS_FOR_BPM) return;

    const intervals: number[] = [];
    for (let i = 1; i < tapsRef.current.length; i++) {
      intervals.push(tapsRef.current[i] - tapsRef.current[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);
    onBpm(Math.max(40, Math.min(240, bpm)));
  }, [onBpm]);

  return { tap };
}
```

- [ ] **Step 3.4: Esegui i test — devono PASSARE**

```bash
npm test -- --reporter=verbose useTapTempo
```
Expected: `3 passed`

- [ ] **Step 3.5: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/hooks/useTapTempo.ts frontend/src/hooks/useTapTempo.test.ts
git commit -m "feat: add useTapTempo hook — 3-tap minimum, 4-tap moving average, 2s reset"
```

---

## Task 4: BeatIndicator + TAP button in BpmEqPanel

**Files:**
- Create: `frontend/src/components/BeatIndicator.tsx`
- Modify: `frontend/src/components/BpmEqPanel.tsx`

- [ ] **Step 4.1: Implementa `BeatIndicator.tsx`**

```typescript
// frontend/src/components/BeatIndicator.tsx
import { useEffect, useRef } from "react";

interface Props {
  isPlaying: boolean;
  bpm: number;
  large?: boolean;
}

export function BeatIndicator({ isPlaying, bpm, large = false }: Props) {
  const dotRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying) return;

    const beatMs = (60 * 1000) / bpm;

    const pulse = () => {
      const el = dotRef.current;
      if (!el) return;
      el.style.opacity = "1";
      el.style.transform = large ? "scale(1.4)" : "scale(1.3)";
      setTimeout(() => {
        if (!el) return;
        el.style.opacity = "0.3";
        el.style.transform = "scale(1)";
      }, 80);
    };

    pulse();
    timerRef.current = setInterval(pulse, beatMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, large]);

  const size = large ? 16 : 8;

  return (
    <div
      ref={dotRef}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: "#00d4aa",
        opacity: isPlaying ? 0.3 : 0.1,
        transition: "opacity 0.08s, transform 0.08s",
        flexShrink: 0,
      }}
    />
  );
}
```

- [ ] **Step 4.2: Aggiungi TAP button a `BpmEqPanel.tsx`**

Aggiungi `onTap?: () => void` all'interfaccia `Props` in `BpmEqPanel.tsx`:

```typescript
interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  audioFx: AudioFx;
  onAudioFxChange: (param: keyof AudioFx, value: number) => void;
  onTap?: () => void;  // ← aggiunto
}
```

Nel JSX, trova la sezione BPM e aggiungi il TAP button sotto il valore numerico BPM:

```tsx
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
```

Aggiorna anche la firma della funzione:
```typescript
export function BpmEqPanel({ bpm, onBpmChange, audioFx, onAudioFxChange, onTap }: Props) {
```

- [ ] **Step 4.3: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 4.4: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/components/BeatIndicator.tsx frontend/src/components/BpmEqPanel.tsx
git commit -m "feat: add BeatIndicator component and TAP tempo button to BpmEqPanel"
```

---

## Task 5: Performance Mode + wiring in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 5.1: Aggiungi `.performance-mode` CSS a `index.css`**

```css
/* Performance mode — fullscreen, hide distractions */
body.performance-mode .pm-hide {
  display: none !important;
}
body.performance-mode .pm-waveform {
  height: 60vh !important;
}
body.performance-mode .pm-beat-large {
  display: flex !important;
}
```

- [ ] **Step 5.2: Aggiungi performance mode e MIDI wiring in `App.tsx`**

Aggiungi import:
```typescript
import { useTapTempo } from "./hooks/useTapTempo";
import { BeatIndicator } from "./components/BeatIndicator";
```

Aggiungi state + hook:
```typescript
const [isPerformanceMode, setIsPerformanceMode] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);

const { tap } = useTapTempo({
  onBpm: handleBpmChange,
});
```

Aggiungi effetto per performance mode (toggles body class):
```typescript
useEffect(() => {
  if (isPerformanceMode) {
    document.body.classList.add("performance-mode");
  } else {
    document.body.classList.remove("performance-mode");
  }
  return () => document.body.classList.remove("performance-mode");
}, [isPerformanceMode]);
```

Aggiungi keyboard shortcut `F` per performance mode e `Escape` per uscire:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "f" && e.target === document.body) setIsPerformanceMode(p => !p);
    if (e.key === "Escape") setIsPerformanceMode(false);
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, []);
```

Passa `onTap` a `BpmEqPanel`:
```tsx
<BpmEqPanel
  bpm={bpm}
  onBpmChange={handleBpmChange}
  audioFx={audioFx}
  onAudioFxChange={handleAudioFxChange}
  onTap={tap}
/>
```

Aggiungi `<BeatIndicator>` nel transport strip (accanto a PLAY/STOP):
```tsx
<BeatIndicator isPlaying={isPlaying} bpm={bpm} />
```

Aggiungi bottone performance mode nell'header:
```tsx
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
```

- [ ] **Step 5.3: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 5.4: Esegui test suite completa frontend**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose
```
Expected: tutti i test passano.

- [ ] **Step 5.5: Esegui test backend**

```bash
cd /Users/vitto/Desktop/music && source backend/.venv/bin/activate && pytest tests/ -v
```
Expected: tutti i test passano.

- [ ] **Step 5.6: Commit finale Sprint 5**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: performance mode (F key), BeatIndicator, tap tempo wired — Sprint 5 complete"
```

---

## Verifica end-to-end

- [ ] Apri Settings o header — seleziona porta MIDI → verifica pallino verde
- [ ] Premi `F` → l'app entra in performance mode (chat/editor spariscono)
- [ ] Premi `Escape` → torna alla vista normale
- [ ] Premi TAP 4 volte a ritmo → verifica BPM aggiornato
- [ ] BeatIndicator pulsa in sync con BPM
- [ ] Collega un synth MIDI-compatible → verifica sync clock
