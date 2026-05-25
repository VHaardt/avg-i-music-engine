import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTapTempo } from "./useTapTempo";

describe("useTapTempo", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("needs 3 taps to emit BPM", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    expect(onBpm).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    expect(onBpm).toHaveBeenCalled();
  });

  it("calculates ~120 BPM from 500ms intervals", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    act(() => { vi.advanceTimersByTime(500); result.current.tap(); });
    const bpm = onBpm.mock.calls.at(-1)?.[0];
    expect(bpm).toBeGreaterThan(115);
    expect(bpm).toBeLessThan(125);
  });

  it("resets after 2s timeout", () => {
    const onBpm = vi.fn();
    const { result } = renderHook(() => useTapTempo({ onBpm }));
    act(() => { result.current.tap(); });
    act(() => { vi.advanceTimersByTime(2100); result.current.tap(); });
    expect(onBpm).not.toHaveBeenCalled();
  });
});
