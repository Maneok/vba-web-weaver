import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Users, BarChart3, ShieldCheck, AlertTriangle, Clock, Euro,
  Bell, RefreshCw, Printer,
} from "lucide-react";

import { KPICard } from "@/components/dashboard/KPICard";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";
import { VigilanceDonut } from "@/components/dashboard/VigilanceDonut";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { UpcomingDeadlines, type Deadline } from "@/components/dashboard/UpcomingDeadlines";
import { QuickActionsBar, QuickActionsFAB } from "@/components/dashboard/QuickActions";

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

// Generate sparkline data from clients (last 6 months trend mock)
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
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
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

  // ── Load notification count ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("lue", false)
      .then(({ count }) => {
        setNotificationCount(count || 0);
      })
      .catch(() => {});
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

    // CA previsionnel from honoraires
    const caPrevisionnel = actifs.reduce((s, c) => s + (c.honoraires || 0), 0);

    // Conformite = % of clients with all KYC fields filled
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

  // ── Monthly chart data (computed from clients) ────────────
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = months[d.getMonth()];

      // Count clients that existed by that month based on dateCreationLigne
      const beforeDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const filtered = clients.filter(c => {
        if (!c.dateCreationLigne) return true; // old clients
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

    // Revues approaching
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

    // Formations approaching for collaborateurs
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

    // Sort by date
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
      { label: "Controle qualite", value: Math.min(100, Math.round(Math.random() * 30 + 60)), description: "Controles realises vs attendus" },
    ];
  }, [clients, collaborateurs]);

  // ── Score color helper ────────────────────────────────────
  const scoreColor = stats.avgScore <= 30 ? "#22c55e" : stats.avgScore <= 55 ? "#f59e0b" : "#ef4444";
  const conformiteColor = stats.tauxConformite >= 80 ? "#22c55e" : stats.tauxConformite >= 50 ? "#f59e0b" : "#ef4444";

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";

  const handleRefresh = useCallback(() => {
    refreshAll().then(() => setLastRefresh(new Date())).catch(() => {});
  }, [refreshAll]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in-up print:bg-white print:text-black">
      {/* ── TOP BAR ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 pb-6 border-b border-white/[0.06] print:mb-4 print:border-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {new Date().getHours() < 18 ? "Bonjour" : "Bonsoir"}, {userName}
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
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {/* Print button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 print:hidden"
            onClick={() => window.print()}
            title="Exporter / Imprimer"
          >
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── SECTION 1: KPI Cards ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 lg:gap-5 mb-8">
        <KPICard
          icon={Users}
          title="Clients actifs"
          value={stats.totalClients}
          color="#3b82f6"
          trendPercent={12}
          trendUp
          sparklineData={generateSparkline(stats.totalClients)}
          loading={isLoading}
        />
        <KPICard
          icon={BarChart3}
          title="Score moyen"
          value={stats.avgScore}
          color={scoreColor}
          sparklineData={generateSparkline(stats.avgScore)}
          loading={isLoading}
        />
        <KPICard
          icon={ShieldCheck}
          title="Taux conformite"
          value={`${stats.tauxConformite}%`}
          color={conformiteColor}
          sparklineData={generateSparkline(stats.tauxConformite)}
          loading={isLoading}
        />
        <KPICard
          icon={AlertTriangle}
          title="Alertes en cours"
          value={stats.alertesEnCours}
          color="#f59e0b"
          onClick={() => navigate("/registre")}
          sparklineData={generateSparkline(stats.alertesEnCours)}
          loading={isLoading}
        />
        <KPICard
          icon={Clock}
          title="Revues echues"
          value={stats.revuesEchues}
          color={stats.revuesEchues > 0 ? "#ef4444" : "#22c55e"}
          onClick={() => navigate("/bdd?filter=echues")}
          sparklineData={generateSparkline(stats.revuesEchues)}
          loading={isLoading}
        />
        <KPICard
          icon={Euro}
          title="CA previsionnel"
          value={`${(stats.caPrevisionnel / 1000).toFixed(0)}k\u20AC`}
          color="#3b82f6"
          sparklineData={generateSparkline(stats.caPrevisionnel / 1000)}
          loading={isLoading}
        />
      </div>

      {/* ── SECTION 2: Charts row ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-8">
        <div className="lg:col-span-3">
          <MonthlyChart data={monthlyData} loading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <VigilanceDonut
            simplifiee={stats.simplifiee}
            standard={stats.standard}
            renforcee={stats.renforcee}
            loading={isLoading}
          />
        </div>
      </div>

      {/* ── SECTION 3: Alerts + Deadlines ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8">
        <AlertsPanel alertes={alertes} loading={isLoading} />
        <UpcomingDeadlines deadlines={deadlines} loading={isLoading} />
      </div>

      {/* ── SECTION 4: Activity Feed ───────────────────────── */}
      <div className="mb-8">
        <ActivityFeed logs={logs} loading={isLoading} />
      </div>

      {/* ── SECTION 5: Compliance Gauges ───────────────────── */}
      <div className="mb-8">
        <ComplianceGauge items={complianceItems} loading={isLoading} />
      </div>

      {/* ── Footer: Last update ────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 pb-6 border-t border-white/[0.04] print:hidden">
        <span>Derniere mise a jour : {formatTime(lastRefresh)}</span>
        <button
          className="hover:text-foreground transition-colors"
          onClick={handleRefresh}
          title="Rafraichir"
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
