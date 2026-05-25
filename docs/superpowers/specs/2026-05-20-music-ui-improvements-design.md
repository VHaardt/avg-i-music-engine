# Design Spec — Music App UI & Audio Improvements
**Date:** 2026-05-20  
**Status:** Approved

---

## Overview

9 improvements to the AVG I music generation app, covering UI layout, audio quality, backend agent coherence, and user productivity features.

---

## 1. Adaptive KnobPanel UI

**Problem:** KnobPanel has a fixed 295px width with `overflow: hidden`. Knobs beyond the visible area are silently clipped.

**Design:**
- Replace fixed width with `flex-shrink: 0; min-width: 180px; max-width: 295px`
- KnobPanel grid uses `repeat(auto-fill, minmax(60px, 1fr))` so it reflows on narrow containers
- Add `overflow-y: auto` with a thin custom scrollbar if more than 6 knobs
- Cap visible knobs at 6 per the existing agent limit — scroll is a safety net only

**Files:** `frontend/src/components/KnobPanel.tsx`, `frontend/src/App.tsx`

---

## 2. Knob Agent Coherence + Sensible Ranges

**Problem:** Knobs can be redundant (e.g., both `lpf` and `cutoff` which are aliases), expose params that conflict with the EQ sliders, or use nonsensical min/max ranges (e.g. `room` going 0–100 when anything above 2 is unusable).

**Design:**

### Deduplication
- Add a deduplication pass in `knobs_agent.py`: if two params are known aliases (e.g. `lpf`/`cutoff`/`ctf`), keep only the one literally present in the code
- Exclude `setcpm`/`cpm` from AI knob list — BPM is now a dedicated always-on control (item 3)
- Prompt addition: instruct agent to prefer params that are **unique in musical function** and **already have a numeric literal** in the code; do not suggest parameters that duplicate or conflict with each other

### Canonical Range Table (added to prompt)
The prompt must include a hard reference table. The agent **must** use these exact min/max values:

| Parameter | min | max | Notes |
|-----------|-----|-----|-------|
| `gain`, `velocity`, `postgain` | 0 | 1.5 | > 1 adds saturation |
| `lpf`, `hpf`, `cutoff`, `bandf` | 80 | 12000 | Hz |
| `lpq`, `hpq`, `resonance` | 0 | 4 | > 1 = resonant peak |
| `room` | 0 | 2 | > 2 sounds unnatural |
| `delay`, `delayfeedback` | 0 | 1 | |
| `delaytime` | 0.05 | 1 | cycles |
| `crush` | 1 | 16 | 1 = no effect, low values = heavy |
| `distort`, `shape` | 0 | 3 | |
| `speed` | 0.25 | 4 | playback rate |
| `pan` | 0 | 1 | 0 = L, 1 = R |
| `transpose`, `detune` | -24 | 24 | semitones |
| `coarse` | 1 | 32 | sample-rate reduction |
| `tremolo` | 0.1 | 20 | Hz |

If a param is not in this table, the agent must derive a sensible range from the current value (e.g. ±200% of the literal value, clamped to physically meaningful bounds).

**Files:** `backend/agents/knobs_agent.py`, `backend/prompts/knobs_agent.yaml`

---

## 3. BPM Knob — Always-On Control

**Problem:** BPM is not always exposed as a knob; it depends on whether the AI includes `setcpm()`.

**Design:**
- New permanent control column between the waveform/player section and the knobs panel (~90px wide)
- **Top:** BPM rotary knob (amber `#fc9`) + value display + range input slider (range: 40–240 BPM, default 120)
- **Bottom:** EQ sliders LOW / MID / HIGH (see item 5)
- BPM knob reads/writes `setcpm(bpm/4)` in the live code via `applyKnobToCode`; if `setcpm` is absent, prepends it
- BPM state lives in `App.tsx` as `const [bpm, setBpm] = useState(120)`
- On mount/code-change: extract BPM from code via regex `setcpm\(([^)]+)\)` → `value * 4` → sync knob

**Files:** `frontend/src/App.tsx`, new `frontend/src/components/BpmEqPanel.tsx`

---

## 4. Pass Current Code in Successive Iterations

**Problem:** The strudel_coder agent treats every request as a fresh generation, ignoring the current playing code. Users cannot ask for targeted modifications.

