import { renderHook, act } from "@testing-library/react";
import { useReducedMotion, useAutoRefreshInterval } from "@/components/dashboard/DashboardReducedMotion";

describe("useReducedMotion", () => {
  it("returns false by default (jsdom does not support media queries)", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});

describe("useAutoRefreshInterval", () => {
  const STORAGE_KEY = "dashboard-refresh-interval";
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};

    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };

    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it("returns default 60000 when no stored value", () => {
    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(result.current[0]).toBe(60000);
  });

  it("stores value in localStorage when setter is called", () => {
    const { result } = renderHook(() => useAutoRefreshInterval());

    act(() => {
      result.current[1](30000);
    });

    expect(result.current[0]).toBe(30000);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "30000");
  });

  it("reads stored value from localStorage on init", () => {
    store[STORAGE_KEY] = "120000";

    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(result.current[0]).toBe(120000);
  });

  it("rejects invalid values and falls back to default", () => {
    store[STORAGE_KEY] = "99999";

    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(result.current[0]).toBe(60000);
  });

  it("rejects non-numeric stored values and falls back to default", () => {
    store[STORAGE_KEY] = "abc";

    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(result.current[0]).toBe(60000);
  });

  it("accepts valid value 0 (disabled)", () => {
    store[STORAGE_KEY] = "0";

    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(result.current[0]).toBe(0);
  });

  it("accepts all valid interval values", () => {
    const validValues = [0, 30000, 60000, 120000, 300000];

    for (const value of validValues) {
      store[STORAGE_KEY] = String(value);
      const { result } = renderHook(() => useAutoRefreshInterval());
      expect(result.current[0]).toBe(value);
    }
  });

  it("returns a setter function as the second element", () => {
    const { result } = renderHook(() => useAutoRefreshInterval());
    expect(typeof result.current[1]).toBe("function");
  });
});
