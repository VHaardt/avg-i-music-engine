# Sprint 3 — Code Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il `<textarea>` in `App.tsx` con Monaco Editor (VS Code engine) + Strudel syntax highlight + autocomplete sui sample disponibili.

**Architecture:** `@monaco-editor/react` wrap in un componente `CodeEditor`. Il language `strudel` viene registrato in `frontend/src/lib/strudelLanguage.ts` tramite il hook `useMonaco`. Monaco usa il CDN di default (nessuna config Vite necessaria). `App.tsx` sostituisce il `<textarea>` con `<CodeEditor>`. `Ctrl+Enter` bypassa il debounce via `evaluateNowRef`.

**Tech Stack:** React 18, TypeScript, `@monaco-editor/react` v4, Monaco Editor

---

## File Map

```
frontend/
  package.json                          MOD  — aggiunge @monaco-editor/react
  src/
    lib/strudelLanguage.ts              NEW  — Monarch tokens + completions + hover
    components/CodeEditor.tsx           NEW  — Monaco wrapper con Strudel language
    App.tsx                             MOD  — sostituisce <textarea> con <CodeEditor>

tests/
  frontend/src/components/CodeEditor.test.tsx   NEW  — smoke test
```

---

## Task 1: Installa dipendenza

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1.1: Installa `@monaco-editor/react`**

```bash
cd /Users/vitto/Desktop/music/frontend && npm install @monaco-editor/react
```
Expected: package aggiunto a `dependencies`.

- [ ] **Step 1.2: Verifica installazione**

```bash
node -e "require('@monaco-editor/react'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 1.3: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @monaco-editor/react dependency"
```

---

## Task 2: Strudel Language Definition

**Files:**
- Create: `frontend/src/lib/strudelLanguage.ts`

- [ ] **Step 2.1: Crea `strudelLanguage.ts`**

