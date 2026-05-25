import { useEffect, useRef } from "react";

interface Props {
  isPlaying: boolean;
  bpm: number;
  large?: boolean;
}

export function BeatIndicator({ isPlaying, bpm, large = false }: Props) {
  const dotRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying || bpm <= 0) return;

    const beatMs = (60 * 1000) / bpm;

    const pulse = () => {
      const el = dotRef.current;
      if (!el) return;
      el.style.opacity = "1";
      el.style.transform = large ? "scale(1.4)" : "scale(1.3)";
      setTimeout(() => {
        if (!el) return;
        el.style.opacity = "0.3";
        el.style.transform = "scale(1)";
      }, 80);
    };

    pulse();
    timerRef.current = setInterval(pulse, beatMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, large]);

  const size = large ? 16 : 8;

  return (
    <div
      ref={dotRef}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: "#00d4aa",
        opacity: isPlaying ? 0.3 : 0.1,
        transition: "opacity 0.08s, transform 0.08s",
        flexShrink: 0,
      }}
    />
  );
}
