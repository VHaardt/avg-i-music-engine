import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CodeEditor } from "./CodeEditor";

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
