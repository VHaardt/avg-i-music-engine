import { useEffect, useRef, useState } from "react";

/**
 * Animates `target` from empty to full, returning [displayedString, isAnimating].
 * `charsPerTick` controls how many characters are revealed per ~16ms frame.
 */
export function useTypewriter(target: string, charsPerTick = 1): [string, boolean] {
  const [displayed, setDisplayed] = useState(target);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevRef = useRef(target);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (target === prevRef.current) return;
    prevRef.current = target;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setDisplayed("");
    setIsAnimating(true);
    let i = 0;

    timerRef.current = setInterval(() => {
      i += charsPerTick;
      if (i >= target.length) {
        setDisplayed(target);
        setIsAnimating(false);
        clearInterval(timerRef.current!);
        timerRef.current = null;
      } else {
        setDisplayed(target.slice(0, i));
      }
    }, 16);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [target, charsPerTick]);

  return [displayed, isAnimating];
}
