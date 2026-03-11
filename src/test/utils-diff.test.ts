/**
 * Tests for src/lib/utils/diff.ts
 * Features #19-21: objectDiff, formatDiffEntry, hasChanges
 */
import { objectDiff, formatDiffEntry, hasChanges } from "@/lib/utils/diff";

describe("Feature #19: objectDiff", () => {
  it("detects changed fields", () => {
    const old = { name: "A", age: 30 };
    const updated = { name: "B", age: 30 };
    const diffs = objectDiff(old, updated);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe("name");
    expect(diffs[0].oldValue).toBe("A");
    expect(diffs[0].newValue).toBe("B");
  });
  it("detects multiple changes", () => {
    const diffs = objectDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 88 });
    expect(diffs).toHaveLength(2);
  });
  it("ignores specified fields", () => {
    const diffs = objectDiff({ a: 1, b: 2 }, { a: 99, b: 2 }, ["a"]);
    expect(diffs).toHaveLength(0);
  });
  it("treats null/undefined/empty as equivalent", () => {
    const diffs = objectDiff({ a: null, b: "" }, { a: undefined, b: null } as any);
    expect(diffs).toHaveLength(0);
  });
  it("returns empty for identical objects", () => {
    expect(objectDiff({ x: 1 }, { x: 1 })).toHaveLength(0);
  });
  it("handles null inputs", () => {
    expect(objectDiff(null as any, { x: 1 })).toEqual([]);
  });
});

describe("Feature #20: formatDiffEntry", () => {
  it("formats a change", () => {
    const result = formatDiffEntry({ field: "nom", oldValue: "A", newValue: "B" });
    expect(result).toContain("nom");
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
  it("formats an addition", () => {
    const result = formatDiffEntry({ field: "ville", oldValue: null, newValue: "Paris" });
    expect(result).toContain("ajouté");
    expect(result).toContain("Paris");
  });
  it("formats a deletion", () => {
    const result = formatDiffEntry({ field: "mail", oldValue: "a@b.fr", newValue: null });
    expect(result).toContain("supprimé");
  });
});

describe("Feature #21: hasChanges", () => {
  it("returns true when changes exist", () => {
    expect(hasChanges({ a: 1 }, { a: 2 })).toBe(true);
  });
  it("returns false when no changes", () => {
    expect(hasChanges({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(false);
  });
  it("respects ignore fields", () => {
    expect(hasChanges({ a: 1, b: 2 }, { a: 99, b: 2 }, ["a"])).toBe(false);
  });
});
