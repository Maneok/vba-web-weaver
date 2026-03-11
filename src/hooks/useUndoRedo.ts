import { useState, useCallback, useRef } from "react";

/**
 * Undo/redo state management hook.
 */
export function useUndoRedo<T>(
  initialState: T,
  maxHistory: number = 50
): {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newState?: T) => void;
  historyLength: number;
} {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);

  const setState = useCallback((newState: T) => {
    setPast(prev => {
      const next = [...prev, present];
      return next.length > maxHistory ? next.slice(-maxHistory) : next;
    });
    setPresent(newState);
    setFuture([]);
  }, [present, maxHistory]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, present]);
    setPresent(next);
  }, [future, present]);

  const reset = useCallback((newState?: T) => {
    setPast([]);
    setFuture([]);
    setPresent(newState ?? initialState);
  }, [initialState]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    reset,
    historyLength: past.length,
  };
}
