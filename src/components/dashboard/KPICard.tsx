import { type LucideIcon } from "lucide-react";

interface KPICardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  color: string;
  subValue?: string;
  onClick?: () => void;
  loading?: boolean;
  /** Accessible description for screen readers */
  ariaLabel?: string;
}

export function KPICard({
  icon: Icon,
  title,
  value,
  color,
  subValue,
  onClick,
  loading = false,
  ariaLabel,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-muted skeleton-shimmer" />
          <div className="h-3 w-20 bg-muted rounded skeleton-shimmer" />
        </div>
        <div className="flex items-end justify-between">
          <div className="h-8 w-16 bg-muted rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const isClickable = !!onClick;
  const computedAriaLabel = ariaLabel || `${title} : ${value}`;

  return (
    <div
      className={`bg-card rounded-2xl p-5 border border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/[0.12] transition-all duration-300 group print:break-inside-avoid print:shadow-none print:hover:scale-100 print:hover:translate-y-0 ${isClickable ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={computedAriaLabel}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} aria-hidden="true" />
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </span>
        </div>
      </div>
      <div>
        <span className="text-3xl font-bold tabular-nums tracking-tight">{value}</span>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}
