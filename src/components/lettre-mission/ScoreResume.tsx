import {
  Building2,
  Globe,
  Briefcase,
  Clock,
  Network,
  AlertTriangle,
} from "lucide-react";
import type { Client, VigilanceLevel } from "../../lib/types";

interface ScoreAxis {
  key: keyof Pick<
    Client,
    | "scoreActivite"
    | "scorePays"
    | "scoreMission"
    | "scoreMaturite"
    | "scoreStructure"
  >;
  label: string;
  icon: React.ReactNode;
}

const AXES: ScoreAxis[] = [
  {
    key: "scoreActivite",
    label: "Activité",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    key: "scorePays",
    label: "Pays",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    key: "scoreMission",
    label: "Mission",
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    key: "scoreMaturite",
    label: "Maturité",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    key: "scoreStructure",
    label: "Structure",
    icon: <Network className="h-4 w-4" />,
  },
];

function getScoreColor(score: number): string {
  if (score <= 25) return "bg-green-500";
  if (score < 60) return "bg-amber-500";
  return "bg-red-500";
}

function getVigilanceBadge(level: VigilanceLevel) {
  const config = {
    SIMPLIFIEE: { bg: "bg-green-100", text: "text-green-800", label: "Simplifiée" },
    STANDARD: { bg: "bg-amber-100", text: "text-amber-800", label: "Standard" },
    RENFORCEE: { bg: "bg-red-100", text: "text-red-800", label: "Renforcée" },
  }[level] ?? { bg: "bg-gray-100", text: "text-gray-800", label: level };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

function getGlobalScoreColor(score: number): string {
  if (score <= 25) return "text-green-600";
  if (score < 60) return "text-amber-600";
  return "text-red-600";
}

interface ScoreResumeProps {
  client: Client;
}

export default function ScoreResume({ client }: ScoreResumeProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Scoring LCB-FT</h4>

      <div className="space-y-2">
        {AXES.map((axis) => {
          const score = client[axis.key];
          return (
            <div key={axis.key} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 flex-shrink-0">{axis.icon}</span>
              <span className="w-20 text-gray-700">{axis.label}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreColor(score)}`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-600 font-mono text-xs">
                {score}
              </span>
            </div>
          );
        })}

        {client.malus > 0 && (
          <div className="flex items-center gap-2 text-sm border-t pt-2 mt-2">
            <span className="text-red-500 flex-shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="w-20 text-red-700 font-medium">Malus</span>
            <div className="flex-1" />
            <span className="text-red-600 font-mono text-xs font-semibold">
              +{client.malus}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t pt-3 mt-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">
            Score global
          </span>
          <span
            className={`text-2xl font-bold ${getGlobalScoreColor(client.scoreGlobal)}`}
          >
            {client.scoreGlobal}
          </span>
        </div>
        {getVigilanceBadge(client.nivVigilance)}
      </div>
    </div>
  );
}
