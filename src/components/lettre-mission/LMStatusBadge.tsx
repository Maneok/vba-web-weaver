import { Badge } from "@/components/ui/badge";
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

interface LMStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export default function LMStatusBadge({ status, size = "sm" }: LMStatusBadgeProps) {
  const s = (status || "brouillon") as LMStatus;
  const info = STATUS_LABELS[s] || STATUS_LABELS.brouillon;
  const icon = STATUS_ICONS[s] || STATUS_ICONS.brouillon;

  return (
    <Badge
      variant="outline"
      className={`${info.bgClass} ${size === "sm" ? "text-[9px] px-1.5 py-0" : "text-xs px-2 py-0.5"} gap-1 inline-flex items-center`}
    >
      {icon}
      {info.label}
    </Badge>
  );
}
