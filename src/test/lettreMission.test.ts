import { describe, it, expect } from "vitest";

// ─── Test helper functions extracted from LettreMissionPage ───

// [#1] Generate LM numero
function generateLMNumero(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LM-${y}-${rand}`;
}

// [#2] Format relative date
function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// [#3] Count variables
interface TemplateSection {
  id: string;
  title: string;
  content: string;
  type: string;
  editable: boolean;
}

function countVariables(sections: TemplateSection[]): number {
  const allContent = sections.map((s) => s.content).join(" ");
  const matches = allContent.match(/\{\{\w+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

// [#4] Build client variables
function buildClientVariables(client: any): Record<string, string> {
  if (!client) return {};
  const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const now = new Date();
  return {
    raison_sociale: client.raisonSociale || "",
    siren: client.siren || "",
    dirigeant: client.dirigeant || "",
    adresse: client.adresse || "",
    ville: client.ville || "",
    cp: client.cp || "",
    code_postal: client.cp || "",
    capital: String(client.capital || ""),
    forme_juridique: client.forme || "",
    honoraires: String(client.honoraires || 0),
    frequence: client.frequence || "MENSUEL",
    associe: client.associe || "",
    date_du_jour: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    nom_cabinet: "Cabinet d'expertise comptable",
    effectif: client.effectif || "",
    ape: client.ape || "",
    date_cloture: client.dateCloture || "31/12",
    formule_politesse: "Monsieur",
    iban: client.iban || "",
    bic: client.bic || "",
    ref: client.ref || "",
  };
}

// STATUT_CONFIG
const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  GENERE: { label: "Genere", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SIGNE: { label: "Signe", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  ENVOYE: { label: "Envoye", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

// TYPE_ACTIVITE_OPTIONS
const TYPE_ACTIVITE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "tenue", label: "Tenue comptable" },
  { value: "revision", label: "Revision" },
  { value: "social", label: "Social / Paie" },
  { value: "juridique", label: "Juridique" },
  { value: "accompagnement", label: "Accompagnement" },
];

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

describe("LettreMission - generateLMNumero", () => {
  it("should generate a valid LM numero format", () => {
    const numero = generateLMNumero();
    expect(numero).toMatch(/^LM-\d{4}-\d{4}$/);
  });

  it("should use current year", () => {
    const numero = generateLMNumero();
    const year = new Date().getFullYear();
    expect(numero).toContain(`LM-${year}-`);
  });

  it("should generate different numeros", () => {
    const numeros = new Set(Array.from({ length: 20 }, () => generateLMNumero()));
    // With 9000 possible values, 20 should almost always be unique
    expect(numeros.size).toBeGreaterThan(15);
  });
});

describe("LettreMission - formatRelativeDate", () => {
  it("should return 'A l'instant' for very recent dates", () => {
    const now = new Date().toISOString();
    expect(formatRelativeDate(now)).toBe("A l'instant");
  });

  it("should return minutes for recent dates", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe("Il y a 5 min");
  });

  it("should return hours for dates within a day", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twoHoursAgo)).toBe("Il y a 2h");
  });

  it("should return days for dates within a week", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(threeDaysAgo)).toBe("Il y a 3j");
  });

  it("should return formatted date for older dates", () => {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeDate(oldDate);
    // Should be a proper date string, not "Il y a..."
    expect(result).not.toContain("Il y a");
    expect(result).not.toBe("—");
  });

  it("should return '—' for invalid dates", () => {
    expect(formatRelativeDate("invalid")).toBe("—");
    expect(formatRelativeDate("")).toBe("—");
  });
});

describe("LettreMission - countVariables", () => {
  it("should count unique variables in sections", () => {
    const sections: TemplateSection[] = [
      { id: "1", title: "A", content: "Hello {{nom}} from {{ville}}", type: "fixed", editable: true },
      { id: "2", title: "B", content: "Dear {{nom}}, your SIREN is {{siren}}", type: "fixed", editable: true },
    ];
    expect(countVariables(sections)).toBe(3); // nom, ville, siren (nom deduplicated)
  });

  it("should return 0 for sections without variables", () => {
    const sections: TemplateSection[] = [
      { id: "1", title: "A", content: "Plain text without variables", type: "fixed", editable: true },
    ];
    expect(countVariables(sections)).toBe(0);
  });

  it("should return 0 for empty sections array", () => {
    expect(countVariables([])).toBe(0);
  });

  it("should handle special content placeholders", () => {
    const sections: TemplateSection[] = [
      { id: "1", title: "A", content: "TABLEAU_ENTITE", type: "fixed", editable: false },
      { id: "2", title: "B", content: "{{raison_sociale}} at {{adresse}}", type: "fixed", editable: true },
    ];
    expect(countVariables(sections)).toBe(2);
  });
});

describe("LettreMission - buildClientVariables", () => {
  it("should return empty object for null/undefined client", () => {
    expect(buildClientVariables(null)).toEqual({});
    expect(buildClientVariables(undefined)).toEqual({});
  });

  it("should map client fields to variable keys", () => {
    const client = {
      raisonSociale: "ACME Corp",
      siren: "123456789",
      dirigeant: "Jean Dupont",
      adresse: "1 rue de Paris",
      ville: "Paris",
      cp: "75001",
      capital: 10000,
      forme: "SARL",
      honoraires: 5000,
      frequence: "MENSUEL",
      associe: "Pierre Martin",
      effectif: "5",
      ape: "62.01Z",
      dateCloture: "31/12",
      iban: "FR7630006000011234567890189",
      bic: "BNPAFRPP",
      ref: "CLI-26-001",
      mail: "contact@acme.fr",
    };

    const vars = buildClientVariables(client);
    expect(vars.raison_sociale).toBe("ACME Corp");
    expect(vars.siren).toBe("123456789");
    expect(vars.dirigeant).toBe("Jean Dupont");
    expect(vars.adresse).toBe("1 rue de Paris");
    expect(vars.ville).toBe("Paris");
    expect(vars.cp).toBe("75001");
    expect(vars.code_postal).toBe("75001");
    expect(vars.capital).toBe("10000");
    expect(vars.forme_juridique).toBe("SARL");
    expect(vars.honoraires).toBe("5000");
    expect(vars.frequence).toBe("MENSUEL");
    expect(vars.associe).toBe("Pierre Martin");
    expect(vars.ape).toBe("62.01Z");
    expect(vars.date_cloture).toBe("31/12");
    expect(vars.iban).toBe("FR7630006000011234567890189");
    expect(vars.bic).toBe("BNPAFRPP");
    expect(vars.ref).toBe("CLI-26-001");
    expect(vars.nom_cabinet).toBe("Cabinet d'expertise comptable");
    expect(vars.formule_politesse).toBe("Monsieur");
  });

  it("should handle missing client fields with defaults", () => {
    const client = { raisonSociale: "Test" };
    const vars = buildClientVariables(client);
    expect(vars.raison_sociale).toBe("Test");
    expect(vars.siren).toBe("");
    expect(vars.dirigeant).toBe("");
    expect(vars.capital).toBe("");
    expect(vars.honoraires).toBe("0");
    expect(vars.frequence).toBe("MENSUEL");
    expect(vars.date_cloture).toBe("31/12");
  });

  it("should generate correct date_du_jour format", () => {
    const client = { raisonSociale: "Test" };
    const vars = buildClientVariables(client);
    // Should match pattern: "11 mars 2026" or similar
    expect(vars.date_du_jour).toMatch(/^\d{1,2} \w+ \d{4}$/);
  });
});

describe("LettreMission - STATUT_CONFIG", () => {
  it("should have all 4 statuts defined", () => {
    expect(Object.keys(STATUT_CONFIG)).toHaveLength(4);
    expect(STATUT_CONFIG).toHaveProperty("BROUILLON");
    expect(STATUT_CONFIG).toHaveProperty("GENERE");
    expect(STATUT_CONFIG).toHaveProperty("SIGNE");
    expect(STATUT_CONFIG).toHaveProperty("ENVOYE");
  });

  it("should have label and color for each statut", () => {
    for (const [key, val] of Object.entries(STATUT_CONFIG)) {
      expect(val.label).toBeTruthy();
      expect(val.color).toBeTruthy();
      expect(typeof val.label).toBe("string");
      expect(typeof val.color).toBe("string");
    }
  });

  it("should use correct color scheme per statut", () => {
    expect(STATUT_CONFIG.BROUILLON.color).toContain("amber");
    expect(STATUT_CONFIG.GENERE.color).toContain("blue");
    expect(STATUT_CONFIG.SIGNE.color).toContain("emerald");
    expect(STATUT_CONFIG.ENVOYE.color).toContain("violet");
  });
});

describe("LettreMission - TYPE_ACTIVITE_OPTIONS", () => {
  it("should have 6 options including 'all'", () => {
    expect(TYPE_ACTIVITE_OPTIONS).toHaveLength(6);
  });

  it("should have 'all' as first option", () => {
    expect(TYPE_ACTIVITE_OPTIONS[0].value).toBe("all");
  });

  it("should have unique values", () => {
    const values = TYPE_ACTIVITE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("should include required activity types", () => {
    const values = TYPE_ACTIVITE_OPTIONS.map((o) => o.value);
    expect(values).toContain("tenue");
    expect(values).toContain("revision");
    expect(values).toContain("social");
    expect(values).toContain("juridique");
    expect(values).toContain("accompagnement");
  });
});

describe("LettreMission - filtering logic", () => {
  const mockTemplates = [
    { id: "1", nom: "Standard SARL", type_activite: "tenue", description: "Modele standard", sections: [] },
    { id: "2", nom: "Revision annuelle", type_activite: "revision", description: "Pour revision", sections: [] },
    { id: "3", nom: "Paie PME", type_activite: "social", description: "Mission sociale", sections: [] },
    { id: "4", nom: "Tenue SCI", type_activite: "tenue", description: "Pour SCI", sections: [] },
  ];

  it("should filter templates by type_activite", () => {
    const filtered = mockTemplates.filter((t) => t.type_activite === "tenue");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toEqual(["1", "4"]);
  });

  it("should filter templates by search query", () => {
    const q = "sci";
    const filtered = mockTemplates.filter(
      (t) => t.nom.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("4");
  });

  it("should return all templates when filter is 'all'", () => {
    const filterType = "all";
    const filtered = filterType === "all" ? mockTemplates : mockTemplates.filter((t) => t.type_activite === filterType);
    expect(filtered).toHaveLength(4);
  });

  it("should combine type and search filters", () => {
    const filterType = "tenue";
    const searchQ = "standard";
    let result = mockTemplates.filter((t) => t.type_activite === filterType);
    result = result.filter((t) => t.nom.toLowerCase().includes(searchQ));
    expect(result).toHaveLength(1);
    expect(result[0].nom).toBe("Standard SARL");
  });
});

describe("LettreMission - lettre filtering logic", () => {
  const mockLettres = [
    { id: "1", client_name: "ACME Corp", numero: "LM-2026-001", statut_lm: "BROUILLON", client_ref: "CLI-26-001" },
    { id: "2", client_name: "Beta SA", numero: "LM-2026-002", statut_lm: "GENERE", client_ref: "CLI-26-002" },
    { id: "3", client_name: "Gamma SCI", numero: "LM-2026-003", statut_lm: "SIGNE", client_ref: "CLI-26-003" },
    { id: "4", client_name: "Delta SARL", numero: "LM-2026-004", statut_lm: "BROUILLON", client_ref: "CLI-26-004" },
  ];

  it("should filter lettres by statut", () => {
    const filtered = mockLettres.filter((l) => l.statut_lm === "BROUILLON");
    expect(filtered).toHaveLength(2);
  });

  it("should filter lettres by client name search", () => {
    const q = "gamma";
    const filtered = mockLettres.filter((l) => (l.client_name || "").toLowerCase().includes(q));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("3");
  });

  it("should filter lettres by numero search", () => {
    const q = "003";
    const filtered = mockLettres.filter((l) => (l.numero || "").toLowerCase().includes(q));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("3");
  });

  it("should filter lettres by client_ref search", () => {
    const q = "cli-26-004";
    const filtered = mockLettres.filter((l) => (l.client_ref || "").toLowerCase().includes(q));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("4");
  });
});

describe("LettreMission - replaceTemplateVariables integration", () => {
  // Inline version matching the imported function
  function replaceVars(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
  }

  it("should replace known variables", () => {
    const result = replaceVars("Bonjour {{dirigeant}} de {{raison_sociale}}", {
      dirigeant: "Jean Dupont",
      raison_sociale: "ACME Corp",
    });
    expect(result).toBe("Bonjour Jean Dupont de ACME Corp");
  });

  it("should keep unknown variables unchanged", () => {
    const result = replaceVars("Hello {{unknown_var}}", {});
    expect(result).toBe("Hello {{unknown_var}}");
  });

  it("should handle empty text", () => {
    const result = replaceVars("", { nom: "Test" });
    expect(result).toBe("");
  });

  it("should handle text without variables", () => {
    const result = replaceVars("Plain text", { nom: "Test" });
    expect(result).toBe("Plain text");
  });

  it("should handle multiple occurrences of same variable", () => {
    const result = replaceVars("{{nom}} et encore {{nom}}", { nom: "ACME" });
    expect(result).toBe("ACME et encore ACME");
  });
});

describe("LettreMission - stats computation", () => {
  const mockLettres = [
    { statut_lm: "BROUILLON" },
    { statut_lm: "BROUILLON" },
    { statut_lm: "GENERE" },
    { statut_lm: "SIGNE" },
    { statut_lm: "ENVOYE" },
    { statut_lm: "SIGNE" },
  ];

  it("should compute correct stats", () => {
    const stats = {
      total: mockLettres.length,
      brouillons: mockLettres.filter((l) => l.statut_lm === "BROUILLON").length,
      generes: mockLettres.filter((l) => l.statut_lm === "GENERE").length,
      signes: mockLettres.filter((l) => l.statut_lm === "SIGNE").length,
    };
    expect(stats.total).toBe(6);
    expect(stats.brouillons).toBe(2);
    expect(stats.generes).toBe(1);
    expect(stats.signes).toBe(2);
  });
});
