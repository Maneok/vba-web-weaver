/**
 * Dashboard shared utilities — simplified palette.
 */
import type { Client } from "@/lib/types";

// ── Semantic colors (3 only) ─────────────────────────────────
export const COLOR = {
  ok: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  primary: "#3b82f6",
  muted: "#64748b",
  purple: "#8b5cf6",
} as const;

// ── Formatting ───────────────────────────────────────────────
export function formatEuros(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M€`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k€`;
  return `${v}€`;
}

export function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function plural(n: number, s: string, p?: string): string {
  return n > 1 ? (p ?? s + "s") : s;
}

// ── Color helpers ────────────────────────────────────────────
export function statusColor(value: number): string {
  if (value >= 75) return COLOR.ok;
  if (value >= 40) return COLOR.warn;
  return COLOR.danger;
}

export function scoreColor(score: number): string {
  if (score <= 25) return COLOR.ok;
  if (score <= 60) return COLOR.warn;
  return COLOR.danger;
}

// ── Filter ───────────────────────────────────────────────────
export function isActive(c: Client): boolean {
  return c.statut !== "INACTIF";
}

// ── Tooltip (shared) ─────────────────────────────────────────
export const TT: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

// ── Safe date ────────────────────────────────────────────────
export function monthsSince(d: string | null | undefined): number {
  if (!d) return Infinity;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return Infinity;
  return (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}
