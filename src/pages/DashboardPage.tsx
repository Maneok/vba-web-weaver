import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { analyzeCockpit } from "@/lib/cockpitEngine";
import {
  RefreshCw, Loader2, Users, Shield, AlertTriangle, FileText, GripVertical,
  TrendingUp, BarChart3, Bell,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import OnboardingWizard, { isOnboardingComplete } from "@/components/OnboardingWizard";
import { QuickActionsFAB } from "@/components/dashboard/QuickActions";
import { KPICard } from "@/components/dashboard/KPICard";
import StatusBanner from "@/components/dashboard/StatusBanner";
import DashboardSearch from "@/components/dashboard/DashboardSearch";
import DashboardShortcutsHelp from "@/components/dashboard/DashboardShortcutsHelp";
import DashboardExport from "@/components/dashboard/DashboardExport";
import DashboardAccessibility from "@/components/dashboard/DashboardAccessibility";
import DashboardPrintHeader from "@/components/dashboard/DashboardPrintHeader";
import DashboardPrintFooter from "@/components/dashboard/DashboardPrintFooter";
import DataFreshnessIndicator from "@/components/dashboard/DataFreshnessIndicator";
import DashboardNotificationCenter from "@/components/dashboard/DashboardNotificationCenter";
import { useReducedMotion, useAutoRefreshInterval } from "@/components/dashboard/DashboardReducedMotion";

// ── Lazy-loaded chart widgets ────────────────────────────────
const LazyRiskRadar = React.lazy(() => import("@/components/dashboard/RiskRadarWidget"));
const LazyExpositionDonut = React.lazy(() => import("@/components/dashboard/ExpositionDonut"));
const LazyRiskValues = React.lazy(() => import("@/components/dashboard/RiskValuesChart"));
const LazyRevenue = React.lazy(() => import("@/components/dashboard/RevenueChart"));
const LazyTopTypes = React.lazy(() => import("@/components/dashboard/TopClientTypes"));
const LazyCollabCases = React.lazy(() => import("@/components/dashboard/CollaboratorCasesChart"));
const LazyTraining = React.lazy(() => import("@/components/dashboard/TrainingStatusWidget"));
const LazyFileUpdate = React.lazy(() => import("@/components/dashboard/FileUpdateStatusWidget"));
const LazyControlStatus = React.lazy(() => import("@/components/dashboard/ControlStatusWidget"));

// ── Skeleton fallback ────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
      <div className="h-4 w-44 bg-muted rounded mb-4" />
      <div className="h-full bg-muted/50 rounded-xl" />
    </div>
  );
}

// ── Staggered animation wrapper ──────────────────────────────
function AnimatedWidget({ children, index, reducedMotion }: { children: React.ReactNode; index: number; reducedMotion: boolean }) {
  if (reducedMotion) return <>{children}</>;
  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "forwards" }}
    >
      {children}
    </div>
  );
}

// ── DnD Widget wrapper ───────────────────────────────────────
function DashboardWidget({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group/widget transition-all duration-200 ${isDragging ? "z-50 opacity-75 scale-[1.02]" : "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"}`}
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

// ── Band section header ──────────────────────────────────────
function BandHeader({ label, color, icon: Icon }: { label: string; color: string; icon: React.ElementType }) {
  return (
    <div className="col-span-full flex items-center gap-3 mt-6 mb-2 print:mt-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${color}`}>
        <Icon className="w-3.5 h-3.5 text-white" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-white">{label}</span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Widget order persistence ─────────────────────────────────
type WidgetKey =
  | "riskRadar" | "vigilance" | "riskValues"
  | "revenue" | "topTypes" | "collabCases"
  | "training" | "fileUpdate" | "controlStatus";

const BAND1_DEFAULT: WidgetKey[] = ["riskRadar", "vigilance", "riskValues"];
const BAND2_DEFAULT: WidgetKey[] = ["revenue", "topTypes", "collabCases"];
const BAND3_DEFAULT: WidgetKey[] = ["training", "fileUpdate", "controlStatus"];
const ALL_WIDGETS: WidgetKey[] = [...BAND1_DEFAULT, ...BAND2_DEFAULT, ...BAND3_DEFAULT];
const WIDGET_ORDER_KEY = "dashboard-widget-order-v3";

function loadBandOrder(band: 1 | 2 | 3): WidgetKey[] {
  const defaults = band === 1 ? BAND1_DEFAULT : band === 2 ? BAND2_DEFAULT : BAND3_DEFAULT;
  try {
    const stored = localStorage.getItem(`${WIDGET_ORDER_KEY}-b${band}`);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter(k => defaults.includes(k as WidgetKey)) as WidgetKey[];
      const missing = defaults.filter(k => !valid.includes(k));
      if (valid.length > 0) return [...valid, ...missing];
    }
  } catch { /* ignore */ }
  return [...defaults];
}

