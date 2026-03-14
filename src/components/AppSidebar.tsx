import { useEffect, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  ScrollText,
  Settings,
  UserPlus,
  FolderOpen,
  Activity,
  FileText,
  LogOut,
  HelpCircle,
  ChevronLeft,
} from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const APP_VERSION = "1.0.0";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; shortcut: string };

const PRINCIPAL_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "D" },
  { to: "/bdd", label: "Base Clients", icon: Users, shortcut: "B" },
];

const CONFORMITE_NAV: NavItem[] = [
  { to: "/registre", label: "Registre LCB", icon: AlertTriangle, shortcut: "R" },
  { to: "/logs", label: "Journal d'audit", icon: ScrollText, shortcut: "J" },
  { to: "/controle", label: "Controle Qualite", icon: ClipboardCheck, shortcut: "Q" },
];

const OUTILS_NAV: NavItem[] = [
  { to: "/ged", label: "Documents / GED", icon: FolderOpen, shortcut: "E" },
  { to: "/diagnostic", label: "Diagnostic 360", icon: Activity, shortcut: "3" },
  { to: "/gouvernance", label: "Gouvernance", icon: ShieldCheck, shortcut: "G" },
  { to: "/lettre-mission", label: "Lettre de Mission", icon: FileText, shortcut: "L" },
];

const CONFIG_NAV: NavItem[] = [
  { to: "/parametres", label: "Parametres", icon: Settings, shortcut: "P" },
  { to: "/aide", label: "Aide", icon: HelpCircle, shortcut: "?" },
];

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { alertes, clients } = useAppState();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && !collapsed) {
      onToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const alertesEnCours = useMemo(() => alertes.filter((a) => a.statut === "EN COURS").length, [alertes]);
  const retardCount = useMemo(() => clients.filter((c) => c.etatPilotage === "RETARD").length, [clients]);

  const badges: Record<string, { count: number; color: string }> = {
    "/": { count: retardCount, color: "bg-amber-400" },
    "/bdd": { count: clients.length, color: "bg-blue-400" },
    "/registre": { count: alertesEnCours, color: "bg-red-400" },
  };

  const cabinetName = profile?.full_name?.split(" ").pop() || "LCB-FT";

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const badge = badges[item.to];
    const hasBadge = badge && badge.count > 0;

    const link = (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === "/"}
        aria-label={collapsed ? item.label : undefined}
        aria-current={location.pathname === item.to || (item.to === "/" && location.pathname === "/") ? "page" : undefined}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-ring))] ${
            isActive
              ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-l-[3px] border-[hsl(var(--primary))] pl-[9px] font-medium"
              : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] border-l-[3px] border-transparent pl-[9px]"
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
        {!collapsed && (
          <>
            <span className="truncate animate-fade-in-up">{item.label}</span>
            {hasBadge && (
              <span className="ml-auto rounded-full bg-[hsl(var(--primary))]/20 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]">
                {badge.count}
              </span>
            )}
            <span className="ml-auto text-[10px] text-[hsl(var(--sidebar-foreground))]/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              {hasBadge ? "" : `Alt+${item.shortcut}`}
            </span>
          </>
        )}
        {collapsed && hasBadge && (
          <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${badge.color} ring-2 ring-[hsl(var(--sidebar-background))]`} />
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.to} delayDuration={200}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
            {hasBadge && (
              <span className="ml-2 text-xs opacity-70">({badge.count})</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  const renderSection = (items: NavItem[], label: string, isFirst = false) => (
    <div>
      {/* OPT-18: role="separator" for screen readers */}
      {!isFirst && collapsed && (
        <div role="separator" aria-hidden="true" className="mx-3 my-2 border-t border-[hsl(var(--sidebar-border))]/60" />
      )}
      {!isFirst && !collapsed && (
        <div role="separator" aria-hidden="true" className="mt-2 border-t border-[hsl(var(--sidebar-border))]/60" />
      )}
      {!collapsed && (
        <p className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/80">
          {label}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => renderNavItem(item))}
      </div>
    </div>
  );

  const nouveauClientBtn = (
    <button
      onClick={() => navigate("/nouveau-client")}
      aria-label="Nouveau Client"
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/25 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <UserPlus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      {!collapsed && <span>Nouveau Client</span>}
    </button>
  );

  const lettreMissionBtn = (
    <button
      onClick={() => navigate("/lettre-mission")}
      aria-label="Lettre de Mission"
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/25 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      {!collapsed && <span>Lettre de Mission</span>}
    </button>
  );


  return (
    <TooltipProvider>
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))]/95 backdrop-blur-xl transition-all duration-300 flex flex-col ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[hsl(var(--sidebar-border))]">
          <button
            onClick={onToggle}
            aria-label="Reduire ou etendre le menu lateral"
            className="flex items-center gap-2 text-left text-sm font-semibold tracking-wide text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-ring))]"
          >
            {collapsed ? (
              <span className="text-[hsl(var(--sidebar-primary))] font-bold">LCB</span>
            ) : (
              <span>
                Cabinet{" "}
                <span className="text-[hsl(var(--sidebar-primary))]">{cabinetName}</span>
              </span>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={onToggle}
              aria-label="Reduire le menu"
              className="p-1 rounded-md text-[hsl(var(--sidebar-foreground))]/80 hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
            >
              <ChevronLeft
                className="h-4 w-4 transition-transform duration-300"
              />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto p-3">
          {renderSection(PRINCIPAL_NAV, "Principal", true)}

          {/* Nouveau Client button — part of Principal group */}
          <div className="mt-1.5 space-y-0.5">
            {collapsed ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>{nouveauClientBtn}</TooltipTrigger>
                <TooltipContent side="right">Nouveau Client</TooltipContent>
              </Tooltip>
            ) : (
              nouveauClientBtn
            )}
          </div>

          {renderSection(CONFORMITE_NAV, "Conformite")}
          {renderSection(OUTILS_NAV, "Outils")}
          {renderSection(CONFIG_NAV, "Configuration")}
        </nav>

        {/* User info + logout + version */}
        <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
          {profile && !collapsed && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium text-[hsl(var(--sidebar-foreground))] truncate">
                {profile.full_name}
              </p>
              <p className="text-xs text-[hsl(var(--sidebar-foreground))]/70 truncate">{profile.email}</p>
            </div>
          )}

          {collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  aria-label="Deconnexion"
                  className="group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground))]/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                >
                  <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:scale-110" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Deconnexion</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSignOut}
              aria-label="Deconnexion"
              className="group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground))]/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:scale-110" />
              <span>Deconnexion</span>
            </button>
          )}

          {/* Trust footer + version */}
          <div className={`mt-2 text-center select-none ${collapsed ? "px-1" : "px-3"}`}>
            {!collapsed && (
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/60 mb-0.5">
                Conforme LCB-FT · Art. L.561-2 CMF
              </p>
            )}
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/70">
              GRIMY v{APP_VERSION}-beta
            </p>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
