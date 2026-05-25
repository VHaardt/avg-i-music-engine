import { useCallback, useEffect, useRef, useState } from "react";

interface UseSceneQueueOptions {
  bpm: number;
  isPlaying: boolean;
  onSwap?: (slot: number) => void;
}

export interface UseSceneQueueReturn {
  queuedSlot: number | null;
  queueScene: (slot: number) => void;
  cancelQueue: () => void;
}

export function useSceneQueue({ bpm, isPlaying, onSwap }: UseSceneQueueOptions): UseSceneQueueReturn {
  const [queuedSlot, setQueuedSlot] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const queueScene = useCallback((slot: number) => {
    setQueuedSlot(slot);
  }, []);

  const cancelQueue = useCallback(() => {
    clearTimer();
    setQueuedSlot(null);
  }, []);

  useEffect(() => {
    if (queuedSlot === null || !isPlaying) {
      clearTimer();
      return;
    }

    const cycleLengthMs = (4 * 60 * 1000) / bpm;
    clearTimer();
    timerRef.current = setInterval(() => {
      const slot = queuedSlot;
      clearTimer();
      setQueuedSlot(null);
      onSwapRef.current?.(slot);
    }, cycleLengthMs);

    return clearTimer;
  }, [queuedSlot, isPlaying, bpm]);

  return { queuedSlot, queueScene, cancelQueue };
}
