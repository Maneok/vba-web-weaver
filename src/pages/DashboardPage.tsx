import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bell, RefreshCw, Settings,
} from "lucide-react";

import OnboardingWizard, { isOnboardingComplete } from "@/components/OnboardingWizard";
import { QuickActionsBar, QuickActionsFAB } from "@/components/dashboard/QuickActions";
import { DashboardKPICards } from "@/components/dashboard/DashboardKPICards";
import { DashboardChart } from "@/components/dashboard/DashboardChart";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { DashboardActivity } from "@/components/dashboard/DashboardActivity";
import { DashboardVigilance } from "@/components/dashboard/DashboardVigilance";
import { type Deadline } from "@/components/dashboard/UpcomingDeadlines";

// ── Helpers ──────────────────────────────────────────────────
function formatTime(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLong(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Generate sparkline data from clients (deterministic linear interpolation)
function generateSparkline(current: number): { v: number }[] {
  const base = Math.max(1, current - 5);
  return Array.from({ length: 7 }, (_, i) => ({ v: Math.max(0, base + Math.round((current - base) * (i / 6))) }));
}

// ── Widget visibility ────────────────────────────────────────
const WIDGET_STORAGE_KEY = "dashboard-widgets";

interface WidgetVisibility {
  kpi: boolean;
  graphique: boolean;
  alertes: boolean;
  activite: boolean;
  repartition: boolean;
}

const DEFAULT_WIDGETS: WidgetVisibility = {
  kpi: true,
  graphique: true,
  alertes: true,
  activite: true,
  repartition: true,
};

function loadWidgetVisibility(): WidgetVisibility {
  try {
    const stored = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_WIDGETS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_WIDGETS };
}

function saveWidgetVisibility(v: WidgetVisibility) {
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(v));
}

const WIDGET_LABELS: { key: keyof WidgetVisibility; label: string }[] = [
  { key: "kpi", label: "Indicateurs KPI" },
  { key: "graphique", label: "Graphiques de suivi" },
  { key: "alertes", label: "Alertes et echeances" },
  { key: "activite", label: "Fil d'activite" },
  { key: "repartition", label: "Jauges de conformite" },
];

// ── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { clients, alertes, logs, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [notificationCount, setNotificationCount] = useState(0);
  const [widgets, setWidgets] = useState<WidgetVisibility>(loadWidgetVisibility);
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();
  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  const mountedRef = useRef(true);

  const greeting = useMemo(() => new Date().getHours() < 18 ? "Bonjour" : "Bonsoir", []);

  useDocumentTitle("Dashboard");

  const toggleWidget = (key: keyof WidgetVisibility) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveWidgetVisibility(next);
      return next;
    });
  };

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey)) return;

      switch (e.key) {
        case "n": e.preventDefault(); navigate("/nouveau-client"); break;
        case "a": e.preventDefault(); navigate("/registre"); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  // ── Auto-refresh every 60s ────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const doRefresh = () => {
      if (document.hidden) return;
      refreshAllRef.current().then(() => { if (mountedRef.current) setLastRefresh(new Date()); }).catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err));
    };
    refreshTimer.current = setInterval(doRefresh, 60000);
    const handleVisibility = () => { if (!document.hidden) doRefresh(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mountedRef.current = false;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // ── Load notification count ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("lue", false)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) { logger.warn("Dashboard", "Notification count error:", error.message); return; }
        setNotificationCount(typeof count === "number" ? count : 0);
      })
      .catch((err: unknown) => {
        if (!cancelled) logger.warn("Dashboard", "Echec du chargement du compteur de notifications", { error: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, [user, lastRefresh]);

  // ── Computed stats from context ───────────────────────────
  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const totalClients = actifs.length;

    const avgScore = totalClients > 0
      ? Math.round(actifs.reduce((s, c) => s + (c.scoreGlobal || 0), 0) / totalClients)
      : 0;

    const simplifiee = clients.filter(c => c.nivVigilance === "SIMPLIFIEE").length;
    const standard = clients.filter(c => c.nivVigilance === "STANDARD").length;
    const renforcee = clients.filter(c => c.nivVigilance === "RENFORCEE").length;

    const alertesEnCours = alertes.filter(a => {
      const s = (a.statut || "").toUpperCase();
      return !s.includes("CLOS") && !s.includes("FERME") && !s.includes("RESOLU");
    }).length;

    const now = new Date();
    const revuesEchues = clients.filter(c => {
      if (!c.dateButoir) return false;
      try { return new Date(c.dateButoir) < now; } catch { return false; }
    }).length;

    const caPrevisionnel = actifs.reduce((s, c) => s + (c.honoraires || 0), 0);

    const withKyc = actifs.filter(c =>
      c.lienCni && c.siren && c.dirigeant && c.adresse
    ).length;
    const tauxConformite = totalClients > 0
      ? Math.round((withKyc / totalClients) * 100)
      : 0;

    return {
      totalClients,
      avgScore,
      simplifiee,
      standard,
      renforcee,
      alertesEnCours,
      revuesEchues,
      caPrevisionnel,
      tauxConformite,
    };
  }, [clients, alertes]);

  const sparklines = useMemo(() => ({
    totalClients: generateSparkline(stats.totalClients),
    avgScore: generateSparkline(stats.avgScore),
    tauxConformite: generateSparkline(stats.tauxConformite),
    alertesEnCours: generateSparkline(stats.alertesEnCours),
    revuesEchues: generateSparkline(stats.revuesEchues),
    caPrevisionnel: generateSparkline(stats.caPrevisionnel / 1000),
  }), [stats]);

  // ── Monthly chart data (computed from clients) ────────────
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = months[d.getMonth()];

      const beforeDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const filtered = clients.filter(c => {
        if (!c.dateCreationLigne) return true;
        try { return new Date(c.dateCreationLigne) <= beforeDate; } catch { return true; }
      });

      result.push({
        month: monthStr,
        simplifiee: filtered.filter(c => c.nivVigilance === "SIMPLIFIEE").length,
        standard: filtered.filter(c => c.nivVigilance === "STANDARD").length,
        renforcee: filtered.filter(c => c.nivVigilance === "RENFORCEE").length,
      });
    }
    return result;
  }, [clients]);

  // ── Upcoming deadlines ────────────────────────────────────
  const deadlines = useMemo<Deadline[]>(() => {
    const now = new Date();
    const items: Deadline[] = [];

    clients.forEach(c => {
      if (!c.dateButoir) return;
      try {
        const d = new Date(c.dateButoir);
        const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diff < 60) {
          items.push({
            id: `revue-${c.ref}`,
            title: `Revue ${c.raisonSociale}`,
            date: c.dateButoir,
            type: "revue",
            clientRef: c.ref,
          });
        }
      } catch { /* skip */ }
    });

    collaborateurs.forEach(col => {
      if (!col.derniereFormation) return;
      try {
        const lastF = new Date(col.derniereFormation);
        const nextF = new Date(lastF);
        nextF.setFullYear(nextF.getFullYear() + 1);
        const diff = (nextF.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diff < 60) {
          items.push({
            id: `formation-${col.nom}`,
            title: `Formation ${col.nom}`,
            date: nextF.toISOString().split("T")[0],
            type: "formation",
          });
        }
      } catch { /* skip */ }
    });

    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items.slice(0, 5);
  }, [clients, collaborateurs]);

  // ── Compliance gauge items ────────────────────────────────
  const complianceItems = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const total = actifs.length || 1;

    const withScreening = actifs.filter(c => c.siren && c.dirigeant).length;
    const withDocs = actifs.filter(c => c.lienCni).length;
    const withLM = actifs.filter(c => c.honoraires > 0).length;

    const collabTotal = collaborateurs.length || 1;
    const now = new Date();
    const trained = collaborateurs.filter(col => {
      if (!col.derniereFormation) return false;
      try {
        const d = new Date(col.derniereFormation);
        return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) < 1;
      } catch { return false; }
    }).length;

    return [
      { label: "Identification clients", value: Math.round((withScreening / total) * 100), description: "Screening complet (SIREN + dirigeant)" },
      { label: "Documents KYC", value: Math.round((withDocs / total) * 100), description: "CNI / piece d'identite renseignee" },
      { label: "Lettres de mission", value: Math.round((withLM / total) * 100), description: "LM signees vs clients actifs" },
      { label: "Formation collaborateurs", value: Math.round((trained / collabTotal) * 100), description: "Formations < 12 mois" },
      { label: "Controle qualite", value: 0, description: "Controles realises vs attendus" },
    ];
  }, [clients, collaborateurs]);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";

  const handleRefresh = useCallback(() => {
    refreshAll().then(() => { if (mountedRef.current) setLastRefresh(new Date()); }).catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err));
  }, [refreshAll]);

  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in-up print:bg-white print:text-black" role="main" aria-label="Tableau de bord">
      {/* ── ONBOARDING WIZARD ──────────────────────────────── */}
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 pb-6 border-b border-white/[0.06] print:mb-4 print:border-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{formatDateLong()}</p>
        </div>

        <div className="flex items-center gap-3">
          <QuickActionsBar notificationCount={notificationCount} />

          {/* Notification bell */}
          <button
            className="relative w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors print:hidden"
            onClick={() => navigate("/registre")}
            title="Notifications"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} non lues)` : ""}`}
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {/* Personnaliser button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 print:hidden"
                title="Personnaliser le tableau de bord"
                aria-label="Personnaliser le tableau de bord"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Personnaliser le tableau de bord</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Choisissez les widgets a afficher sur votre tableau de bord.
                </p>
                {WIDGET_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Checkbox
                      id={`widget-${key}`}
                      checked={widgets[key]}
                      onCheckedChange={() => toggleWidget(key)}
                    />
                    <label
                      htmlFor={`widget-${key}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── SECTION 1: KPI Cards ───────────────────────────── */}
      {widgets.kpi && (
        <DashboardKPICards stats={stats} sparklines={sparklines} isLoading={isLoading} />
      )}

      {/* ── SECTION 2: Charts row ──────────────────────────── */}
      {widgets.graphique && (
        <DashboardChart
          monthlyData={monthlyData}
          simplifiee={stats.simplifiee}
          standard={stats.standard}
          renforcee={stats.renforcee}
          isLoading={isLoading}
        />
      )}

      {/* ── SECTION 3: Alerts + Deadlines ──────────────────── */}
      {widgets.alertes && (
        <DashboardAlerts alertes={alertes} deadlines={deadlines} isLoading={isLoading} />
      )}

      {/* ── SECTION 4: Activity Feed ───────────────────────── */}
      {widgets.activite && (
        <DashboardActivity logs={logs} isLoading={isLoading} />
      )}

      {/* ── SECTION 5: Compliance Gauges ───────────────────── */}
      {widgets.repartition && (
        <DashboardVigilance complianceItems={complianceItems} isLoading={isLoading} />
      )}

      {/* ── Footer: Last update ────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 pb-6 border-t border-white/[0.04] print:hidden">
        <span>Derniere mise a jour : {formatTime(lastRefresh)}</span>
        <button
          className="hover:text-foreground transition-colors"
          onClick={handleRefresh}
          title="Rafraichir"
          aria-label="Rafraichir les donnees du tableau de bord"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Mobile FAB ─────────────────────────────────────── */}
      <QuickActionsFAB />

      {/* ── Print styles ───────────────────────────────────── */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
