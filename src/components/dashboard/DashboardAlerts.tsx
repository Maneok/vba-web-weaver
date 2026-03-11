import { AlertsPanel } from "./AlertsPanel";
import { UpcomingDeadlines, type Deadline } from "./UpcomingDeadlines";
import type { AlerteRegistre } from "@/lib/types";

interface DashboardAlertsProps {
  alertes: AlerteRegistre[];
  deadlines: Deadline[];
  isLoading: boolean;
}

export function DashboardAlerts({ alertes, deadlines, isLoading }: DashboardAlertsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8 print:grid-cols-2 print:gap-2" role="region" aria-label="Alertes et échéances">
      <AlertsPanel alertes={alertes} loading={isLoading} />
      <UpcomingDeadlines deadlines={deadlines} loading={isLoading} />
    </div>
  );
}
