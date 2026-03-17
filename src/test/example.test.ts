import { describe, it, expect } from "vitest";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "../lib/riskEngine";

describe("riskEngine - calculateRiskScore", () => {
  const baseParams = {
    ape: "56.10A",
    paysRisque: false,
    mission: "TENUE COMPTABLE",
    dateCreation: "2010-01-01",
    dateReprise: "2018-01-01",
    effectif: "3 À 5 SALARIÉS",
    forme: "SARL",
    ppe: false,
    atypique: false,
    distanciel: false,
    cash: false,
    pression: false,
  };

  it("should return correct sub-scores for a low-risk client", () => {
    const result = calculateRiskScore(baseParams);
    expect(result.scoreActivite).toBe(30); // APE 56.10A = 30
    expect(result.scorePays).toBe(0);
    expect(result.scoreMission).toBe(25); // TENUE COMPTABLE = 25
    expect(result.scoreStructure).toBe(20); // SARL = 20
    expect(result.malus).toBe(0);
  });

  it("should force score 100 when PPE is true", () => {
    const result = calculateRiskScore({ ...baseParams, ppe: true });
    expect(result.scoreGlobal).toBe(100);
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("should force score 100 when atypique is true", () => {
    const result = calculateRiskScore({ ...baseParams, atypique: true });
    expect(result.scoreGlobal).toBe(100);
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("should calculate correct malus for cash + distanciel + pression", () => {
    const result = calculateRiskScore({
      ...baseParams,
      cash: true,
      distanciel: true,
      pression: true,
    });
    expect(result.malus).toBe(110); // 40 + 30 + 40
  });

  it("should add malus even when maxCriterion >= 60", () => {
    const result = calculateRiskScore({
      ...baseParams,
      ape: "47.77Z", // score 80
      cash: true, // malus 40
    });
    expect(result.scoreActivite).toBe(80);
    expect(result.malus).toBe(40);
    expect(result.scoreGlobal).toBe(100); // min(80 + 40, 100)
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("should cap score at 100", () => {
    const result = calculateRiskScore({
      ...baseParams,
      ape: "92.00Z", // score 100
      cash: true,
      pression: true,
      distanciel: true,
    });
    expect(result.scoreGlobal).toBe(100);
  });

  it("should return SIMPLIFIEE for score <= 25", () => {
    const result = calculateRiskScore({
      ...baseParams,
      ape: "86.21Z", // 20
      forme: "ENTREPRISE INDIVIDUELLE", // 20
    });
    expect(result.scoreGlobal).toBeLessThanOrEqual(25);
    expect(result.nivVigilance).toBe("SIMPLIFIEE");
  });

  it("should return paysRisque score 100 when paysRisque is true", () => {
    const result = calculateRiskScore({ ...baseParams, paysRisque: true });
    expect(result.scorePays).toBe(100);
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("should default APE score to 25 for unknown codes", () => {
    const result = calculateRiskScore({ ...baseParams, ape: "99.99Z" });
    expect(result.scoreActivite).toBe(25);
  });
});

describe("riskEngine - calculateNextReviewDate", () => {
  it("should add 36 months for SIMPLIFIEE", () => {
    expect(calculateNextReviewDate("SIMPLIFIEE", "2024-01-15")).toBe("2027-01-15");
  });

  it("should add 12 months for STANDARD", () => {
    expect(calculateNextReviewDate("STANDARD", "2024-06-01")).toBe("2025-06-01");
  });

  it("should add 6 months for RENFORCEE", () => {
    expect(calculateNextReviewDate("RENFORCEE", "2024-01-01")).toBe("2024-07-01");
  });
});

describe("riskEngine - getPilotageStatus", () => {
  it("should return RETARD for past dates", () => {
    expect(getPilotageStatus("2020-01-01")).toBe("RETARD");
  });

  it("should return A JOUR for far future dates", () => {
    expect(getPilotageStatus("2030-01-01")).toBe("A JOUR");
  });
});
