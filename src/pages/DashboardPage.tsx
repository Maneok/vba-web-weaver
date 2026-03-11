import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { analyzeCockpit } from "@/lib/cockpitEngine";
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
  RefreshCw, Settings, Loader2, Eye, EyeOff, GripVertical, RotateCcw,
  Building2, UserCheck, CreditCard, MapPin, Hash, ShieldCheck,
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
import DashboardCockpit from "@/components/dashboard/DashboardCockpit";
import DashboardSearch from "@/components/dashboard/DashboardSearch";
import DashboardShortcutsHelp from "@/components/dashboard/DashboardShortcutsHelp";
import DashboardStaff from "@/components/dashboard/DashboardStaff";
import DashboardExport from "@/components/dashboard/DashboardExport";
import DashboardGoals from "@/components/dashboard/DashboardGoals";
import DashboardDataQuality from "@/components/dashboard/DashboardDataQuality";
import DashboardAccessibility from "@/components/dashboard/DashboardAccessibility";
import DashboardPrintHeader from "@/components/dashboard/DashboardPrintHeader";
import DashboardPrintFooter from "@/components/dashboard/DashboardPrintFooter";
import DataFreshnessIndicator from "@/components/dashboard/DataFreshnessIndicator";
import DashboardNotificationCenter from "@/components/dashboard/DashboardNotificationCenter";
import RiskDistributionMini from "@/components/dashboard/RiskDistributionMini";
import { useReducedMotion, useAutoRefreshInterval } from "@/components/dashboard/DashboardReducedMotion";

// ── Helpers ──────────────────────────────────────────────────
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
type WidgetKey = "kpi" | "cockpit" | "graphique" | "alertes" | "activite" | "repartition" | "equipe" | "objectifs" | "qualite";

const DEFAULT_ORDER: WidgetKey[] = ["kpi", "cockpit", "graphique", "alertes", "activite", "repartition", "equipe", "objectifs", "qualite"];
const STORAGE_KEY_VIS = "dashboard-widgets";
const STORAGE_KEY_ORDER = "dashboard-widget-order";

interface WidgetVisibility {
  kpi: boolean;
  cockpit: boolean;
  graphique: boolean;
  alertes: boolean;
  activite: boolean;
  repartition: boolean;
  equipe: boolean;
  objectifs: boolean;
  qualite: boolean;
}

