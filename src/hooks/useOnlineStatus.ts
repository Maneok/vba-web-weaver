import { useState, useEffect, useRef } from "react";

/**
 * Track browser online/offline status.
 */
export function useOnlineStatus(): {
  isOnline: boolean;
  lastChangedAt: Date | null;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChangedAt(new Date());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLastChangedAt(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, lastChangedAt };
}
