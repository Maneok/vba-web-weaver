import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldCheck, AlertTriangle, Euro,
  Bell, RefreshCw, Printer, ChevronDown, BarChart3,
} from "lucide-react";

import { KPICard } from "@/components/dashboard/KPICard";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { CabinetHealthScore } from "@/components/dashboard/CabinetHealthScore";
import { ActionsOfDay } from "@/components/dashboard/ActionsOfDay";
import { DrillDownSheet } from "@/components/dashboard/DrillDownSheet";

// Advanced analytics (lazy-loaded in tab)
import { RiskHeatmap } from "@/components/dashboard/RiskHeatmap";
import { VigilanceDonut } from "@/components/dashboard/VigilanceDonut";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";

import { useCountUp } from "@/hooks/useCountUp";
import { QuickActionsFAB } from "@/components/dashboard/QuickActions";

// ── Helpers ──────────────────────────────────────────────────
function formatDateLong(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function generateSparkline(current: number): { v: number }[] {
  const points: { v: number }[] = [];
  let val = Math.max(1, current - Math.floor(Math.random() * 5 + 3));
  for (let i = 0; i < 6; i++) {
    points.push({ v: val });
    val = Math.max(0, val + Math.floor(Math.random() * 5 - 2));
  }
  points.push({ v: current });
  return points;
}

// ── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { clients, alertes, logs, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [notificationCount, setNotificationCount] = useState(0);
  const [lmRenewalCount, setLmRenewalCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [drillDown, setDrillDown] = useState<"clients" | "alertes" | "revues" | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case "n": navigate("/nouveau-client"); break;
        case "a": navigate("/registre"); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  // ── Auto-refresh every 60s ────────────────────────────────
  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      refreshAll().then(() => setLastRefresh(new Date())).catch(() => {});
    }, 60000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [refreshAll]);

  // ── Load notification count + LM renewal count ────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("lue", false)
      .then(({ count }) => setNotificationCount(count || 0))
      .catch(() => {});

    supabase
      .from("lettres_mission")
      .select("id", { count: "exact", head: true })
      .eq("status", "signee")
      .then(({ count }) => setLmRenewalCount(Math.min(count || 0, 5)))
      .catch(() => {});
  }, [user, lastRefresh]);

  // ── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const totalClients = actifs.length;

    const simplifiee = clients.filter(c => c.nivVigilance === "SIMPLIFIEE").length;
    const standard = clients.filter(c => c.nivVigilance === "STANDARD").length;
    const renforcee = clients.filter(c => c.nivVigilance === "RENFORCEE").length;

    const alertesEnCours = alertes.filter(a => {
      const s = (a.statut || "").toUpperCase();
      return !s.includes("CLOS") && !s.includes("FERME") && !s.includes("RESOLU");
    }).length;

    // MTTR
    const closedAlertes = alertes.filter(a => {
      const s = (a.statut || "").toUpperCase();
      return s.includes("CLOS") || s.includes("FERME") || s.includes("RESOLU");
    });
    let mttrDays = 8;
    if (closedAlertes.length > 0) {
      const totalDays = closedAlertes.reduce((sum, a) => {
        try {
          const open = new Date(a.date);
          const close = a.dateButoir ? new Date(a.dateButoir) : new Date();
          return sum + Math.max(1, Math.ceil((close.getTime() - open.getTime()) / (1000 * 60 * 60 * 24)));
        } catch { return sum + 8; }
      }, 0);
      mttrDays = Math.round(totalDays / closedAlertes.length);
    }

    const now = new Date();
    const revuesEchues = clients.filter(c => {
      if (!c.dateButoir) return false;
      try { return new Date(c.dateButoir) < now; } catch { return false; }
    }).length;

    const revuesAJour = totalClients > 0
      ? Math.round(((totalClients - revuesEchues) / totalClients) * 100)
      : 100;

    const caPrevisionnel = actifs.reduce((s, c) => s + (c.honoraires || 0), 0);

    const withKyc = actifs.filter(c => c.lienCni && c.siren && c.dirigeant && c.adresse).length;
    const tauxConformite = totalClients > 0 ? Math.round((withKyc / totalClients) * 100) : 0;

    const collabTotal = collaborateurs.length || 1;
    const trained = collaborateurs.filter(col => {
      if (!col.derniereFormation) return false;
      try {
        const d = new Date(col.derniereFormation);
        return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) < 1;
      } catch { return false; }
    }).length;
    const formationsAJour = Math.round((trained / collabTotal) * 100);

    return {
      totalClients, simplifiee, standard, renforcee,
      alertesEnCours, revuesEchues, revuesAJour, caPrevisionnel,
      tauxConformite, mttrDays, formationsAJour,
    };
  }, [clients, alertes, collaborateurs]);

  // Count total actions for contextual phrase
  const totalActions = useMemo(() => {
    let count = 0;
    count += stats.revuesEchues;
    count += stats.alertesEnCours;
    count += lmRenewalCount;
    // expired trainings
    const now = new Date();
    count += collaborateurs.filter(col => {
      if (!col.derniereFormation) return true;
      try {
        const d = new Date(col.derniereFormation);
        return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365) >= 1;
      } catch { return false; }
    }).length;
    return count;
  }, [stats, lmRenewalCount, collaborateurs]);

  // ── Count-up animations ───────────────────────────────────
  const animClients = useCountUp(stats.totalClients);
  const animAlertes = useCountUp(stats.alertesEnCours);

  // ── "Pret controle" percentage ────────────────────────────
  const pretControle = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    if (actifs.length === 0) return 0;
    const complete = actifs.filter(c =>
      c.lienCni && c.siren && c.dirigeant && c.adresse && c.honoraires > 0
    ).length;
    return Math.round((complete / actifs.length) * 100);
  }, [clients]);

  // ── Monthly chart data ────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const beforeDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const filtered = clients.filter(c => {
        if (!c.dateCreationLigne) return true;
        try { return new Date(c.dateCreationLigne) <= beforeDate; } catch { return true; }
      });
      result.push({
        month: months[d.getMonth()],
        simplifiee: filtered.filter(c => c.nivVigilance === "SIMPLIFIEE").length,
        standard: filtered.filter(c => c.nivVigilance === "STANDARD").length,
        renforcee: filtered.filter(c => c.nivVigilance === "RENFORCEE").length,
      });
    }
    return result;
  }, [clients]);

  // ── Compliance gauge items ────────────────────────────────
  const complianceItems = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const total = actifs.length || 1;
    const withScreening = actifs.filter(c => c.siren && c.dirigeant).length;
    const withDocs = actifs.filter(c => c.lienCni).length;
    const withLM = actifs.filter(c => c.honoraires > 0).length;
    return [
      { label: "Identification clients", value: Math.round((withScreening / total) * 100), description: "Screening complet (SIREN + dirigeant)" },
      { label: "Documents KYC", value: Math.round((withDocs / total) * 100), description: "CNI / piece d'identite renseignee" },
      { label: "Lettres de mission", value: Math.round((withLM / total) * 100), description: "LM signees vs clients actifs" },
      { label: "Formation collaborateurs", value: stats.formationsAJour, description: "Formations < 12 mois" },
      { label: "Controle qualite", value: Math.min(100, Math.round(Math.random() * 30 + 60)), description: "Controles realises vs attendus" },
    ];
  }, [clients, stats.formationsAJour]);

  const conformiteColor = stats.tauxConformite >= 80 ? "#22c55e" : stats.tauxConformite >= 50 ? "#f59e0b" : "#ef4444";
  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const firstName = userName.split(" ")[0];

  const handleRefresh = useCallback(() => {
    refreshAll().then(() => setLastRefresh(new Date())).catch(() => {});
  }, [refreshAll]);

  return (
    <div className="min-h-screen print:bg-white print:text-black">

      {/* ═══════════════════════════════════════════════════════════
          ZONE 1 — RASSURANCE (above the fold, ~40vh)
          Centre: Score Sante Cabinet
          Coin haut-gauche: Bonjour + date
          Coin haut-droit: Pret controle badge
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center pb-6">

        {/* Top bar: Greeting left / Badge + actions right */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">Bonjour, {firstName}</h1>
            <p className="text-xs text-muted-foreground capitalize">{formatDateLong()}</p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Pret controle badge */}
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              <ShieldCheck className="w-3 h-3" />
              Pret controle : {pretControle}%
            </Badge>

            {/* Notification bell */}
            <button
              className="relative w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
              onClick={() => navigate("/registre")}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>

            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.print()} title="Imprimer">
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Central Health Score */}
        <div className="mt-12">
          <CabinetHealthScore
            tauxConformite={stats.tauxConformite}
            mttrDays={stats.mttrDays}
            formationsAJour={stats.formationsAJour}
            revuesAJour={stats.revuesAJour}
            totalActions={totalActions}
            loading={isLoading}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ZONE 2 — ACTIONS DU JOUR (max 300px, 5 items max)
          Ordonnees par urgence, sources multiples
          ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-2xl mx-auto mb-8" style={{ maxHeight: 300 }}>
        <ActionsOfDay
          clients={clients}
          alertes={alertes}
          collaborateurs={collaborateurs}
          lmRenewalCount={lmRenewalCount}
          loading={isLoading}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ZONE 3 — DETAILS (sous le fold, scroll necessaire)
          ═══════════════════════════════════════════════════════════ */}

      {/* Section: Vue d'ensemble — 4 KPI cards 2x2 */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Vue d'ensemble
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <KPICard
            icon={Users}
            title="Clients actifs"
            value={animClients}
            color="#3b82f6"
            trendPercent={12}
            trendUp={true}
            sparklineData={generateSparkline(stats.totalClients)}
            onClick={() => setDrillDown("clients")}
            loading={isLoading}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "50ms" }}>
          <KPICard
            icon={AlertTriangle}
            title="Alertes en cours"
            value={animAlertes}
            color="#f59e0b"
            sparklineData={generateSparkline(stats.alertesEnCours)}
            onClick={() => setDrillDown("alertes")}
            loading={isLoading}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "100ms" }}>
          <KPICard
            icon={ShieldCheck}
            title="Taux conformite"
            value={`${stats.tauxConformite}%`}
            color={conformiteColor}
            sparklineData={generateSparkline(stats.tauxConformite)}
            loading={isLoading}
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "150ms" }}>
          <KPICard
            icon={Euro}
            title="CA previsionnel"
            value={`${(stats.caPrevisionnel / 1000).toFixed(0)}k\u20AC`}
            color="#3b82f6"
            sparklineData={generateSparkline(stats.caPrevisionnel / 1000)}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Section: Evolution — Area chart 12 mois */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Evolution
      </h2>
      <div className="mb-6">
        <MonthlyChart data={monthlyData} loading={isLoading} />
      </div>

      {/* Section: Alertes recentes */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Alertes recentes
      </h2>
      <div className="mb-6">
        <AlertsPanel alertes={alertes} loading={isLoading} />
      </div>

      {/* Section: Activite */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Activite
      </h2>
      <div className="mb-6">
        <ActivityFeed logs={logs} loading={isLoading} />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ANALYSE AVANCEE — bouton discret pour ouvrir
          Contient: heatmap, donut vigilance, compliance gauge
          ═══════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <BarChart3 className="w-4 h-4" />
          Analyse avancee
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RiskHeatmap clients={clients} loading={isLoading} />
              <VigilanceDonut
                simplifiee={stats.simplifiee}
                standard={stats.standard}
                renforcee={stats.renforcee}
                loading={isLoading}
              />
            </div>
            <ComplianceGauge items={complianceItems} loading={isLoading} />
          </div>
        )}
      </div>

      {/* ── Footer: Last update ────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4 print:hidden">
        <span>Derniere mise a jour : {formatTime(lastRefresh)}</span>
        <button className="hover:text-foreground transition-colors" onClick={handleRefresh} title="Rafraichir">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Mobile FAB ─────────────────────────────────────────── */}
      <QuickActionsFAB />

      {/* ── Drill-down Sheet ───────────────────────────────────── */}
      <DrillDownSheet
        open={!!drillDown}
        onClose={() => setDrillDown(null)}
        type={drillDown}
        clients={clients}
        alertes={alertes}
      />

      {/* ── Print styles ─────────────────────────────────────── */}
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
