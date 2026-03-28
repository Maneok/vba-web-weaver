import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  RefreshCw,
  Shield,
  ShieldCheck,
  Building2,
  CheckSquare,
  Activity,
  HelpCircle,
  LogOut,
  ChevronsLeft,
  Plus,
} from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUserInitials } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─── Types ─── */

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut?: string; /* OPT-12: keyboard shortcut hint */
};

/* ─── Navigation data ─── */

const DASHBOARD: NavItem = { to: "/", label: "Tableau de bord", icon: LayoutDashboard, shortcut: "D" };

const PORTEFEUILLE: NavItem[] = [
  { to: "/bdd", label: "Clients", icon: Users, shortcut: "B" },
  { to: "/lettre-mission", label: "Lettres de mission", icon: FileText, shortcut: "L" },
  { to: "/ged", label: "Documents", icon: FolderOpen, shortcut: "E" },
];

const CONFORMITE: NavItem[] = [
  { to: "/revue-maintien", label: "Revue periodique", icon: RefreshCw, shortcut: "M" },
  { to: "/registre", label: "Registre LCB", icon: Shield, shortcut: "R" },
];

const PILOTAGE: NavItem[] = [
  { to: "/gouvernance", label: "Gouvernance", icon: Building2, shortcut: "G" },
  { to: "/controle", label: "Controle qualite", icon: CheckSquare, shortcut: "Q" },
];

const FOOTER_NAV: NavItem[] = [
  { to: "/diagnostic", label: "Diagnostic 360", icon: Activity, shortcut: "3" },
  { to: "/aide", label: "Aide", icon: HelpCircle, shortcut: "?" },
];

const APP_VERSION = "1.0.0";

/* OPT-46: Role badge colors */
const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  SUPERVISEUR: "bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  COLLABORATEUR: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  STAGIAIRE: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
};

const ROLE_SHORT_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collab.",
  STAGIAIRE: "Stagiaire",
};

/* ─── Helpers ─── */

function getCabinetInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/* ─── Component ─── */

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { alertes, clients, collaborateurs } = useAppState();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  /* OPT-49: Track scroll to show subtle shadow under header */
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const handler = () => setIsScrolled(nav.scrollTop > 4);
    nav.addEventListener("scroll", handler, { passive: true });
    return () => nav.removeEventListener("scroll", handler);
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024 && !collapsed) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // OPT-SB3: Stable callback reference
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth", { replace: true });
  }, [signOut, navigate]);

  const alertesEnCours = useMemo(
    () => alertes.filter((a) => a.statut === "EN COURS").length,
    [alertes],
  );

  // Count clients with overdue reviews
  const [reviewCount, setReviewCount] = useState(0);
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("clients")
      .select("niv_vigilance, date_derniere_revue, date_creation_ligne")
      .eq("cabinet_id", profile.cabinet_id)
      .eq("statut", "ACTIF")
      .then(({ data }) => {
        if (!data) return;
        const count = data.filter((c) => {
          const vig = c.niv_vigilance || "STANDARD";
          const base =
            [c.date_derniere_revue, c.date_creation_ligne]
              .filter(Boolean)
              .sort()
              .pop() || new Date().toISOString().split("T")[0];
          const d = new Date(base);
          switch (vig) {
            case "SIMPLIFIEE": d.setFullYear(d.getFullYear() + 2); break;
            case "STANDARD": d.setFullYear(d.getFullYear() + 1); break;
            case "RENFORCEE": d.setMonth(d.getMonth() + 6); break;
          }
          return d <= new Date();
        }).length;
        setReviewCount(count);
      });
  }, [profile?.cabinet_id, clients]);

  // Count expired GED documents for sidebar badge
  const [expiredDocsCount, setExpiredDocsCount] = useState(0);
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("cabinet_id", profile.cabinet_id)
      .lt("expiration_date", new Date().toISOString().split("T")[0])
      .then(({ count }) => {
        setExpiredDocsCount(count ?? 0);
      });
  }, [profile?.cabinet_id]);

  // Count collaborateurs with expired training (> 12 months or never trained)
  const expiredTrainingCount = useMemo(() => {
    return collaborateurs.filter(c => {
      if (!c.derniereFormation) return true;
      const ts = new Date(c.derniereFormation).getTime();
      if (isNaN(ts)) return true;
      return (Date.now() - ts) / (1000 * 60 * 60 * 24) > 365;
    }).length;
  }, [collaborateurs]);

  // OPT-SB1: Memoize badge counts to avoid object recreation on every render
  const badges = useMemo<Record<string, number>>(() => ({
    "/bdd": clients.length,
    "/registre": alertesEnCours,
    "/ged": expiredDocsCount,
    "/gouvernance": expiredTrainingCount,
  }), [clients.length, alertesEnCours, expiredDocsCount, expiredTrainingCount]);

  // Fetch real cabinet name from DB
  const [cabinetDisplayName, setCabinetDisplayName] = useState("GRIMY");
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("cabinets")
      .select("nom")
      .eq("id", profile.cabinet_id)
      .single()
      .then(({ data }) => {
        if (data?.nom) setCabinetDisplayName(data.nom);
      });
  }, [profile?.cabinet_id]);

  // OPT-SB2: Memoize derived values
  const userInitials = useMemo(() => getUserInitials(profile?.full_name), [profile?.full_name]);
  const hasAlerts = alertesEnCours > 0;

  // OPT-SB4: Stable callback for item active check
  const isItemActive = useCallback((to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname.startsWith(to + "/");
  }, [location.pathname]);

  /* ─── Render single nav item ─── */
  const renderItem = (
    item: NavItem,
    opts: {
      isFooter?: boolean;
      showAddButton?: boolean;
      notificationDot?: boolean;
      staggerIndex?: number;
    } = {},
  ) => {
    const Icon = item.icon;
    const badge = badges[item.to];
    const hasBadge = badge !== undefined && badge > 0;
    const active = isItemActive(item.to);
    const { isFooter, showAddButton, notificationDot, staggerIndex = 0 } = opts;

    /* OPT-1: Build class list — h-8 compact, rounded-lg */
    /* OPT-2: transition-colors duration-150 for smooth hover */
    /* OPT-3: focus-visible ring with blue tint */
    /* OPT-4: active:scale-[0.98] click feedback */
    /* OPT-5: sidebar-item-enter stagger animation */
    const itemClasses = [
      "group relative flex items-center h-8 rounded-lg",
      "transition-all duration-150 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0",
      "active:scale-[0.98]",
      "sidebar-item-enter",
    ];

    if (collapsed) {
      /* OPT-6: Collapsed items centered with fixed size */
      itemClasses.push("justify-center mx-auto w-8");
      if (active) {
        /* OPT-7: Active collapsed — blue bg + subtle shadow */
        itemClasses.push(
          "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
          "shadow-sm shadow-blue-500/10 dark:shadow-blue-500/5",
        );
      } else if (isFooter) {
        /* OPT-8: Footer items — more muted */
        itemClasses.push("text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300");
      } else {
        itemClasses.push("text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white");
      }
    } else {
      /* OPT-9: Expanded items — gap-2.5 for icon spacing */
      itemClasses.push("px-2.5 gap-2.5");
      if (active) {
        /* OPT-10: Active expanded — blue bg + left padding for bar + subtle glow */
        itemClasses.push(
          "bg-blue-50/80 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
          "shadow-sm shadow-blue-500/5 dark:shadow-blue-400/5",
        );
      } else if (isFooter) {
        itemClasses.push("text-slate-400 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300");
      } else {
        /* OPT-11: Normal items — hover:translateY(-0.5px) micro-lift */
        itemClasses.push(
          "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white",
          "hover:-translate-y-[0.5px]",
        );
      }
    }

    const link = (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === "/"}
        aria-label={collapsed ? item.label : undefined}
        className={itemClasses.join(" ")}
        style={{ animationDelay: `${staggerIndex * 30}ms` }}
      >
        {/* OPT-12: Active indicator bar — gradient blue */}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-400 dark:to-blue-500 sidebar-bar-enter" />
        )}

        {/* OPT-13: Icon wrapper with hover circle bg */}
        <span className="relative shrink-0 flex items-center justify-center w-5 h-5 rounded-md transition-colors duration-150 group-hover:bg-slate-200/50 dark:group-hover:bg-white/[0.04]">
          <Icon
            className={[
              "w-4 h-4 transition-all duration-150",
              "group-hover:scale-105",
              active ? "text-blue-600 dark:text-blue-400" : "",
            ].join(" ")}
            strokeWidth={1.5}
          />
          {/* OPT-14: Notification dot with pulse animation */}
          {notificationDot && hasAlerts && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-50 dark:ring-[#0B1120] sidebar-notif-pulse" />
          )}
        </span>

        {/* Text + badges (expanded only) */}
        {!collapsed && (
          <>
            {/* OPT-15: Text — tracking-[0.01em] for readability + semibold when active */}
            <span
              className={[
                "text-[13px] truncate transition-opacity duration-150 tracking-[0.01em]",
                active ? "font-semibold" : "font-medium",
              ].join(" ")}
              title={item.label}
            >
              {item.label}
            </span>

            {/* OPT-16: Inline [+] button for Clients — with hover grow */}
            {showAddButton && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/nouveau-client?fresh=1");
                }}
                className="ml-auto text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:scale-105 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25 transition-all duration-150 cursor-pointer flex items-center gap-0.5"
                aria-label="Nouveau client"
              >
                <Plus className="w-3 h-3" strokeWidth={2} />
              </button>
            )}

            {/* OPT-17: Badge counter — rounded-full with subtle border */}
            {hasBadge && !showAddButton && (
              <span className="min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-slate-200/80 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-slate-300/30 dark:border-white/[0.04] flex items-center justify-center ml-auto sidebar-badge-enter">
                {badge}
              </span>
            )}

            {/* OPT-18: Keyboard shortcut hint on hover */}
            {!hasBadge && !showAddButton && item.shortcut && (
              <span className="ml-auto text-[10px] text-slate-300 dark:text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
                Alt+{item.shortcut}
              </span>
            )}
          </>
        )}
      </NavLink>
    );

    /* OPT-19: Tooltip in collapsed mode only — show badge count */
    if (collapsed) {
      return (
        <Tooltip key={item.to} delayDuration={80}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="font-medium text-sm px-3 py-1.5 shadow-lg"
          >
            <span>{item.label}</span>
            {hasBadge && (
              <span className="ml-2 text-[11px] opacity-60">({badge})</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  /* ─── Section label ─── */
  const renderSectionLabel = (label: string) => {
    if (collapsed) {
      /* OPT-20: Collapsed separator — subtle dotted line */
      return (
        <div
          role="separator"
          aria-hidden="true"
          className="mx-4 my-3 border-t border-dashed border-slate-200/70 dark:border-white/[0.05] transition-opacity duration-200"
        />
      );
    }
    /* OPT-21: Section label — uppercase, tiny, with left dot accent — compact */
    return (
      <p className="flex items-center gap-1.5 px-2.5 mb-1 mt-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400/80 dark:text-slate-500/80 pointer-events-none select-none transition-opacity duration-200">
        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        {label}
      </p>
    );
  };

  /* ─── Stagger counter ─── */
  let staggerIdx = 0;

  return (
    <TooltipProvider>
      {/* OPT-22: Mobile overlay — gradient backdrop instead of solid */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-gradient-to-r from-black/60 to-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          /* OPT-23: Sidebar bg — subtle gradient top-to-bottom */
          "bg-gradient-to-b from-slate-50 via-white to-slate-50/80",
          "dark:from-[#0B1120] dark:via-[#0d1526] dark:to-[#0B1120]",
          /* OPT-24: Border right + subtle inner shadow for depth */
          "border-r border-slate-200/80 dark:border-white/[0.06]",
          "shadow-[1px_0_8px_-3px_rgba(0,0,0,0.06)] dark:shadow-[1px_0_8px_-3px_rgba(0,0,0,0.3)]",
          /* OPT-25: Backdrop blur for glass effect */
          "backdrop-blur-xl",
          /* OPT-26: Smooth transition with custom easing */
          "transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          collapsed
            ? "-translate-x-full lg:translate-x-0 lg:w-[72px]"
            : "translate-x-0 w-[230px]",
        ].join(" ")}
      >
        {/* ═══ Header ═══ */}
        <div
          className={[
            "h-12 flex items-center shrink-0",
            /* OPT-27: Header border with scroll-aware shadow */
            "border-b border-slate-200/60 dark:border-white/[0.06]",
            isScrolled ? "shadow-sm shadow-black/[0.03] dark:shadow-black/20" : "",
            "transition-shadow duration-200",
            collapsed ? "px-3 justify-center" : "px-4 justify-between",
          ].join(" ")}
        >
          {collapsed ? (
            /* Collapsed logo — click to expand sidebar */
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  aria-label="Deplier le menu"
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-md shadow-blue-500/20 dark:shadow-blue-500/10 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 cursor-pointer"
                >
                  {getCabinetInitials(cabinetDisplayName)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Deplier le menu
              </TooltipContent>
            </Tooltip>
          ) : (
            /* OPT-29: Expanded header — cabinet name with hover bg */
            <div className="flex items-center gap-2.5 min-w-0 px-1 py-1 -mx-1 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors duration-150 cursor-default">
              {/* OPT-30: Mini gradient square before cabinet name */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/15">
                {getCabinetInitials(cabinetDisplayName)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 leading-tight">
                  Cabinet
                </span>
                <span className="text-[13px] font-semibold text-slate-800 dark:text-white truncate leading-tight">
                  {cabinetDisplayName}
                </span>
              </div>
            </div>
          )}

          {/* OPT-31: Toggle collapse — chevron with rotation */}
          {!collapsed && (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  aria-label="Reduire le menu"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200 hover:shadow-sm"
                >
                  <ChevronsLeft className="w-4 h-4 transition-transform duration-300" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Reduire <kbd className="ml-1.5 text-[10px] font-mono bg-slate-100 dark:bg-white/[0.06] px-1 py-0.5 rounded border border-slate-200 dark:border-white/[0.1]">Ctrl+B</kbd>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ═══ Scrollable navigation ═══ */}
        <nav
          ref={navRef}
          aria-label="Menu principal"
          className={[
            "flex-1 overflow-y-auto px-2.5 py-2.5",
            /* OPT-33: Subtle thin scrollbar, visible only on hover */
            "[&::-webkit-scrollbar]:w-[3px]",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-transparent",
            "hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/60",
            "dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.08]",
            "[&::-webkit-scrollbar-track]:bg-transparent",
          ].join(" ")}
        >
          {/* Dashboard (standalone) */}
          <div className={collapsed ? "flex flex-col items-center" : ""}>
            {renderItem(DASHBOARD, { staggerIndex: staggerIdx++ })}
          </div>

          {/* ── PORTEFEUILLE ── */}
          {renderSectionLabel("Portefeuille")}
          <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center space-y-0.5" : ""}`}>
            {PORTEFEUILLE.map((item) =>
              renderItem(item, {
                showAddButton: item.to === "/bdd",
                staggerIndex: staggerIdx++,
              }),
            )}
          </div>

          {/* ── CONFORMITE LCB-FT ── */}
          {renderSectionLabel("Conformite LCB-FT")}
          <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center space-y-0.5" : ""}`}>
            {CONFORMITE.map((item) =>
              renderItem(item, {
                notificationDot: item.to === "/registre",
                staggerIndex: staggerIdx++,
              }),
            )}
          </div>

          {/* ── PILOTAGE CABINET ── */}
          {renderSectionLabel("Pilotage cabinet")}
          <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center space-y-0.5" : ""}`}>
            {PILOTAGE.map((item) =>
              renderItem(item, { staggerIndex: staggerIdx++ }),
            )}
          </div>
        </nav>

        {/* ═══ Footer (pinned at bottom) ═══ */}
        <div className="mt-auto shrink-0 border-t border-slate-200/60 dark:border-white/[0.06] px-2.5 pt-1.5 pb-2">
          {/* OPT-34: Footer nav items — muted style */}
          <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center space-y-0.5" : ""}`}>
            {FOOTER_NAV.map((item) => renderItem(item, { isFooter: true }))}
          </div>

          {/* ── Super Admin link (visible only for super admins) ── */}
          {profile?.is_super_admin === true && (
            <div className={`mt-1 ${collapsed ? "flex flex-col items-center" : ""}`}>
              {collapsed ? (
                <Tooltip delayDuration={80}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to="/super-admin"
                      aria-label="Super Admin"
                      className={[
                        "group relative flex items-center justify-center mx-auto w-8 h-8 rounded-lg transition-all duration-150",
                        isItemActive("/super-admin")
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-500/10"
                          : "text-indigo-400 dark:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300",
                      ].join(" ")}
                    >
                      <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="font-medium text-sm px-3 py-1.5 shadow-lg">
                    Super Admin
                  </TooltipContent>
                </Tooltip>
              ) : (
                <NavLink
                  to="/super-admin"
                  className={[
                    "group relative flex items-center h-8 px-2.5 gap-2.5 rounded-lg transition-all duration-150",
                    isItemActive("/super-admin")
                      ? "bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-500/5"
                      : "text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300",
                  ].join(" ")}
                >
                  {isItemActive("/super-admin") && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600 sidebar-bar-enter" />
                  )}
                  <span className="relative shrink-0 flex items-center justify-center w-5 h-5 rounded-md">
                    <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                  </span>
                  <span className={`text-[13px] truncate tracking-[0.01em] ${isItemActive("/super-admin") ? "font-semibold" : "font-medium"}`}>
                    Super Admin
                  </span>
                  <span className="ml-auto text-[9px] font-medium px-1.5 py-[1px] rounded-full bg-indigo-500/15 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400">
                    SA
                  </span>
                </NavLink>
              )}
            </div>
          )}

          {/* ── User profile ── */}
          <div
            className={`mt-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06] ${
              collapsed ? "flex flex-col items-center gap-1.5" : ""
            }`}
          >
            {collapsed ? (
              <>
                {/* OPT-35: Collapsed — avatar with gradient ring */}
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/25 dark:to-indigo-500/25 p-[2px]">
                        <div className="w-full h-full rounded-full bg-slate-50 dark:bg-[#0B1120] text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center justify-center">
                          {userInitials}
                        </div>
                      </div>
                      {/* OPT-36: Online status dot */}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-50 dark:border-[#0B1120] sidebar-notif-pulse" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{profile?.full_name || "Utilisateur"}</span>
                      {profile?.role && (
                        <span className="text-[10px] opacity-60">{ROLE_SHORT_LABELS[profile.role] || profile.role}</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* OPT-37: Collapsed logout */}
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      aria-label="Deconnexion"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                    >
                      <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>Deconnexion</TooltipContent>
                </Tooltip>
              </>
            ) : (
              /* OPT-38: Expanded — full profile block with hover bg */
              <div className="flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors duration-150 group/profile">
                {/* OPT-39: Avatar with gradient ring + status dot */}
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/25 dark:to-indigo-500/25 p-[1.5px]">
                    <div className="w-full h-full rounded-full bg-white dark:bg-[#0B1120] text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                      {userInitials}
                    </div>
                  </div>
                  {/* OPT-40: Online status dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-[#0B1120] sidebar-notif-pulse" />
                </div>

                <div className="min-w-0 flex-1">
                  {/* OPT-41: Name with stronger weight */}
                  <p
                    className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight"
                    title={profile?.full_name || undefined}
                  >
                    {profile?.full_name}
                  </p>
                  {/* OPT-42: Role badge instead of email — more useful */}
                  {profile?.role && (
                    <span className={`inline-block mt-0.5 text-[9px] font-medium px-1.5 py-[1px] rounded-full ${ROLE_BADGE_COLORS[profile.role] || "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400"}`}>
                      {ROLE_SHORT_LABELS[profile.role] || profile.role}
                    </span>
                  )}
                </div>

                {/* OPT-43: Logout button — slide-left icon on hover */}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      aria-label="Deconnexion"
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover/profile:opacity-100"
                    >
                      <LogOut className="w-4 h-4 transition-transform duration-200 hover:-translate-x-0.5" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>Deconnexion</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* OPT-44: Version + trust footer */}
          <div className={`mt-1 text-center select-none ${collapsed ? "px-0.5" : "px-2"}`}>
            {!collapsed && (
              /* OPT-45: Compliance trust line */
              <p className="text-[9px] text-slate-400/70 dark:text-slate-600/70 mb-0.5 tracking-wide">
                Conforme LCB-FT · Art. L.561-2
              </p>
            )}
            {/* OPT-46: Version number */}
            <p className="text-[9px] text-slate-400/50 dark:text-slate-600/50 font-mono">
              {collapsed ? `v${APP_VERSION}` : `GRIMY v${APP_VERSION}-beta`}
            </p>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
