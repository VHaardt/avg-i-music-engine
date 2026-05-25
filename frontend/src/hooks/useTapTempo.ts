import { useCallback, useRef } from "react";

const MAX_TAPS = 4;
const RESET_TIMEOUT_MS = 2000;
const MIN_TAPS_FOR_BPM = 3;

interface UseTapTempoOptions {
  onBpm: (bpm: number) => void;
}

export function useTapTempo({ onBpm }: UseTapTempoOptions) {
  const tapsRef = useRef<number[]>([]);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tap = useCallback(() => {
    const now = performance.now();

    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => { tapsRef.current = []; }, RESET_TIMEOUT_MS);

    tapsRef.current = [...tapsRef.current.slice(-(MAX_TAPS - 1)), now];

    if (tapsRef.current.length < MIN_TAPS_FOR_BPM) return;

    const intervals: number[] = [];
    for (let i = 1; i < tapsRef.current.length; i++) {
      intervals.push(tapsRef.current[i] - tapsRef.current[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);
    onBpm(Math.max(40, Math.min(240, bpm)));
  }, [onBpm]);

  return { tap };
}
