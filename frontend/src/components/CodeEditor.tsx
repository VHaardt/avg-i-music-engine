import Editor from "@monaco-editor/react";
import { registerStrudelLanguage } from "../lib/strudelLanguage";

interface Props {
  value: string;
  onChange: (code: string) => void;
  readOnly: boolean;
  onEvaluateNow: () => void;
}

export function CodeEditor({ value, onChange, readOnly, onEvaluateNow }: Props) {
  return (
    <Editor
      height="100%"
      language="strudel"
      theme="strudel-dark"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      beforeMount={(monaco) => {
        registerStrudelLanguage(monaco);
      }}
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
        editor.addCommand(
          2048 | 3, // CtrlCmd + Enter
          () => onEvaluateNow()
        );
      }}
    />
  );
}
