import { useState, useEffect, useCallback, useRef } from "react";

interface CountdownOptions {
  /** Target date to count down to */
  targetDate?: Date | string;
  /** Duration in milliseconds (alternative to targetDate) */
  durationMs?: number;
  /** Callback when countdown reaches zero */
  onComplete?: () => void;
  /** Auto-start (default: true) */
  autoStart?: boolean;
}

interface CountdownResult {
  /** Total milliseconds remaining */
  timeLeft: number;
  /** Whether the countdown is actively running */
  isRunning: boolean;
  /** Whether the countdown has completed */
  isComplete: boolean;
  /** Formatted breakdown */
  formatted: { days: number; hours: number; minutes: number; seconds: number };
  /** Start/resume the countdown */
  start: () => void;
  /** Pause the countdown */
  pause: () => void;
  /** Reset the countdown */
  reset: () => void;
}

function formatTimeLeft(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Countdown timer hook with start/pause/reset controls.
 */
export function useCountdown(options: CountdownOptions): CountdownResult {
  const { targetDate, durationMs, onComplete, autoStart = true } = options;

  const getInitialTimeLeft = useCallback(() => {
    if (targetDate) {
      const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
      return Math.max(0, target.getTime() - Date.now());
    }
    return durationMs ?? 0;
  }, [targetDate, durationMs]);

  const [timeLeft, setTimeLeft] = useState(getInitialTimeLeft);
  const [isRunning, setIsRunning] = useState(autoStart && getInitialTimeLeft() > 0);
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = targetDate
          ? Math.max(0, (typeof targetDate === "string" ? new Date(targetDate) : targetDate).getTime() - Date.now())
          : Math.max(0, prev - 1000);

        if (next <= 0) {
          setIsRunning(false);
          setIsComplete(true);
          onCompleteRef.current?.();
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, targetDate, timeLeft]);

  const start = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
      setIsComplete(false);
    }
  }, [timeLeft]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setTimeLeft(getInitialTimeLeft());
    setIsRunning(false);
    setIsComplete(false);
  }, [getInitialTimeLeft]);

  return {
    timeLeft,
    isRunning,
    isComplete,
    formatted: formatTimeLeft(timeLeft),
    start,
    pause,
    reset,
  };
}
