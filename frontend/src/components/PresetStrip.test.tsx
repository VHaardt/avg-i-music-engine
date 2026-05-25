import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { PresetStrip } from "./PresetStrip";
import type { Preset } from "../types";

const emptyPresets: Preset[] = Array.from({ length: 16 }, () => ({ name: null, code: null, bpm: 120 }));

test("renders 16 preset buttons", () => {
  render(<PresetStrip presets={emptyPresets} activeSlot={0} onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()} />);
  for (let i = 1; i <= 16; i++) expect(screen.getByText(String(i))).toBeInTheDocument();
});

test("SAVE button calls onSave with active slot", () => {
  const onSave = vi.fn();
  render(<PresetStrip presets={emptyPresets} activeSlot={3} onSave={onSave} onLoad={vi.fn()} onSetActive={vi.fn()} />);
  fireEvent.click(screen.getByText(/save/i));
  expect(onSave).toHaveBeenCalledWith(3);
});

test("clicking a saved slot calls onLoad with slot index", () => {
  const onLoad = vi.fn();
  const presets = emptyPresets.map((p, i) => i === 5 ? { ...p, code: '$: sound("bd")' } : p);
  render(<PresetStrip presets={presets} activeSlot={0} onSave={vi.fn()} onLoad={onLoad} onSetActive={vi.fn()} />);
  fireEvent.click(screen.getByText("6")); // slot 5 = button label 6
  expect(onLoad).toHaveBeenCalledWith(5);
});

test("clicking any slot calls onSetActive", () => {
  const onSetActive = vi.fn();
  render(<PresetStrip presets={emptyPresets} activeSlot={0} onSave={vi.fn()} onLoad={vi.fn()} onSetActive={onSetActive} />);
  fireEvent.click(screen.getByText("4"));
  expect(onSetActive).toHaveBeenCalledWith(3); // label 4 = index 3
});
