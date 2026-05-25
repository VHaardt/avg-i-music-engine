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
