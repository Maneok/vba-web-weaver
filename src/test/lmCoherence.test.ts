/**
 * 50 coherence tests for the Lettre de Mission system
 * Covers: validation, sanitization, wizard types, engine, variables, modeles integration
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Imports ──
import {
  validateStep0,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  validateStep6,
  validateStep7,
  sanitizeText,
  sanitizeWizardData,
  VALIDATORS,
} from "@/lib/lmValidation";

import {
  INITIAL_LM_WIZARD_DATA,
  computeAnnexes,
  formatDuration,
  LM_TOTAL_STEPS,
  LM_STEP_LABELS,
  LM_STEP_TITLES,
  LM_STEP_DURATIONS,
  ANNEXE_LABELS,
} from "@/lib/lmWizardTypes";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";

import {
  incrementCounter,
  resetCounter,
  calcHonorairesMensuels,
  calcHonorairesTrimestriels,
  checkHonorairesConsistency,
  buildVariablesMap,
  resolveModeleSections,
} from "@/lib/lettreMissionEngine";

import type { LMSection } from "@/lib/lettreMissionModeles";
import { GRIMY_DEFAULT_SECTIONS, GRIMY_DEFAULT_CGV, GRIMY_DEFAULT_REPARTITION, validateCnoecCompliance } from "@/lib/lettreMissionModeles";

// ══════════════════════════════════════════════
// 1. Validation — Step 1 (Client)
// ══════════════════════════════════════════════

describe("Step 0 — Client selection", () => {
  it("01: rejects empty client_id", () => {
    const errors = validateStep0({ client_id: "" });
    expect(errors.some((e) => e.field === "client_id")).toBe(true);
  });

  it("02: rejects empty mission_type_id (step 1)", () => {
    const errors = validateStep1({ mission_type_id: "" });
    expect(errors.some((e) => e.field === "mission_type_id")).toBe(true);
  });

  it("03: valid step 0 + step 1 passes", () => {
    expect(validateStep0({ client_id: "c1" })).toHaveLength(0);
    expect(validateStep1({ mission_type_id: "presentation" })).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// 2. Validation — Step 2 (Missions)
// ══════════════════════════════════════════════

describe("Step 2 — Missions validation", () => {
  it("04: rejects no missions selected", () => {
    const errors = validateStep2({ missions_selected: [] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("05: accepts at least one selected mission", () => {
    const errors = validateStep2({
      missions_selected: [{ section_id: "tenue", selected: true }],
    });
    expect(errors).toHaveLength(0);
  });

  it("06: rejects missions with missing section_id", () => {
    const errors = validateStep2({
      missions_selected: [
        { selected: true },
      ],
    });
    expect(errors.some((e) => e.message.includes("section_id"))).toBe(true);
  });

  it("07: ignores unselected missions for incompatibility check", () => {
    const errors = validateStep2({
      missions_selected: [
        { section_id: "tenue", selected: true },
        { section_id: "surveillance", selected: false },
      ],
    });
    expect(errors).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// 3. Validation — Step 3 (Details)
// ══════════════════════════════════════════════

describe("Step 3 — Modele/duree validation", () => {
  const validStep3 = {
    associe_signataire: "M. Martin",
    date_debut: "2026-01-01",
  };

  it("08: valid step 3 passes", () => {
    expect(validateStep3(validStep3)).toHaveLength(0);
  });

  it("09: rejects missing associe_signataire", () => {
    const errors = validateStep3({ ...validStep3, associe_signataire: "" });
    expect(errors.some((e) => e.field === "associe_signataire")).toBe(true);
  });

  it("10: rejects missing date_debut", () => {
    const errors = validateStep3({ ...validStep3, date_debut: "" });
    expect(errors.some((e) => e.field === "date_debut")).toBe(true);
  });

  it("11: rejects invalid date_debut", () => {
    const errors = validateStep3({ ...validStep3, date_debut: "not-a-date" });
    expect(errors.some((e) => e.field === "date_debut")).toBe(true);
  });

  it("12: accepts valid ISO date", () => {
    const errors = validateStep3({ ...validStep3, date_debut: "2026-06-15" });
    expect(errors).toHaveLength(0);
  });

  it("13: rejects when both fields missing", () => {
    const errors = validateStep3({});
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════
// 4. Validation — Step 4 (Honoraires)
// ══════════════════════════════════════════════

describe("Step 4 — Honoraires validation", () => {
  it("14: rejects zero honoraires", () => {
    const errors = validateStep4({ honoraires_ht: 0, frequence_facturation: "MENSUEL" });
    expect(errors.some((e) => e.field === "honoraires_ht")).toBe(true);
  });

  it("15: rejects excessively high honoraires (> 500k)", () => {
    const errors = validateStep4({ honoraires_ht: 600000, frequence_facturation: "MENSUEL" });
    expect(errors.some((e) => e.message.includes("500 000"))).toBe(true);
  });

  it("16: accepts valid honoraires", () => {
    const errors = validateStep4({ honoraires_ht: 12000, frequence_facturation: "MENSUEL" });
    expect(errors).toHaveLength(0);
  });

  it("17: rejects missing frequence", () => {
    const errors = validateStep4({ honoraires_ht: 5000, frequence_facturation: "" });
    expect(errors.some((e) => e.field === "frequence_facturation")).toBe(true);
  });

  it("18: validates French IBAN correctly (valid)", () => {
    // Valid FR IBAN: FR7630006000011234567890189
    const errors = validateStep4({
      honoraires_ht: 5000,
      frequence_facturation: "MENSUEL",
      mode_paiement: "prelevement",
      iban: "FR7630006000011234567890189",
    });
    expect(errors.some((e) => e.field === "iban")).toBe(false);
  });

  it("19: rejects incorrect French IBAN length", () => {
    const errors = validateStep4({
      honoraires_ht: 5000,
      frequence_facturation: "MENSUEL",
      mode_paiement: "prelevement",
      iban: "FR76300060000112345",
    });
    expect(errors.some((e) => e.field === "iban")).toBe(true);
  });
});

// ══════════════════════════════════════════════
// 5. Validation — Steps 5 & 6 (always valid)
// ══════════════════════════════════════════════

describe("Steps 5 & 6 — always valid", () => {
  it("20: step 5 always passes", () => {
    expect(validateStep5()).toHaveLength(0);
  });

  it("21: step 6 always passes", () => {
    expect(validateStep6()).toHaveLength(0);
  });

  it("22: VALIDATORS map has all 8 steps", () => {
    expect(Object.keys(VALIDATORS)).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(typeof VALIDATORS[i]).toBe("function");
    }
  });
});

// ══════════════════════════════════════════════
// 6. Sanitization
// ══════════════════════════════════════════════

describe("Sanitization", () => {
  it("23: encodes HTML tags", () => {
    const result = sanitizeText("<b>bold</b>");
    expect(result).not.toContain("<b>");
    expect(result).toContain("&lt;");
  });

  it("24: removes javascript: URIs", () => {
    const result = sanitizeText("javascript:alert(1)");
    expect(result).not.toContain("javascript:");
  });

  it("25: removes event handlers", () => {
    const result = sanitizeText("onerror=alert(1)");
    expect(result).not.toContain("onerror=");
  });

  it("26: sanitizeWizardData deep-sanitizes nested objects", () => {
    const input = { name: "<b>test</b>", nested: { val: "<div>x</div>" } };
    const result = sanitizeWizardData(input);
    expect(result.name).toContain("&lt;");
    expect((result.nested as any).val).toContain("&lt;");
  });

  it("27: sanitizeWizardData preserves non-string values", () => {
    const input = { count: 42, active: true, items: [1, 2, 3] };
    const result = sanitizeWizardData(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.items).toEqual([1, 2, 3]);
  });
});

// ══════════════════════════════════════════════
// 7. Wizard Types & Constants
// ══════════════════════════════════════════════

describe("Wizard types coherence", () => {
  it("28: LM_TOTAL_STEPS equals 8", () => {
    expect(LM_TOTAL_STEPS).toBe(8);
  });

  it("29: step labels match total steps", () => {
    expect(LM_STEP_LABELS).toHaveLength(LM_TOTAL_STEPS);
  });

  it("30: step titles match total steps", () => {
    expect(LM_STEP_TITLES).toHaveLength(LM_TOTAL_STEPS);
  });

  it("31: step durations match total steps", () => {
    expect(LM_STEP_DURATIONS).toHaveLength(LM_TOTAL_STEPS);
  });

  it("32: INITIAL_LM_WIZARD_DATA has all required fields", () => {
    const d = INITIAL_LM_WIZARD_DATA;
    expect(d.client_id).toBe("");
    expect(d.type_mission).toBe("");
    expect(d.missions_selected).toEqual([]);
    expect(d.honoraires_ht).toBe(0);
    expect(d.wizard_step).toBe(0);
    expect(d.modele_id).toBe("");
    expect(d.statut).toBe("brouillon");
  });

  it("33: INITIAL_LM_WIZARD_DATA tacite_reconduction defaults to true", () => {
    expect(INITIAL_LM_WIZARD_DATA.tacite_reconduction).toBe(true);
  });
});

// ══════════════════════════════════════════════
// 8. Compute Annexes
// ══════════════════════════════════════════════

describe("computeAnnexes", () => {
  const baseData: LMWizardData = { ...INITIAL_LM_WIZARD_DATA };

  it("34: always includes cgv_cabinet and clause_travail_dissimule", () => {
    const annexes = computeAnnexes(baseData);
    expect(annexes).toContain("cgv_cabinet");
    expect(annexes).toContain("clause_travail_dissimule");
  });

  it("35: adds repartition_travaux_sociaux for social mission", () => {
    const d = {
      ...baseData,
      missions_selected: [{ section_id: "social", label: "Social", description: "", icon: "", selected: true, sous_options: [] }],
    };
    expect(computeAnnexes(d)).toContain("repartition_travaux_sociaux");
  });

  it("36: adds mandat_sepa for prelevement", () => {
    const d = { ...baseData, mode_paiement: "prelevement" };
    expect(computeAnnexes(d)).toContain("mandat_sepa");
  });

  it("37: no mandat_sepa for virement", () => {
    const d = { ...baseData, mode_paiement: "virement" };
    expect(computeAnnexes(d)).not.toContain("mandat_sepa");
  });

  it("38: adds detail_missions_complementaires for conseil", () => {
    const d = {
      ...baseData,
      missions_selected: [{ section_id: "conseil", label: "Conseil", description: "", icon: "", selected: true, sous_options: [] }],
    };
    expect(computeAnnexes(d)).toContain("detail_missions_complementaires");
  });

  it("39: ANNEXE_LABELS has entries for all known annexes", () => {
    const keys = ["cgv_cabinet", "clause_travail_dissimule", "repartition_travaux_sociaux", "mandat_sepa", "detail_missions_complementaires"];
    keys.forEach((k) => expect(ANNEXE_LABELS[k]).toBeTruthy());
  });
});

// ══════════════════════════════════════════════
// 9. Format Duration
// ══════════════════════════════════════════════

describe("formatDuration", () => {
  it("40: returns dash for zero", () => {
    expect(formatDuration(0)).toBe("—");
  });

  it("41: returns seconds only for < 60s", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("42: returns minutes + seconds", () => {
    expect(formatDuration(125)).toBe("2 min 5 s");
  });

  it("43: returns minutes only for exact minutes", () => {
    expect(formatDuration(120)).toBe("2 min");
  });
});

// ══════════════════════════════════════════════
// 10. Engine — Counter
// ══════════════════════════════════════════════

describe("LM Counter", () => {
  beforeEach(() => resetCounter(0));

  it("44: incrementCounter produces LM-YYYY-0001 format", () => {
    const num = incrementCounter();
    const year = new Date().getFullYear();
    expect(num).toBe(`LM-${year}-0001`);
  });

  it("45: incrementCounter increments sequentially", () => {
    incrementCounter(); // 0001
    const second = incrementCounter(); // 0002
    expect(second).toMatch(/-0002$/);
  });

  it("46: resetCounter resets to given value", () => {
    resetCounter(99);
    const next = incrementCounter();
    expect(next).toMatch(/-0100$/);
  });
});

// ══════════════════════════════════════════════
// 11. Engine — Honoraires calculations
// ══════════════════════════════════════════════

describe("Honoraires calculations", () => {
  it("47: monthly = annual / 12 (rounded to 2 decimals)", () => {
    expect(calcHonorairesMensuels(12000)).toBe(1000);
    expect(calcHonorairesMensuels(10000)).toBeCloseTo(833.33, 2);
  });

  it("48: quarterly = annual / 4", () => {
    expect(calcHonorairesTrimestriels(12000)).toBe(3000);
  });

  it("49: consistency check ecart within 1 cent", () => {
    const result = checkHonorairesConsistency(12000);
    expect(result.ecart).toBeLessThanOrEqual(0.01);
  });

  it("50: handles negative/NaN gracefully", () => {
    expect(calcHonorairesMensuels(-100)).toBe(0);
    expect(calcHonorairesMensuels(NaN)).toBe(0);
    expect(calcHonorairesTrimestriels(Infinity)).toBe(0);
  });
});

// ══════════════════════════════════════════════
// 12. Engine — Variables map
// ══════════════════════════════════════════════

describe("buildVariablesMap", () => {
  const wizData = {
    raison_sociale: "SARL Test",
    forme_juridique: "SARL",
    siren: "123456789",
    dirigeant: "Jean Dupont",
    adresse: "12 rue Test",
    cp: "75001",
    ville: "Paris",
    capital: "10000",
    ape: "6920Z",
    email: "test@test.fr",
    telephone: "0123456789",
    honoraires_ht: 12000,
    frequence_facturation: "MENSUEL",
    associe_signataire: "M. Martin",
    chef_mission: "Mme Durand",
    type_mission: "TENUE",
    date_cloture: "31/12/2026",
    date_debut: "01/01/2026",
  };

  it("51: maps raison_sociale correctly", () => {
    const vars = buildVariablesMap(wizData);
    expect(vars.raison_sociale).toBe("SARL Test");
  });

  it("52: maps adresse_complete as combined field", () => {
    const vars = buildVariablesMap(wizData);
    expect(vars.adresse_complete).toContain("12 rue Test");
    expect(vars.adresse_complete).toContain("75001");
    expect(vars.adresse_complete).toContain("Paris");
  });

  it("53: formats honoraires with FR locale", () => {
    const vars = buildVariablesMap(wizData);
    // 12000 in fr-FR can be "12 000" or "12\u202f000"
    expect(vars.hono).toContain("HT");
    expect(vars.honoraires_ttc).toBeTruthy();
  });

  it("54: includes date_du_jour", () => {
    const vars = buildVariablesMap(wizData);
    expect(vars.date_du_jour).toBeTruthy();
    expect(vars.date_jour).toBeTruthy();
  });

  it("55: handles missing fields gracefully", () => {
    const vars = buildVariablesMap({});
    expect(vars.raison_sociale).toBe("");
    expect(vars.dirigeant).toBe("");
    expect(vars.honoraires).toBe("0");
  });
});

// ══════════════════════════════════════════════
// 13. Engine — resolveModeleSections
// ══════════════════════════════════════════════

describe("resolveModeleSections", () => {
  const testSections: LMSection[] = [
    { id: "intro", titre: "Intro", contenu: "Bonjour {{dirigeant}}", type: "fixed", editable: true, cnoec_obligatoire: true, ordre: 1 },
    { id: "social_clause", titre: "Social", contenu: "Clause sociale", type: "conditional", condition: "sociale", editable: true, cnoec_obligatoire: false, ordre: 2 },
    { id: "outro", titre: "Fin", contenu: "Cordialement, {{associe}}", type: "fixed", editable: true, cnoec_obligatoire: false, ordre: 3 },
  ];

  it("56: resolves variables in section contenu", () => {
    const resolved = resolveModeleSections(testSections, { dirigeant: "Jean", associe: "Martin" });
    expect(resolved[0].contenu).toBe("Bonjour Jean");
  });

  it("57: filters conditional sections when mission not selected", () => {
    const missions = [{ section_id: "social", selected: false }];
    const resolved = resolveModeleSections(testSections, {}, missions);
    expect(resolved.find((s) => s.id === "social_clause")).toBeUndefined();
  });

  it("58: keeps conditional sections when mission is selected", () => {
    const missions = [{ section_id: "social", selected: true }];
    const resolved = resolveModeleSections(testSections, {}, missions);
    // The condition is "sociale" which maps to "social" in condMap
    expect(resolved.find((s) => s.id === "social_clause")).toBeTruthy();
  });

  it("59: filters hidden sections", () => {
    const withHidden = [...testSections, { ...testSections[0], id: "hidden_one", hidden: true } as any];
    const resolved = resolveModeleSections(withHidden, {});
    expect(resolved.find((s) => s.id === "hidden_one")).toBeUndefined();
  });

  it("60: reorders sections sequentially", () => {
    const resolved = resolveModeleSections(testSections, {});
    resolved.forEach((s, i) => expect(s.ordre).toBe(i + 1));
  });
});

// ══════════════════════════════════════════════
// 14. GRIMY Defaults coherence
// ══════════════════════════════════════════════

describe("GRIMY defaults coherence", () => {
  it("61: GRIMY_DEFAULT_SECTIONS has at least 10 sections", () => {
    expect(GRIMY_DEFAULT_SECTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("62: all GRIMY sections have unique ids", () => {
    const ids = GRIMY_DEFAULT_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("63: sections are ordered sequentially", () => {
    GRIMY_DEFAULT_SECTIONS.forEach((s, i) => {
      expect(s.ordre).toBe(i + 1);
    });
  });

  it("64: GRIMY_DEFAULT_CGV is non-empty", () => {
    expect(GRIMY_DEFAULT_CGV.length).toBeGreaterThan(100);
  });

  it("65: GRIMY_DEFAULT_REPARTITION is an array", () => {
    expect(Array.isArray(GRIMY_DEFAULT_REPARTITION)).toBe(true);
    expect(GRIMY_DEFAULT_REPARTITION.length).toBeGreaterThan(0);
  });

  it("66: all cnoec_obligatoire sections have cnoec_reference", () => {
    GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire).forEach((s) => {
      expect(s.cnoec_reference).toBeTruthy();
    });
  });

  it("67: validateCnoecCompliance returns valid for full GRIMY sections", () => {
    const result = validateCnoecCompliance(GRIMY_DEFAULT_SECTIONS);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
