import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Bell, RefreshCw, Settings, Loader2, Eye, EyeOff, GripVertical, RotateCcw,
} from "lucide-react";

import OnboardingWizard, { isOnboardingComplete } from "@/components/OnboardingWizard";
import { QuickActionsBar, QuickActionsFAB } from "@/components/dashboard/QuickActions";
import { DashboardKPICards } from "@/components/dashboard/DashboardKPICards";
import { DashboardChart } from "@/components/dashboard/DashboardChart";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { DashboardActivity } from "@/components/dashboard/DashboardActivity";
import { DashboardVigilance } from "@/components/dashboard/DashboardVigilance";
import { SortableWidget } from "@/components/dashboard/SortableWidget";
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

function generateSparkline(current: number): { v: number }[] {
  const base = Math.max(1, current - 5);
  return Array.from({ length: 7 }, (_, i) => ({ v: Math.max(0, base + Math.round((current - base) * (i / 6))) }));
}

// ── Widget keys & persistence ────────────────────────────────
type WidgetKey = "kpi" | "graphique" | "alertes" | "activite" | "repartition";

const DEFAULT_ORDER: WidgetKey[] = ["kpi", "graphique", "alertes", "activite", "repartition"];
const STORAGE_KEY_VIS = "dashboard-widgets";
const STORAGE_KEY_ORDER = "dashboard-widget-order";

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

function loadVisibility(): WidgetVisibility {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VIS);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result: WidgetVisibility = { ...DEFAULT_WIDGETS };
      for (const key of Object.keys(DEFAULT_WIDGETS) as WidgetKey[]) {
        if (typeof parsed[key] === "boolean") result[key] = parsed[key];
      }
      return result;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_WIDGETS };
}

function saveVisibility(v: WidgetVisibility) {
  try { localStorage.setItem(STORAGE_KEY_VIS, JSON.stringify(v)); } catch { /* ignore */ }
}

function loadOrder(): WidgetKey[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ORDER);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) {
        // Validate all keys present
        const valid = DEFAULT_ORDER.every(k => parsed.includes(k));
        if (valid) return parsed as WidgetKey[];
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

function saveOrder(order: WidgetKey[]) {
  try { localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order)); } catch { /* ignore */ }
}

const WIDGET_META: Record<WidgetKey, { label: string; description: string }> = {
  kpi: { label: "Indicateurs KPI", description: "Clients, score, conformité, alertes, revues, CA" },
  graphique: { label: "Graphiques de suivi", description: "Évolution mensuelle et répartition vigilance" },
  alertes: { label: "Alertes et échéances", description: "Alertes récentes et prochaines échéances" },
  activite: { label: "Fil d'activité", description: "Dernières actions effectuées" },
  repartition: { label: "Jauges de conformité", description: "Indicateurs de conformité détaillés" },
};

// ── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { clients, alertes, logs, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [widgets, setWidgets] = useState<WidgetVisibility>(loadVisibility);
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(loadOrder);
  const [dragMode, setDragMode] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();
  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  const mountedRef = useRef(true);
  const lastManualRefresh = useRef(0);

  const greeting = useMemo(() => new Date().getHours() < 18 ? "Bonjour" : "Bonsoir", []);

  useDocumentTitle("Dashboard");

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
        saveOrder(next);
        return next;
      });
    }
  }

  function resetOrder() {
    setWidgetOrder([...DEFAULT_ORDER]);
    saveOrder([...DEFAULT_ORDER]);
  }

  const isDefaultOrder = widgetOrder.every((k, i) => k === DEFAULT_ORDER[i]);

  const toggleWidget = (key: WidgetKey) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibility(next);
      return next;
    });
  };

  const setAllWidgets = (visible: boolean) => {
    const next: WidgetVisibility = { kpi: visible, graphique: visible, alertes: visible, activite: visible, repartition: visible };
    setWidgets(next);
    saveVisibility(next);
  };

  const hiddenCount = Object.values(widgets).filter(v => !v).length;
  const allVisible = hiddenCount === 0;
  const allHidden = hiddenCount === 5;

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      switch (e.key) {
        case "n": e.preventDefault(); navigate("/nouveau-client"); break;
        case "A": if (e.shiftKey) { e.preventDefault(); navigate("/registre"); } break;
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
      refreshAllRef.current()
        .then(() => { if (mountedRef.current) setLastRefresh(new Date()); })
        .catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err));
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

  // ── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS");
    const totalClients = actifs.length;
    const avgScore = totalClients > 0
      ? Math.round(actifs.reduce((s, c) => s + (c.scoreGlobal || 0), 0) / totalClients) : 0;
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
      try { const d = new Date(c.dateButoir); return !isNaN(d.getTime()) && d < now; } catch { return false; }
    }).length;
    const caPrevisionnel = actifs.reduce((s, c) => s + (c.honoraires || 0), 0);
    const withKyc = actifs.filter(c => c.lienCni && c.siren && c.dirigeant && c.adresse).length;
    const tauxConformite = totalClients > 0 ? Math.round((withKyc / totalClients) * 100) : 0;
    return { totalClients, avgScore, simplifiee, standard, renforcee, alertesEnCours, revuesEchues, caPrevisionnel, tauxConformite };
  }, [clients, alertes]);

  const sparklines = useMemo(() => ({
    totalClients: generateSparkline(stats.totalClients),
    avgScore: generateSparkline(stats.avgScore),
    tauxConformite: generateSparkline(stats.tauxConformite),
    alertesEnCours: generateSparkline(stats.alertesEnCours),
    revuesEchues: generateSparkline(stats.revuesEchues),
    caPrevisionnel: generateSparkline(stats.caPrevisionnel / 1000),
  }), [stats]);

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

  const deadlines = useMemo<Deadline[]>(() => {
    const now = new Date();
    const items: Deadline[] = [];
    clients.forEach(c => {
      if (!c.dateButoir) return;
      try {
        const d = new Date(c.dateButoir);
        if (isNaN(d.getTime())) return;
        if ((d.getTime() - now.getTime()) / 86400000 < 60) {
          items.push({ id: `revue-${c.ref}`, title: `Revue ${c.raisonSociale || c.ref}`, date: c.dateButoir, type: "revue", clientRef: c.ref });
        }
      } catch { /* skip */ }
    });
    collaborateurs.forEach(col => {
      if (!col.derniereFormation) return;
      try {
        const lastF = new Date(col.derniereFormation);
        if (isNaN(lastF.getTime())) return;
        const nextF = new Date(lastF);
        nextF.setFullYear(nextF.getFullYear() + 1);
        if ((nextF.getTime() - now.getTime()) / 86400000 < 60) {
          items.push({ id: `formation-${col.nom}`, title: `Formation ${col.nom}`, date: nextF.toISOString().split("T")[0], type: "formation" });
        }
      } catch { /* skip */ }
    });
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items.slice(0, 8);
  }, [clients, collaborateurs]);

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
    return [
      { label: "Identification clients", value: Math.round((withScreening / total) * 100), description: "Screening complet (SIREN + dirigeant)" },
      { label: "Documents KYC", value: Math.round((withDocs / total) * 100), description: "CNI / pièce d'identité renseignée" },
      { label: "Lettres de mission", value: Math.round((withLM / total) * 100), description: "LM signées vs clients actifs" },
      { label: "Formation collaborateurs", value: Math.round((trained / collabTotal) * 100), description: "Formations < 12 mois" },
      { label: "Contrôle qualité", value: 0, description: "Contrôles réalisés vs attendus" },
    ];
  }, [clients, collaborateurs]);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastManualRefresh.current < 3000) return;
    lastManualRefresh.current = now;
    setIsRefreshing(true);
    refreshAll()
      .then(() => { if (mountedRef.current) setLastRefresh(new Date()); })
      .catch((err: unknown) => logger.debug("Dashboard", "refresh failed:", err))
      .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
  }, [refreshAll]);

  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();

  // ── Widget renderer ───────────────────────────────────────
  const widgetContent: Record<WidgetKey, ReactNode> = {
    kpi: <DashboardKPICards stats={stats} sparklines={sparklines} isLoading={isLoading} />,
    graphique: (
      <DashboardChart
        monthlyData={monthlyData}
        simplifiee={stats.simplifiee}
        standard={stats.standard}
        renforcee={stats.renforcee}
        isLoading={isLoading}
      />
    ),
    alertes: <DashboardAlerts alertes={alertes} deadlines={deadlines} isLoading={isLoading} />,
    activite: <DashboardActivity logs={logs} isLoading={isLoading} />,
    repartition: <DashboardVigilance complianceItems={complianceItems} isLoading={isLoading} />,
  };

  // Filter to visible widgets only
  const visibleWidgets = widgetOrder.filter(k => widgets[k]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in-up print:bg-white print:text-black print:p-4" role="main" aria-label="Tableau de bord">
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 pb-6 border-b border-white/[0.06] print:mb-4 print:border-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{formatDateLong()}</p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <QuickActionsBar notificationCount={notificationCount} />

          {/* Notification bell */}
          <button
            className="relative w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
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

          {/* Drag mode toggle */}
          <Button
            size="sm"
            variant={dragMode ? "default" : "ghost"}
            className="h-9 w-9 p-0"
            onClick={() => setDragMode(!dragMode)}
            title={dragMode ? "Quitter le mode réorganisation" : "Réorganiser les widgets"}
            aria-label={dragMode ? "Quitter le mode réorganisation" : "Réorganiser les widgets"}
            aria-pressed={dragMode}
          >
            <GripVertical className="w-4 h-4" />
          </Button>

          {/* Personnaliser */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 px-2.5"
                title="Personnaliser le tableau de bord"
                aria-label="Personnaliser le tableau de bord"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Personnaliser</span>
                {hiddenCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {hiddenCount}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Personnaliser le tableau de bord</DialogTitle>
                <DialogDescription>
                  Choisissez les widgets à afficher. Utilisez le bouton <GripVertical className="w-3.5 h-3.5 inline-block align-text-bottom" /> pour réorganiser.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {widgetOrder.map((key) => {
                  const meta = WIDGET_META[key];
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleWidget(key)}
                    >
                      <Checkbox
                        id={`widget-${key}`}
                        checked={widgets[key]}
                        onCheckedChange={() => toggleWidget(key)}
                        className="mt-0.5"
                        aria-describedby={`widget-desc-${key}`}
                      />
                      <div className="flex-1">
                        <label htmlFor={`widget-${key}`} className="text-sm font-medium cursor-pointer select-none block">
                          {meta.label}
                        </label>
                        <span id={`widget-desc-${key}`} className="text-xs text-muted-foreground">
                          {meta.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5" onClick={() => setAllWidgets(true)} disabled={allVisible}>
                  <Eye className="w-3.5 h-3.5" /> Tout afficher
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5" onClick={() => setAllWidgets(false)} disabled={allHidden}>
                  <EyeOff className="w-3.5 h-3.5" /> Tout masquer
                </Button>
              </div>
              {!isDefaultOrder && (
                <Button size="sm" variant="ghost" className="w-full text-xs gap-1.5 mt-1" onClick={resetOrder}>
                  <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser l'ordre
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Drag mode banner ──────────────────────────────── */}
      {dragMode && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 print:hidden">
          <p className="text-xs text-primary font-medium flex items-center gap-2">
            <GripVertical className="w-4 h-4" />
            Mode réorganisation — Glissez les widgets pour les déplacer
          </p>
          <div className="flex gap-2">
            {!isDefaultOrder && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={resetOrder}>
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDragMode(false)}>
              Terminé
            </Button>
          </div>
        </div>
      )}

      {/* ── Hidden widgets notice ─────────────────────────── */}
      {hiddenCount > 0 && !isLoading && !dragMode && (
        <div className="mb-4 text-center print:hidden">
          <p className="text-xs text-muted-foreground">
            {hiddenCount} widget{hiddenCount > 1 ? "s" : ""} masqué{hiddenCount > 1 ? "s" : ""} —{" "}
            <button className="text-primary hover:underline" onClick={() => setAllWidgets(true)}>
              tout afficher
            </button>
          </p>
        </div>
      )}

      {/* ── All hidden state ──────────────────────────────── */}
      {allHidden && !isLoading && (
        <div className="text-center py-16 print:hidden">
          <EyeOff className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Tous les widgets sont masqués</p>
          <Button size="sm" variant="outline" onClick={() => setAllWidgets(true)}>
            <Eye className="w-4 h-4 mr-2" /> Tout afficher
          </Button>
        </div>
      )}

      {/* ── WIDGETS (sortable) ────────────────────────────── */}
      {!allHidden && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleWidgets} strategy={verticalListSortingStrategy}>
            {visibleWidgets.map((key) => (
              <SortableWidget
                key={key}
                id={key}
                label={WIDGET_META[key].label}
                dragEnabled={dragMode}
              >
                {widgetContent[key]}
              </SortableWidget>
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 pb-6 border-t border-white/[0.04] print:hidden">
        <span>Dernière mise à jour : {formatTime(lastRefresh)}</span>
        <button
          className="hover:text-foreground transition-colors disabled:opacity-50"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Rafraîchir les données"
          aria-label="Rafraîchir les données du tableau de bord"
        >
          {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      <QuickActionsFAB />

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
