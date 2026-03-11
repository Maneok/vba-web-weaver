/**
 * Tests for src/lib/utils/statistics.ts
 * Features #6-10: average, median, percentile, standardDeviation, distribution
 */
import { average, median, percentile, standardDeviation, distribution } from "@/lib/utils/statistics";

describe("Feature #6: average", () => {
  it("calculates mean", () => { expect(average([10, 20, 30])).toBe(20); });
  it("handles single value", () => { expect(average([5])).toBe(5); });
  it("handles empty array", () => { expect(average([])).toBe(0); });
  it("handles decimals", () => { expect(average([1, 2])).toBe(1.5); });
  it("ignores NaN/Infinity", () => { expect(average([10, NaN, 20, Infinity])).toBe(15); });
});

describe("Feature #7: median", () => {
  it("odd count → middle value", () => { expect(median([1, 3, 5])).toBe(3); });
  it("even count → average of two middle", () => { expect(median([1, 2, 3, 4])).toBe(2.5); });
  it("unsorted input", () => { expect(median([5, 1, 3])).toBe(3); });
  it("single value", () => { expect(median([42])).toBe(42); });
  it("empty array", () => { expect(median([])).toBe(0); });
});

describe("Feature #8: percentile", () => {
  it("50th percentile = median", () => { expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3); });
  it("0th percentile = min", () => { expect(percentile([10, 20, 30], 0)).toBe(10); });
  it("100th percentile = max", () => { expect(percentile([10, 20, 30], 100)).toBe(30); });
  it("25th percentile", () => { expect(percentile([1, 2, 3, 4], 25)).toBe(1.75); });
  it("empty array", () => { expect(percentile([], 50)).toBe(0); });
  it("single value", () => { expect(percentile([42], 75)).toBe(42); });
});

describe("Feature #9: standardDeviation", () => {
  it("calculates std dev", () => {
    const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2, 0);
  });
  it("all same values → 0", () => { expect(standardDeviation([5, 5, 5])).toBe(0); });
  it("single value → 0", () => { expect(standardDeviation([5])).toBe(0); });
  it("empty → 0", () => { expect(standardDeviation([])).toBe(0); });
});

describe("Feature #10: distribution", () => {
  it("distributes into buckets", () => {
    const buckets = [
      { label: "Faible", min: 0, max: 30 },
      { label: "Moyen", min: 30, max: 60 },
      { label: "Fort", min: 60, max: 120 },
    ];
    const result = distribution([10, 25, 45, 70, 90], buckets);
    expect(result[0].count).toBe(2); // 10, 25
    expect(result[1].count).toBe(1); // 45
    expect(result[2].count).toBe(2); // 70, 90
    expect(result[0].percentage).toBe(40);
  });
  it("handles empty values", () => {
    const buckets = [{ label: "All", min: 0, max: 100 }];
    const result = distribution([], buckets);
    expect(result[0].count).toBe(0);
    expect(result[0].percentage).toBe(0);
  });
});
