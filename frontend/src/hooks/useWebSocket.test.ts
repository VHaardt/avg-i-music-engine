import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

let lastInstance: any = null;

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {
    lastInstance = this;
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal("WebSocket", MockWebSocket);

test("exposes sendMessage, lastUpdate, isConnected", () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  expect(result.current.sendMessage).toBeDefined();
  expect(result.current.lastUpdate).toBeNull();
  expect(result.current.isConnected).toBe(false);
});

test("isConnected becomes true after onopen fires", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  expect(result.current.isConnected).toBe(true);
});

test("isConnected becomes false when onclose fires", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  expect(result.current.isConnected).toBe(true);
  await act(async () => { lastInstance.onclose?.(); });
  expect(result.current.isConnected).toBe(false);
});

test("lastUpdate is set when onmessage receives type=update", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  const updateMsg = { type: "update", code: '$: note("c3")', knobs: [], message: "Test", creative_mode: false };
  await act(async () => {
    lastInstance.onmessage?.({ data: JSON.stringify(updateMsg) });
  });
  expect(result.current.lastUpdate).toEqual(updateMsg);
});

test("lastUpdate is NOT set when message type is not update", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  await act(async () => {
    lastInstance.onmessage?.({ data: JSON.stringify({ type: "connected" }) });
  });
  expect(result.current.lastUpdate).toBeNull();
});

test("sendMessage serializes and sends via WebSocket", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  result.current.sendMessage({ type: "user_message", message: "ciao" });
  expect(lastInstance.send).toHaveBeenCalledWith('{"type":"user_message","message":"ciao"}');
});
