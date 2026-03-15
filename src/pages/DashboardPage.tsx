import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { analyzeCockpit } from "@/lib/cockpitEngine";
import {
  RefreshCw, Loader2,
  Building2, UserCheck, CreditCard, MapPin, Hash, ShieldCheck,
  Users, Shield, AlertTriangle, FileText, GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import OnboardingWizard, { isOnboardingComplete } from "@/components/OnboardingWizard";
import { QuickActionsFAB } from "@/components/dashboard/QuickActions";
import { KPICard } from "@/components/dashboard/KPICard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import StatusBanner from "@/components/dashboard/StatusBanner";
import DashboardCockpit from "@/components/dashboard/DashboardCockpit";
import DashboardSearch from "@/components/dashboard/DashboardSearch";
import DashboardShortcutsHelp from "@/components/dashboard/DashboardShortcutsHelp";
import DashboardExport from "@/components/dashboard/DashboardExport";
import DashboardDataQuality from "@/components/dashboard/DashboardDataQuality";
import DashboardAccessibility from "@/components/dashboard/DashboardAccessibility";
import DashboardPrintHeader from "@/components/dashboard/DashboardPrintHeader";
import DashboardPrintFooter from "@/components/dashboard/DashboardPrintFooter";
import DataFreshnessIndicator from "@/components/dashboard/DataFreshnessIndicator";
import DashboardNotificationCenter from "@/components/dashboard/DashboardNotificationCenter";
import { useReducedMotion, useAutoRefreshInterval } from "@/components/dashboard/DashboardReducedMotion";

// ── Lazy-loaded recharts components (TDZ prevention) ─────────
const ComplianceRadar = React.lazy(() => import("@/components/dashboard/ComplianceRadar"));
const LazyMonthlyChart = React.lazy(() =>
  import("@/components/dashboard/MonthlyChart").then(m => ({ default: m.MonthlyChart }))
);
const LazyVigilanceDonut = React.lazy(() =>
  import("@/components/dashboard/VigilanceDonut").then(m => ({ default: m.VigilanceDonut }))
);

// ── Skeleton fallback for lazy charts ────────────────────────
function ChartSkeleton({ height = "h-[340px]" }: { height?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border p-5 ${height} animate-pulse`}>
      <div className="h-4 w-44 bg-muted rounded mb-4" />
      <div className="h-full bg-muted/50 rounded-xl" />
    </div>
  );
}

// ── DnD Widget wrapper ───────────────────────────────────────
function DashboardWidget({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group/widget ${isDragging ? "z-50 opacity-75 scale-[1.02]" : ""}`}
      {...attributes}
    >
      <button
        {...listeners}
        className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/widget:opacity-50 hover:!opacity-100 focus:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 bg-card border border-border rounded-full p-1 shadow-sm print:hidden"
        aria-label="Déplacer ce widget"
        tabIndex={-1}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

// ── Widget order persistence ─────────────────────────────────
type WidgetKey = "cockpit" | "radar" | "chart" | "vigilance" | "activity" | "quality";
const DEFAULT_ORDER: WidgetKey[] = ["cockpit", "radar", "chart", "vigilance", "activity", "quality"];
const WIDGET_ORDER_KEY = "dashboard-widget-order-v2";

function loadWidgetOrder(): WidgetKey[] {
  try {
    const stored = localStorage.getItem(WIDGET_ORDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((k: string) => DEFAULT_ORDER.includes(k as WidgetKey)) as WidgetKey[];
        const missing = DEFAULT_ORDER.filter(k => !valid.includes(k));
        if (valid.length + missing.length === DEFAULT_ORDER.length) return [...valid, ...missing];
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

function saveWidgetOrder(order: WidgetKey[]) {
  try { localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
}

// ── Helpers ──────────────────────────────────────────────────
function formatDateLong(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { clients, alertes, logs, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; titre: string; message: string; type: "systeme" | "conformite" | "revue" | "alerte"; lue: boolean; created_at: string }[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [missionsData, setMissionsData] = useState<{ count: number; ca: number | null }>({ count: 0, ca: null });
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(loadWidgetOrder);
  const reducedMotion = useReducedMotion();
  const [autoRefreshInterval] = useAutoRefreshInterval();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();
  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  const mountedRef = useRef(true);
  const lastManualRefresh = useRef(0);

  // ── DnD sensors ─────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder(prev => {
        const oldIndex = prev.indexOf(active.id as WidgetKey);
        const newIndex = prev.indexOf(over.id as WidgetKey);
        const next = arrayMove(prev, oldIndex, newIndex);
        saveWidgetOrder(next);
        return next;
      });
    }
  }

  // ── Handlers ────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastManualRefresh.current < 3000) return;
    lastManualRefresh.current = now;
    setIsRefreshing(true);
    refreshAll()
      .then(() => {
        if (mountedRef.current) {
          setLastRefresh(new Date());
          setAnnouncements(prev => [...prev.slice(-4), "Données actualisées"]);
        }
      })
      .catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err))
      .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
  }, [refreshAll]);

  const handleMarkNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    supabase.from("notifications").update({ lue: true }).eq("id", id).then(() => {});
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(() => {
    const unreadIds = notifications.filter(n => !n.lue).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
    if (unreadIds.length > 0) {
      supabase.from("notifications").update({ lue: true }).in("id", unreadIds).then(() => {});
    }
  }, [notifications]);

  const greeting = useMemo(() => new Date().getHours() < 18 ? "Bonjour" : "Bonsoir", []);

  useDocumentTitle("Dashboard");

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "n": e.preventDefault(); navigate("/nouveau-client"); break;
          case "A": if (e.shiftKey) { e.preventDefault(); navigate("/registre"); } break;
        }
        return;
      }

      if (inInput) return;

      switch (e.key) {
        case "?": e.preventDefault(); setShortcutsOpen(true); break;
        case "/": e.preventDefault(); searchInputRef.current?.focus(); break;
        case "r": case "R": e.preventDefault(); handleRefresh(); break;
        case "p": case "P": e.preventDefault(); window.print(); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, handleRefresh]);

  // ── Auto-refresh ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const doRefresh = () => {
      if (document.hidden) return;
      refreshAllRef.current()
        .then(() => {
          if (mountedRef.current) {
            setLastRefresh(new Date());
            setAnnouncements(prev => [...prev.slice(-4), "Données actualisées"]);
          }
        })
        .catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err));
    };
    if (autoRefreshInterval > 0) {
      refreshTimer.current = setInterval(doRefresh, autoRefreshInterval);
    }
    const handleVisibility = () => { if (!document.hidden) doRefresh(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mountedRef.current = false;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoRefreshInterval]);

  // ── Load notifications ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("notifications")
      .select("id, titre, message, type, lue, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { logger.warn("Dashboard", "Notification load error:", error.message); return; }
        const items = (data || []).map((n: any) => ({
          id: n.id,
          titre: n.titre || "Notification",
          message: n.message || "",
          type: (n.type || "systeme") as "systeme" | "conformite" | "revue" | "alerte",
          lue: !!n.lue,
          created_at: n.created_at || new Date().toISOString(),
        }));
        setNotifications(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) logger.warn("Dashboard", "Echec du chargement des notifications", { error: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, [user, lastRefresh]);

  // ── Load missions data (lettres de mission) ───────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("lettres_mission")
          .select("id, statut, honoraires_annuels")
          .neq("statut", "brouillon");
        if (cancelled || error) return;
        const missions = data || [];
        const ca = missions.reduce((s: number, m: any) => s + (Number(m.honoraires_annuels) || 0), 0);
        setMissionsData({ count: missions.length, ca: ca > 0 ? ca : null });
      } catch {
        // Table or column might not exist — fail silently
      }
    })();
    return () => { cancelled = true; };
  }, [lastRefresh]);

  // ── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const totalClients = actifs.length;
    const simplifiee = clients.filter(c => c.nivVigilance === "SIMPLIFIEE").length;
    const standard = clients.filter(c => c.nivVigilance === "STANDARD").length;
    const renforcee = clients.filter(c => c.nivVigilance === "RENFORCEE").length;
    return { totalClients, simplifiee, standard, renforcee };
  }, [clients]);

  // ── Compliance items (7 axes) ─────────────────────────────
  const complianceItems = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const total = actifs.length || 1;
    const withScreening = actifs.filter(c => c.siren && c.dirigeant).length;
    const withDocs = actifs.filter(c => c.lienCni).length;
    const withLM = actifs.filter(c => (c.honoraires || 0) > 0).length;
    const collabTotal = collaborateurs.length || 1;
    const now = new Date();
    const trained = collaborateurs.filter(col => {
      if (!col.derniereFormation) return false;
      try { const d = new Date(col.derniereFormation); if (isNaN(d.getTime())) return false; return (now.getTime() - d.getTime()) / (86400000 * 365) < 1; } catch { return false; }
    }).length;
    const withBE = actifs.filter(c => c.beneficiaireEffectif).length;
    const withAddr = actifs.filter(c => c.adresse).length;
    return [
      { label: "Identification clients", value: Math.round((withScreening / total) * 100), target: 90, description: "Screening complet (SIREN + dirigeant)" },
      { label: "Documents KYC", value: Math.round((withDocs / total) * 100), target: 85, description: "CNI / pièce d'identité renseignée" },
      { label: "Lettres de mission", value: Math.round((withLM / total) * 100), target: 80, description: "LM signées vs clients actifs" },
      { label: "Formation collaborateurs", value: Math.round((trained / collabTotal) * 100), target: 100, description: "Formations < 12 mois" },
      { label: "Bénéficiaires effectifs", value: Math.round((withBE / total) * 100), target: 90, description: "BE identifiés" },
      { label: "Adresses vérifiées", value: Math.round((withAddr / total) * 100), target: 95, description: "Adresse renseignée" },
      { label: "Contrôle qualité", value: 0, target: 80, description: "Contrôles réalisés vs attendus" },
    ];
  }, [clients, collaborateurs]);

  // ── Compliance score (single source of truth) ──────────────
  const complianceScore = useMemo(() =>
    Math.round(complianceItems.reduce((sum, item) => sum + item.value, 0) / complianceItems.length),
    [complianceItems]
  );

  // ── Cockpit analysis ─────────────────────────────────────
  const cockpitData = useMemo(
    () => analyzeCockpit(clients, collaborateurs, alertes),
    [clients, collaborateurs, alertes]
  );

  // ── Alertes count (critical + warning from cockpit) ───────
  const criticalCount = useMemo(() => {
    const urgencies = cockpitData.urgencies ?? [];
    return urgencies.filter(u => u.severity === "critique").length;
  }, [cockpitData]);

  const warningCount = useMemo(() => {
    const urgencies = cockpitData.urgencies ?? [];
    return urgencies.filter(u => u.severity === "warning").length;
  }, [cockpitData]);

  const alertesCount = criticalCount + warningCount;

  // ── Monthly chart data ────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const beforeDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const filtered = clients.filter(c => {
        if (!c.dateCreationLigne) return true;
        try { const cd = new Date(c.dateCreationLigne); return !isNaN(cd.getTime()) && cd <= beforeDate; } catch { return true; }
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

  // ── Data quality categories ───────────────────────────────
  const dataQualityCategories = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const total = actifs.length;
    if (total === 0) return [];
    return [
      { label: "SIREN", total, filled: actifs.filter(c => c.siren).length, icon: <Building2 className="w-3.5 h-3.5" /> },
      { label: "Dirigeant", total, filled: actifs.filter(c => c.dirigeant).length, icon: <UserCheck className="w-3.5 h-3.5" /> },
      { label: "CNI", total, filled: actifs.filter(c => c.lienCni).length, icon: <CreditCard className="w-3.5 h-3.5" /> },
      { label: "Adresse", total, filled: actifs.filter(c => c.adresse).length, icon: <MapPin className="w-3.5 h-3.5" /> },
      { label: "Code APE", total, filled: actifs.filter(c => c.codeApe).length, icon: <Hash className="w-3.5 h-3.5" /> },
      { label: "Vigilance", total, filled: actifs.filter(c => c.nivVigilance).length, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    ];
  }, [clients]);

  // ── KPI card helpers ──────────────────────────────────────
  const conformiteColor = complianceScore >= 70 ? "#22c55e" : complianceScore >= 40 ? "#f59e0b" : "#ef4444";
  const alertesColor = alertesCount > 0 ? "#ef4444" : "#22c55e";
  const caSubValue = missionsData.ca != null
    ? `${(missionsData.ca / 1000).toFixed(1).replace(/\.0$/, "")}k€/an`
    : undefined;
  const missionsSubValue = missionsData.count === 0 ? "Créer une lettre de mission" : caSubValue;

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const cabinetName = profile?.cabinet_id ? "Cabinet" : "GRIMY";
  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();
  const printDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // ── Widget content map ────────────────────────────────────
  const widgetContent: Record<WidgetKey, React.ReactNode> = {
    cockpit: <DashboardCockpit cockpit={cockpitData} isLoading={isLoading} />,
    radar: (
      <React.Suspense fallback={<ChartSkeleton height="h-[380px]" />}>
        <ComplianceRadar items={complianceItems} score={complianceScore} isLoading={isLoading} />
      </React.Suspense>
    ),
    chart: (
      <React.Suspense fallback={<ChartSkeleton />}>
        <LazyMonthlyChart data={monthlyData} loading={isLoading} />
      </React.Suspense>
    ),
    vigilance: (
      <React.Suspense fallback={<ChartSkeleton />}>
        <LazyVigilanceDonut
          simplifiee={stats.simplifiee}
          standard={stats.standard}
          renforcee={stats.renforcee}
          loading={isLoading}
        />
      </React.Suspense>
    ),
    activity: (
      <div className="space-y-2">
        <ActivityFeed logs={logs.slice(0, 3)} loading={isLoading} />
        {!isLoading && logs.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => navigate("/audit-trail")}
              className="text-xs text-primary hover:underline transition-colors"
            >
              Voir le journal complet
            </button>
          </div>
        )}
      </div>
    ),
    quality: <DashboardDataQuality categories={dataQualityCategories} isLoading={isLoading} />,
  };

  return (
    <DashboardAccessibility announcements={announcements}>
    <div
      className={`p-5 lg:p-8 max-w-[1400px] mx-auto ${reducedMotion ? "" : "animate-fade-in-up"} print:bg-white print:text-black print:p-4`}
      role="main"
      aria-label="Tableau de bord"
    >
      <DashboardPrintHeader cabinetName={cabinetName} userName={userName} date={printDate} />
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR (simplified: search + notifications + refresh) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 print:mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{formatDateLong()}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <DashboardSearch clients={clients} alertes={alertes} className="w-40 sm:w-56 md:w-64" inputRef={searchInputRef} />
          <DashboardNotificationCenter
            notifications={notifications}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            isLoading={isLoading}
          />
          <DashboardExport
            clients={clients}
            alertes={alertes}
            collaborateurs={collaborateurs}
            stats={{ totalClients: stats.totalClients, avgScore: 0, tauxConformite: complianceScore, alertesEnCours: alertesCount, revuesEchues: 0, caPrevisionnel: 0 }}
            cockpitUrgencies={cockpitData.urgencies}
            complianceItems={complianceItems}
          />
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Rafraîchir (R)"
            aria-label="Rafraîchir les données"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ZONE FIXE — Statut + KPIs
          ═══════════════════════════════════════════════════════ */}

      {/* Bannière de statut émotionnelle */}
      <div className="mb-5">
        <StatusBanner
          criticalCount={criticalCount}
          warningCount={warningCount}
          isLoading={isLoading}
        />
      </div>

      {/* 4 KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        role="region"
        aria-label="Indicateurs clés"
      >
        <KPICard
          icon={Users}
          title="Clients actifs"
          value={stats.totalClients}
          color="#3b82f6"
          onClick={() => navigate(stats.totalClients === 0 ? "/nouveau-client" : "/bdd")}
          loading={isLoading}
          subValue={stats.totalClients === 0 ? "Ajouter un client" : undefined}
          ariaLabel={`Clients actifs : ${stats.totalClients}`}
        />
        <KPICard
          icon={Shield}
          title="Conformité"
          value={`${complianceScore}%`}
          color={conformiteColor}
          progress={complianceScore}
          onClick={() => navigate("/controle")}
          loading={isLoading}
          ariaLabel={`Conformité globale : ${complianceScore}%`}
        />
        <KPICard
          icon={AlertTriangle}
          title="Alertes"
          value={alertesCount > 0 ? alertesCount : "Aucune"}
          color={alertesColor}
          onClick={() => navigate("/registre")}
          loading={isLoading}
          ariaLabel={alertesCount > 0 ? `${alertesCount} alerte${alertesCount > 1 ? "s" : ""}` : "Aucune alerte"}
        />
        <KPICard
          icon={FileText}
          title="Missions"
          value={missionsData.count}
          color="#8b5cf6"
          onClick={() => navigate("/lettre-mission")}
          loading={isLoading}
          subValue={missionsSubValue}
          ariaLabel={`${missionsData.count} mission${missionsData.count > 1 ? "s" : ""} active${missionsData.count > 1 ? "s" : ""}`}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          ZONE DnD — 6 widgets réorganisables (grille 2 colonnes)
          ═══════════════════════════════════════════════════════ */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {widgetOrder.map(key => (
              <DashboardWidget key={key} id={key}>
                {widgetContent[key]}
              </DashboardWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-3 pb-4 print:hidden">
        <DataFreshnessIndicator lastRefresh={lastRefresh} staleThresholdMinutes={5} />
      </div>

      <QuickActionsFAB />
      <DashboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DashboardPrintFooter cabinetName={cabinetName} />

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:block { display: block !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
    </DashboardAccessibility>
  );
}
