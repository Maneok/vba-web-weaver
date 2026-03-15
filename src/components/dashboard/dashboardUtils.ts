/**
 * Shared utilities for dashboard widgets.
 * Single source of truth for formatting, colors, and filters.
 */
import type { Client } from "@/lib/types";

// ── Color constants ──────────────────────────────────────────
export const VIGILANCE_COLORS = {
  simplifiee: "#22c55e",
  standard: "#f59e0b",
  renforcee: "#ef4444",
} as const;

export const SEVERITY_COLORS = {
  critique: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
} as const;

export const MISSION_COLORS: Record<string, string> = {
  "TENUE COMPTABLE": "#3b82f6",
  "REVISION / SURVEILLANCE": "#8b5cf6",
  "SOCIAL / PAIE SEULE": "#06b6d4",
  "CONSEIL DE GESTION": "#f59e0b",
  "CONSTITUTION / CESSION": "#ef4444",
  "DOMICILIATION": "#ec4899",
  "IRPP": "#10b981",
};

export const RISK_FACTOR_COLORS: Record<string, string> = {
  "Cash": "#ef4444",
  "PPE": "#f97316",
  "Pays risque": "#eab308",
  "Atypique": "#8b5cf6",
  "Distanciel": "#3b82f6",
  "Pression": "#ec4899",
};

export const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

// ── Formatting ───────────────────────────────────────────────
export function formatEuros(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")} M€`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} k€`;
  return `${v} €`;
}

export function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n > 1 ? (plural ?? `${singular}s`) : singular;
}

// ── Vigilance color from score ──────────────────────────────
export function vigilanceColorFromScore(score: number): string {
  if (score <= 25) return VIGILANCE_COLORS.simplifiee;
  if (score <= 60) return VIGILANCE_COLORS.standard;
  return VIGILANCE_COLORS.renforcee;
}

export function progressColor(value: number): string {
  if (value >= 80) return VIGILANCE_COLORS.simplifiee;
  if (value >= 50) return VIGILANCE_COLORS.standard;
  return VIGILANCE_COLORS.renforcee;
}

// ── Active clients filter (single source of truth) ──────────
export function isActiveClient(c: Client): boolean {
  return c.statut !== "INACTIF";
}

// ── Tooltip style (shared across all charts) ────────────────
export const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
} as const;

// ── Safe date parsing ────────────────────────────────────────
export function safeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function monthsSince(dateStr: string): number {
  const d = safeDate(dateStr);
  if (!d) return Infinity;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}
