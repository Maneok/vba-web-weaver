import { Clock, CheckCircle, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DocumentStatusBadgeProps {
  status: "pending" | "validated" | "rejected";
  rejectionReason?: string;
  validatedBy?: string;
  validatedAt?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: "En attente",
    className: "bg-amber-500/15 text-amber-500",
    Icon: Clock,
  },
  validated: {
    label: "Validé",
    className: "bg-emerald-500/15 text-emerald-500",
    Icon: CheckCircle,
  },
  rejected: {
    label: "Rejeté",
    className: "bg-red-500/15 text-red-500",
    Icon: XCircle,
  },
} as const;

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

export default function DocumentStatusBadge({
  status,
  rejectionReason,
  validatedBy,
  validatedAt,
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const { Icon } = config;

  const hasTooltip =
    (status === "validated" && (validatedBy || validatedAt)) ||
    (status === "rejected" && rejectionReason);

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );

  if (!hasTooltip) return badge;

  const tooltipText =
    status === "validated"
      ? `Validé${validatedBy ? ` par ${validatedBy}` : ""}${validatedAt ? ` le ${formatDate(validatedAt)}` : ""}`
      : `Motif : ${rejectionReason}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
