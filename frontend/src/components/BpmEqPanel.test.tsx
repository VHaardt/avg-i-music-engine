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
