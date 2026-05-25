import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isConnected: boolean;
  isWaiting: boolean;
  streamingText?: string;
}

const LABEL_STYLE_BASE: CSSProperties = {
  fontSize: "0.6rem",
  fontFamily: "monospace",
  letterSpacing: "2px",
  marginBottom: "5px",
};

function TypingIndicator() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ ...LABEL_STYLE_BASE, color: "#2a7a5a" }}>ASSISTANT</div>
      <div style={{
        background: "#0a1810", border: "1px solid #1a3824",
        borderRadius: "3px 14px 14px 14px",
        padding: "12px 16px",
        display: "flex", gap: "7px", alignItems: "center",
      }}>
        <span className="dot-pulse" style={{ animationDelay: "0ms" }} />
        <span className="dot-pulse" style={{ animationDelay: "200ms" }} />
        <span className="dot-pulse" style={{ animationDelay: "400ms" }} />
      </div>
    </div>
  );
}

export function Chat({ messages, onSend, isConnected, isWaiting, streamingText = "" }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [animatedContents, setAnimatedContents] = useState<string[]>(
    messages.map(m => m.content)
  );
  const prevLengthRef = useRef(messages.length);

  useEffect(() => {
    const len = messages.length;

    if (len < prevLengthRef.current) {
      setAnimatedContents(messages.map(m => m.content));
      prevLengthRef.current = len;
      return;
    }

    if (len === prevLengthRef.current) return;
    prevLengthRef.current = len;

    const lastIndex = len - 1;
    const lastMsg = messages[lastIndex];

    if (lastMsg.role !== "agent") {
      setAnimatedContents(messages.map(m => m.content));
      return;
    }

    setAnimatedContents(messages.map((m, i) => i < lastIndex ? m.content : ""));

    const target = lastMsg.content;
    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      const slice = target.slice(0, i);
      setAnimatedContents(prev => {
        const next = [...prev];
        next[lastIndex] = slice;
        return next;
      });
      if (i >= target.length) {
        setAnimatedContents(prev => {
          const next = [...prev];
          next[lastIndex] = target;
          return next;
        });
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [animatedContents, isWaiting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isConnected || isWaiting) return;
    onSend(text);
    setInput("");
  };

  const isDisabled = !isConnected || isWaiting;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#07090e" }}>

      {/* Header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid #1a2030",
        fontFamily: "monospace", fontSize: "0.62rem", color: "#4a6a8a",
        letterSpacing: "3px", display: "flex", alignItems: "center", gap: "8px",
        flexShrink: 0, background: "#05070c",
      }}>
        <span style={{ color: "#4a8aaa", fontSize: "0.8rem" }}>◈</span>
        AI ASSISTANT
        {isWaiting && (
          <span style={{ marginLeft: "auto" }}>
            <span className="spinner" />
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 14px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        {messages.map((msg, i) => {
          const content = animatedContents[i] ?? msg.content;
          const isLastAgent = msg.role === "agent" && i === messages.length - 1;
          const isStillAnimating = isLastAgent && content.length < msg.content.length;
          const isUser = msg.role === "user";

          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
            }}>
              {/* Role label */}
              <div style={{
                ...LABEL_STYLE_BASE,
                color: isUser ? "#3a6a9a" : "#2a7a5a",
              }}>
                {isUser ? "YOU" : "ASSISTANT"}
              </div>

              {/* Bubble */}
              <div style={{
                background: isUser ? "#0f1a2a" : "#0a1810",
                border: isUser ? "1px solid #1e3355" : "1px solid #1a3824",
                color: isUser ? "#90c0e8" : "#72cc88",
                borderRadius: isUser ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
                padding: "11px 15px",
                maxWidth: "90%",
                fontSize: "0.88rem",
                lineHeight: 1.65,
                wordBreak: "break-word",
              }}>
                {isUser ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>
                ) : (
                  <span className="md-content">
                    <ReactMarkdown>{content}</ReactMarkdown>
                    {isStillAnimating && <span className="cursor-blink">▋</span>}
                  </span>
                )}
                {isUser && isStillAnimating && <span className="cursor-blink">▋</span>}
              </div>
            </div>
          );
        })}

        {isWaiting && !streamingText && <TypingIndicator />}
        {streamingText && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ ...LABEL_STYLE_BASE, color: "#00d4aa66" }}>ASSISTANT</div>
            <div style={{
              background: "#0a1f18",
              border: "1px solid #1a3a2a",
              borderRadius: "0 12px 12px 12px",
              padding: "10px 14px",
              color: "#c8e6d8",
              fontSize: "0.88rem",
              lineHeight: "1.55",
              maxWidth: "88%",
              whiteSpace: "pre-wrap",
            }}>
              {streamingText}
              <span style={{
                display: "inline-block",
                width: "2px", height: "1em",
                background: "#00d4aa",
                marginLeft: "2px",
                animation: "blink 1s step-end infinite",
                verticalAlign: "text-bottom",
              }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: "flex", gap: "8px", padding: "12px 14px",
        borderTop: "1px solid #1a2030", flexShrink: 0,
        background: "#05070c",
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            !isConnected ? "In attesa di connessione..." :
            isWaiting    ? "In elaborazione..." :
                           "Descrivi cosa vuoi..."
          }
          disabled={isDisabled}
          style={{
            flex: 1, background: "#0c1020",
            border: `1px solid ${isDisabled ? "#141820" : "#1e2d48"}`,
            borderRadius: "10px", padding: "9px 14px",
            color: isDisabled ? "#3a4858" : "#b0c8e0",
            fontSize: "0.88rem", outline: "none",
            fontFamily: "system-ui, sans-serif",
            transition: "border-color 0.2s, color 0.2s",
          }}
        />
        <button
          type="submit"
          disabled={isDisabled}
          style={{
            background: isDisabled ? "#0a0e10" : "#0e2018",
            border: `1px solid ${isDisabled ? "#181e1e" : "#1e4030"}`,
            borderRadius: "10px", padding: "9px 18px",
            color: isDisabled ? "#2a4a3a" : "#6abf8a",
            cursor: isDisabled ? "default" : "pointer",
            fontSize: "1rem",
            transition: "all 0.15s",
          }}
        >
          →
        </button>
      </form>
    </div>
  );
}
