import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { analyzeCockpit } from "@/lib/cockpitEngine";
import { formatDateFr } from "@/lib/dateUtils";
import {
  RefreshCw, Loader2, Users, Shield, AlertTriangle, FileText,
  GripVertical, TrendingUp, BarChart3, Bell,
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
import { isActive, scoreColor as vigilanceColor, statusColor, formatEuros, pct, monthsSince, COLOR } from "@/components/dashboard/dashboardUtils";

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
    <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-3" />
      <div className="flex-1 bg-muted/40 rounded-lg mt-3 h-[220px]" />
    </div>
  );
}

// ── Error fallback for lazy widgets ──────────────────────────
class WidgetErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { logger.warn("Dashboard", "Widget error:", error.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card rounded-xl border border-destructive/20 p-4 h-[300px] flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-6 h-6 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Widget indisponible</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-xs text-primary mt-2 hover:underline">Réessayer</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Staggered animation wrapper ──────────────────────────────
function AnimatedWidget({ children, index, reducedMotion }: { children: React.ReactNode; index: number; reducedMotion: boolean }) {
  if (reducedMotion) return <>{children}</>;
  return (
    <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${index * 70}ms`, animationFillMode: "forwards" }}>
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
      className={`relative group/widget transition-colors duration-150 ${isDragging ? "z-50 opacity-75" : ""}`}
      {...attributes}
    >
      <button
        {...listeners}
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/widget:opacity-50 hover:!opacity-100 focus:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 print:hidden"
        aria-label="Déplacer ce widget"
        tabIndex={0}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

// ── Band section header ──────────────────────────────────────
function BandHeader({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-2 print:mt-3" role="heading" aria-level={2}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Widget order persistence ─────────────────────────────────
type WidgetKey =
  | "riskRadar" | "vigilance" | "riskValues"
  | "revenue" | "topTypes" | "collabCases"
  | "training" | "fileUpdate" | "controlStatus";

const BAND_DEFAULTS: Record<1 | 2 | 3, WidgetKey[]> = {
  1: ["riskRadar", "vigilance", "riskValues"],
  2: ["revenue", "topTypes", "collabCases"],
  3: ["training", "fileUpdate", "controlStatus"],
};
const ORDER_KEY = "dashboard-widget-order-v3";

function loadBandOrder(band: 1 | 2 | 3): WidgetKey[] {
  const defaults = BAND_DEFAULTS[band];
  try {
    const raw = localStorage.getItem(`${ORDER_KEY}-b${band}`);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      const valid = parsed.filter(k => defaults.includes(k as WidgetKey)) as WidgetKey[];
      const missing = defaults.filter(k => !valid.includes(k));
      if (valid.length > 0) return [...valid, ...missing];
    }
  } catch { /* corrupted storage */ }
  return [...defaults];
}

function saveBandOrder(band: 1 | 2 | 3, order: WidgetKey[]) {
  try { localStorage.setItem(`${ORDER_KEY}-b${band}`, JSON.stringify(order)); } catch { /* quota exceeded */ }
}

// ── Notification type ────────────────────────────────────────
interface DashboardNotification {
  id: string;
  titre: string;
  message: string;
  type: "systeme" | "conformite" | "revue" | "alerte";
  lue: boolean;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────
const DATE_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { clients, alertes, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
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

  // ── DnD sensors (memoized) ────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const makeDragHandler = useCallback((band: 1 | 2 | 3, setter: React.Dispatch<React.SetStateAction<WidgetKey[]>>) => {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setter(prev => {
          const oldIdx = prev.indexOf(active.id as WidgetKey);
          const newIdx = prev.indexOf(over.id as WidgetKey);
          const next = arrayMove(prev, oldIdx, newIdx);
          saveBandOrder(band, next);
          return next;
        });
      }
    };
  }, []);

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
    supabase.from("notifications").update({ lue: true }).eq("id", id)
      .then(({ error }) => { if (error) logger.debug("Dashboard", "mark-read error:", error.message); });
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(() => {
    const unreadIds = notifications.filter(n => !n.lue).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
    supabase.from("notifications").update({ lue: true }).in("id", unreadIds)
      .then(({ error }) => { if (error) logger.debug("Dashboard", "mark-all-read error:", error.message); });
  }, [notifications]);

  const greeting = useMemo(() => new Date().getHours() < 18 ? "Bonjour" : "Bonsoir", []);

  useDocumentTitle("Dashboard");

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "n") { e.preventDefault(); navigate("/nouveau-client"); }
        else if (e.shiftKey && e.key === "A") { e.preventDefault(); navigate("/registre"); }
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
        .then(() => { if (mountedRef.current) { setLastRefresh(new Date()); } })
        .catch((err: unknown) => logger.debug("Dashboard", "auto-refresh failed:", err));
    };
    const startInterval = () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      if (autoRefreshInterval > 0) refreshTimer.current = setInterval(doRefresh, autoRefreshInterval);
    };
    startInterval();
    const handleVisibility = () => {
      if (document.hidden) {
        if (refreshTimer.current) clearInterval(refreshTimer.current);
      } else {
        doRefresh();
        startInterval();
      }
    };
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
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const items: DashboardNotification[] = (data || []).map((n: any) => ({
          id: String(n.id ?? ""),
          titre: String(n.titre ?? "Notification"),
          message: String(n.message ?? ""),
          type: (["systeme", "conformite", "revue", "alerte"].includes(n.type) ? n.type : "systeme") as DashboardNotification["type"],
          lue: Boolean(n.lue),
          created_at: String(n.created_at ?? new Date().toISOString()),
        }));
        setNotifications(items);
      })
      .catch(() => { /* notifications table may not exist */ });
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
          .neq("statut", "resiliee");
        if (cancelled || error) return;
        const missions = data || [];
        let ca = 0;
        for (const m of missions) ca += Number(m.honoraires_annuels) || 0;
        setMissionsData({ count: missions.length, ca: ca > 0 ? ca : null });
      } catch { /* table may not exist */ }
    })();
    return () => { cancelled = true; };
  }, [lastRefresh]);

  // ── Computed stats (single pass) ──────────────────────────
  const stats = useMemo(() => {
    let totalActifs = 0, simplifiee = 0, standard = 0, renforcee = 0;
    for (const c of clients) {
      if (!isActive(c)) continue;
      totalActifs++;
      if (c.nivVigilance === "SIMPLIFIEE") simplifiee++;
      else if (c.nivVigilance === "STANDARD") standard++;
      else if (c.nivVigilance === "RENFORCEE") renforcee++;
    }
    return { totalClients: totalActifs, simplifiee, standard, renforcee };
  }, [clients]);

  // ── Compliance items (single pass, optimized) ─────────────
  const complianceItems = useMemo(() => {
    const actifs = clients.filter(isActive);
    const n = actifs.length || 1;
    let withScreening = 0, withDocs = 0, withLM = 0, withBE = 0, withAddr = 0;
    for (const c of actifs) {
      if (c.siren?.trim() && c.dirigeant?.trim()) withScreening++;
      if (c.lienCni) withDocs++;
      if ((c.honoraires ?? 0) > 0) withLM++;
      if (c.be?.trim()) withBE++;
      if (c.adresse?.trim()) withAddr++;
    }
    const collabN = collaborateurs.length || 1;
    let trained = 0;
    for (const col of collaborateurs) {
      if (monthsSince(col.derniereFormation) < 12) trained++;
    }
    return [
      { label: "Identification clients", value: pct(withScreening, n), target: 90 },
      { label: "Documents KYC", value: pct(withDocs, n), target: 85 },
      { label: "Lettres de mission", value: pct(withLM, n), target: 80 },
      { label: "Formation collaborateurs", value: pct(trained, collabN), target: 100 },
      { label: "Bénéficiaires effectifs", value: pct(withBE, n), target: 90 },
      { label: "Adresses vérifiées", value: pct(withAddr, n), target: 95 },
    ];
  }, [clients, collaborateurs]);

  const complianceScore = useMemo(() => {
    const sum = complianceItems.reduce((s, item) => s + item.value, 0);
    return complianceItems.length > 0 ? Math.round(sum / complianceItems.length) : 0;
  }, [complianceItems]);

  // ── Cockpit analysis ─────────────────────────────────────
  const cockpitData = useMemo(
    () => analyzeCockpit(clients, collaborateurs, alertes),
    [clients, collaborateurs, alertes],
  );

  // Single pass for severity counts
  const { criticalCount, warningCount } = useMemo(() => {
    let crit = 0, warn = 0;
    for (const u of cockpitData.urgencies ?? []) {
      if (u.severity === "critique") crit++;
      else if (u.severity === "warning") warn++;
    }
    return { criticalCount: crit, warningCount: warn };
  }, [cockpitData]);

  const alertesCount = criticalCount + warningCount;

  // ── Derived values ────────────────────────────────────────
  const conformiteColor = statusColor(complianceScore);
  const avgScoreColor = vigilanceColor(cockpitData.scoreMoyen);
  const alertesColor = alertesCount > 0 ? COLOR.danger : COLOR.ok;
  const caSubValue = missionsData.ca != null ? `${formatEuros(missionsData.ca)}/an` : undefined;

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const cabinetName = profile?.cabinet_id ? "Cabinet" : "GRIMY";
  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();
  const printDate = formatDateFr(new Date());
  const dateStr = useMemo(() => DATE_LONG.format(new Date()), []);

  // ── Widget content map (memoized) ─────────────────────────
  const widgetContent: Record<WidgetKey, React.ReactNode> = useMemo(() => ({
    riskRadar: <LazyRiskRadar clients={clients} loading={isLoading} />,
    vigilance: <LazyExpositionDonut simplifiee={stats.simplifiee} standard={stats.standard} renforcee={stats.renforcee} loading={isLoading} />,
    riskValues: <LazyRiskValues clients={clients} loading={isLoading} />,
    revenue: <LazyRevenue clients={clients} loading={isLoading} />,
    topTypes: <LazyTopTypes clients={clients} loading={isLoading} />,
    collabCases: <LazyCollabCases clients={clients} loading={isLoading} />,
    training: <LazyTraining collaborateurs={collaborateurs} loading={isLoading} />,
    fileUpdate: <LazyFileUpdate clients={clients} loading={isLoading} />,
    controlStatus: <LazyControlStatus clients={clients} loading={isLoading} />,
  }), [clients, collaborateurs, isLoading, stats.simplifiee, stats.standard, stats.renforcee]);

  // ── Render band ───────────────────────────────────────────
  function renderBand(
    band: 1 | 2 | 3,
    label: string,
    icon: React.ElementType,
    order: WidgetKey[],
    setter: React.Dispatch<React.SetStateAction<WidgetKey[]>>,
    startIndex: number,
  ) {
    return (
      <section aria-label={label}>
        <BandHeader label={label} icon={icon} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragHandler(band, setter)}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {order.map((key, i) => (
                <AnimatedWidget key={key} index={startIndex + i} reducedMotion={reducedMotion}>
                  <DashboardWidget id={key}>
                    <WidgetErrorBoundary>
                      <React.Suspense fallback={<ChartSkeleton />}>
                        {widgetContent[key]}
                      </React.Suspense>
                    </WidgetErrorBoundary>
                  </DashboardWidget>
                </AnimatedWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    );
  }

  return (
    <DashboardAccessibility announcements={announcements}>
    <div
      className={`p-4 sm:p-5 lg:p-8 max-w-[1440px] mx-auto ${reducedMotion ? "" : "animate-fade-in-up"}`}
      role="main"
      aria-label="Tableau de bord"
    >
      <DashboardPrintHeader cabinetName={cabinetName} userName={userName} date={printDate} />
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR ── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 print:mb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" title={`${greeting}, ${userName}`}>{greeting}, {userName}</h1>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
          <DashboardSearch clients={clients} alertes={alertes} className="w-36 sm:w-48 md:w-56" inputRef={searchInputRef} />
          <DashboardNotificationCenter notifications={notifications} onMarkAsRead={handleMarkNotificationAsRead} onMarkAllAsRead={handleMarkAllNotificationsAsRead} isLoading={isLoading} />
          <DashboardExport
            clients={clients} alertes={alertes} collaborateurs={collaborateurs}
            stats={{ totalClients: stats.totalClients, avgScore: cockpitData.scoreMoyen, tauxConformite: complianceScore, alertesEnCours: alertesCount, revuesEchues: 0, caPrevisionnel: 0 }}
            cockpitUrgencies={cockpitData.urgencies} complianceItems={complianceItems}
          />
          <button
            className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white text-xs font-medium transition-all disabled:opacity-45 hover:shadow-md hover:shadow-emerald-500/15 active:scale-95"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Rafraîchir (R)"
            aria-label="Rafraîchir les données"
          >
            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </header>

      {/* ── STATUS BANNER ── */}
      <div className="mb-4">
        <StatusBanner criticalCount={criticalCount} warningCount={warningCount} isLoading={isLoading} />
      </div>

      {/* ── 5 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6" role="region" aria-label="Indicateurs clés">
        <KPICard icon={Users} title="Clients actifs" value={stats.totalClients} color={COLOR.primary}
          onClick={() => navigate(stats.totalClients === 0 ? "/nouveau-client" : "/bdd")}
          loading={isLoading} subValue={stats.totalClients === 0 ? "Ajouter" : undefined}
          ariaLabel={`${stats.totalClients} clients actifs`} />
        <KPICard icon={TrendingUp} title="Score moyen" value={`${cockpitData.scoreMoyen}/120`} color={avgScoreColor}
          onClick={() => navigate("/diagnostic")} loading={isLoading}
          subValue={cockpitData.scoreMoyen <= 25 ? "Simplifiée" : cockpitData.scoreMoyen <= 60 ? "Standard" : "Renforcée"}
          ariaLabel={`Score moyen ${cockpitData.scoreMoyen} sur 120`} />
        <KPICard icon={Shield} title="Conformité" value={`${complianceScore}%`} color={conformiteColor}
          progress={complianceScore} onClick={() => navigate("/controle")} loading={isLoading}
          ariaLabel={`Conformité ${complianceScore}%`} />
        <KPICard icon={AlertTriangle} title="Alertes" value={alertesCount || "0"} color={alertesColor}
          onClick={() => navigate("/registre")} loading={isLoading}
          ariaLabel={`${alertesCount} alertes`} />
        <KPICard icon={FileText} title="Missions" value={missionsData.count} color={COLOR.purple}
          onClick={() => navigate("/lettre-mission")} loading={isLoading}
          subValue={missionsData.count === 0 ? "Créer" : caSubValue}
          ariaLabel={`${missionsData.count} missions`} />
      </div>

      {/* ══ 3 BANDES — 9 widgets réorganisables (3 colonnes) ══ */}
      {renderBand(1, "Risque LCB-FT", Shield, band1Order, setBand1Order, 0)}
      {renderBand(2, "Pilotage Cabinet", BarChart3, band2Order, setBand2Order, 3)}
      {renderBand(3, "Alertes Cabinet", Bell, band3Order, setBand3Order, 6)}

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-6 pb-4 print:hidden">
        <DataFreshnessIndicator lastRefresh={lastRefresh} staleThresholdMinutes={5} />
      </div>

      <QuickActionsFAB />
      <DashboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DashboardPrintFooter cabinetName={cabinetName} />

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up { animation: none !important; opacity: 1 !important; }
        }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
    </DashboardAccessibility>
  );
}