function saveBandOrder(band: 1 | 2 | 3, order: WidgetKey[]) {
  try { localStorage.setItem(`${WIDGET_ORDER_KEY}-b${band}`, JSON.stringify(order)); } catch { /* ignore */ }
}

// ── Helpers ──────────────────────────────────────────────────
function formatDateLong(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
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
  const [band1Order, setBand1Order] = useState<WidgetKey[]>(() => loadBandOrder(1));
  const [band2Order, setBand2Order] = useState<WidgetKey[]>(() => loadBandOrder(2));
  const [band3Order, setBand3Order] = useState<WidgetKey[]>(() => loadBandOrder(3));
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

  function makeDragHandler(
    band: 1 | 2 | 3,
    setter: React.Dispatch<React.SetStateAction<WidgetKey[]>>,
  ) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setter(prev => {
          const oldIndex = prev.indexOf(active.id as WidgetKey);
          const newIndex = prev.indexOf(over.id as WidgetKey);
          const next = arrayMove(prev, oldIndex, newIndex);
          saveBandOrder(band, next);
          return next;
        });
      }
    };
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

  // ── Load missions data ───────────────────────────────────
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
      } catch { /* Table might not exist */ }
    })();
    return () => { cancelled = true; };
  }, [lastRefresh]);

  // ── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    return {
      totalClients: actifs.length,
      simplifiee: clients.filter(c => c.nivVigilance === "SIMPLIFIEE").length,
      standard: clients.filter(c => c.nivVigilance === "STANDARD").length,
      renforcee: clients.filter(c => c.nivVigilance === "RENFORCEE").length,
    };
  }, [clients]);

  // ── Compliance items (for export) ──────────────────────────
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
    const withBE = actifs.filter(c => c.be?.trim()).length;
    const withAddr = actifs.filter(c => c.adresse).length;
    return [
      { label: "Identification clients", value: Math.round((withScreening / total) * 100), target: 90 },
      { label: "Documents KYC", value: Math.round((withDocs / total) * 100), target: 85 },
      { label: "Lettres de mission", value: Math.round((withLM / total) * 100), target: 80 },
      { label: "Formation collaborateurs", value: Math.round((trained / collabTotal) * 100), target: 100 },
      { label: "Bénéficiaires effectifs", value: Math.round((withBE / total) * 100), target: 90 },
      { label: "Adresses vérifiées", value: Math.round((withAddr / total) * 100), target: 95 },
      { label: "Contrôle qualité", value: 0, target: 80 },
    ];
  }, [clients, collaborateurs]);

  const complianceScore = useMemo(() =>
    Math.round(complianceItems.reduce((sum, item) => sum + item.value, 0) / complianceItems.length),
    [complianceItems]
  );

  // ── Cockpit analysis ─────────────────────────────────────
  const cockpitData = useMemo(
    () => analyzeCockpit(clients, collaborateurs, alertes),
    [clients, collaborateurs, alertes]
  );

  const criticalCount = useMemo(() =>
    (cockpitData.urgencies ?? []).filter(u => u.severity === "critique").length,
    [cockpitData]
  );
  const warningCount = useMemo(() =>
    (cockpitData.urgencies ?? []).filter(u => u.severity === "warning").length,
    [cockpitData]
  );
  const alertesCount = criticalCount + warningCount;

  // ── KPI helpers ──────────────────────────────────────────
  const conformiteColor = complianceScore >= 70 ? "#22c55e" : complianceScore >= 40 ? "#f59e0b" : "#ef4444";
  const alertesColor = alertesCount > 0 ? "#ef4444" : "#22c55e";
  const caSubValue = missionsData.ca != null
    ? `${(missionsData.ca / 1000).toFixed(1).replace(/\.0$/, "")}k€/an`
    : undefined;

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const cabinetName = profile?.cabinet_id ? "Cabinet" : "GRIMY";
  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();
  const printDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // ── Widget content map ────────────────────────────────────
  const widgetContent: Record<WidgetKey, React.ReactNode> = {
    riskRadar: <LazyRiskRadar clients={clients} loading={isLoading} />,
    vigilance: (
      <LazyExpositionDonut
        simplifiee={stats.simplifiee}
        standard={stats.standard}
        renforcee={stats.renforcee}
        loading={isLoading}
      />
    ),
    riskValues: <LazyRiskValues clients={clients} loading={isLoading} />,
    revenue: <LazyRevenue clients={clients} loading={isLoading} />,
    topTypes: <LazyTopTypes clients={clients} loading={isLoading} />,
    collabCases: <LazyCollabCases clients={clients} loading={isLoading} />,
    training: <LazyTraining collaborateurs={collaborateurs} loading={isLoading} />,
    fileUpdate: <LazyFileUpdate clients={clients} loading={isLoading} />,
    controlStatus: <LazyControlStatus clients={clients} loading={isLoading} />,
  };

  // ── Render band ───────────────────────────────────────────
  function renderBand(
    band: 1 | 2 | 3,
    label: string,
    color: string,
    icon: React.ElementType,
    order: WidgetKey[],
    setter: React.Dispatch<React.SetStateAction<WidgetKey[]>>,
    startIndex: number,
  ) {
    return (
      <>
        <BandHeader label={label} color={color} icon={icon} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragHandler(band, setter)}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {order.map((key, i) => (
                <AnimatedWidget key={key} index={startIndex + i} reducedMotion={reducedMotion}>
                  <DashboardWidget id={key}>
                    <React.Suspense fallback={<ChartSkeleton />}>
                      {widgetContent[key]}
                    </React.Suspense>
                  </DashboardWidget>
                </AnimatedWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </>
    );
  }

  return (
    <DashboardAccessibility announcements={announcements}>
    <div
      className={`p-5 lg:p-8 max-w-[1440px] mx-auto ${reducedMotion ? "" : "animate-fade-in-up"} print:bg-white print:text-black print:p-4`}
      role="main"
      aria-label="Tableau de bord"
    >
      <DashboardPrintHeader cabinetName={cabinetName} userName={userName} date={printDate} />
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR ── */}
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
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50 print:hidden"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Rafraîchir (R)"
            aria-label="Rafraîchir les données"
          >
            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* ── STATUS BANNER ── */}
      <div className="mb-5">
        <StatusBanner criticalCount={criticalCount} warningCount={warningCount} isLoading={isLoading} />
      </div>

      {/* ── TITLE ── */}
      <div className="text-center mb-6 py-3 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
          Pilotage Cabinet Dynamique LCB-FT
        </h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          Score moyen : <span className="font-semibold" style={{ color: cockpitData.scoreMoyen <= 25 ? "#22c55e" : cockpitData.scoreMoyen <= 60 ? "#f59e0b" : "#ef4444" }}>{cockpitData.scoreMoyen}/100</span>
          {" · "}Taux KYC : <span className="font-semibold">{cockpitData.tauxKycComplet}%</span>
          {" · "}Taux formation : <span className="font-semibold">{cockpitData.tauxFormation}%</span>
        </p>
      </div>

      {/* ── 5 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6" role="region" aria-label="Indicateurs clés">
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
          icon={TrendingUp}
          title="Score moyen"
          value={`${cockpitData.scoreMoyen}/100`}
          color={cockpitData.scoreMoyen <= 25 ? "#22c55e" : cockpitData.scoreMoyen <= 60 ? "#f59e0b" : "#ef4444"}
          onClick={() => navigate("/diagnostic")}
          loading={isLoading}
          subValue={cockpitData.scoreMoyen <= 25 ? "Simplifiée" : cockpitData.scoreMoyen <= 60 ? "Standard" : "Renforcée"}
          ariaLabel={`Score moyen : ${cockpitData.scoreMoyen}/100`}
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
          subValue={missionsData.count === 0 ? "Créer une mission" : caSubValue}
          ariaLabel={`${missionsData.count} mission${missionsData.count > 1 ? "s" : ""}`}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          3 BANDES — 9 widgets réorganisables (grille 3 colonnes)
          ═══════════════════════════════════════════════════════ */}

      {/* BANDE 1 — RISQUE LCB-FT */}
      {renderBand(1, "Risque LCB-FT", "bg-blue-600", Shield, band1Order, setBand1Order, 0)}

      {/* BANDE 2 — PILOTAGE CABINET */}
      {renderBand(2, "Pilotage Cabinet", "bg-amber-600", BarChart3, band2Order, setBand2Order, 3)}

      {/* BANDE 3 — ALERTES CABINET */}
      {renderBand(3, "Alertes Cabinet", "bg-red-600", Bell, band3Order, setBand3Order, 6)}

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-6 pb-4 print:hidden">
        <DataFreshnessIndicator lastRefresh={lastRefresh} staleThresholdMinutes={5} />
      </div>

      <QuickActionsFAB />
      <DashboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DashboardPrintFooter cabinetName={cabinetName} />

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out;
        }
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
