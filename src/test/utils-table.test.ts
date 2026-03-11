/**
 * Tests for src/lib/utils/table.ts
 * Features #39-42: multiSort, filterByDateRange, computeColumnStats, paginateWithInfo
 */
import { multiSort, filterByDateRange, computeColumnStats, paginateWithInfo } from "@/lib/utils/table";

describe("Feature #39: multiSort", () => {
  const data = [
    { name: "C", score: 30 },
    { name: "A", score: 30 },
    { name: "B", score: 50 },
    { name: "A", score: 10 },
  ];

  it("sorts by single column", () => {
    const result = multiSort(data, [{ key: "name", direction: "asc" }]);
    expect(result[0].name).toBe("A");
  });
  it("sorts by multiple columns", () => {
    const result = multiSort(data, [
      { key: "score", direction: "asc" },
      { key: "name", direction: "asc" },
    ]);
    expect(result[0].name).toBe("A"); // score 10
    expect(result[1].name).toBe("A"); // score 30
    expect(result[2].name).toBe("C"); // score 30
  });
  it("sorts descending", () => {
    const result = multiSort(data, [{ key: "score", direction: "desc" }]);
    expect(result[0].score).toBe(50);
  });
  it("does not mutate", () => {
    multiSort(data, [{ key: "name", direction: "asc" }]);
    expect(data[0].name).toBe("C");
  });
  it("handles empty sorts", () => {
    expect(multiSort(data, []).length).toBe(4);
  });
  it("handles null values", () => {
    const items = [{ a: null }, { a: "B" }, { a: "A" }] as any[];
    const result = multiSort(items, [{ key: "a", direction: "asc" }]);
    // null sorts before strings (null → -1)
    expect(result[0].a).toBeNull();
  });
});

describe("Feature #40: filterByDateRange", () => {
  const items = [
    { id: 1, date: "2026-01-15" },
    { id: 2, date: "2026-03-10" },
    { id: 3, date: "2026-06-20" },
    { id: 4, date: "" },
  ];

  it("filters by start date", () => {
    const result = filterByDateRange(items, "date", "2026-03-01");
    expect(result).toHaveLength(2);
  });
  it("filters by end date", () => {
    const result = filterByDateRange(items, "date", undefined, "2026-03-31");
    expect(result).toHaveLength(2);
  });
  it("filters by range", () => {
    const result = filterByDateRange(items, "date", "2026-02-01", "2026-04-01");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
  it("excludes empty dates", () => {
    const result = filterByDateRange(items, "date");
    expect(result).toHaveLength(3);
  });
});

describe("Feature #41: computeColumnStats", () => {
  const items = [
    { score: 10 }, { score: 20 }, { score: 30 }, { score: 40 }, { score: 50 },
  ];

  it("computes min", () => { expect(computeColumnStats(items, "score").min).toBe(10); });
  it("computes max", () => { expect(computeColumnStats(items, "score").max).toBe(50); });
  it("computes average", () => { expect(computeColumnStats(items, "score").average).toBe(30); });
  it("computes sum", () => { expect(computeColumnStats(items, "score").sum).toBe(150); });
  it("computes count", () => { expect(computeColumnStats(items, "score").count).toBe(5); });
  it("handles empty", () => {
    const stats = computeColumnStats([], "score" as any);
    expect(stats.min).toBe(0);
    expect(stats.count).toBe(0);
  });
});

describe("Feature #42: paginateWithInfo", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it("returns correct page data", () => {
    const result = paginateWithInfo(items, 1, 10);
    expect(result.data).toHaveLength(10);
    expect(result.data[0].id).toBe(1);
  });
  it("returns correct metadata", () => {
    const result = paginateWithInfo(items, 2, 10);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(25);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(true);
  });
  it("last page has fewer items", () => {
    const result = paginateWithInfo(items, 3, 10);
    expect(result.data).toHaveLength(5);
    expect(result.hasNext).toBe(false);
  });
  it("clamps page to valid range", () => {
    const result = paginateWithInfo(items, 999, 10);
    expect(result.page).toBe(3);
  });
  it("handles page 0 → page 1", () => {
    const result = paginateWithInfo(items, 0, 10);
    expect(result.page).toBe(1);
  });
  it("handles empty array", () => {
    const result = paginateWithInfo([], 1, 10);
    expect(result.data).toHaveLength(0);
    expect(result.totalPages).toBe(1);
  });
});
