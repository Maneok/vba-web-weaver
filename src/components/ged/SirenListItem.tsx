import { Progress } from "@/components/ui/progress";
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
}

function formatSiren(siren: string): string {
  return siren.replace(/(\d{3})(?=\d)/g, "$1 ");
}

function formatDaysAgo(dateStr: string): string {
  const days = differenceInDays(new Date(), new Date(dateStr));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `il y a ${days}j`;
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
}: SirenListItemProps) {
  const completion = requiredDocs > 0 ? Math.round((docCount / requiredDocs) * 100) : 0;
  const isComplete = completion >= 100;

  const progressColor = isComplete
    ? "[&>div]:bg-emerald-500"
    : completion > 50
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-red-500";

  const dotColor = hasExpired
    ? "bg-red-500"
    : isComplete
      ? "bg-emerald-500"
      : "bg-amber-500";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer max-h-20 ${
        isSelected
          ? "bg-accent border-l-2 border-primary"
          : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
            <span className="font-medium text-sm truncate">{clientName}</span>
          </div>
          <p className="text-xs text-muted-foreground ml-4">{formatSiren(siren)}</p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatDaysAgo(lastUpdate)}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1.5 ml-4">
        <Progress value={completion} className={`h-1.5 flex-1 ${progressColor}`} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {docCount}/{requiredDocs} docs
        </span>
      </div>
    </button>
  );
}
