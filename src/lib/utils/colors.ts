/**
 * Centralized color mapping for risk, status, and priority.
 * Returns Tailwind CSS classes.
 */

import type { AlertPriority } from "@/lib/types";

/** Get Tailwind color classes for a risk score (0-100) */
export function getRiskColor(score: number): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (score <= 30) {
    return {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      label: "Faible",
    };
  }
  if (score <= 59) {
    return {
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      border: "border-amber-500/20",
      label: "Moyen",
    };
  }
  return {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/20",
    label: "Eleve",
  };
}

/** Get Tailwind color classes for a status string */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const normalized = (status ?? "").toUpperCase().trim();

  switch (normalized) {
    case "CONFORME":
    case "A JOUR":
    case "ACTIF":
    case "VALIDE":
    case "RESOLU":
    case "CLOTURE":
      return { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" };

    case "CONFORME AVEC RESERVES":
    case "BIENTÔT":
    case "BIENTOT":
    case "EN COURS":
    case "A_TRAITER":
    case "A TRAITER":
    case "PROSPECT":
      return { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" };

    case "NON CONFORME MINEUR":
    case "RETARD":
    case "INACTIF":
      return { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" };

    case "NON CONFORME MAJEUR":
    case "REFUSE":
    case "ARCHIVE":
      return { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" };

    default:
      return { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-400" };
  }
}

/** Get Tailwind color classes for an alert priority */
export function getPriorityColor(priority: AlertPriority | string): {
  bg: string;
  text: string;
  label: string;
} {
  switch ((priority ?? "").toUpperCase()) {
    case "CRITIQUE":
      return { bg: "bg-red-500/15", text: "text-red-400", label: "Critique" };
    case "HAUTE":
      return { bg: "bg-orange-500/15", text: "text-orange-400", label: "Haute" };
    case "MOYENNE":
      return { bg: "bg-amber-500/15", text: "text-amber-400", label: "Moyenne" };
    case "BASSE":
      return { bg: "bg-slate-500/15", text: "text-slate-400", label: "Basse" };
    default:
      return { bg: "bg-slate-500/15", text: "text-slate-400", label: "Inconnue" };
  }
}
