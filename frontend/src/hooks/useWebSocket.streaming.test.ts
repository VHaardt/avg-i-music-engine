import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    MockWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("useWebSocket streaming", () => {
  it("accumulates stream_chunk into streamingText", () => {
    const { result } = renderHook(() => useWebSocket("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "Ciao " }) }); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "mondo" }) }); });

    expect(result.current.streamingText).toBe("Ciao mondo");
  });

  it("resets streamingText when update arrives", () => {
    const { result } = renderHook(() => useWebSocket("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "partial" }) }); });
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: "update", code: "", knobs: [], message: "Done", creative_mode: false,
        }),
      });
    });

    expect(result.current.streamingText).toBe("");
    expect(result.current.lastUpdate?.message).toBe("Done");
  });
});
