# Audio FX Chain — Fixed vs Track-Dependent Knobs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate knobs into two categories — fixed FX knobs that control the Web Audio post-processing chain directly (no code resubmission), and track-dependent knobs that inject parameters into Strudel code.

**Architecture:** Extend the existing audio chain in `StrudelPlayer` with drive (WaveShaperNode), reverb (ConvolverNode + wet GainNode), delay (DelayNode + feedback + wet GainNode), and master volume (GainNode). All new nodes are exposed via `onAudioFxNodes` callback so `App.tsx` can update their AudioParams directly when knobs change. `BpmEqPanel` gains a second FX section with faders for the new params. `KnobPanel` (track-dependent) is unchanged.

**Tech Stack:** Web Audio API, React 18, TypeScript, Vitest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/lib/audioFx.ts` | Pure helpers: `makeReverbIR`, `makeDriveCurve` |
| Modify | `frontend/src/types.ts` | Add `AudioFxNodes`, `AudioFx`; keep `EqNodes` alias |
| Modify | `frontend/src/components/StrudelPlayer.tsx` | Extended chain; `onAudioFxNodes` prop replaces `onEqNodes` |
| Modify | `frontend/src/components/BpmEqPanel.tsx` | Add FX faders section; props: `audioFx` + `onAudioFxChange` |
| Modify | `frontend/src/App.tsx` | Replace `eq`/`eqNodes` with `audioFx`/`audioFxNodes` |
| Modify | `frontend/src/components/BpmEqPanel.test.tsx` | Update for new props |
| Modify | `frontend/src/components/StrudelPlayer.test.tsx` | Update for `onAudioFxNodes` |

---

## Audio Chain (complete)

```
Strudel gainNode
    │
compressor (DynamicsCompressor)
    │
low (BiquadFilter lowshelf, ±12 dB)
    │
mid (BiquadFilter peaking, ±12 dB)
    │
high (BiquadFilter highshelf, ±12 dB)
    │
drive (WaveShaper, soft-clip 0..1)
    │
    ├──────────────────────────────→ masterVol (dry always present)
    │
    ├→ convolver (synthetic IR) → reverbWet (gain 0..1) → masterVol
    │
    └→ delayNode ←── delayFeedback ←── delayNode (feedback loop)
              └→ delayWet (gain 0..1) → masterVol
                                             │
                                         analyser
                                             │
                                       ctx.destination
```

---

## Task 1: Audio utility helpers

**Files:**
- Create: `frontend/src/lib/audioFx.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/audioFx.test.ts`:

```typescript
import { describe, expect, test, beforeEach } from "vitest";
import { makeReverbIR, makeDriveCurve } from "./audioFx";

describe("makeReverbIR", () => {
  let ctx: OfflineAudioContext;
  beforeEach(() => { ctx = new OfflineAudioContext(2, 44100, 44100); });

  test("returns AudioBuffer with correct duration", () => {
    const buf = makeReverbIR(ctx, 1.5, 3);
    expect(buf.duration).toBeCloseTo(1.5, 1);
    expect(buf.numberOfChannels).toBe(2);
  });

  test("IR data is non-zero", () => {
    const buf = makeReverbIR(ctx, 0.5, 2);
    const data = buf.getChannelData(0);
    expect(data.some(v => v !== 0)).toBe(true);
  });
});

