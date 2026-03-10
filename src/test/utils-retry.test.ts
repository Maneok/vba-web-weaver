/**
 * Tests for src/lib/utils/retry.ts
 * Features #30-31: withRetry, withTimeout
 */

import { withRetry, withTimeout } from "@/lib/utils/retry";

describe("Feature #30: withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, backoffFactor: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after all retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }))
      .rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("defaults to 3 retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(4); // 1 + 3
  });

  it("retries with 0 maxRetries means no retry", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { maxRetries: 0, baseDelayMs: 10 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("Feature #31: withTimeout", () => {
  it("resolves if promise completes within timeout", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      1000
    );
    expect(result).toBe("ok");
  });

  it("rejects if promise exceeds timeout", async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50))
      .rejects.toThrow(/timed out/i);
  });

  it("uses custom error message", async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50, "Trop lent!"))
      .rejects.toThrow("Trop lent!");
  });

  it("clears timeout on success (no memory leak)", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    await withTimeout(Promise.resolve("ok"), 1000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
