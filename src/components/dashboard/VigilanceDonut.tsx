import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface VigilanceDonutProps {
  simplifiee: number;
  standard: number;
  renforcee: number;
  loading?: boolean;
}

const COLORS = {
  simplifiee: "#22c55e",
  standard: "#f59e0b",
  renforcee: "#ef4444",
};

export function VigilanceDonut({ simplifiee, standard, renforcee, loading = false }: VigilanceDonutProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-4 w-40 rounded skeleton-shimmer mb-4" />
        <div className="w-48 h-48 mx-auto rounded-full skeleton-shimmer" />
        <div className="flex justify-center gap-4 mt-3">
          <div className="h-3 w-16 rounded skeleton-shimmer" />
          <div className="h-3 w-16 rounded skeleton-shimmer" />
          <div className="h-3 w-16 rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const data = [
    { name: "Simplifiée", value: simplifiee, color: COLORS.simplifiee },
    { name: "Standard", value: standard, color: COLORS.standard },
    { name: "Renforcée", value: renforcee, color: COLORS.renforcee },
  ].filter(d => d.value > 0);

  const total = simplifiee + standard + renforcee;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-gray-300 dark:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid" role="figure" aria-label={`Répartition vigilance : ${simplifiee} simplifiée, ${standard} standard, ${renforcee} renforcée`}>
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <PieChartIcon className="w-4 h-4 text-primary" aria-hidden="true" />
        Répartition vigilance
      </h3>

      {total === 0 ? (
        <div className="text-center py-12">
          <PieChartIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune donnée</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez des clients pour voir la répartition</p>
        </div>
      ) : (
        <>
          <div className="w-full aspect-square max-w-[220px] mx-auto print:max-w-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} client${value > 1 ? "s" : ""}`, name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--card-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--card-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-4 mt-3 flex-wrap">
            {[
              { label: "Simplifiée", value: simplifiee, color: COLORS.simplifiee },
              { label: "Standard", value: standard, color: COLORS.standard },
              { label: "Renforcée", value: renforcee, color: COLORS.renforcee },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="text-xs text-muted-foreground">
                  {item.value} {item.label.toLowerCase()}
                  {total > 0 && <span className="ml-1 opacity-60">({Math.round((item.value / total) * 100)}%)</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
