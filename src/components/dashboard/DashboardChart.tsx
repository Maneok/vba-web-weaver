import { MonthlyChart } from "./MonthlyChart";
import { VigilanceDonut } from "./VigilanceDonut";

interface DashboardChartProps {
  monthlyData: { month: string; simplifiee: number; standard: number; renforcee: number }[];
  simplifiee: number;
  standard: number;
  renforcee: number;
  isLoading: boolean;
}

export function DashboardChart({ monthlyData, simplifiee, standard, renforcee, isLoading }: DashboardChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-8" role="region" aria-label="Graphiques de suivi">
      <div className="lg:col-span-3">
        <MonthlyChart data={monthlyData} loading={isLoading} />
      </div>
      <div className="lg:col-span-2">
        <VigilanceDonut
          simplifiee={simplifiee}
          standard={standard}
          renforcee={renforcee}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
