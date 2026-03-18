import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  RefreshCw,
  Shield,
  Building2,
  CheckSquare,
  Activity,
  Settings,
  HelpCircle,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Plus,
} from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
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
};

/* ─── Navigation data ─── */

const DASHBOARD: NavItem = { to: "/", label: "Dashboard", icon: LayoutDashboard };

const PORTEFEUILLE: NavItem[] = [
  { to: "/bdd", label: "Clients", icon: Users },
  { to: "/lettre-mission", label: "Lettres de mission", icon: FileText },
  { to: "/ged", label: "Documents", icon: FolderOpen },
];

const CONFORMITE: NavItem[] = [
  { to: "/revue-maintien", label: "Revue periodique", icon: RefreshCw },
  { to: "/registre", label: "Registre LCB", icon: Shield },
];

const PILOTAGE: NavItem[] = [
  { to: "/gouvernance", label: "Gouvernance", icon: Building2 },
  { to: "/controle", label: "Controle qualite", icon: CheckSquare },
];

const FOOTER_NAV: NavItem[] = [
  { to: "/diagnostic", label: "Diagnostic 360", icon: Activity },
  { to: "/parametres", label: "Parametres", icon: Settings },
  { to: "/aide", label: "Aide", icon: HelpCircle },
];

/* ─── Helpers ─── */

