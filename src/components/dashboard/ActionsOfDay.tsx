import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Clock, AlertTriangle, FileText, CheckCircle, ShieldAlert,
  GraduationCap, ChevronRight,
} from "lucide-react";
import type { Client, AlerteRegistre, Collaborateur } from "@/lib/types";

export interface ActionItem {
  id: string;
  label: string;
  description: string;
  path: string;
  urgency: number;
  color: string;
  iconColor: string;
  icon: typeof Clock;
}

interface ActionsOfDayProps {
  clients: Client[];
  alertes: AlerteRegistre[];
  collaborateurs: Collaborateur[];
  lmRenewalCount: number;
  loading?: boolean;
}

export function useActionItems(
  clients: Client[],
  alertes: AlerteRegistre[],
  collaborateurs: Collaborateur[],
  lmRenewalCount: number,
): ActionItem[] {
  return useMemo(() => {
    const now = new Date();
    const items: ActionItem[] = [];

    // 1. Revues echues (rouge — urgence maximale)
    const revuesEchues = clients.filter(c => {
      if (!c.dateButoir) return false;
      try { return new Date(c.dateButoir) < now; } catch { return false; }
    });
    if (revuesEchues.length > 0) {
      items.push({
        id: "revues-echues",
        label: `${revuesEchues.length} revue${revuesEchues.length > 1 ? "s" : ""} echue${revuesEchues.length > 1 ? "s" : ""}`,
        description: revuesEchues.slice(0, 2).map(c => c.raisonSociale || "Sans nom").join(", ") + (revuesEchues.length > 2 ? "..." : ""),
        path: "/bdd?filter=echues",
        urgency: 100,
        color: "bg-red-50 dark:bg-red-500/10",
        iconColor: "text-red-500",
        icon: Clock,
      });
    }

    // 2. Alertes > 30 jours (rouge)
    const alertesAnciennes = alertes.filter(a => {
      const s = (a.statut || "").toUpperCase();
      if (s.includes("CLOS") || s.includes("FERME") || s.includes("RESOLU")) return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) > 30;
    });
    const alertesRecentes = alertes.filter(a => {
      const s = (a.statut || "").toUpperCase();
      if (s.includes("CLOS") || s.includes("FERME") || s.includes("RESOLU")) return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
    });

    if (alertesAnciennes.length > 0) {
      items.push({
        id: "alertes-anciennes",
        label: `${alertesAnciennes.length} alerte${alertesAnciennes.length > 1 ? "s" : ""} > 30 jours`,
        description: "Alertes ouvertes depuis plus d'un mois",
        path: "/registre",
        urgency: 90,
        color: "bg-red-50 dark:bg-red-500/10",
        iconColor: "text-red-500",
        icon: AlertTriangle,
      });
    }

    if (alertesRecentes.length > 0) {
      items.push({
        id: "alertes-ouvertes",
        label: `${alertesRecentes.length} alerte${alertesRecentes.length > 1 ? "s" : ""} ouverte${alertesRecentes.length > 1 ? "s" : ""}`,
        description: "Alertes en cours de traitement",
        path: "/registre",
        urgency: 60,
        color: "bg-orange-50 dark:bg-orange-500/10",
        iconColor: "text-orange-500",
        icon: AlertTriangle,
      });
    }

    // 3. Screening perimes (> 12 mois)
    const screeningPerimes = clients.filter(c => {
      if (!c.dateDerniereRevue) return false;
      try {
        const d = new Date(c.dateDerniereRevue);
        return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) > 365;
      } catch { return false; }
    });
    if (screeningPerimes.length > 0) {
      items.push({
        id: "screening-perimes",
        label: `${screeningPerimes.length} screening${screeningPerimes.length > 1 ? "s" : ""} perime${screeningPerimes.length > 1 ? "s" : ""}`,
        description: "Verifications > 12 mois a renouveler",
        path: "/bdd",
        urgency: 70,
        color: "bg-orange-50 dark:bg-orange-500/10",
        iconColor: "text-orange-500",
        icon: ShieldAlert,
      });
    }

    // 4. LM a renouveler
    if (lmRenewalCount > 0) {
      items.push({
        id: "lm-renouveler",
        label: `${lmRenewalCount} LM a renouveler`,
        description: "Lettres de mission arrivant a echeance",
        path: "/lettre-mission",
        urgency: 50,
        color: "bg-violet-50 dark:bg-violet-500/10",
        iconColor: "text-violet-500",
        icon: FileText,
      });
    }

    // 5. Formations echues
    const formationsEchues = collaborateurs.filter(col => {
      if (!col.derniereFormation) return true;
      try {
        const d = new Date(col.derniereFormation);
        return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) >= 1;
      } catch { return false; }
    });
    if (formationsEchues.length > 0) {
      items.push({
        id: "formations-echues",
        label: `${formationsEchues.length} formation${formationsEchues.length > 1 ? "s" : ""} a mettre a jour`,
        description: formationsEchues.slice(0, 2).map(c => c.nom || "Sans nom").join(", ") + (formationsEchues.length > 2 ? "..." : ""),
        path: "/gouvernance",
        urgency: 40,
        color: "bg-blue-50 dark:bg-blue-500/10",
        iconColor: "text-blue-500",
        icon: GraduationCap,
      });
    }

    items.sort((a, b) => b.urgency - a.urgency);
    return items.slice(0, 5);
  }, [clients, alertes, collaborateurs, lmRenewalCount]);
}

export function ActionsOfDay({
  clients,
  alertes,
  collaborateurs,
  lmRenewalCount,
  loading = false,
}: ActionsOfDayProps) {
  const navigate = useNavigate();
  const actions = useActionItems(clients, alertes, collaborateurs, lmRenewalCount);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-xl animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-sm">A faire aujourd'hui</h3>
        {actions.length > 0 && (
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            {actions.length}
          </Badge>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="flex items-center gap-3 py-6 justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Tout est en ordre. Bonne journee !
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl ${action.color} hover:opacity-80 transition-opacity text-left group`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.iconColor} bg-white/60 dark:bg-white/10`}>
                <action.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground truncate">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
