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
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer group relative ${
        isSelected
          ? "bg-accent border-l-2 border-primary"
          : "hover:bg-accent/50"
      }`}
    >
      {/* #116 — Favorite star */}
      {onToggleFavorite && clientRef && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(clientRef); }}
          className={`absolute top-2 right-2 transition-opacity ${
            isFavorite ? "opacity-100 text-amber-400" : "opacity-0 group-hover:opacity-50 text-muted-foreground hover:!text-amber-400 hover:!opacity-100"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-400" : ""}`} />
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* #112 — Avatar initials */}
            <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 text-[10px] font-bold text-white ${avatarColor}`}>
              {initials}
            </span>
            <span className="font-medium text-sm truncate">{clientName}</span>
          </div>
          <div className="flex items-center gap-2 ml-8 mt-0.5">
            <p className="text-xs text-muted-foreground">{formatSiren(siren)}</p>
            {/* #111 — Expired docs badge */}
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                <AlertTriangle className="h-2.5 w-2.5" />
                {expiredCount}
              </span>
            )}
            {/* #114 — Pending validation badge */}
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
                <Clock className="h-2.5 w-2.5" />
                {pendingCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* NEW badge for uploads < 24h */}
          {lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 86_400_000 && (
            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
              NEW
            </span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDaysAgo(lastUpdate)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1.5 ml-8">
        <Progress value={completion} className={`h-1.5 flex-1 ${progressColor}`} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {docCount} doc{docCount !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
