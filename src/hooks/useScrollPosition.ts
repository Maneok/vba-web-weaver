import { useState, useEffect, useCallback } from "react";

/**
 * Track scroll position with optional throttling.
 */
export function useScrollPosition(throttleMs: number = 100): {
  scrollX: number;
  scrollY: number;
  isAtTop: boolean;
  isAtBottom: boolean;
  scrollDirection: "up" | "down" | null;
} {
  const [position, setPosition] = useState({
    scrollX: 0,
    scrollY: 0,
    isAtTop: true,
    isAtBottom: false,
    scrollDirection: null as "up" | "down" | null,
  });

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const updatePosition = () => {
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const isAtTop = scrollY <= 0;
      const isAtBottom = scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5;
      const scrollDirection = scrollY > lastY ? "down" : scrollY < lastY ? "up" : null;

      setPosition({ scrollX, scrollY, isAtTop, isAtBottom, scrollDirection });
      lastY = scrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        if (throttleMs > 0) {
          setTimeout(updatePosition, throttleMs);
        } else {
          requestAnimationFrame(updatePosition);
        }
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [throttleMs]);

  return position;
}
