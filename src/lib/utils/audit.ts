/**
 * Audit trail helpers for compliance reporting.
 */

export interface AuditEntry {
  id?: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  metadata?: Record<string, unknown>;
}

/** Format an audit entry for display */
export function formatAuditEntry(entry: AuditEntry): string {
  const date = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Date inconnue";

  return `[${date}] ${entry.user} — ${entry.action}: ${entry.details}`;
}

/** Categorize audit actions by type */
export function categorizeAuditAction(action: string): {
  category: "auth" | "data" | "compliance" | "admin" | "other";
  label: string;
  icon: string;
} {
  const upper = (action ?? "").toUpperCase();

  if (["CONNEXION", "DECONNEXION", "LOGIN", "LOGOUT"].some(a => upper.includes(a))) {
    return { category: "auth", label: "Authentification", icon: "shield" };
  }
  if (["CREATION", "MODIFICATION", "SUPPRESSION", "CREATION_CLIENT"].some(a => upper.includes(a))) {
    return { category: "data", label: "Donnees", icon: "database" };
  }
  if (["SCREENING", "SCORING", "ALERTE", "TRACFIN", "REVUE", "CONTROLE", "LETTRE"].some(a => upper.includes(a))) {
    return { category: "compliance", label: "Conformite", icon: "clipboard-check" };
  }
  if (["INVITATION", "CHANGEMENT_ROLE", "ADMIN"].some(a => upper.includes(a))) {
    return { category: "admin", label: "Administration", icon: "settings" };
  }
  return { category: "other", label: "Autre", icon: "activity" };
}

/** Calculate audit statistics from entries */
export function calculateAuditStats(entries: AuditEntry[]): {
  total: number;
  byCategory: Record<string, number>;
  byUser: Record<string, number>;
  last24h: number;
  last7d: number;
} {
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const d7 = 7 * 24 * 60 * 60 * 1000;

  const byCategory: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  let last24h = 0;
  let last7d = 0;

  for (const entry of entries) {
    const cat = categorizeAuditAction(entry.action).category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byUser[entry.user] = (byUser[entry.user] || 0) + 1;

    const ts = new Date(entry.timestamp).getTime();
    if (now - ts < h24) last24h++;
    if (now - ts < d7) last7d++;
  }

  return { total: entries.length, byCategory, byUser, last24h, last7d };
}

/** Filter audit entries by multiple criteria */
export function filterAuditEntries(
  entries: AuditEntry[],
  filters: {
    user?: string;
    action?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }
): AuditEntry[] {
  return entries.filter(entry => {
    if (filters.user && entry.user !== filters.user) return false;
    if (filters.action && !entry.action.toUpperCase().includes(filters.action.toUpperCase())) return false;
    if (filters.category) {
      const cat = categorizeAuditAction(entry.action).category;
      if (cat !== filters.category) return false;
    }
    if (filters.startDate) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < new Date(filters.startDate)) return false;
    }
    if (filters.endDate) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate > new Date(filters.endDate)) return false;
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const searchable = `${entry.user} ${entry.action} ${entry.details} ${entry.resource}`.toLowerCase();
      if (!searchable.includes(term)) return false;
    }
    return true;
  });
}
