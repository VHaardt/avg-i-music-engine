import { renderHook, act } from "@testing-library/react";
import { usePresets } from "./usePresets";

beforeEach(() => localStorage.clear());

test("initialises with 16 empty slots", () => {
  const { result } = renderHook(() => usePresets());
  expect(result.current.presets).toHaveLength(16);
  result.current.presets.forEach(p => expect(p.code).toBeNull());
});

test("savePreset stores code and bpm in slot", () => {
  const { result } = renderHook(() => usePresets());
  act(() => { result.current.savePreset(0, '$: sound("bd")', 128); });
  expect(result.current.presets[0].code).toBe('$: sound("bd")');
  expect(result.current.presets[0].bpm).toBe(128);
});

test("savePreset persists to localStorage", () => {
  const { result } = renderHook(() => usePresets());
  act(() => { result.current.savePreset(2, '$: note("c3")', 120); });
  const stored = JSON.parse(localStorage.getItem("avgI_presets")!);
  expect(stored[2].code).toBe('$: note("c3")');
});

test("loadPreset returns code and bpm for saved slot", () => {
  const { result } = renderHook(() => usePresets());
  act(() => { result.current.savePreset(3, '$: sound("hh")', 140); });
  const loaded = result.current.loadPreset(3);
  expect(loaded?.code).toBe('$: sound("hh")');
  expect(loaded?.bpm).toBe(140);
});

test("loadPreset returns null for empty slot", () => {
  const { result } = renderHook(() => usePresets());
  expect(result.current.loadPreset(5)).toBeNull();
});

test("clearPreset empties a slot", () => {
  const { result } = renderHook(() => usePresets());
  act(() => { result.current.savePreset(1, '$: sound("bd")', 120); });
  act(() => { result.current.clearPreset(1); });
  expect(result.current.presets[1].code).toBeNull();
});

test("activeSlot updates when setActiveSlot called", () => {
  const { result } = renderHook(() => usePresets());
  act(() => { result.current.setActiveSlot(7); });
  expect(result.current.activeSlot).toBe(7);
});
