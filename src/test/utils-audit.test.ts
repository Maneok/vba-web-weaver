/**
 * Tests for src/lib/utils/audit.ts
 * Features #31-34: formatAuditEntry, categorizeAuditAction, calculateAuditStats, filterAuditEntries
 */
import { formatAuditEntry, categorizeAuditAction, calculateAuditStats, filterAuditEntries, type AuditEntry } from "@/lib/utils/audit";

const makeEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  timestamp: "2026-03-10T10:30:00Z",
  user: "jean@example.fr",
  action: "CREATION_CLIENT",
  resource: "clients",
  details: "Nouveau client cree",
  ...overrides,
});

describe("Feature #31: formatAuditEntry", () => {
  it("formats entry with date and details", () => {
    const result = formatAuditEntry(makeEntry());
    expect(result).toContain("jean@example.fr");
    expect(result).toContain("CREATION_CLIENT");
    expect(result).toContain("Nouveau client cree");
  });
  it("handles missing timestamp", () => {
    const result = formatAuditEntry(makeEntry({ timestamp: "" }));
    expect(result).toContain("Date inconnue");
  });
});

describe("Feature #32: categorizeAuditAction", () => {
  it("CONNEXION → auth", () => { expect(categorizeAuditAction("CONNEXION").category).toBe("auth"); });
  it("CREATION_CLIENT → data", () => { expect(categorizeAuditAction("CREATION_CLIENT").category).toBe("data"); });
  it("SCREENING → compliance", () => { expect(categorizeAuditAction("SCREENING").category).toBe("compliance"); });
  it("INVITATION → admin", () => { expect(categorizeAuditAction("INVITATION_UTILISATEUR").category).toBe("admin"); });
  it("unknown → other", () => { expect(categorizeAuditAction("UNKNOWN_ACTION").category).toBe("other"); });
  it("returns French label", () => { expect(categorizeAuditAction("CONNEXION").label).toBe("Authentification"); });
});

describe("Feature #33: calculateAuditStats", () => {
  it("calculates totals and breakdowns", () => {
    const entries = [
      makeEntry({ action: "CONNEXION", user: "a@a.fr", timestamp: new Date().toISOString() }),
      makeEntry({ action: "CREATION_CLIENT", user: "b@b.fr", timestamp: new Date().toISOString() }),
      makeEntry({ action: "SCREENING", user: "a@a.fr", timestamp: new Date(Date.now() - 2 * 86400000).toISOString() }),
    ];
    const stats = calculateAuditStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.byCategory.auth).toBe(1);
    expect(stats.byCategory.data).toBe(1);
    expect(stats.byUser["a@a.fr"]).toBe(2);
    expect(stats.last24h).toBe(2);
    expect(stats.last7d).toBe(3);
  });
  it("handles empty entries", () => {
    const stats = calculateAuditStats([]);
    expect(stats.total).toBe(0);
  });
});

describe("Feature #34: filterAuditEntries", () => {
  const entries = [
    makeEntry({ user: "a@a.fr", action: "CONNEXION", timestamp: "2026-03-10T10:00:00Z" }),
    makeEntry({ user: "b@b.fr", action: "CREATION_CLIENT", timestamp: "2026-03-09T10:00:00Z" }),
    makeEntry({ user: "a@a.fr", action: "SCREENING", timestamp: "2026-03-08T10:00:00Z", details: "Sanctions check" }),
  ];

  it("filters by user", () => {
    expect(filterAuditEntries(entries, { user: "a@a.fr" })).toHaveLength(2);
  });
  it("filters by action", () => {
    expect(filterAuditEntries(entries, { action: "CONNEXION" })).toHaveLength(1);
  });
  it("filters by date range", () => {
    const result = filterAuditEntries(entries, { startDate: "2026-03-09", endDate: "2026-03-11" });
    expect(result).toHaveLength(2);
  });
  it("filters by search term", () => {
    expect(filterAuditEntries(entries, { search: "sanctions" })).toHaveLength(1);
  });
  it("combines multiple filters", () => {
    expect(filterAuditEntries(entries, { user: "a@a.fr", action: "SCREENING" })).toHaveLength(1);
  });
  it("returns all when no filters", () => {
    expect(filterAuditEntries(entries, {})).toHaveLength(3);
  });
});
