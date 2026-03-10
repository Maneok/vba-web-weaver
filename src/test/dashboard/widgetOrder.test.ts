import { describe, it, expect, beforeEach } from "vitest";

// ── Tests for widget order persistence & migration ──────────

type WidgetKey = "kpi" | "cockpit" | "graphique" | "alertes" | "activite" | "repartition" | "equipe";

const DEFAULT_ORDER: WidgetKey[] = ["kpi", "cockpit", "graphique", "alertes", "activite", "repartition", "equipe"];
const STORAGE_KEY_ORDER = "dashboard-widget-order";

let store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
};

function loadOrder(): WidgetKey[] {
  try {
    const stored = mockStorage.getItem(STORAGE_KEY_ORDER);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const validStored = parsed.filter((k: string) => DEFAULT_ORDER.includes(k as WidgetKey)) as WidgetKey[];
        const missing = DEFAULT_ORDER.filter(k => !validStored.includes(k));
        const result = [...validStored, ...missing];
        if (result.length === DEFAULT_ORDER.length) return result;
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

describe("Widget order — loadOrder", () => {
  beforeEach(() => { store = {}; });

  it("retourne l'ordre par défaut quand storage est vide", () => {
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
  });

  it("charge un ordre complet sauvegardé", () => {
    const custom: WidgetKey[] = ["equipe", "cockpit", "repartition", "activite", "alertes", "graphique", "kpi"];
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(custom));
    expect(loadOrder()).toEqual(custom);
  });

  it("gère un JSON corrompu sans crash", () => {
    mockStorage.setItem(STORAGE_KEY_ORDER, "not-json{{{");
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
  });

  it("gère un objet au lieu d'un tableau", () => {
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify({ a: 1 }));
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
  });

  it("migre un ancien ordre avec 5 clés vers 7 clés", () => {
    // Old order from before cockpit & equipe were added
    const oldOrder = ["repartition", "activite", "alertes", "graphique", "kpi"];
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(oldOrder));
    const result = loadOrder();
    // Should keep old order and append cockpit + equipe
    expect(result.length).toBe(7);
    expect(result[0]).toBe("repartition");
    expect(result[4]).toBe("kpi");
    expect(result).toContain("cockpit");
    expect(result).toContain("equipe");
  });

  it("ignore les clés invalides dans le storage", () => {
    const badOrder = ["kpi", "unknown", "graphique"];
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(badOrder));
    const result = loadOrder();
    expect(result.length).toBe(7);
    expect(result).not.toContain("unknown");
  });

  it("déduplique les clés stockées", () => {
    const duped = ["kpi", "kpi", "graphique"];
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(duped));
    const result = loadOrder();
    // Should have all 7 unique keys
    expect(result.length).toBe(7);
    expect(new Set(result).size).toBe(7);
  });

  it("gère un tableau vide", () => {
    mockStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify([]));
    const result = loadOrder();
    expect(result).toEqual(DEFAULT_ORDER);
  });

  it("gère null en storage", () => {
    mockStorage.setItem(STORAGE_KEY_ORDER, "null");
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
  });

  it("les 7 clés par défaut sont bien définies", () => {
    expect(DEFAULT_ORDER).toHaveLength(7);
    expect(DEFAULT_ORDER).toContain("kpi");
    expect(DEFAULT_ORDER).toContain("cockpit");
    expect(DEFAULT_ORDER).toContain("graphique");
    expect(DEFAULT_ORDER).toContain("alertes");
    expect(DEFAULT_ORDER).toContain("activite");
    expect(DEFAULT_ORDER).toContain("repartition");
    expect(DEFAULT_ORDER).toContain("equipe");
  });
});
