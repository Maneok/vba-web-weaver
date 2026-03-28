import { useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Star, AlertTriangle, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

interface SirenListItemProps {
  siren: string;
  clientName: string;
  docCount: number;
  requiredDocs: number;
  lastUpdate: string;
  hasExpired: boolean;
  isSelected: boolean;
  onClick: () => void;
  /** #111 — Number of expired documents */
  expiredCount?: number;
  /** #114 — Number of documents pending validation */
  pendingCount?: number;
  /** #116 — Favorited */
  isFavorite?: boolean;
  onToggleFavorite?: (clientRef: string) => void;
  clientRef?: string;
}

function formatSiren(siren: string): string {
  return siren.replace(/(\d{3})(?=\d)/g, "$1 ");
}

function formatDaysAgo(dateStr: string): string {
  if (!dateStr) return "";
  const days = differenceInDays(new Date(), new Date(dateStr));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `il y a ${days}j`;
}

/* #112 — Generate initials from name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* #112 — Consistent color from string hash */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
    "bg-violet-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
    "bg-pink-500", "bg-indigo-500",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function SirenListItem({
  siren,
  clientName,
  docCount,
  requiredDocs,
  lastUpdate,
  hasExpired,
  isSelected,
  onClick,
  expiredCount = 0,
  pendingCount = 0,
  isFavorite = false,
  onToggleFavorite,
  clientRef,
}: SirenListItemProps) {
  const completion = requiredDocs > 0 ? Math.round((docCount / requiredDocs) * 100) : 0;
  const isComplete = completion >= 100;

  const progressColor = isComplete
    ? "[&>div]:bg-emerald-500"
    : completion > 50
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-red-500";

  const avatarColor = hashColor(clientName);
  const initials = getInitials(clientName);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 cursor-pointer group relative ${
        isSelected
          ? "bg-accent border-l-2 border-primary"
          : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{clientName}</span>
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium shrink-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                {expiredCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-muted-foreground">{formatSiren(siren)}</p>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{docCount} doc{docCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Completion indicator */}
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            isComplete ? "bg-emerald-500" : completion > 50 ? "bg-amber-500" : "bg-red-500"
          }`} />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {formatDaysAgo(lastUpdate)}
          </span>
        </div>
      </div>
    </button>
  );
}
