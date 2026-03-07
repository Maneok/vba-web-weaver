import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { analyzeCockpit, type CockpitSummary, type CockpitUrgency } from "@/lib/cockpitEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CreditCard, FileWarning, GraduationCap, Bell, ShieldAlert, Users, ChevronRight, CheckCircle2 } from "lucide-react";

const SEVERITY_STYLES = {
  critique: "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-4 border-l-orange-400 bg-orange-50 dark:bg-orange-950/20",
  info: "border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
};

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  revision: Clock,
  cni: CreditCard,
  scoring: ShieldAlert,
  fantome: FileWarning,
  formation: GraduationCap,
  alerte: Bell,
  kyc: Users,
};

function UrgencyCard({ urgency }: { urgency: CockpitUrgency }) {
  const Icon = TYPE_ICONS[urgency.type] || AlertTriangle;
  return (
    <div className={`p-3 rounded-lg ${SEVERITY_STYLES[urgency.severity]} transition-all hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${urgency.severity === "critique" ? "text-red-600" : urgency.severity === "warning" ? "text-orange-500" : "text-blue-500"}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{urgency.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{urgency.detail}</p>
          {urgency.ref && (
            <span className="inline-block text-[10px] font-mono mt-1 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded">{urgency.ref}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UrgencySection({
  title,
  icon: Icon,
  urgencies,
  color,
}: {
  title: string;
  icon: typeof AlertTriangle;
  urgencies: CockpitUrgency[];
  color: string;
}) {
  if (urgencies.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
          <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {urgencies.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {urgencies.map((u, i) => (
          <UrgencyCard key={i} urgency={u} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function CockpitPage() {
  const { clients, collaborateurs, alertes } = useAppState();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CockpitSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const result = analyzeCockpit(clients, collaborateurs, alertes);
    setSummary(result);
  }, [clients, collaborateurs, alertes]);

  if (!summary) return null;

  const critiques = summary.urgencies.filter(u => u.severity === "critique").length;
  const warnings = summary.urgencies.filter(u => u.severity === "warning").length;
  const totalUrgencies = summary.urgencies.length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className={`rounded-xl p-6 ${critiques > 0 ? "bg-gradient-to-r from-red-600 to-red-800" : warnings > 0 ? "bg-gradient-to-r from-orange-500 to-amber-600" : "bg-gradient-to-r from-emerald-600 to-teal-700"} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cockpit LCB-FT</h1>
            <p className="text-sm opacity-90 mt-1">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{summary.clientsActifs}</p>
                <p className="text-[10px] opacity-80">Clients actifs</p>
              </div>
              <div className="w-px h-8 bg-white/30" />
              <div className="text-center">
                <p className="text-2xl font-bold">{summary.totalHonoraires.toLocaleString("fr-FR")} EUR</p>
                <p className="text-[10px] opacity-80">Honoraires totaux</p>
              </div>
              <div className="w-px h-8 bg-white/30" />
              <div className="text-center">
                <p className="text-2xl font-bold">{totalUrgencies}</p>
                <p className="text-[10px] opacity-80">Points d'attention</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            {critiques > 0 ? (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <p className="font-bold text-lg">{critiques} critique(s)</p>
                  <p className="text-xs opacity-80">Action immediate requise</p>
                </div>
              </div>
            ) : totalUrgencies === 0 ? (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <p className="font-bold">Tout est en ordre</p>
                  <p className="text-xs opacity-80">Aucune urgence detectee</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Revisions retard", count: summary.revisionsRetard.length, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
          { label: "CNI perimees", count: summary.cniPerimees.length, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20" },
          { label: "Incoh. scoring", count: summary.incoherencesScoring.length, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
          { label: "Lignes fantomes", count: summary.lignesFantomes.length, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
          { label: "Formations", count: summary.formationsAFaire.length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { label: "Alertes", count: summary.alertesNonTraitees.length, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20" },
          { label: "KYC incomplets", count: summary.kycIncomplets.length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg p-3 text-center ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.count > 0 ? s.color : "text-muted-foreground"}`}>{s.count}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Urgency Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UrgencySection title="Revisions en retard" icon={Clock} urgencies={summary.revisionsRetard} color="text-red-600" />
        <UrgencySection title="CNI perimees / bientot" icon={CreditCard} urgencies={summary.cniPerimees} color="text-red-500" />
        <UrgencySection title="Incoherences scoring" icon={ShieldAlert} urgencies={summary.incoherencesScoring} color="text-orange-600" />
        <UrgencySection title="Alertes non traitees" icon={Bell} urgencies={summary.alertesNonTraitees} color="text-rose-600" />
        <UrgencySection title="Formations a faire" icon={GraduationCap} urgencies={summary.formationsAFaire} color="text-amber-600" />
        <UrgencySection title="KYC incomplets" icon={Users} urgencies={summary.kycIncomplets} color="text-blue-600" />
      </div>

      {summary.lignesFantomes.length > 0 && (
        <UrgencySection title="Lignes fantomes" icon={FileWarning} urgencies={summary.lignesFantomes} color="text-purple-600" />
      )}

      {/* Quick Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Acces rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Dashboard", to: "/dashboard", icon: "📊" },
              { label: "Base Clients", to: "/bdd", icon: "📁" },
              { label: "Controle Qualite", to: "/controle", icon: "🔍" },
              { label: "Diagnostic 360°", to: "/diagnostic", icon: "🛡" },
            ].map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-sm"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
