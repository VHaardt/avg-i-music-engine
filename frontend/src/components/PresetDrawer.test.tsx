import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PresetDrawer } from "./PresetDrawer";
import type { Preset } from "../types";

const emptyPreset = (): Preset => ({ name: null, code: null, bpm: 120, color: null, createdAt: null });

const makePresets = (count = 16): Preset[] =>
  Array.from({ length: count }, emptyPreset);

const openDrawer = () => fireEvent.click(screen.getByText("◈ PRESETS"));

describe("PresetDrawer", () => {
  it("renders all 16 slot tiles", () => {
    render(
      <PresetDrawer
        presets={makePresets()}
        activeSlot={null}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    openDrawer();
    for (let i = 1; i <= 16; i++) {
      expect(screen.getAllByText(String(i)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("calls onLoad when clicking a filled slot", () => {
    const presets = makePresets();
    presets[2] = { name: "Bass", code: "note('c3')", bpm: 120, color: null, createdAt: Date.now() };
    const onLoad = vi.fn();
    render(
      <PresetDrawer
        presets={presets} activeSlot={null}
        onSave={vi.fn()} onLoad={onLoad} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    openDrawer();
    fireEvent.click(screen.getByText("Bass"));
    expect(onLoad).toHaveBeenCalledWith(2);
  });

  it("shows BPM badge on filled slots", () => {
    const presets = makePresets();
    presets[0] = { name: "Kick", code: "setcpm(30)\nsound('bd')", bpm: 120, color: null, createdAt: Date.now() };
    render(
      <PresetDrawer
        presets={presets} activeSlot={0}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={vi.fn()} onColor={vi.fn()}
      />
    );
    openDrawer();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("calls onRename after inline edit", () => {
    const presets = makePresets();
    presets[0] = { name: "Old Name", code: "note('c3')", bpm: 120, color: null, createdAt: Date.now() };
    const onRename = vi.fn();
    render(
      <PresetDrawer
        presets={presets} activeSlot={0}
        onSave={vi.fn()} onLoad={vi.fn()} onSetActive={vi.fn()}
        onClear={vi.fn()} onRename={onRename} onColor={vi.fn()}
      />
    );
    openDrawer();
    fireEvent.doubleClick(screen.getByText("Old Name"));
    const input = screen.getByDisplayValue("Old Name");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith(0, "New Name");
  });
});
