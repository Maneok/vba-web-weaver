import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, FileWarning, GraduationCap, Shield, Users, TrendingUp, XCircle } from "lucide-react";
import type { CockpitAlert } from "@/lib/types";

const SEVERITY_STYLES = {
  critical: "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
  info: "border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
};

const TYPE_ICONS: Record<CockpitAlert["type"], typeof AlertTriangle> = {
  retard: Clock,
  cni_expire: FileWarning,
  incoherence: XCircle,
  kyc_incomplet: Shield,
  formation: GraduationCap,
  fantome: AlertTriangle,
};

const TYPE_LABELS: Record<CockpitAlert["type"], string> = {
  retard: "Révision en retard",
  cni_expire: "Document expiré",
  incoherence: "Incohérence scoring",
  kyc_incomplet: "KYC incomplet",
  formation: "Formation",
  fantome: "Ligne fantôme",
};

export default function CockpitPage() {
  const { clients, collaborateurs, cockpitAlerts, alertes, dismissAlert } = useAppState();

  const totalClients = clients.filter(c => c.statut === "ACTIF").length;
  const totalHonoraires = clients.reduce((s, c) => s + c.honoraires, 0);
  const criticalCount = cockpitAlerts.filter(a => a.severity === "critical").length;
  const warningCount = cockpitAlerts.filter(a => a.severity === "warning").length;
  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS").length;

  // Group alerts by type
  const grouped = cockpitAlerts.reduce((acc, alert, idx) => {
    if (!acc[alert.type]) acc[alert.type] = [];
    acc[alert.type].push({ ...alert, _idx: idx });
    return acc;
  }, {} as Record<string, (CockpitAlert & { _idx: number })[]>);

  const avgScore = clients.length ? Math.round(clients.reduce((s, c) => s + c.scoreGlobal, 0) / clients.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cockpit LCB-FT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diagnostic automatique du dispositif — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <Users className="w-6 h-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalClients}</p>
            <p className="text-xs text-muted-foreground">Clients actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{avgScore}</p>
            <p className="text-xs text-muted-foreground">Score moyen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Alertes critiques</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <Shield className="w-6 h-6 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
            <p className="text-xs text-muted-foreground">Avertissements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{totalHonoraires.toLocaleString("fr-FR")} &euro;</p>
            <p className="text-xs text-muted-foreground">Honoraires totaux</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert status banner */}
      {cockpitAlerts.length === 0 ? (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">Dispositif conforme</p>
              <p className="text-sm text-green-600 dark:text-green-500">Aucune alerte détectée. Tous les dossiers sont à jour.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                {cockpitAlerts.length} point{cockpitAlerts.length > 1 ? "s" : ""} de vigilance
              </p>
              <p className="text-sm text-red-600 dark:text-red-500">
                {criticalCount} critique{criticalCount > 1 ? "s" : ""}, {warningCount} avertissement{warningCount > 1 ? "s" : ""} — {alertesEnCours} alerte{alertesEnCours > 1 ? "s" : ""} en cours dans le registre
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts grouped by type */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([type, alerts]) => {
          const Icon = TYPE_ICONS[type as CockpitAlert["type"]] || AlertTriangle;
          const label = TYPE_LABELS[type as CockpitAlert["type"]] || type;
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {label} ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert._idx} className={`flex items-center justify-between p-3 rounded-lg text-sm ${SEVERITY_STYLES[alert.severity]}`}>
                    <div>
                      {alert.clientRef && (
                        <span className="font-mono text-xs text-muted-foreground mr-2">{alert.clientRef}</span>
                      )}
                      {alert.clientName && (
                        <span className="font-medium mr-2">{alert.clientName}</span>
                      )}
                      <span className="text-muted-foreground">{alert.message}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => dismissAlert(alert._idx)} className="text-xs shrink-0 ml-2">
                      Traité
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
