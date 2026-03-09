import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, FileText, CheckCircle } from "lucide-react";

interface Action {
  label: string;
  count: number;
  path: string;
  color: string;
  icon: typeof Clock;
}

interface ActionsOfDayProps {
  revuesEchues: number;
  alertesOuvertes: number;
  lmARenouveler: number;
  userName: string;
  loading?: boolean;
}

export function ActionsOfDay({
  revuesEchues,
  alertesOuvertes,
  lmARenouveler,
  userName,
  loading = false,
}: ActionsOfDayProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl border border-border p-4">
        <div className="h-5 w-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const actions: Action[] = [
    { label: "revue(s) echue(s)", count: revuesEchues, path: "/bdd?filter=echues", color: "bg-red-500/15 text-red-500 border-red-500/30", icon: Clock },
    { label: "alerte(s) ouverte(s)", count: alertesOuvertes, path: "/registre", color: "bg-orange-500/15 text-orange-500 border-orange-500/30", icon: AlertTriangle },
    { label: "LM a renouveler", count: lmARenouveler, path: "/lettre-mission", color: "bg-violet-500/15 text-violet-500 border-violet-500/30", icon: FileText },
  ].filter(a => a.count > 0);

  const totalActions = actions.reduce((s, a) => s + a.count, 0);

  return (
    <div className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl border border-border p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm">
          <span className="font-medium">Bonjour, {userName}.</span>{" "}
          {totalActions > 0 ? (
            <span className="text-muted-foreground">
              Aujourd'hui : {totalActions} action{totalActions > 1 ? "s" : ""} en attente
            </span>
          ) : (
            <span className="text-emerald-500 flex items-center gap-1 inline-flex">
              <CheckCircle className="w-4 h-4" />
              Tout est en ordre. Bonne journee !
            </span>
          )}
        </p>

        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className={`${action.color} gap-1.5 cursor-pointer hover:opacity-80 transition-opacity text-xs`}
                >
                  <action.icon className="w-3 h-3" />
                  {action.count} {action.label}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