**Design:**
- `strudel_coder.py` already receives `state["strudel_code"]` — expose it explicitly in the prompt as `{current_code}`
- Prompt update: add a `<current_code>` section with clear instruction:
  - If `current_code` is non-empty: **modify it surgically** — keep what works, change only what the user asked
  - Deletion is allowed and expected: if the user asks to "remove the bass", delete that `$:` block entirely
  - If `current_code` is empty: generate fresh
- This applies to all agent iterations in the conversation loop

**Files:** `backend/agents/strudel_coder.py`, `backend/prompts/strudel_coder.yaml`

---

## 5. Audio Quality — Compressor + EQ Sliders

### 5a. Master Compressor (crackling fix)

**Problem:** Multiple simultaneous patterns can exceed 0 dBFS causing digital clipping/crackling.

**Design:**
- After `initStrudel()` in `StrudelPlayer.tsx`, insert a `DynamicsCompressorNode` on the master output:
  ```
  threshold: -12 dB, knee: 6 dB, ratio: 4:1, attack: 0.003s, release: 0.25s
  ```
- Connect: `gainNode → compressor → audioContext.destination`
- The analyser (waveform) taps after the compressor so it reflects the actual output

### 5b. EQ Sliders — LOW / MID / HIGH

**Problem:** No way to shape the master EQ in real time; some sounds are too harsh or too muddy.

**Design:**
- Three `BiquadFilterNode`s on the master chain (post-compressor):
  - **LOW**: lowshelf at 200 Hz, gain range −12 to +12 dB, default 0
  - **MID**: peaking at 1000 Hz, Q=1, gain range −12 to +12 dB, default 0
  - **HIGH**: highshelf at 6000 Hz, gain range −12 to +12 dB, default 0
- Sliders vertical, in the `BpmEqPanel` component (item 3), between waveform and knobs
- State in `App.tsx`: `const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 })`
- Filter nodes created once in `StrudelPlayer` and exposed via callback (like `onAudioNode`)

**Files:** `frontend/src/components/StrudelPlayer.tsx`, `frontend/src/components/BpmEqPanel.tsx`, `frontend/src/App.tsx`

---

## 6. WAV Download (auto on recording stop)

**Problem:** `Recorder.tsx` saves as `.webm`. User wants `.wav`.

**Design:**
- MediaRecorder does not natively produce WAV. Strategy: capture raw PCM via `AudioWorkletProcessor` and encode to WAV manually on stop.
- Implementation:
  1. Load a minimal `pcm-recorder-processor.js` AudioWorklet that buffers `Float32Array` chunks
  2. On `stop`: collect all chunks → interleave L+R → write WAV header (44-byte RIFF) → `Blob` → download
  3. Sample rate from `audioNode.context.sampleRate` (typically 44100 or 48000); output is **stereo** (2 channels)
  4. Filename: `performance-{timestamp}.wav`
- Download triggers automatically on stop (existing behavior preserved, format changes)
- Remove the `↓ WAV` button from the waveform header (not needed — recording via REC button as before)

**Files:** `frontend/src/components/Recorder.tsx`, new `frontend/public/pcm-recorder-processor.js`

---

## 7. Preset System (8×2 = 16 slots)

**Design:**

### Storage
- `localStorage` key: `avgI_presets` → JSON array of 16 entries
- Each entry: `{ name: string | null, code: string | null }` (null = empty slot)
- Active slot index: `localStorage` key `avgI_activePreset` → number (0–15)

### UI — Preset Strip
- Horizontal strip between hardware panel and code editor (~28px tall)
- 16 buttons in two groups of 8, separated by a thin divider
- Button states: **empty** (dim border), **saved** (green tint), **active** (cyan border + glow)
- Right-click on a slot → context menu: Rename / Clear (desktop-only app)
- **SAVE** button (right side): saves current `code` + current `bpm` to the active slot
- Clicking a non-active slot: loads its code into the editor + syncs BPM knob

### Preset data shape
```ts
interface Preset {
  name: string | null   // user label, null = "Preset N"
  code: string | null   // strudel code, null = empty
  bpm: number           // BPM at save time
}
```

### State in App.tsx
```ts
const [presets, setPresets] = useState<Preset[]>(() => loadPresetsFromStorage())
const [activePreset, setActivePreset] = useState<number>(() => loadActiveFromStorage())
```

**Files:** `frontend/src/components/PresetStrip.tsx` (new), `frontend/src/hooks/usePresets.ts` (new), `frontend/src/App.tsx`

