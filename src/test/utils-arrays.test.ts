/**
 * Tests for src/lib/utils/arrays.ts
 * Features #11-16: groupBy, sortBy, uniqBy, chunk, compact, indexBy
 */

import { groupBy, sortBy, uniqBy, chunk, compact, indexBy } from "@/lib/utils/arrays";

describe("Feature #11: groupBy", () => {
  it("groups items by key", () => {
    const items = [
      { name: "A", type: "x" },
      { name: "B", type: "y" },
      { name: "C", type: "x" },
    ];
    const result = groupBy(items, i => i.type);
    expect(result["x"]).toHaveLength(2);
    expect(result["y"]).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(groupBy([], () => "")).toEqual({});
  });

  it("handles single group", () => {
    const items = [{ v: 1 }, { v: 2 }];
    const result = groupBy(items, () => "all");
    expect(result["all"]).toHaveLength(2);
  });
});

describe("Feature #12: sortBy", () => {
  it("sorts by string key ascending", () => {
    const items = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];
    const result = sortBy(items, i => i.name);
    expect(result.map(i => i.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts by number key ascending", () => {
    const items = [{ score: 30 }, { score: 10 }, { score: 20 }];
    const result = sortBy(items, i => i.score);
    expect(result.map(i => i.score)).toEqual([10, 20, 30]);
  });

  it("sorts descending", () => {
    const items = [{ score: 10 }, { score: 30 }, { score: 20 }];
    const result = sortBy(items, i => i.score, "desc");
    expect(result.map(i => i.score)).toEqual([30, 20, 10]);
  });

  it("does not mutate original array", () => {
    const items = [{ v: 2 }, { v: 1 }];
    sortBy(items, i => i.v);
    expect(items[0].v).toBe(2); // original unchanged
  });

  it("handles empty array", () => {
    expect(sortBy([], () => 0)).toEqual([]);
  });
});

describe("Feature #13: uniqBy", () => {
  it("removes duplicates by key", () => {
    const items = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 1, name: "C" },
    ];
    const result = uniqBy(items, i => i.id);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A"); // keeps first
  });

  it("handles no duplicates", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(uniqBy(items, i => i.id)).toHaveLength(3);
  });

  it("handles empty array", () => {
    expect(uniqBy([], () => "")).toEqual([]);
  });

  it("handles all duplicates", () => {
    const items = [{ id: 1 }, { id: 1 }, { id: 1 }];
    expect(uniqBy(items, i => i.id)).toHaveLength(1);
  });
});

describe("Feature #14: chunk", () => {
  it("splits into equal chunks", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("handles uneven last chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles chunk size larger than array", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("handles chunk size 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("handles invalid chunk size (0)", () => {
    expect(chunk([1, 2], 0)).toEqual([]);
  });
});

describe("Feature #15: compact", () => {
  it("removes null and undefined", () => {
    expect(compact([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  it("removes false, 0, and empty string", () => {
    expect(compact([1, false, 0, "", 2])).toEqual([1, 2]);
  });

  it("handles all falsy", () => {
    expect(compact([null, undefined, false, 0, ""])).toEqual([]);
  });

  it("handles empty array", () => {
    expect(compact([])).toEqual([]);
  });

  it("keeps truthy objects", () => {
    const obj = { a: 1 };
    expect(compact([obj, null])).toEqual([obj]);
  });
});

describe("Feature #16: indexBy", () => {
  it("creates lookup dictionary", () => {
    const items = [
      { ref: "CLI-001", name: "A" },
      { ref: "CLI-002", name: "B" },
    ];
    const result = indexBy(items, i => i.ref);
    expect(result["CLI-001"].name).toBe("A");
    expect(result["CLI-002"].name).toBe("B");
  });

  it("later items overwrite earlier with same key", () => {
    const items = [
      { id: "1", val: "first" },
      { id: "1", val: "second" },
    ];
    const result = indexBy(items, i => i.id);
    expect(result["1"].val).toBe("second");
  });

  it("handles empty array", () => {
    expect(indexBy([], () => "")).toEqual({});
  });
});
