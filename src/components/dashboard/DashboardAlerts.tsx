import { AlertsPanel } from "./AlertsPanel";
import { UpcomingDeadlines, type Deadline } from "./UpcomingDeadlines";

interface DashboardAlertsProps {
  alertes: any[];
  deadlines: Deadline[];
  isLoading: boolean;
}

export function DashboardAlerts({ alertes, deadlines, isLoading }: DashboardAlertsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8" role="region" aria-label="Alertes et echeances">
      <AlertsPanel alertes={alertes} loading={isLoading} />
      <UpcomingDeadlines deadlines={deadlines} loading={isLoading} />
    </div>
  );
}