---

## 8. Live Code Evaluation Debounce

**Problem:** `StrudelPlayer` re-evaluates the Strudel code on every `code` state change. When the user edits the textarea, each keystroke (or delete) triggers an immediate re-evaluation — causing interruptions, restarts, and noise mid-edit.

**Design:**
- In `StrudelPlayer.tsx`, the `useEffect` that calls `replRef.current.evaluate(code)` must be debounced by **3 seconds** of inactivity
- Implementation: use a `useRef<ReturnType<typeof setTimeout>>` to hold the timer; clear and reset it on every `code` change; only call `evaluate` when the timer fires
- The 3s debounce applies **only to user edits** (manual textarea changes). Code pushed from the AI pipeline (via `lastUpdate`) bypasses debounce and evaluates immediately — this is achieved by having App.tsx call a separate `evaluateNow()` callback on the player when AI code arrives
- During the debounce window: show a subtle `⏳ PENDING` indicator next to LIVE so the user knows evaluation is queued

```ts
// StrudelPlayer: simplified debounce logic
useEffect(() => {
  if (!isPlaying || !replRef.current || !code) return;
  const timer = setTimeout(() => replRef.current.evaluate(code), 3000);
  return () => clearTimeout(timer);
}, [code, isPlaying]);
```

- Add `onImmediateEvaluate` prop to `StrudelPlayer` that App.tsx calls when AI updates code (no debounce path)

**Files:** `frontend/src/components/StrudelPlayer.tsx`, `frontend/src/App.tsx`

---

## Layout Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ AVG I  │  WAVEFORM header (title)           WAV badge removed   │
│ + REC  │  ─────────────────────────────────  │  BPM   │ KNOBS  │
│        │  waveform canvas (slightly shorter)  │  knob  │ 3×2   │
│        │  ─────────────────────────────────  │ ─────  │ grid  │
│        │  ▶ PLAY  ■ STOP  ● LIVE            │ EQ     │       │
│        │                                     │ sliders│       │
├─────────────────────────────────────────────────────────────────┤
│ PRESETS  [1][2][3][4][5][6][7][8] | [9][10][11][12][13][14][15][16]  SAVE │
├─────────────────────────────────────────────────────────────────┤
│  STRUDEL CODE (editable textarea)          │  CHAT              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

| # | Task | Files | Rationale |
|---|------|-------|-----------|
| 1 | Master compressor in StrudelPlayer | StrudelPlayer.tsx | Unblocks audio quality; needed before EQ |
| 2 | BpmEqPanel component + wiring | BpmEqPanel.tsx, App.tsx | Central UI addition; other features depend on layout |
| 3 | Adaptive KnobPanel | KnobPanel.tsx, App.tsx | Quick layout fix |
| 4 | Knob agent coherence + range table | knobs_agent.py, knobs_agent.yaml | Backend improvement |
| 5 | Pass current code to strudel_coder | strudel_coder.py, strudel_coder.yaml | Core UX improvement |
| 6 | PresetStrip + usePresets hook | PresetStrip.tsx, usePresets.ts, App.tsx | Self-contained feature |
| 7 | WAV recorder | Recorder.tsx, pcm-recorder-processor.js | Independent of other changes |
| 8 | Live code debounce (3s) | StrudelPlayer.tsx, App.tsx | Prevents noise on every keystroke |

---

## Testing Checklist

- [ ] BPM knob syncs with `setcpm()` in generated code (read + write)
- [ ] BPM knob works when `setcpm` is absent (injects it)
- [ ] EQ sliders audibly affect output (LOW muddy → bright, HIGH harsh → smooth)
- [ ] No crackling with 4+ simultaneous patterns
- [ ] Knob panel shows 6 knobs without clipping at any window width
- [ ] No duplicate/alias knobs in knob panel
- [ ] Successive chat messages modify existing code, not replace entirely
- [ ] Preset SAVE persists after page reload
- [ ] Preset LOAD updates code editor + BPM knob
- [ ] WAV file plays correctly in audio player after download
- [ ] Recording auto-downloads on stop (no extra button needed)
- [ ] Typing in textarea does NOT re-evaluate until 3s after last keystroke
- [ ] AI-generated code evaluates immediately (bypasses debounce)
- [ ] `⏳ PENDING` indicator visible during debounce window
- [ ] Knob min/max values match canonical range table for all standard params
