import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_LABELS, type LMStatus } from "@/lib/lettreMissionWorkflow";
import {
  FileEdit, Send, CheckCircle2, Archive, XCircle,
} from "lucide-react";

const STATUS_ICONS: Record<LMStatus, React.ReactNode> = {
  brouillon: <FileEdit className="w-3 h-3" />,
  envoyee: <Send className="w-3 h-3" />,
  signee: <CheckCircle2 className="w-3 h-3" />,
  archivee: <Archive className="w-3 h-3" />,
  resiliee: <XCircle className="w-3 h-3" />,
};

const STATUS_ICONS_LG: Record<LMStatus, React.ReactNode> = {
  brouillon: <FileEdit className="w-4 h-4" />,
  envoyee: <Send className="w-4 h-4" />,
  signee: <CheckCircle2 className="w-4 h-4" />,
  archivee: <Archive className="w-4 h-4" />,
  resiliee: <XCircle className="w-4 h-4" />,
};

interface LMStatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  dateLabel?: string;
  overdue?: boolean;
}

export default function LMStatusBadge({ status, size = "sm", showTooltip, dateLabel, overdue }: LMStatusBadgeProps) {
  const s = (status || "brouillon") as LMStatus;
  const info = STATUS_LABELS[s] || STATUS_LABELS.brouillon;
  const icon = size === "lg" ? (STATUS_ICONS_LG[s] || STATUS_ICONS_LG.brouillon) : (STATUS_ICONS[s] || STATUS_ICONS.brouillon);

  const sizeClasses =
    size === "sm" ? "text-[9px] px-1.5 py-0" :
    size === "lg" ? "text-sm px-3 py-1" :
    "text-xs px-2 py-0.5";

  const badge = (
    <Badge
      variant="outline"
      className={`${info.bgClass} ${sizeClasses} gap-1 inline-flex items-center ${overdue ? "ring-1 ring-red-500/30 animate-pulse" : ""}`}
      aria-label={`Statut : ${info.label}`}
    >
      {icon}
      {info.label}
      {/* OPT-26: Larger overdue indicator for visibility */}
      {overdue && <span className="w-2 h-2 rounded-full bg-red-400 ml-0.5 animate-pulse" />}
    </Badge>
  );

  if (showTooltip || dateLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{info.description}</p>
          {dateLabel && <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">{dateLabel}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

/** Compact status dot for tables */
export function LMStatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const s = (status || "brouillon") as LMStatus;
  const info = STATUS_LABELS[s] || STATUS_LABELS.brouillon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block rounded-full ${info.dotClass}`}
          style={{ width: size, height: size }}
          aria-label={info.label}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {info.label} — {info.description}
      </TooltipContent>
    </Tooltip>
  );
}
