/**
 * Tests for src/lib/utils/colors.ts
 * Features #48-50: getRiskColor, getStatusColor, getPriorityColor
 */

import { getRiskColor, getStatusColor, getPriorityColor } from "@/lib/utils/colors";

describe("Feature #48: getRiskColor", () => {
  it("low risk (0-30) → emerald", () => {
    const result = getRiskColor(15);
    expect(result.bg).toContain("emerald");
    expect(result.label).toBe("Faible");
  });

  it("medium risk (31-59) → amber", () => {
    const result = getRiskColor(45);
    expect(result.bg).toContain("amber");
    expect(result.label).toBe("Moyen");
  });

  it("high risk (60+) → red", () => {
    const result = getRiskColor(80);
    expect(result.bg).toContain("red");
    expect(result.label).toBe("Eleve");
  });

  it("boundary: score 30 → low", () => {
    expect(getRiskColor(30).label).toBe("Faible");
  });

  it("boundary: score 31 → medium", () => {
    expect(getRiskColor(31).label).toBe("Moyen");
  });

  it("boundary: score 59 → medium", () => {
    expect(getRiskColor(59).label).toBe("Moyen");
  });

  it("boundary: score 60 → high", () => {
    expect(getRiskColor(60).label).toBe("Eleve");
  });

  it("score 0 → low", () => {
    expect(getRiskColor(0).label).toBe("Faible");
  });

  it("score 100 (max) → high", () => {
    expect(getRiskColor(100).label).toBe("Eleve");
  });
});

describe("Feature #49: getStatusColor", () => {
  it("CONFORME → emerald", () => {
    expect(getStatusColor("CONFORME").bg).toContain("emerald");
  });

  it("A JOUR → emerald", () => {
    expect(getStatusColor("A JOUR").bg).toContain("emerald");
  });

  it("EN COURS → amber", () => {
    expect(getStatusColor("EN COURS").bg).toContain("amber");
  });

  it("RETARD → orange", () => {
    expect(getStatusColor("RETARD").bg).toContain("orange");
  });

  it("NON CONFORME MAJEUR → red", () => {
    expect(getStatusColor("NON CONFORME MAJEUR").bg).toContain("red");
  });

  it("REFUSE → red", () => {
    expect(getStatusColor("REFUSE").bg).toContain("red");
  });

  it("unknown status → slate (default)", () => {
    expect(getStatusColor("UNKNOWN").bg).toContain("slate");
  });

  it("case-insensitive", () => {
    expect(getStatusColor("conforme").bg).toContain("emerald");
  });

  it("handles null-like", () => {
    expect(getStatusColor(null as any).bg).toContain("slate");
  });
});

describe("Feature #50: getPriorityColor", () => {
  it("CRITIQUE → red", () => {
    const result = getPriorityColor("CRITIQUE");
    expect(result.bg).toContain("red");
    expect(result.label).toBe("Critique");
  });

  it("HAUTE → orange", () => {
    const result = getPriorityColor("HAUTE");
    expect(result.bg).toContain("orange");
    expect(result.label).toBe("Haute");
  });

  it("MOYENNE → amber", () => {
    const result = getPriorityColor("MOYENNE");
    expect(result.bg).toContain("amber");
    expect(result.label).toBe("Moyenne");
  });

  it("BASSE → slate", () => {
    const result = getPriorityColor("BASSE");
    expect(result.bg).toContain("slate");
    expect(result.label).toBe("Basse");
  });

  it("unknown priority → slate + Inconnue", () => {
    const result = getPriorityColor("UNKNOWN" as any);
    expect(result.bg).toContain("slate");
    expect(result.label).toBe("Inconnue");
  });

  it("case-insensitive", () => {
    expect(getPriorityColor("critique" as any).label).toBe("Critique");
  });
});
