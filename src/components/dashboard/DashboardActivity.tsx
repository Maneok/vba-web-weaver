import { ActivityFeed } from "./ActivityFeed";

interface DashboardActivityProps {
  logs: any[];
  isLoading: boolean;
}

export function DashboardActivity({ logs, isLoading }: DashboardActivityProps) {
  return (
    <div className="mb-8" role="region" aria-label="Fil d'activite">
      <ActivityFeed logs={logs} loading={isLoading} />
    </div>
  );
}
