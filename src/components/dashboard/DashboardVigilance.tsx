import { ComplianceGauge } from "./ComplianceGauge";

interface ComplianceItem {
  label: string;
  value: number;
  description: string;
}

interface DashboardVigilanceProps {
  complianceItems: ComplianceItem[];
  isLoading: boolean;
}

export function DashboardVigilance({ complianceItems, isLoading }: DashboardVigilanceProps) {
  return (
    <div className="mb-8 print:break-inside-avoid" role="region" aria-label="Jauges de conformité">
      <ComplianceGauge items={complianceItems} loading={isLoading} />
    </div>
  );
}
