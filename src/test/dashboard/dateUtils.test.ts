import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDateFR, formatDateTimeFR, timeAgo, daysUntil } from "@/lib/dateUtils";

// ── Tests 1-20: dateUtils ────────────────────────────────────

describe("dateUtils — formatDateFR", () => {
  // Test 1
  it("formate une date ISO valide en français", () => {
    const result = formatDateFR("2025-03-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  // Test 2
  it("retourne un tiret pour null", () => {
    expect(formatDateFR(null)).toBe("\u2014");
  });

  // Test 3
  it("retourne un tiret pour undefined", () => {
    expect(formatDateFR(undefined)).toBe("\u2014");
  });

  // Test 4
  it("retourne un tiret pour chaîne vide", () => {
    expect(formatDateFR("")).toBe("\u2014");
  });

  // Test 5
  it("retourne la chaîne brute pour une date invalide", () => {
    expect(formatDateFR("not-a-date")).toBe("not-a-date");
  });

  // Test 6
  it("gère les dates avec timestamp", () => {
    const result = formatDateFR("2025-06-01T14:30:00Z");
    expect(result).toMatch(/2025/);
  });
});

describe("dateUtils — formatDateTimeFR", () => {
  // Test 7
  it("formate date et heure", () => {
    const result = formatDateTimeFR("2025-03-15T14:30:00");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  // Test 8
  it("retourne un tiret pour chaîne vide", () => {
    expect(formatDateTimeFR("")).toBe("\u2014");
  });

  // Test 9
  it("retourne la chaîne brute pour date invalide", () => {
    expect(formatDateTimeFR("invalid")).toBe("invalid");
  });
});

describe("dateUtils — timeAgo", () => {
  // Test 10
  it("retourne vide pour chaîne vide", () => {
    expect(timeAgo("")).toBe("");
  });

  // Test 11
  it("retourne 'A l'instant' pour maintenant", () => {
    expect(timeAgo(new Date().toISOString())).toBe("A l'instant");
  });

  // Test 12
  it("retourne minutes pour < 1h", () => {
    const d = new Date(Date.now() - 15 * 60000);
    expect(timeAgo(d.toISOString())).toBe("Il y a 15 min");
  });

  // Test 13
  it("retourne heures pour < 24h", () => {
    const d = new Date(Date.now() - 3 * 3600000);
    expect(timeAgo(d.toISOString())).toBe("Il y a 3h");
  });

  // Test 14
  it("retourne 'Hier' pour 1 jour", () => {
    const d = new Date(Date.now() - 26 * 3600000);
    expect(timeAgo(d.toISOString())).toBe("Hier");
  });

  // Test 15
  it("retourne jours pour < 7j", () => {
    const d = new Date(Date.now() - 4 * 86400000);
    expect(timeAgo(d.toISOString())).toBe("Il y a 4j");
  });

  // Test 16
  it("retourne la date formatée pour > 7j", () => {
    const d = new Date(Date.now() - 30 * 86400000);
    const result = timeAgo(d.toISOString());
    // Should be a formatted date like "15 févr."
    expect(result).not.toBe("");
    expect(result).not.toContain("Il y a");
  });

  // Test 17
  it("retourne la chaîne brute pour date invalide", () => {
    expect(timeAgo("not-a-date")).toBe("not-a-date");
  });

  // Test 18
  it("gère les dates sans T séparateur", () => {
    const d = new Date(Date.now() - 5 * 60000);
    const str = d.toISOString().replace("T", " ");
    expect(timeAgo(str)).toBe("Il y a 5 min");
  });
});

describe("dateUtils — daysUntil", () => {
  // Test 19
  it("retourne -9999 pour date invalide", () => {
    expect(daysUntil("invalid-date")).toBe(-9999);
  });

  // Test 20
  it("retourne un nombre négatif pour date passée", () => {
    expect(daysUntil("2020-01-01")).toBeLessThan(0);
    expect(daysUntil("2020-01-01")).not.toBe(-9999);
  });

  // Test 21 (bonus)
  it("retourne un nombre positif pour date future lointaine", () => {
    expect(daysUntil("2099-01-01")).toBeGreaterThan(0);
  });
});
