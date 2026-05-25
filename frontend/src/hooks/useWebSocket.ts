import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateMessage, WsOutMessage } from "../types";

const RECONNECT_DELAY_MS = 3000;

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<UpdateMessage | null>(null);
  const [streamingText, setStreamingText] = useState("");

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onclose = () => {
        setIsConnected(false);
        setStreamingText("");
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg?.type === "stream_chunk") {
            setStreamingText((prev) => prev + (msg.text ?? ""));
          } else if (msg?.type === "update") {
            setStreamingText("");
            setLastUpdate(msg as UpdateMessage);
          }
        } catch { /* ignore malformed messages */ }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [url]);

  const sendMessage = useCallback((msg: WsOutMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, lastUpdate, sendMessage, streamingText };
}