```typescript
// frontend/src/lib/strudelLanguage.ts
import type * as Monaco from "monaco-editor";

export const STRUDEL_FUNCTIONS = [
  // Pattern constructors
  { label: "note", detail: "note(string) — pitch pattern" },
  { label: "sound", detail: "sound(string) — sample pattern" },
  { label: "s", detail: "s(string) — alias for sound()" },
  { label: "n", detail: "n(number|string) — note number" },
  { label: "freq", detail: "freq(number) — frequency in Hz" },
  { label: "chord", detail: "chord(string) — chord voicing" },
  // Combinators
  { label: "stack", detail: "stack(...patterns) — play simultaneously" },
  { label: "cat", detail: "cat(...patterns) — play in sequence" },
  { label: "seq", detail: "seq(...patterns) — alias for cat()" },
  { label: "fastcat", detail: "fastcat(...patterns)" },
  { label: "slowcat", detail: "slowcat(...patterns)" },
  // Time
  { label: "fast", detail: "fast(factor) — speed up pattern" },
  { label: "slow", detail: "slow(factor) — slow down pattern" },
  { label: "every", detail: "every(n, fn) — apply fn every n cycles" },
  { label: "sometimes", detail: "sometimes(fn) — apply fn ~50% of cycles" },
  { label: "often", detail: "often(fn) — apply fn ~75% of cycles" },
  { label: "rarely", detail: "rarely(fn) — apply fn ~25% of cycles" },
  { label: "almostAlways", detail: "almostAlways(fn)" },
  { label: "almostNever", detail: "almostNever(fn)" },
  { label: "setcpm", detail: "setcpm(n) — set cycles per minute (BPM/4)" },
  // Effects (chainable)
  { label: "gain", detail: ".gain(0..2) — volume" },
  { label: "pan", detail: ".pan(-1..1) — stereo pan" },
  { label: "room", detail: ".room(0..1) — reverb room size" },
  { label: "delay", detail: ".delay(0..1) — delay wet" },
  { label: "delaytime", detail: ".delaytime(seconds) — delay time" },
  { label: "delayfeedback", detail: ".delayfeedback(0..1)" },
  { label: "cutoff", detail: ".cutoff(hz) — low pass filter" },
  { label: "resonance", detail: ".resonance(0..1)" },
  { label: "hcutoff", detail: ".hcutoff(hz) — high pass filter" },
  { label: "attack", detail: ".attack(seconds)" },
  { label: "decay", detail: ".decay(seconds)" },
  { label: "sustain", detail: ".sustain(0..1)" },
  { label: "release", detail: ".release(seconds)" },
  { label: "crush", detail: ".crush(bits) — bit crusher" },
  { label: "coarse", detail: ".coarse(n) — sample rate reducer" },
  { label: "speed", detail: ".speed(factor) — sample playback speed" },
  { label: "begin", detail: ".begin(0..1) — sample start offset" },
  { label: "end", detail: ".end(0..1) — sample end offset" },
  { label: "loop", detail: ".loop(1) — loop sample" },
  { label: "loopBegin", detail: ".loopBegin(0..1)" },
  { label: "loopEnd", detail: ".loopEnd(0..1)" },
  // Mini-notation helpers
  { label: "mini", detail: "mini(string) — parse mini-notation" },
  { label: "reify", detail: "reify(value) — lift value to pattern" },
  // Structure
  { label: "rev", detail: ".rev() — reverse pattern" },
  { label: "palindrome", detail: ".palindrome() — forward then reverse" },
  { label: "jux", detail: ".jux(fn) — apply fn to right channel only" },
  { label: "off", detail: ".off(time, fn) — offset transformed copy" },
  { label: "superimpose", detail: ".superimpose(fn) — stack with transformed copy" },
  { label: "layer", detail: ".layer(...fns)" },
  // Scale
  { label: "scale", detail: ".scale(name) — quantize to scale" },
  { label: "scaleTranspose", detail: ".scaleTranspose(n)" },
  // Randomness
  { label: "rand", detail: "rand — random 0..1 signal" },
  { label: "irand", detail: "irand(max) — random integer" },
  { label: "perlin", detail: "perlin — smooth noise" },
  { label: "choose", detail: "choose(...values) — random pick" },
  { label: "wchoose", detail: "wchoose(...[val,weight])" },
  { label: "shuffle", detail: ".shuffle() — random order" },
];

export const STRUDEL_SAMPLES: string[] = [
  "bd", "sn", "hh", "oh", "cp", "rim", "mt", "ht", "lt", "cy", "cr", "cb",
  "808", "808bd", "808sd", "808hc", "808oh", "bass", "bass0", "bass1", "bass2",
  "arpy", "arp", "jazz", "gtr", "feel", "blip", "bleep", "birds",
  "piano", "violin", "cello", "flute", "clarinet", "oboe", "trumpet", "trombone",
  "sitar", "banjo", "vibraphone", "marimba", "xylophone", "choir-aahs",
  "lead-1-square", "lead-2-sawtooth", "pad-1-new-age", "pad-2-warm",
  "synth-bass-1", "synth-bass-2", "electric-guitar-jazz", "acoustic-guitar-nylon",
];

export const STRUDEL_MONARCH_TOKENS: Monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      [/setcpm|stack|cat|seq|fastcat|slowcat|note|sound|chord|freq|mini/, "keyword.strudel"],
      [/\.(gain|pan|room|delay|delaytime|cutoff|resonance|speed|attack|decay|sustain|release|fast|slow|rev|jux|off|scale|crush|loop|begin|end|every|sometimes|often|rarely)/, "method.strudel"],
      [/\b(bd|sn|hh|oh|cp|piano|bass|arpy|jazz)\b/, "sample.strudel"],
      [/"[^"]*"/, "string"],
      [/'[^']*'/, "string"],
      [/`[^`]*`/, "string.template"],
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/\d+(\.\d+)?/, "number"],
      [/[{}()\[\]]/, "bracket"],
    ],
    comment: [
      [/\*\//, "comment", "@pop"],
      [/./, "comment"],
    ],
  },
};

export function registerStrudelLanguage(monacoInstance: typeof Monaco): void {
  // Prevent double-registration
  const existing = monacoInstance.languages.getLanguages().find(l => l.id === "strudel");
  if (existing) return;

  monacoInstance.languages.register({ id: "strudel" });

  monacoInstance.languages.setMonarchTokensProvider("strudel", STRUDEL_MONARCH_TOKENS);

  monacoInstance.editor.defineTheme("strudel-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.strudel", foreground: "00d4aa", fontStyle: "bold" },
      { token: "method.strudel", foreground: "4a9eff" },
      { token: "sample.strudel", foreground: "f59e0b" },
      { token: "string", foreground: "4abf7a" },
      { token: "number", foreground: "c084fc" },
      { token: "comment", foreground: "3a5060", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#05070a",
      "editor.foreground": "#c8e6d8",
      "editor.lineHighlightBackground": "#0a1018",
      "editorCursor.foreground": "#00d4aa",
      "editor.selectionBackground": "#1a3a2a",
    },
  });

  monacoInstance.languages.registerCompletionItemProvider("strudel", {
    triggerCharacters: ['"', "'", "("],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };

      const fnItems: Monaco.languages.CompletionItem[] = STRUDEL_FUNCTIONS.map(f => ({
        label: f.label,
        kind: monacoInstance.languages.CompletionItemKind.Function,
        detail: f.detail,
        insertText: f.label,
        range,
      }));

      const sampleItems: Monaco.languages.CompletionItem[] = STRUDEL_SAMPLES.map(s => ({
        label: s,
        kind: monacoInstance.languages.CompletionItemKind.Value,
        detail: `sample: ${s}`,
        insertText: s,
        range,
      }));

      return { suggestions: [...fnItems, ...sampleItems] };
    },
  });

  monacoInstance.languages.registerHoverProvider("strudel", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const fn = STRUDEL_FUNCTIONS.find(f => f.label === word.word);
      if (!fn) return null;
      return {
        contents: [{ value: `**${fn.label}** — ${fn.detail}` }],
      };
    },
  });
}
```

- [ ] **Step 2.2: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 2.3: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/lib/strudelLanguage.ts
git commit -m "feat: add Strudel Monaco language definition — tokens, completions, hover docs"
```

