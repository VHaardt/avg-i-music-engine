import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSceneQueue } from "./useSceneQueue";

describe("useSceneQueue", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("starts with no queued slot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    expect(result.current.queuedSlot).toBeNull();
  });

  it("queueScene sets queuedSlot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(3); });
    expect(result.current.queuedSlot).toBe(3);
  });

  it("cancelQueue clears queuedSlot", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(3); });
    act(() => { result.current.cancelQueue(); });
    expect(result.current.queuedSlot).toBeNull();
  });

  it("queueing second slot replaces first", () => {
    const { result } = renderHook(() => useSceneQueue({ bpm: 120, isPlaying: false }));
    act(() => { result.current.queueScene(2); });
    act(() => { result.current.queueScene(5); });
    expect(result.current.queuedSlot).toBe(5);
  });

  it("fires onSwap after one cycle when playing", () => {
    const onSwap = vi.fn();
    const { result } = renderHook(() =>
      useSceneQueue({ bpm: 120, isPlaying: true, onSwap })
    );
    // At 120 BPM: cycle = 4 * 60000 / 120 = 2000ms
    act(() => { result.current.queueScene(1); });
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onSwap).toHaveBeenCalledWith(1);
    expect(result.current.queuedSlot).toBeNull();
  });
});
