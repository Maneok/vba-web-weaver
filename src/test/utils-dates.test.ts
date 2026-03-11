/**
 * Tests for src/lib/utils/dates.ts
 * Features #17-24: addDays, addMonths, isBusinessDay, getNextBusinessDay, startOfDay, endOfDay, differenceInDays, getQuarter
 */

import { addDays, addMonths, isBusinessDay, getNextBusinessDay, startOfDay, endOfDay, differenceInDays, getQuarter } from "@/lib/utils/dates";

describe("Feature #17: addDays", () => {
  it("adds positive days", () => {
    const result = addDays("2026-03-10", 5);
    expect(result.getDate()).toBe(15);
  });

  it("subtracts with negative days", () => {
    const result = addDays("2026-03-10", -5);
    expect(result.getDate()).toBe(5);
  });

  it("handles month boundary", () => {
    const result = addDays("2026-01-31", 1);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(1);
  });

  it("accepts Date object", () => {
    const result = addDays(new Date(2026, 0, 1), 10);
    expect(result.getDate()).toBe(11);
  });

  it("does not mutate original date", () => {
    const original = new Date(2026, 0, 1);
    addDays(original, 10);
    expect(original.getDate()).toBe(1);
  });
});

describe("Feature #18: addMonths", () => {
  it("adds months normally", () => {
    const result = addMonths("2026-01-15", 2);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(15);
  });

  it("handles month-end clamping (Jan 31 + 1 month)", () => {
    const result = addMonths("2026-01-31", 1);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28); // clamped to Feb 28
  });

  it("handles leap year (Jan 31 + 1 month in leap year)", () => {
    const result = addMonths("2028-01-31", 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29); // Feb 29 in leap year
  });

  it("subtracts months with negative", () => {
    const result = addMonths("2026-03-15", -2);
    expect(result.getMonth()).toBe(0); // January
  });

  it("wraps year correctly", () => {
    const result = addMonths("2026-11-15", 3);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // February
  });
});

describe("Feature #19: isBusinessDay", () => {
  it("Monday is a business day", () => {
    expect(isBusinessDay("2026-03-09")).toBe(true); // Monday
  });

  it("Friday is a business day", () => {
    expect(isBusinessDay("2026-03-13")).toBe(true); // Friday
  });

  it("Saturday is not a business day", () => {
    expect(isBusinessDay("2026-03-14")).toBe(false); // Saturday
  });

  it("Sunday is not a business day", () => {
    expect(isBusinessDay("2026-03-15")).toBe(false); // Sunday
  });
});

describe("Feature #20: getNextBusinessDay", () => {
  it("returns next day if current is weekday", () => {
    const result = getNextBusinessDay("2026-03-09"); // Monday
    expect(result.getDay()).toBe(2); // Tuesday
  });

  it("skips weekend from Friday", () => {
    const result = getNextBusinessDay("2026-03-13"); // Friday
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(16);
  });

  it("skips Sunday from Saturday", () => {
    const result = getNextBusinessDay("2026-03-14"); // Saturday
    expect(result.getDay()).toBe(1); // Monday
  });
});

describe("Feature #21: startOfDay", () => {
  it("sets time to midnight", () => {
    const result = startOfDay("2026-03-10T15:30:45.123");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("preserves date", () => {
    const result = startOfDay("2026-03-10T23:59:59");
    expect(result.getDate()).toBe(10);
  });
});

describe("Feature #22: endOfDay", () => {
  it("sets time to 23:59:59.999", () => {
    const result = endOfDay("2026-03-10T00:00:00");
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });
});

describe("Feature #23: differenceInDays", () => {
  it("calculates positive difference", () => {
    expect(differenceInDays("2026-03-15", "2026-03-10")).toBe(5);
  });

  it("calculates negative difference (a < b)", () => {
    expect(differenceInDays("2026-03-10", "2026-03-15")).toBe(-5);
  });

  it("returns 0 for same day", () => {
    expect(differenceInDays("2026-03-10", "2026-03-10")).toBe(0);
  });

  it("handles cross-month", () => {
    expect(differenceInDays("2026-04-01", "2026-03-31")).toBe(1);
  });

  it("handles cross-year", () => {
    expect(differenceInDays("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("Feature #24: getQuarter", () => {
  it("January → Q1", () => {
    expect(getQuarter("2026-01-15")).toEqual({ quarter: 1, year: 2026 });
  });

  it("April → Q2", () => {
    expect(getQuarter("2026-04-01")).toEqual({ quarter: 2, year: 2026 });
  });

  it("September → Q3", () => {
    expect(getQuarter("2026-09-30")).toEqual({ quarter: 3, year: 2026 });
  });

  it("December → Q4", () => {
    expect(getQuarter("2026-12-25")).toEqual({ quarter: 4, year: 2026 });
  });

  it("March (last month of Q1)", () => {
    expect(getQuarter("2026-03-31").quarter).toBe(1);
  });
});