describe("makeDriveCurve", () => {
  test("returns Float32Array of length 256", () => {
    const curve = makeDriveCurve(0.5);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(256);
  });

  test("drive=0 produces near-identity curve", () => {
    const curve = makeDriveCurve(0);
    // midpoint (index 128) should be ~0
    expect(Math.abs(curve[128])).toBeLessThan(0.05);
    // endpoint (index 255) should be ~1
    expect(curve[255]).toBeCloseTo(1, 0);
  });

  test("drive=1 clips more aggressively than drive=0", () => {
    const soft = makeDriveCurve(0);
    const hard = makeDriveCurve(1);
    // at 3/4 scale (index 192), hard should be more compressed toward 1
    expect(hard[192]).toBeGreaterThan(soft[192]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npx vitest run src/lib/audioFx.test.ts
```
Expected: `Cannot find module './audioFx'`

- [ ] **Step 3: Implement `audioFx.ts`**

Create `frontend/src/lib/audioFx.ts`:

```typescript
export function makeReverbIR(
  ctx: BaseAudioContext,
  duration: number,
  decay: number
): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * duration);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function makeDriveCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = k === 0
      ? x
      : ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/lib/audioFx.test.ts
```
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/audioFx.ts frontend/src/lib/audioFx.test.ts
git commit -m "feat: add makeReverbIR and makeDriveCurve audio utilities"
```

---

## Task 2: Update types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Update `types.ts`**

Replace the file content with:

```typescript
export interface Knob {
  name: string;
  strudel_param: string;
  min: number;
  max: number;
  value: number;
  color: string;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

export interface UpdateMessage {
  type: "update";
  code: string;
  knobs: Knob[];
  message: string;
  creative_mode: boolean;
  code_error?: string;
}

export type WsOutMessage =
  | { type: "user_message"; message: string }
  | { type: "knob_change"; knob_name: string; value: number }
  | { type: "runtime_error"; message: string };

export interface AudioFxNodes {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  drive: WaveShaperNode;
  reverbWet: GainNode;
  delayNode: DelayNode;
  delayWet: GainNode;
  masterVol: GainNode;
}

/** State values for all fixed audio FX knobs */
export interface AudioFx {
  low: number;        // -12..+12 dB
  mid: number;        // -12..+12 dB
  high: number;       // -12..+12 dB
  drive: number;      // 0..1 saturation amount
  reverb: number;     // 0..1 wet level
  delay: number;      // 0..1 wet level
  delayTime: number;  // 0.01..1.0 seconds
  vol: number;        // 0..2.0 master gain
}

/** @deprecated use AudioFxNodes */
export type EqNodes = Pick<AudioFxNodes, "low" | "mid" | "high">;

export interface Preset {
  name: string | null;
  code: string | null;
  bpm: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: errors only in files that still reference old `EqNodes` with the old shape — those will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add AudioFxNodes and AudioFx types"
```

---

## Task 3: Extend audio chain in StrudelPlayer

**Files:**
- Modify: `frontend/src/components/StrudelPlayer.tsx`

**Context:** Currently the chain is `gainNode → compressor → low → mid → high → analyser → destination`. We add: drive (WaveShaperNode), then fan out to dry + reverb send + delay send, all mixing into a new `masterVol` GainNode before analyser.

- [ ] **Step 1: Write failing test**

Open `frontend/src/components/StrudelPlayer.test.tsx`. Find the section testing `onEqNodes` / `onAnalyserNode`. Add a new test (do not remove existing ones yet — they will fail with prop rename, which is expected):

```typescript
test("calls onAudioFxNodes with all required node types on play", async () => {
  const onAudioFxNodes = vi.fn();
  const { getByRole } = render(
    <StrudelPlayer
      code='note("c3")'
      onAudioNode={vi.fn()}
      onAnalyserNode={vi.fn()}
      onAudioFxNodes={onAudioFxNodes}
    />
  );
  await userEvent.click(getByRole("button", { name: /play/i }));
  await waitFor(() => expect(onAudioFxNodes).toHaveBeenCalled(), { timeout: 3000 });
  const nodes = onAudioFxNodes.mock.calls[0][0];
  expect(nodes.low).toBeInstanceOf(BiquadFilterNode);
  expect(nodes.mid).toBeInstanceOf(BiquadFilterNode);
  expect(nodes.high).toBeInstanceOf(BiquadFilterNode);
  expect(nodes.drive).toBeInstanceOf(WaveShaperNode);
  expect(nodes.reverbWet).toBeInstanceOf(GainNode);
  expect(nodes.delayNode).toBeInstanceOf(DelayNode);
  expect(nodes.delayWet).toBeInstanceOf(GainNode);
  expect(nodes.masterVol).toBeInstanceOf(GainNode);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx vitest run src/components/StrudelPlayer.test.tsx
```
Expected: fails on `onAudioFxNodes` not being a valid prop.

- [ ] **Step 3: Rewrite `StrudelPlayer.tsx`**

Replace the full file content with:

```typescript
import { useEffect, useRef, useState } from "react";
import type { AudioFxNodes } from "../types";
import { makeReverbIR, makeDriveCurve } from "../lib/audioFx";

interface Props {
  code: string;
  onAudioNode: (node: AudioNode | null) => void;
  onAnalyserNode?: (node: AnalyserNode | null) => void;
  onAudioFxNodes?: (nodes: AudioFxNodes | null) => void;
  onError?: (msg: string) => void;
  evaluateNowRef?: React.MutableRefObject<((code: string) => void) | null>;
}

export function StrudelPlayer({ code, onAudioNode, onAnalyserNode, onAudioFxNodes, onError, evaluateNowRef }: Props) {
  const replRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (evaluateNowRef) {
      evaluateNowRef.current = (newCode: string) => {
        if (replRef.current && isPlaying) {
          setIsPending(false);
          replRef.current.evaluate(newCode);
        }
      };
    }
  }, [isPlaying, evaluateNowRef]);

  useEffect(() => {
    if (!isPlaying || !replRef.current || !code) return;
    setIsPending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsPending(false);
      replRef.current.evaluate(code);
    }, 3000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, isPlaying]);

  const reportError = (e: any) => {
    const msg = e?.message ?? String(e);
    setError(msg);
    onError?.(msg);
  };

  const handlePlay = async () => {
    setError(null);
    try {
      if (!replRef.current) {
        setIsLoading(true);
        try {
          const { initStrudel, samples, registerSoundfonts } = await import("../lib/strudel-bundle");
          replRef.current = await initStrudel({
            prebake: async () => {
              await Promise.all([
                samples("github:tidalcycles/Dirt-Samples/main"),
                registerSoundfonts(),
              ]);
            },
            onEvalError: (e: Error) => reportError(e),
          });
        } finally {
          setIsLoading(false);
        }
      }
      await replRef.current.evaluate(code);
      if (replRef.current.state?.evalError) return;
      setIsPlaying(true);

      try {
        const { getSuperdoughAudioController } = await import("../lib/strudel-bundle");
        const ctrl = getSuperdoughAudioController();
        const gainNode: AudioNode | null = ctrl?.output?.destinationGain ?? null;
        onAudioNode(gainNode);

        if (gainNode) {
          const ctx = gainNode.context as AudioContext;

          // Compressor
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -12;
          compressor.knee.value = 6;
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          // EQ
          const low = ctx.createBiquadFilter();
          low.type = "lowshelf";
          low.frequency.value = 200;
          low.gain.value = 0;

          const mid = ctx.createBiquadFilter();
          mid.type = "peaking";
          mid.frequency.value = 1000;
          mid.Q.value = 1;
          mid.gain.value = 0;

          const high = ctx.createBiquadFilter();
          high.type = "highshelf";
          high.frequency.value = 6000;
          high.gain.value = 0;

          // Drive (soft-clip saturation)
          const drive = ctx.createWaveShaper();
          drive.curve = makeDriveCurve(0);
          drive.oversample = "2x";

          // Reverb
          const convolver = ctx.createConvolver();
          convolver.buffer = makeReverbIR(ctx, 2.5, 3);
          const reverbWet = ctx.createGain();
          reverbWet.gain.value = 0;

          // Delay with feedback
          const delayNode = ctx.createDelay(1.0);
          delayNode.delayTime.value = 0.35;
          const delayFeedback = ctx.createGain();
          delayFeedback.gain.value = 0.4;
          const delayWet = ctx.createGain();
          delayWet.gain.value = 0;

          // Master volume
          const masterVol = ctx.createGain();
          masterVol.gain.value = 1.0;

          // Analyser
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;

          // Series chain: gainNode → compressor → low → mid → high → drive
          gainNode.disconnect();
          gainNode.connect(compressor);
          compressor.connect(low);
          low.connect(mid);
          mid.connect(high);
          high.connect(drive);

          // Drive → dry path → masterVol
          drive.connect(masterVol);

          // Drive → reverb send → masterVol
          drive.connect(convolver);
          convolver.connect(reverbWet);
          reverbWet.connect(masterVol);

          // Drive → delay send (with feedback) → masterVol
          drive.connect(delayNode);
          delayNode.connect(delayFeedback);
          delayFeedback.connect(delayNode);
          delayNode.connect(delayWet);
          delayWet.connect(masterVol);

          // masterVol → analyser → destination
          masterVol.connect(analyser);
          analyser.connect(ctx.destination);

          onAnalyserNode?.(analyser);
          onAudioFxNodes?.({ low, mid, high, drive, reverbWet, delayNode, delayWet, masterVol });
        }
      } catch {
        onAudioNode(null);
      }
    } catch (e: any) {
      reportError(e);
    }
  };

  const handleStop = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try { replRef.current?.stop(); } catch { /* ignore */ }
    setIsPlaying(false);
    setIsPending(false);
    onAudioNode(null);
    onAnalyserNode?.(null);
    onAudioFxNodes?.(null);
  };

  const playDisabled = isPlaying || !code || isLoading;

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={handlePlay}
        disabled={playDisabled}
        style={{
          background: playDisabled ? "#0f1a0f" : "#142a14",
          border: `1px solid ${playDisabled ? "#1a2a1a" : "#2a5a2a"}`,
          borderRadius: "5px",
          padding: "4px 14px",
          color: playDisabled ? "#2a4a2a" : "#7cc",
          cursor: playDisabled ? "default" : "pointer",
          fontSize: "0.8rem",
          fontFamily: "monospace",
          letterSpacing: "1px",
        }}
      >
        {isLoading ? "⟳ LOADING" : "▶ PLAY"}
      </button>
      <button
        onClick={handleStop}
        disabled={!isPlaying}
        style={{
          background: !isPlaying ? "#150f0f" : "#2a1414",
          border: `1px solid ${!isPlaying ? "#2a1a1a" : "#5a2a2a"}`,
          borderRadius: "5px",
          padding: "4px 14px",
          color: !isPlaying ? "#3a2a2a" : "#f77",
          cursor: !isPlaying ? "default" : "pointer",
          fontSize: "0.8rem",
          fontFamily: "monospace",
          letterSpacing: "1px",
        }}
      >
        ■ STOP
      </button>
      {isPlaying && !isPending && (
        <span style={{ fontSize: "0.7rem", color: "#00d4aa", fontFamily: "monospace", letterSpacing: "1px" }}>● LIVE</span>
      )}
      {isPlaying && isPending && (
        <span style={{ fontSize: "0.7rem", color: "#8a7a3a", fontFamily: "monospace", letterSpacing: "1px" }}>⏳ PENDING</span>
      )}
      {error && (
        <span style={{ fontSize: "0.7rem", color: "#f77", fontFamily: "monospace" }}>{error}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect new test PASS, old `onEqNodes` tests FAIL**

```bash
cd frontend && npx vitest run src/components/StrudelPlayer.test.tsx
```
Expected: new `onAudioFxNodes` test passes; any existing tests that pass `onEqNodes` prop will show TypeScript errors (fix in Task 5).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StrudelPlayer.tsx
git commit -m "feat: extend audio chain with drive, reverb, delay, masterVol nodes"
```

---

## Task 4: Add FX faders to BpmEqPanel

**Files:**
- Modify: `frontend/src/components/BpmEqPanel.tsx`
- Modify: `frontend/src/components/BpmEqPanel.test.tsx`

**Context:** The panel currently has BPM knob + EQ faders (3 VertFaders). We extend it with an FX section: 5 faders (reverb, delay, delay time, drive, vol). Panel width widens from 104px → 160px. Props change: `eq` + `onEqChange` → `audioFx: AudioFx` + `onAudioFxChange: (param: keyof AudioFx, value: number) => void`.

- [ ] **Step 1: Write failing tests**

Replace `frontend/src/components/BpmEqPanel.test.tsx` with:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { BpmEqPanel } from "./BpmEqPanel";
import type { AudioFx } from "../types";

const defaultFx: AudioFx = {
  low: 0, mid: 0, high: 0,
  drive: 0, reverb: 0, delay: 0, delayTime: 0.35, vol: 1,
};

test("renders BPM label and current value", () => {
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={vi.fn()} />);
  expect(screen.getByText(/BPM/i)).toBeInTheDocument();
  expect(screen.getByText("120")).toBeInTheDocument();
});

test("calls onBpmChange when BPM slider moves", () => {
  const onBpmChange = vi.fn();
  render(<BpmEqPanel bpm={120} onBpmChange={onBpmChange} audioFx={defaultFx} onAudioFxChange={vi.fn()} />);
  const bpmSlider = screen.getByRole("slider", { name: /bpm/i });
  fireEvent.change(bpmSlider, { target: { value: "140" } });
  expect(onBpmChange).toHaveBeenCalledWith(140);
});

test("renders EQ section labels", () => {
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={vi.fn()} />);
  expect(screen.getByText("LOW")).toBeInTheDocument();
  expect(screen.getByText("MID")).toBeInTheDocument();
  expect(screen.getByText("HIGH")).toBeInTheDocument();
});

test("calls onAudioFxChange with 'low' when LOW slider changes", () => {
  const onAudioFxChange = vi.fn();
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={onAudioFxChange} />);
  const lowSlider = screen.getByRole("slider", { name: /low/i });
  fireEvent.change(lowSlider, { target: { value: "6" } });
  expect(onAudioFxChange).toHaveBeenCalledWith("low", 6);
});

test("calls onAudioFxChange with 'high' when HIGH slider changes", () => {
  const onAudioFxChange = vi.fn();
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={onAudioFxChange} />);
  const highSlider = screen.getByRole("slider", { name: /high/i });
  fireEvent.change(highSlider, { target: { value: "-3" } });
  expect(onAudioFxChange).toHaveBeenCalledWith("high", -3);
});

