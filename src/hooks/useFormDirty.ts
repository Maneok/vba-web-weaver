import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Track if a form has unsaved changes. Optionally warns on page leave.
 */
export function useFormDirty<T extends Record<string, unknown>>(
  initialValues: T,
  options?: { warnOnLeave?: boolean }
): {
  isDirty: boolean;
  setFieldValue: (field: keyof T, value: unknown) => void;
  currentValues: T;
  reset: (newValues?: T) => void;
  getChangedFields: () => Array<keyof T>;
} {
  const [values, setValues] = useState<T>(initialValues);
  const initialRef = useRef<T>(initialValues);

  const isDirty = Object.keys(initialRef.current).some(
    key => values[key] !== initialRef.current[key]
  );

  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback((newValues?: T) => {
    const v = newValues ?? initialRef.current;
    initialRef.current = v;
    setValues(v);
  }, []);

  const getChangedFields = useCallback((): Array<keyof T> => {
    return Object.keys(initialRef.current).filter(
      key => values[key] !== initialRef.current[key]
    ) as Array<keyof T>;
  }, [values]);

  // Warn on page leave
  useEffect(() => {
    if (!options?.warnOnLeave || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, options?.warnOnLeave]);

  return { isDirty, setFieldValue, currentValues: values, reset, getChangedFields };
}
