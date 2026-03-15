import { type LucideIcon } from "lucide-react";

interface KPICardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  color: string;
  subValue?: string;
  /** 0-100 micro progress bar under the value */
  progress?: number;
  onClick?: () => void;
  loading?: boolean;
  ariaLabel?: string;
}

export function KPICard({
  icon: Icon,
  title,
  value,
  color,
  subValue,
  progress,
  onClick,
  loading = false,
  ariaLabel,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border border-l-4 border-l-muted print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-10 w-20 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const isClickable = !!onClick;

  return (
    <div
      className={`bg-card rounded-2xl p-5 border border-border border-l-4 hover:border-white/[0.12] transition-colors duration-200 print:break-inside-avoid ${isClickable ? "cursor-pointer" : ""}`}
      style={{ borderLeftColor: color }}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={ariaLabel || `${title} : ${value}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 shrink-0" style={{ color }} aria-hidden="true" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">
          {title}
        </span>
      </div>
      <div className="text-4xl font-bold tabular-nums tracking-tight leading-none">
        {value}
      </div>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1.5 truncate">{subValue}</p>
      )}
      {progress !== undefined && (
        <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  );
}