const DEFAULT_WIDGETS: WidgetVisibility = {
  kpi: true,
  cockpit: true,
  graphique: true,
  alertes: true,
  activite: true,
  repartition: true,
  equipe: true,
  objectifs: true,
  qualite: true,
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
      if (Array.isArray(parsed)) {
        // Keep valid keys from stored order, then append any missing new keys
        const validStored = parsed.filter((k: string) => DEFAULT_ORDER.includes(k as WidgetKey)) as WidgetKey[];
        const missing = DEFAULT_ORDER.filter(k => !validStored.includes(k));
        const result = [...validStored, ...missing];
        if (result.length === DEFAULT_ORDER.length) return result;
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
  cockpit: { label: "Cockpit LCB-FT", description: "Anomalies et urgences de conformité détectées" },
  graphique: { label: "Graphiques de suivi", description: "Évolution mensuelle et répartition vigilance" },
  alertes: { label: "Alertes et échéances", description: "Alertes récentes et prochaines échéances" },
  activite: { label: "Fil d'activité", description: "Dernières actions effectuées" },
  repartition: { label: "Jauges de conformité", description: "Indicateurs de conformité détaillés" },
  equipe: { label: "Équipe & formations", description: "Collaborateurs et état des formations LCB-FT" },
  objectifs: { label: "Objectifs de conformité", description: "Suivi des cibles et progression" },
  qualite: { label: "Qualité des données", description: "Taux de remplissage des champs clés" },
};

// ── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
  const { clients, alertes, logs, collaborateurs, isLoading, refreshAll } = useAppState();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; titre: string; message: string; type: "systeme" | "conformite" | "revue" | "alerte"; lue: boolean; created_at: string }[]>([]);
  const [widgets, setWidgets] = useState<WidgetVisibility>(loadVisibility);
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(loadOrder);
  const [dragMode, setDragMode] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const reducedMotion = useReducedMotion();
  const [autoRefreshInterval, setAutoRefreshInterval] = useAutoRefreshInterval();
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    const next: WidgetVisibility = { kpi: visible, cockpit: visible, graphique: visible, alertes: visible, activite: visible, repartition: visible, equipe: visible, objectifs: visible, qualite: visible };
    setWidgets(next);
    saveVisibility(next);
  };

  const hiddenCount = Object.values(widgets).filter(v => !v).length;
  const allVisible = hiddenCount === 0;
  const allHidden = hiddenCount === DEFAULT_ORDER.length;

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl/Cmd shortcuts work even in inputs
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "n": e.preventDefault(); navigate("/nouveau-client"); break;
          case "A": if (e.shiftKey) { e.preventDefault(); navigate("/registre"); } break;
        }
        return;
      }

      // Single-key shortcuts only outside inputs
      if (inInput) return;

      switch (e.key) {
        case "?": e.preventDefault(); setShortcutsOpen(true); break;
        case "/": e.preventDefault(); searchInputRef.current?.focus(); break;
        case "r": case "R": e.preventDefault(); handleRefresh(); break;
        case "d": case "D": e.preventDefault(); setDragMode(v => !v); break;
        case "p": case "P": e.preventDefault(); window.print(); break;
        default: {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= 9) {
            const visKeys = widgetOrder.filter(k => widgets[k]);
            if (num <= visKeys.length) {
              e.preventDefault();
              const el = document.getElementById(`widget-${visKeys[num - 1]}`);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
              el?.focus();
            }
          }
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, handleRefresh, widgetOrder, widgets]);

  // ── Auto-refresh with configurable interval ──────────────
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

  // ── Cockpit analysis ─────────────────────────────────────
  const cockpitData = useMemo(
    () => analyzeCockpit(clients, collaborateurs, alertes),
    [clients, collaborateurs, alertes]
  );

  // ── Goals computation ────────────────────────────────────
  const goalsData = useMemo(() => {
    return complianceItems
      .filter(item => item.target != null && item.target > 0)
      .map((item, i) => ({
        id: `goal-${i}`,
        label: item.label,
        current: item.value,
        target: item.target!,
        description: item.description || "",
      }));
  }, [complianceItems]);

  // ── Data quality computation ────────────────────────────
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

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const cabinetName = profile?.cabinet_id ? "Cabinet" : "GRIMY";

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

  const showOnboarding = !isLoading && clients.length === 0 && !isOnboardingComplete();

  // ── Widget renderer ───────────────────────────────────────
  const widgetContent: Record<WidgetKey, ReactNode> = {
    kpi: (
      <>
        <DashboardKPICards stats={stats} sparklines={sparklines} isLoading={isLoading} />
        {!isLoading && stats.totalClients > 0 && (
          <div className="mt-3 px-1">
            <RiskDistributionMini simplifiee={stats.simplifiee} standard={stats.standard} renforcee={stats.renforcee} />
          </div>
        )}
      </>
    ),
    cockpit: <DashboardCockpit cockpit={cockpitData} isLoading={isLoading} />,
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
    equipe: <DashboardStaff collaborateurs={collaborateurs} isLoading={isLoading} />,
    objectifs: <DashboardGoals goals={goalsData} isLoading={isLoading} />,
    qualite: <DashboardDataQuality categories={dataQualityCategories} isLoading={isLoading} />,
  };

  // Filter to visible widgets only
  const visibleWidgets = widgetOrder.filter(k => widgets[k]);

  const printDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <DashboardAccessibility announcements={announcements}>
    <div className={`p-6 lg:p-8 max-w-[1600px] mx-auto ${reducedMotion ? "" : "animate-fade-in-up"} print:bg-white print:text-black print:p-4`} role="main" aria-label="Tableau de bord">
      <DashboardPrintHeader cabinetName={cabinetName} userName={userName} date={printDate} />
      {showOnboarding && <OnboardingWizard />}

      {/* ── TOP BAR ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 pb-6 border-b border-white/[0.06] print:mb-4 print:border-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{formatDateLong()}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <DashboardSearch clients={clients} alertes={alertes} className="w-40 sm:w-56 md:w-64 lg:w-80" inputRef={searchInputRef} />
          <QuickActionsBar />

          {/* Notification center */}
          <DashboardNotificationCenter
            notifications={notifications}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            isLoading={isLoading}
          />

          {/* Export */}
          <DashboardExport clients={clients} alertes={alertes} collaborateurs={collaborateurs} stats={stats} cockpitUrgencies={cockpitData.urgencies} complianceItems={complianceItems} />

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
              {/* Auto-refresh interval */}
              <div className="pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  <RefreshCw className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom" />
                  Actualisation automatique
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { value: 0, label: "Désactivée" },
                    { value: 30000, label: "30s" },
                    { value: 60000, label: "1 min" },
                    { value: 120000, label: "2 min" },
                    { value: 300000, label: "5 min" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAutoRefreshInterval(opt.value)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        autoRefreshInterval === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
        <DataFreshnessIndicator lastRefresh={lastRefresh} staleThresholdMinutes={5} />
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
