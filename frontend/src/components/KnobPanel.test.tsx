import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { KnobPanel } from "./KnobPanel";
import { Knob } from "../types";

const knobs: Knob[] = [
  { name: "BPM", strudel_param: "setcps", min: 0.5, max: 3.0, value: 1.4, color: "#fc9" },
  { name: "Filtro", strudel_param: "lpf", min: 200, max: 8000, value: 800, color: "#9cf" },
];

test("renders knob labels", () => {
  render(<KnobPanel knobs={knobs} onKnobChange={vi.fn()} />);
  expect(screen.getByText("BPM")).toBeInTheDocument();
  expect(screen.getByText("Filtro")).toBeInTheDocument();
});

test("shows empty state when no knobs", () => {
  render(<KnobPanel knobs={[]} onKnobChange={vi.fn()} />);
  expect(screen.getByText(/nessun knob/i)).toBeInTheDocument();
});

test("calls onKnobChange with param and parsed value", () => {
  const onChange = vi.fn();
  render(<KnobPanel knobs={knobs} onKnobChange={onChange} />);
  const sliders = screen.getAllByRole("slider");
  fireEvent.change(sliders[0], { target: { value: "2.0" } });
  expect(onChange).toHaveBeenCalledWith("setcps", 2.0);
});

test("displays knob values with one decimal place", () => {
  render(<KnobPanel knobs={knobs} onKnobChange={vi.fn()} />);
  expect(screen.getByText("1.4")).toBeInTheDocument();
  expect(screen.getByText("800.0")).toBeInTheDocument();
});

test("updates multiple knobs independently", () => {
  const onChange = vi.fn();
  render(<KnobPanel knobs={knobs} onKnobChange={onChange} />);
  const sliders = screen.getAllByRole("slider");
  fireEvent.change(sliders[1], { target: { value: "4000" } });
  expect(onChange).toHaveBeenCalledWith("lpf", 4000);
});

test("grid container has overflowY auto and fills height", () => {
  const { container } = render(<KnobPanel knobs={knobs} onKnobChange={vi.fn()} />);
  const grid = container.firstChild as HTMLElement;
  expect(grid.style.overflowY).toBe("auto");
  expect(grid.style.height).toBe("100%");
});
