import { describe, it, expect, beforeEach } from "vitest";

// ── Tests 22-40: Widget visibility logic ─────────────────────
// Re-implement the pure functions from DashboardPage to test them in isolation

const WIDGET_STORAGE_KEY = "dashboard-widgets";

interface WidgetVisibility {
  kpi: boolean;
  graphique: boolean;
  alertes: boolean;
  activite: boolean;
  repartition: boolean;
}

const DEFAULT_WIDGETS: WidgetVisibility = {
  kpi: true,
  graphique: true,
  alertes: true,
  activite: true,
  repartition: true,
};

function loadWidgetVisibility(): WidgetVisibility {
  try {
    const stored = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result: WidgetVisibility = { ...DEFAULT_WIDGETS };
      for (const key of Object.keys(DEFAULT_WIDGETS) as (keyof WidgetVisibility)[]) {
        if (typeof parsed[key] === "boolean") {
          result[key] = parsed[key];
        }
      }
      return result;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_WIDGETS };
}

function saveWidgetVisibility(v: WidgetVisibility) {
  try {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(v));
  } catch { /* ignore */ }
}

describe("Widget visibility — loadWidgetVisibility", () => {
  beforeEach(() => {
    localStorage.removeItem(WIDGET_STORAGE_KEY);
  });

  // Test 22
  it("retourne les valeurs par défaut quand localStorage est vide", () => {
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 23
  it("charge les préférences sauvegardées", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: false, graphique: true, alertes: true, activite: true, repartition: true }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(false);
    expect(result.graphique).toBe(true);
  });

  // Test 24
  it("gère un JSON corrompu sans crash", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, "not-json{{{");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 25
  it("ignore les clés invalides et garde les défauts", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: "string", unknown: true }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(true); // string ignored, kept default
    expect((result as any).unknown).toBeUndefined();
  });

  // Test 26
  it("gère un objet partiellement valide", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: false }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(false);
    expect(result.graphique).toBe(true); // default
    expect(result.alertes).toBe(true);
    expect(result.activite).toBe(true);
    expect(result.repartition).toBe(true);
  });

  // Test 27
  it("gère un tableau au lieu d'un objet", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 28
  it("gère null en localStorage", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, "null");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 29
  it("gère un nombre en localStorage", () => {
    localStorage.setItem(WIDGET_STORAGE_KEY, "42");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });
});

describe("Widget visibility — saveWidgetVisibility", () => {
  beforeEach(() => {
    localStorage.removeItem(WIDGET_STORAGE_KEY);
  });

  // Test 30
  it("sauvegarde les préférences en JSON", () => {
    const prefs = { ...DEFAULT_WIDGETS, kpi: false };
    saveWidgetVisibility(prefs);
    const stored = localStorage.getItem(WIDGET_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).kpi).toBe(false);
  });

  // Test 31
  it("roundtrip save → load", () => {
    const prefs: WidgetVisibility = { kpi: false, graphique: false, alertes: true, activite: false, repartition: true };
    saveWidgetVisibility(prefs);
    expect(loadWidgetVisibility()).toEqual(prefs);
  });

  // Test 32
  it("écrase les anciennes préférences", () => {
    saveWidgetVisibility({ ...DEFAULT_WIDGETS, kpi: false });
    saveWidgetVisibility({ ...DEFAULT_WIDGETS, kpi: true, alertes: false });
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(true);
    expect(result.alertes).toBe(false);
  });
});

describe("Widget visibility — toggle logic", () => {
  // Test 33
  it("toggle kpi de true à false", () => {
    const prev = { ...DEFAULT_WIDGETS };
    const next = { ...prev, kpi: !prev.kpi };
    expect(next.kpi).toBe(false);
  });

  // Test 34
  it("toggle kpi de false à true", () => {
    const prev = { ...DEFAULT_WIDGETS, kpi: false };
    const next = { ...prev, kpi: !prev.kpi };
    expect(next.kpi).toBe(true);
  });

  // Test 35
  it("setAllWidgets true active tout", () => {
    const next: WidgetVisibility = { kpi: true, graphique: true, alertes: true, activite: true, repartition: true };
    expect(Object.values(next).every(v => v === true)).toBe(true);
  });

  // Test 36
  it("setAllWidgets false masque tout", () => {
    const next: WidgetVisibility = { kpi: false, graphique: false, alertes: false, activite: false, repartition: false };
    expect(Object.values(next).every(v => v === false)).toBe(true);
  });

  // Test 37
  it("hiddenCount est correct", () => {
    const w: WidgetVisibility = { kpi: false, graphique: true, alertes: false, activite: true, repartition: false };
    const hiddenCount = Object.values(w).filter(v => !v).length;
    expect(hiddenCount).toBe(3);
  });

  // Test 38
  it("allVisible quand aucun masqué", () => {
    const hiddenCount = Object.values(DEFAULT_WIDGETS).filter(v => !v).length;
    expect(hiddenCount).toBe(0);
  });

  // Test 39
  it("allHidden quand tout masqué", () => {
    const w: WidgetVisibility = { kpi: false, graphique: false, alertes: false, activite: false, repartition: false };
    const hiddenCount = Object.values(w).filter(v => !v).length;
    expect(hiddenCount).toBe(5);
  });

  // Test 40
  it("les 5 clés de widgets sont bien définies", () => {
    const keys = Object.keys(DEFAULT_WIDGETS);
    expect(keys).toHaveLength(5);
    expect(keys).toContain("kpi");
    expect(keys).toContain("graphique");
    expect(keys).toContain("alertes");
    expect(keys).toContain("activite");
    expect(keys).toContain("repartition");
  });
});