function getInitials(name: string | undefined | null): string {
  if (!name?.trim()) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getCabinetInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/* ─── Component ─── */

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { alertes, clients } = useAppState();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024 && !collapsed) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

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

  /* Badge counts */
  const badges: Record<string, number> = {
    "/bdd": clients.length,
    "/registre": alertesEnCours,
  };

  const cabinetName = profile?.full_name?.split(" ").pop() || "GRIMY";
  const userInitials = getInitials(profile?.full_name);
  const hasAlerts = alertesEnCours > 0;

  /* ─── Check if item is active ─── */
  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname.startsWith(to + "/");
  };

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
    const active = isActive(item.to);
    const { isFooter, showAddButton, notificationDot, staggerIndex = 0 } = opts;

    const itemClasses = [
      "group relative flex items-center h-10 rounded-lg",
      "transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0",
      "active:scale-[0.98]",
      "sidebar-item-enter",
    ];

    if (collapsed) {
      itemClasses.push("justify-center mx-auto w-10");
      if (active) {
        itemClasses.push("bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400");
      } else if (isFooter) {
        itemClasses.push("text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300");
      } else {
        itemClasses.push("text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white");
      }
    } else {
      itemClasses.push("px-3 gap-3");
      if (active) {
        itemClasses.push("bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400");
      } else if (isFooter) {
        itemClasses.push("text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300");
      } else {
        itemClasses.push("text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white");
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
        {/* OPT-24: Active indicator bar */}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-500 transition-all duration-200" />
        )}

        {/* Icon wrapper */}
        <span className="relative shrink-0">
          <Icon
            className="w-5 h-5 transition-transform duration-150 group-hover:scale-105"
            strokeWidth={1.5}
          />
          {/* OPT-41: Notification dot for Registre */}
          {notificationDot && hasAlerts && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-50 dark:ring-[#0B1120]" />
          )}
        </span>

        {/* Text + badges (expanded only) */}
        {!collapsed && (
          <>
            <span className="text-sm font-medium truncate transition-opacity duration-150">
              {item.label}
            </span>

            {/* OPT-26: Inline [+] button for Clients */}
            {showAddButton && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/nouveau-client");
                }}
                className="ml-auto text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25 transition-colors cursor-pointer flex items-center gap-0.5"
                aria-label="Nouveau client"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}

            {/* OPT-25: Badge counter */}
            {hasBadge && !showAddButton && (
              <span className="min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-slate-200 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 flex items-center justify-center ml-auto animate-count-up">
                {badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );

    // OPT-28: Tooltip in collapsed mode only
    if (collapsed) {
      return (
        <Tooltip key={item.to} delayDuration={100}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium text-sm">
            {item.label}
            {hasBadge && <span className="ml-2 text-xs opacity-70">({badge})</span>}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  /* ─── Section label ─── */
  const renderSectionLabel = (label: string) => {
    if (collapsed) {
      return (
        <div
          role="separator"
          aria-hidden="true"
          className="mx-3 my-2 border-t border-slate-200 dark:border-white/[0.06] transition-opacity duration-200"
        />
      );
    }
    return (
      <p className="px-3 mb-1 mt-6 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 pointer-events-none select-none transition-opacity duration-200">
        {label}
      </p>
    );
  };

  /* ─── Stagger counter ─── */
  let staggerIdx = 0;

  return (
    <TooltipProvider>
      {/* OPT: Mobile overlay backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "bg-slate-50 dark:bg-[#0B1120]",
          "border-r border-slate-200 dark:border-white/[0.06]",
          "transition-all duration-300 ease-in-out",
          collapsed
            ? "-translate-x-full lg:translate-x-0 lg:w-[72px]"
            : "translate-x-0 w-[260px]",
        ].join(" ")}
      >
        {/* ═══ Header ═══ */}
        <div
          className={`h-16 flex items-center shrink-0 border-b border-slate-200 dark:border-white/[0.06] ${
            collapsed ? "px-3 justify-center" : "px-4 justify-between"
          }`}
        >
          {/* OPT-50: Cabinet name / initials */}
          {collapsed ? (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
              {getCabinetInitials(cabinetName)}
            </div>
          ) : (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Cabinet
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {cabinetName}
              </span>
            </div>
          )}

          {/* OPT-36: Toggle collapse/expand */}
          {!collapsed && (
            <button
              onClick={onToggle}
              aria-label="Reduire le menu"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4 transition-transform duration-300" />
            </button>
          )}
          {collapsed && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  aria-label="Deplier le menu"
                  className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm transition-colors z-50"
                >
                  <ChevronsRight className="w-3 h-3 transition-transform duration-300" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Deplier</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ═══ Scrollable navigation ═══ */}
        <nav
          aria-label="Menu principal"
          className={[
            "flex-1 overflow-y-auto px-3 py-4",
            "[&::-webkit-scrollbar]:w-1",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-transparent",
            "hover:[&::-webkit-scrollbar-thumb]:bg-slate-300",
            "dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.1]",
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

        {/* ═══ Footer (fixed at bottom) ═══ */}
        <div className="mt-auto shrink-0 border-t border-slate-200 dark:border-white/[0.06] px-3 pt-2 pb-3">
          {/* Footer nav items (Diagnostic, Parametres, Aide) */}
          <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center space-y-0.5" : ""}`}>
            {FOOTER_NAV.map((item) => renderItem(item, { isFooter: true }))}
          </div>

          {/* ── User profile ── */}
          <div
            className={`mt-3 pt-3 border-t border-slate-200 dark:border-white/[0.06] ${
              collapsed ? "flex flex-col items-center gap-2" : ""
            }`}
          >
            {collapsed ? (
              <>
                {/* OPT-34: Collapsed — initials only */}
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400 text-xs font-semibold flex items-center justify-center cursor-default">
                      {userInitials}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {profile?.full_name || "Utilisateur"}
                  </TooltipContent>
                </Tooltip>

                {/* OPT-35: Collapsed logout */}
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      aria-label="Deconnexion"
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Deconnexion</TooltipContent>
                </Tooltip>
              </>
            ) : (
              /* OPT-33: Expanded — full profile block */
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400 text-xs font-semibold flex items-center justify-center shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate"
                    title={profile?.full_name || undefined}
                  >
                    {profile?.full_name}
                  </p>
                  <p
                    className="text-[11px] text-slate-400 dark:text-slate-500 truncate"
                    title={profile?.email || undefined}
                  >
                    {profile?.email}
                  </p>
                </div>
                {/* OPT-35: Logout button */}
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      aria-label="Deconnexion"
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 p-1 rounded-md hover:bg-red-500/10 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Deconnexion</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