test("renders FX section labels", () => {
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={vi.fn()} />);
  expect(screen.getByText("RVB")).toBeInTheDocument();
  expect(screen.getByText("DLY")).toBeInTheDocument();
  expect(screen.getByText("DLT")).toBeInTheDocument();
  expect(screen.getByText("DRV")).toBeInTheDocument();
  expect(screen.getByText("VOL")).toBeInTheDocument();
});

test("calls onAudioFxChange with 'reverb' when RVB slider changes", () => {
  const onAudioFxChange = vi.fn();
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={onAudioFxChange} />);
  const rvbSlider = screen.getByRole("slider", { name: /rvb/i });
  fireEvent.change(rvbSlider, { target: { value: "0.5" } });
  expect(onAudioFxChange).toHaveBeenCalledWith("reverb", 0.5);
});

test("calls onAudioFxChange with 'vol' when VOL slider changes", () => {
  const onAudioFxChange = vi.fn();
  render(<BpmEqPanel bpm={120} onBpmChange={vi.fn()} audioFx={defaultFx} onAudioFxChange={onAudioFxChange} />);
  const volSlider = screen.getByRole("slider", { name: /vol/i });
  fireEvent.change(volSlider, { target: { value: "1.5" } });
  expect(onAudioFxChange).toHaveBeenCalledWith("vol", 1.5);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npx vitest run src/components/BpmEqPanel.test.tsx
```
Expected: fails on missing `audioFx` prop / unknown `onAudioFxChange`.

- [ ] **Step 3: Rewrite `BpmEqPanel.tsx`**

Replace the full file content with:

```typescript
import { useRef, useState } from "react";
import type React from "react";
import type { AudioFx } from "../types";

interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  audioFx: AudioFx;
  onAudioFxChange: (param: keyof AudioFx, value: number) => void;
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

const TRACK_H = 44;

function VertFader({ value, min, max, step, color, label, onChange, ariaLabel }: {
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
    const newVal = Math.max(min, Math.min(max,
      valueRef.current - e.movementY * (range / 80)
    ));
    onChange(newVal);
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
          top: 0, width: "2px", height: "100%",
          background: "#0e1622", borderRadius: "1px",
        }} />
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          top: centerTop - 0.5, width: "8px", height: "1px",
          background: "#253344",
        }} />
        {fillH > 0.5 && (
          <div style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            top: fillTop, height: fillH, width: "2px",
            background: color, borderRadius: "1px",
            opacity: active ? 0.95 : 0.7,
          }} />
        )}
        <div style={{
          position: "absolute", left: "50%",
          top: thumbTop, transform: "translate(-50%, -50%)",
          width: "18px", height: "6px",
          background: `linear-gradient(180deg, ${color}bb 0%, ${color}66 100%)`,
          border: `1px solid ${color}99`,
          borderRadius: "2px",
          boxShadow: active ? `0 0 8px ${color}88` : `0 0 2px ${color}33`,
          transition: "box-shadow 0.12s",
        }} />
      </div>

      <div style={{ fontSize: "0.44rem", color: active ? color : `${color}99`, fontFamily: "monospace", letterSpacing: "1px", transition: "color 0.12s" }}>
        {label}
      </div>

      <input
        type="range"
        aria-label={ariaLabel}
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
      />
    </div>
  );
}

