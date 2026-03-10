import { ActivityFeed } from "./ActivityFeed";
import type { LogEntry } from "@/lib/types";

interface DashboardActivityProps {
  logs: LogEntry[];
  isLoading: boolean;
}

export function DashboardActivity({ logs, isLoading }: DashboardActivityProps) {
  return (
    <div className="mb-8 print:break-inside-avoid" role="region" aria-label="Fil d'activité">
      <ActivityFeed logs={logs} loading={isLoading} />
    </div>
  );
}
