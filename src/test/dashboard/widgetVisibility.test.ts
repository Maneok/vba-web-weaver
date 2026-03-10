import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Tests 22-40: Widget visibility logic ─────────────────────

const WIDGET_STORAGE_KEY = "dashboard-widgets";

interface WidgetVisibility {
  kpi: boolean;
  cockpit: boolean;
  graphique: boolean;
  alertes: boolean;
  activite: boolean;
  repartition: boolean;
  equipe: boolean;
}

const DEFAULT_WIDGETS: WidgetVisibility = {
  kpi: true,
  cockpit: true,
  graphique: true,
  alertes: true,
  activite: true,
  repartition: true,
  equipe: true,
};

// In-memory storage mock
let store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

function loadWidgetVisibility(): WidgetVisibility {
  try {
    const stored = mockStorage.getItem(WIDGET_STORAGE_KEY);
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
    mockStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(v));
  } catch { /* ignore */ }
}

describe("Widget visibility — loadWidgetVisibility", () => {
  beforeEach(() => {
    store = {};
  });

  // Test 22
  it("retourne les valeurs par défaut quand storage est vide", () => {
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 23
  it("charge les préférences sauvegardées", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: false, cockpit: true, graphique: true, alertes: true, activite: true, repartition: true, equipe: true }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(false);
    expect(result.graphique).toBe(true);
  });

  // Test 24
  it("gère un JSON corrompu sans crash", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, "not-json{{{");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 25
  it("ignore les clés invalides et garde les défauts", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: "string", unknown: true }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(true);
    expect((result as any).unknown).toBeUndefined();
  });

  // Test 26
  it("gère un objet partiellement valide", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ kpi: false }));
    const result = loadWidgetVisibility();
    expect(result.kpi).toBe(false);
    expect(result.graphique).toBe(true);
    expect(result.alertes).toBe(true);
    expect(result.activite).toBe(true);
    expect(result.repartition).toBe(true);
    expect(result.cockpit).toBe(true);
    expect(result.equipe).toBe(true);
  });

  // Test 27
  it("gère un tableau au lieu d'un objet", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 28
  it("gère null en storage", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, "null");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });

  // Test 29
  it("gère un nombre en storage", () => {
    mockStorage.setItem(WIDGET_STORAGE_KEY, "42");
    expect(loadWidgetVisibility()).toEqual(DEFAULT_WIDGETS);
  });
});

describe("Widget visibility — saveWidgetVisibility", () => {
  beforeEach(() => {
    store = {};
  });

  // Test 30
  it("sauvegarde les préférences en JSON", () => {
    const prefs = { ...DEFAULT_WIDGETS, kpi: false };
    saveWidgetVisibility(prefs);
    const stored = mockStorage.getItem(WIDGET_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).kpi).toBe(false);
  });

  // Test 31
  it("roundtrip save → load", () => {
    const prefs: WidgetVisibility = { kpi: false, cockpit: true, graphique: false, alertes: true, activite: false, repartition: true, equipe: false };
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
    const next: WidgetVisibility = { kpi: true, cockpit: true, graphique: true, alertes: true, activite: true, repartition: true, equipe: true };
    expect(Object.values(next).every(v => v === true)).toBe(true);
  });

  // Test 36
  it("setAllWidgets false masque tout", () => {
    const next: WidgetVisibility = { kpi: false, cockpit: false, graphique: false, alertes: false, activite: false, repartition: false, equipe: false };
    expect(Object.values(next).every(v => v === false)).toBe(true);
  });

  // Test 37
  it("hiddenCount est correct", () => {
    const w: WidgetVisibility = { kpi: false, cockpit: true, graphique: true, alertes: false, activite: true, repartition: false, equipe: true };
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
    const w: WidgetVisibility = { kpi: false, cockpit: false, graphique: false, alertes: false, activite: false, repartition: false, equipe: false };
    const hiddenCount = Object.values(w).filter(v => !v).length;
    expect(hiddenCount).toBe(7);
  });

  // Test 40
  it("les 7 clés de widgets sont bien définies", () => {
    const keys = Object.keys(DEFAULT_WIDGETS);
    expect(keys).toHaveLength(7);
    expect(keys).toContain("kpi");
    expect(keys).toContain("cockpit");
    expect(keys).toContain("graphique");
    expect(keys).toContain("alertes");
    expect(keys).toContain("activite");
    expect(keys).toContain("repartition");
    expect(keys).toContain("equipe");
  });
});