const LABEL: React.CSSProperties = {
  fontSize: "0.48rem",
  color: "#3a5060",
  fontFamily: "monospace",
  letterSpacing: "2px",
};

const DIVIDER = (
  <div style={{ width: "100%", height: "1px", background: "#111d28", margin: "1px 0" }} />
);

export function BpmEqPanel({ bpm, onBpmChange, audioFx, onAudioFxChange }: Props) {
  const [bpmActive, setBpmActive] = useState(false);
  const [bpmHovered, setBpmHovered] = useState(false);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const pct = (bpm - 40) / (240 - 40);
  const rot = pct * 270 - 135;
  const rad = ((rot - 90) * Math.PI) / 180;
  const cx = 18, cy = 18, r = 13;
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
    const newBpm = Math.max(40, Math.min(240, bpmRef.current - e.movementY * (200 / 150)));
    onBpmChange(Math.round(newBpm));
  };

  const handleBpmPointerUp = () => setBpmActive(false);

  const bpmShadow = bpmActive
    ? "drop-shadow(0 0 6px #fc9c)"
    : bpmHovered
    ? "drop-shadow(0 0 3px #fc955)"
    : "none";

  return (
    <div style={{
      position: "relative",
      width: "160px", flexShrink: 0,
      background: "#080b10",
      borderRight: "1px solid #1a2230",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "8px 6px 6px",
      gap: "4px",
    }}>
      <div style={LABEL}>BPM</div>

      <svg
        width="36" height="36" viewBox="0 0 36 36"
        style={{ cursor: bpmActive ? "grabbing" : "grab", userSelect: "none", filter: bpmShadow, transition: "filter 0.15s" }}
        onPointerDown={handleBpmPointerDown}
        onPointerMove={handleBpmPointerMove}
        onPointerUp={handleBpmPointerUp}
        onPointerCancel={handleBpmPointerUp}
        onMouseEnter={() => setBpmHovered(true)}
        onMouseLeave={() => setBpmHovered(false)}
      >
        <circle cx={cx} cy={cy} r="16" fill="#070910" stroke="#16202e" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0e1622" strokeWidth="2.5" />
        <path d={arcPath} fill="none" stroke="#fc9" strokeWidth="2.5" strokeLinecap="round" opacity={bpmActive ? 1 : 0.85} />
        <defs>
          <radialGradient id="bpm-kg" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#28334a" />
            <stop offset="100%" stopColor="#080a12" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="8" fill="url(#bpm-kg)" stroke="#18222e" strokeWidth="0.75" />
        <line
          x1={cx + 3 * Math.cos(rad)} y1={cy + 3 * Math.sin(rad)}
          x2={ix} y2={iy}
          stroke="#fc9" strokeWidth="2.5" strokeLinecap="round"
        />
      </svg>

      <div style={{ fontSize: "0.7rem", color: bpmActive ? "#fc9" : "#c8a060", fontFamily: "monospace", transition: "color 0.15s" }}>
        {bpm}
      </div>

      <input
        type="range"
        aria-label="bpm"
        min={40} max={240} step={1}
        value={bpm}
        onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
      />

      {DIVIDER}

      <div style={{ ...LABEL, marginBottom: "1px" }}>EQ</div>

      <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
        {(["low", "mid", "high"] as const).map((band) => (
          <VertFader
            key={band}
            value={audioFx[band]}
            min={-12}
            max={12}
            step={0.5}
            color={EQ_COLORS[band]}
            label={band.toUpperCase()}
            ariaLabel={band}
            onChange={(v) => onAudioFxChange(band, v)}
          />
        ))}
      </div>

      {DIVIDER}

      <div style={{ ...LABEL, marginBottom: "1px" }}>FX</div>

      <div style={{ display: "flex", gap: "7px", alignItems: "flex-start" }}>
        {FX_PARAMS.map(({ param, label, min, max, step }) => (
          <VertFader
            key={param}
            value={audioFx[param] as number}
            min={min}
            max={max}
            step={step}
            color={FX_COLORS[param]}
            label={label}
            ariaLabel={label.toLowerCase()}
            onChange={(v) => onAudioFxChange(param, v)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/components/BpmEqPanel.test.tsx
```
Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BpmEqPanel.tsx frontend/src/components/BpmEqPanel.test.tsx
git commit -m "feat: add FX faders section to BpmEqPanel (reverb, delay, drive, vol)"
```

---

## Task 5: Wire up in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Context:** Replace `eq: { low, mid, high }` + `eqNodes: EqNodes | null` with `audioFx: AudioFx` + `audioFxNodes: AudioFxNodes | null`. The `handleAudioFxChange` function updates both state and the relevant AudioParam (or WaveShaperNode curve) directly — no code resubmission for any FX param.

- [ ] **Step 1: Rewrite `App.tsx`**

Apply the following targeted changes to `frontend/src/App.tsx`:

**1a. Update imports** — replace `EqNodes` with `AudioFx, AudioFxNodes`:

```typescript
// REMOVE this line:
import type { ChatMessage, EqNodes, Knob, UpdateMessage } from "./types";

// ADD this line:
import type { AudioFx, AudioFxNodes, ChatMessage, Knob, UpdateMessage } from "./types";
import { makeDriveCurve } from "./lib/audioFx";
```

**1b. Replace state declarations** — find and replace:

```typescript
// REMOVE:
const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
const [eqNodes, setEqNodes] = useState<EqNodes | null>(null);

// ADD:
const [audioFx, setAudioFx] = useState<AudioFx>({
  low: 0, mid: 0, high: 0,
  drive: 0, reverb: 0, delay: 0, delayTime: 0.35, vol: 1,
});
const [audioFxNodes, setAudioFxNodes] = useState<AudioFxNodes | null>(null);
```

**1c. Replace handler** — find and replace:

```typescript
// REMOVE:
const handleEqChange = useCallback((band: "low" | "mid" | "high", value: number) => {
  setEq(prev => ({ ...prev, [band]: value }));
  if (eqNodes) eqNodes[band].gain.value = value;
}, [eqNodes]);

// ADD:
const handleAudioFxChange = useCallback((param: keyof AudioFx, value: number) => {
  setAudioFx(prev => ({ ...prev, [param]: value }));
  if (!audioFxNodes) return;
  switch (param) {
    case "low":       audioFxNodes.low.gain.value = value; break;
    case "mid":       audioFxNodes.mid.gain.value = value; break;
    case "high":      audioFxNodes.high.gain.value = value; break;
    case "drive":     audioFxNodes.drive.curve = makeDriveCurve(value); break;
    case "reverb":    audioFxNodes.reverbWet.gain.value = value; break;
    case "delay":     audioFxNodes.delayWet.gain.value = value; break;
    case "delayTime": audioFxNodes.delayNode.delayTime.value = value; break;
    case "vol":       audioFxNodes.masterVol.gain.value = value; break;
  }
}, [audioFxNodes]);
```

**1d. Update BpmEqPanel JSX** — find and replace:

```tsx
// REMOVE:
<BpmEqPanel bpm={bpm} onBpmChange={handleBpmChange} eq={eq} onEqChange={handleEqChange} />

// ADD:
<BpmEqPanel bpm={bpm} onBpmChange={handleBpmChange} audioFx={audioFx} onAudioFxChange={handleAudioFxChange} />
```

**1e. Update StrudelPlayer JSX** — find and replace:

```tsx
// REMOVE:
onEqNodes={setEqNodes}

// ADD:
onAudioFxNodes={setAudioFxNodes}
```

- [ ] **Step 2: Run full frontend test suite**

```bash
cd frontend && npx vitest run
```
Expected: all tests pass. If any remaining test references `onEqNodes` or `eq`/`setEq`, update those references to the new props in the same step.

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire audioFx state and handlers — knobs control audio chain directly"
```

---

## Task 6: Update StrudelPlayer tests

**Files:**
- Modify: `frontend/src/components/StrudelPlayer.test.tsx`

**Context:** Any existing tests that use `onEqNodes` prop need to be updated to `onAudioFxNodes`. The new prop name and type are the only change.

- [ ] **Step 1: Find and replace in the test file**

Open `frontend/src/components/StrudelPlayer.test.tsx`. Replace every occurrence of `onEqNodes` with `onAudioFxNodes`. The callback receives `AudioFxNodes | null` instead of `EqNodes | null`.

If any test imports `EqNodes`, update to `AudioFxNodes`.

- [ ] **Step 2: Run StrudelPlayer tests**

```bash
cd frontend && npx vitest run src/components/StrudelPlayer.test.tsx
```
Expected: all tests pass.

- [ ] **Step 3: Run full suite one final time**

```bash
cd frontend && npx vitest run
```
Expected: 100% pass.

- [ ] **Step 4: Final TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StrudelPlayer.test.tsx
git commit -m "test: update StrudelPlayer tests for onAudioFxNodes prop rename"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| Fixed FX knobs don't modify Strudel code | Task 3 + Task 5 (`handleAudioFxChange` only sets AudioParams) |
| Reverb send/return via Web Audio | Task 3 (ConvolverNode + reverbWet GainNode) |
| Delay with feedback | Task 3 (DelayNode + delayFeedback loop) |
| Drive/saturation | Task 3 (WaveShaperNode) + Task 1 (`makeDriveCurve`) |
| Master volume | Task 3 (masterVol GainNode) |
| Clear UI separation fixed vs track | Task 4 (EQ + FX sections in BpmEqPanel) / unchanged KnobPanel |
| All audio nodes exposed for live updates | Task 3 (`onAudioFxNodes` callback) |
| No code resubmission on FX change | Task 5 (`handleAudioFxChange` uses AudioParam, not `setCode`) |

**Placeholder scan:** No TBDs, all code blocks complete. ✓

**Type consistency:**
- `AudioFxNodes` defined in Task 2, used in Task 3 (callback), Task 5 (state), Task 6 (tests) ✓
- `AudioFx` defined in Task 2, used in Task 4 (props), Task 5 (state + handler) ✓
- `makeDriveCurve` defined in Task 1, imported in Task 5 (`App.tsx`) ✓
- `makeReverbIR` defined in Task 1, imported in Task 3 (`StrudelPlayer.tsx`) ✓
