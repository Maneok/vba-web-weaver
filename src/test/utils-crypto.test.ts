/**
 * Tests for src/lib/utils/crypto.ts
 * Features #16-18: generateId, hashString, generateSecureToken
 */
import { generateId, hashString, generateSecureToken } from "@/lib/utils/crypto";

describe("Feature #16: generateId", () => {
  it("returns a UUID v4 format", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("Feature #17: hashString", () => {
  it("returns a 64-char hex string (SHA-256)", async () => {
    const hash = await hashString("hello");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("same input → same hash", async () => {
    const h1 = await hashString("test");
    const h2 = await hashString("test");
    expect(h1).toBe(h2);
  });
  it("different input → different hash", async () => {
    const h1 = await hashString("hello");
    const h2 = await hashString("world");
    expect(h1).not.toBe(h2);
  });
  it("empty string → empty", async () => {
    expect(await hashString("")).toBe("");
  });
});

describe("Feature #18: generateSecureToken", () => {
  it("generates token of specified length", () => {
    expect(generateSecureToken(16).length).toBe(16);
    expect(generateSecureToken(64).length).toBe(64);
  });
  it("default length is 32", () => {
    expect(generateSecureToken().length).toBe(32);
  });
  it("generates hex chars only", () => {
    expect(generateSecureToken(32)).toMatch(/^[0-9a-f]+$/);
  });
  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSecureToken()));
    expect(tokens.size).toBe(50);
  });
});