---

## Task 3: CodeEditor component

**Files:**
- Create: `frontend/src/components/CodeEditor.tsx`
- Create: `frontend/src/components/CodeEditor.test.tsx`

- [ ] **Step 3.1: Scrivi il test (smoke test)**

```typescript
// frontend/src/components/CodeEditor.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CodeEditor } from "./CodeEditor";

// Monaco doesn't load in jsdom — mock @monaco-editor/react
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="monaco-mock"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={false}
    />
  ),
  useMonaco: () => null,
}));

describe("CodeEditor", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(
      <CodeEditor
        value="note('c3')"
        onChange={vi.fn()}
        readOnly={false}
        onEvaluateNow={vi.fn()}
      />
    );
    expect(getByTestId("monaco-mock")).toBeInTheDocument();
  });

  it("calls onChange when value changes", async () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <CodeEditor value="note('c3')" onChange={onChange} readOnly={false} onEvaluateNow={vi.fn()} />
    );
    const textarea = getByTestId("monaco-mock") as HTMLTextAreaElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(textarea, { target: { value: "note('d3')" } });
    expect(onChange).toHaveBeenCalledWith("note('d3')");
  });
});
```

- [ ] **Step 3.2: Esegui i test — devono FALLIRE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose CodeEditor
```
Expected: `Cannot find module './CodeEditor'`

- [ ] **Step 3.3: Implementa `CodeEditor.tsx`**

```typescript
// frontend/src/components/CodeEditor.tsx
import Editor, { useMonaco } from "@monaco-editor/react";
import { useEffect } from "react";
import { registerStrudelLanguage } from "../lib/strudelLanguage";

interface Props {
  value: string;
  onChange: (code: string) => void;
  readOnly: boolean;
  onEvaluateNow: () => void;
}

export function CodeEditor({ value, onChange, readOnly, onEvaluateNow }: Props) {
  const monacoInstance = useMonaco();

  useEffect(() => {
    if (!monacoInstance) return;
    registerStrudelLanguage(monacoInstance);
  }, [monacoInstance]);

  return (
    <Editor
      height="100%"
      language="strudel"
      theme="strudel-dark"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
        lineNumbers: "off",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        readOnly,
        renderLineHighlight: "line",
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        padding: { top: 14, bottom: 14 },
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: true },
        tabSize: 2,
        insertSpaces: true,
        scrollbar: { vertical: "auto", horizontal: "hidden" },
      }}
      onMount={(editor) => {
        // Ctrl+Enter → evaluate immediately
        editor.addCommand(
          // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter = 2048 | 3
          2048 | 3,
          () => onEvaluateNow()
        );
      }}
    />
  );
}
```

- [ ] **Step 3.4: Esegui i test — devono PASSARE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose CodeEditor
```
Expected: `2 passed`

- [ ] **Step 3.5: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/components/CodeEditor.tsx frontend/src/components/CodeEditor.test.tsx
git commit -m "feat: add CodeEditor component wrapping Monaco with Strudel language"
```

---

## Task 4: Integra CodeEditor in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 4.1: Sostituisci `<textarea>` con `<CodeEditor>` in `App.tsx`**

Aggiungi import in cima:
```typescript
import { CodeEditor } from "./components/CodeEditor";
```

Trova il blocco `<textarea ... />` nel JSX (nella "Code column") e sostituiscilo con:

```tsx
<CodeEditor
  value={isCodeAnimating ? displayedCode : code}
  onChange={(v) => {
    if (!isWaiting && !isCodeAnimating) setCode(v);
  }}
  readOnly={isWaiting || isCodeAnimating}
  onEvaluateNow={() => {
    if (evaluateNowRef.current) evaluateNowRef.current(code);
  }}
/>
```

Rimuovi anche il `onKeyDown` handler del Tab che era sulla textarea (Monaco gestisce Tab nativamente).

- [ ] **Step 4.2: Verifica TypeScript**

```bash
cd /Users/vitto/Desktop/music/frontend && npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 4.3: Esegui test suite**

```bash
npm test -- --reporter=verbose
```
Expected: tutti i test passano.

- [ ] **Step 4.4: Commit finale Sprint 3**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/App.tsx
git commit -m "feat: replace textarea with Monaco CodeEditor — Strudel syntax, autocomplete, Ctrl+Enter"
```
