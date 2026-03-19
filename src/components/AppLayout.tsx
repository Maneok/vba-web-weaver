import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { Outlet, useLocation, useNavigate, NavLink } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import SubscriptionBanner from "./SubscriptionBanner";

import { ArrowLeft, Home, Keyboard, LayoutDashboard, LogOut, Menu, ScrollText, Settings, User, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAppState } from "@/lib/AppContext";
import { ROLE_LABELS } from "@/lib/auth/types";
import { getUserInitials } from "@/lib/utils";
import { formatDateFr } from "@/lib/dateUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, { title: string; breadcrumb: { label: string; path?: string }[] }> = {
  "/": { title: "Tableau de bord", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Tableau de bord" }] },
  "/bdd": { title: "Base Clients", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Base Clients" }] },
  "/nouveau-client": { title: "Nouveau Client", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Base Clients", path: "/bdd" }, { label: "Nouveau Client" }] },
  "/gouvernance": { title: "Gouvernance", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Gouvernance" }] },
  "/controle": { title: "Controle Qualite", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Controle Qualite" }] },
  "/registre": { title: "Registre LCB-FT", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Registre LCB-FT" }] },
  "/logs": { title: "Journal d'audit", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Journal d'audit" }] },
  "/diagnostic": { title: "Diagnostic 360", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Diagnostic 360" }] },
  "/ged": { title: "Documents / GED", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Documents / GED" }] },
  "/parametres": { title: "Parametres", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Parametres" }] },
  "/lettre-mission": { title: "Lettre de Mission", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Lettre de Mission" }] },
  "/revue-maintien": { title: "Revue periodique", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Revue periodique" }] },
  "/aide": { title: "Aide", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Aide" }] },
  "/notifications": { title: "Notifications", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Notifications" }] },
  "/admin/users": { title: "Gestion utilisateurs", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Gestion utilisateurs" }] },
  "/audit": { title: "Journal d'audit", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Journal d'audit" }] },
  "/super-admin": { title: "Super Admin", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Super Admin" }] },
};

/** Format date as "Jeu. 19 mars 2026" */
function formatHeaderDate(date: Date): string {
  const dayName = date.toLocaleDateString("fr-FR", { weekday: "short" });
  // Capitalize first letter: "jeu." → "Jeu."
  const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${capitalized} ${formatDateFr(date)}`;
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      const collapsed = stored !== null ? stored === "true" : true;
      // Sync CSS var immediately (before first paint) to avoid layout flash
      document.documentElement.style.setProperty(
        "--sidebar-offset",
        collapsed ? "72px" : "260px"
      );
      return collapsed;
    } catch {
      return true;
    }
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, session } = useAuth();
  const { isOnline } = useAppState();
  const prevPathRef = useRef(location.pathname);

  const userInitials = getUserInitials(profile?.full_name);
  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);

  // Persist sidebar collapsed state + keep CSS variable in sync
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
    } catch {
      // Ignore storage errors (e.g. private browsing)
    }
    document.documentElement.style.setProperty(
      "--sidebar-offset",
      sidebarCollapsed ? "72px" : "260px"
    );
  }, [sidebarCollapsed]);

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Page transition fade + scroll to top on route change
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setIsTransitioning(true);
      window.scrollTo(0, 0);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      const timer = setTimeout(() => setIsTransitioning(false), 200);
      prevPathRef.current = location.pathname;
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleSidebarToggle = () => {
    // Preserve scroll position on sidebar toggle
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    setSidebarCollapsed(prev => !prev);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
    });
  };

  // Detect detail pages for "Retour" button
  const isClientDetail = location.pathname.startsWith("/client/");
  const isLettreMissionDetail = /^\/lettre-mission\/[^/]+/.test(location.pathname);
  const isDetailPage = isClientDetail || isLettreMissionDetail;

  // Dynamic breadcrumb for client detail pages
  let page = PAGE_TITLES[location.pathname];
  if (!page && isClientDetail) {
    const ref = location.pathname.split("/client/")[1];
    page = { title: ref, breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Base Clients", path: "/bdd" }, { label: ref }] };
  }
  if (!page && isLettreMissionDetail) {
    const ref = location.pathname.split("/lettre-mission/")[1];
    page = { title: `LDM ${ref}`, breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Lettre de Mission", path: "/lettre-mission" }, { label: ref }] };
  }
  if (!page) page = { title: "Page", breadcrumb: [{ label: "Accueil", path: "/" }] };

  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] : null;
  const roleBadgeColor: Record<string, string> = {
    ADMIN: "bg-blue-500/20 text-blue-300",
    SUPERVISEUR: "bg-purple-500/20 text-purple-300",
    COLLABORATEUR: "bg-emerald-500/20 text-emerald-300",
    STAGIAIRE: "bg-amber-500/20 text-amber-300",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Page loading progress bar */}
      {isPending && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 animate-pulse rounded-r-full" style={{ width: "70%", animation: "progress-bar 1.5s ease-in-out infinite" }} />
        </div>
      )}

      {/* OPT-16: Better focus visibility for skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 bg-blue-600 text-white px-3 py-2 rounded focus:outline-2 focus:outline-offset-2 focus:outline-blue-400">
        Aller au contenu principal
      </a>
      <AppSidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />

      <div ref={scrollRef} className="app-content-offset pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-2 lg:gap-4 px-3 lg:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/[0.06]">
          {/* Mobile menu button with animation */}
          <button
            onClick={handleSidebarToggle}
            aria-label="Ouvrir ou fermer le menu"
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] text-slate-500 dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-transform duration-200 active:scale-90 shrink-0"
          >
            <Menu className={`w-5 h-5 transition-transform duration-200 ${!sidebarCollapsed ? "rotate-90" : ""}`} />
          </button>

          {/* Retour button on detail pages */}
          {isDetailPage && (
            <button
              onClick={() => navigate(isClientDetail ? "/bdd" : "/lettre-mission")}
              className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors rounded-lg px-1.5 lg:px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/[0.04] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
          )}

          <nav className="flex items-center gap-1 lg:gap-1.5 text-xs min-w-0 flex-1" aria-label="Fil d'ariane">
            <ol className="flex items-center gap-1 lg:gap-1.5 list-none m-0 p-0 min-w-0">
              {page.breadcrumb.map((item, i) => {
                const isLast = i === page.breadcrumb.length - 1;
                const isHome = i === 0 && item.label === "Accueil";
                // On mobile, only show last 2 breadcrumb items
                const hiddenOnMobile = !isLast && i < page.breadcrumb.length - 2;
                return (
                  <li key={i} className={`flex items-center gap-1 lg:gap-1.5 min-w-0 ${hiddenOnMobile ? "hidden sm:flex" : ""}`}>
                    {i > 0 && <span className="text-slate-300 dark:text-slate-600 shrink-0 select-none">/</span>}
                    {!isLast && item.path ? (
                      <button
                        onClick={() => startTransition(() => navigate(item.path!))}
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer truncate max-w-[80px] sm:max-w-none"
                      >
                        {isHome ? <Home className="w-3.5 h-3.5" /> : item.label}
                      </button>
                    ) : (
                      <span className={`truncate max-w-[120px] sm:max-w-none ${isLast ? "text-slate-600 dark:text-slate-300 font-medium" : "text-slate-400 dark:text-slate-500"}`} aria-current={isLast ? "page" : undefined}>
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              onClick={() => navigate("/parametres")}
              aria-label="Parametres"
              className="hidden md:flex w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 items-center justify-center transition-colors duration-150 cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
            <time dateTime={new Date().toISOString().split("T")[0]} className="hidden lg:inline text-xs text-slate-400 dark:text-slate-500 px-1.5">
              {headerDate}
            </time>
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-white/[0.06]" />

            <ThemeToggle />
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Ouvrir le menu utilisateur"
                  className="relative w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center hover:bg-blue-500/20 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {userInitials}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white dark:border-slate-900 ${
                      isOnline && session ? "bg-emerald-400 status-dot-live" : "bg-red-400"
                    }`}
                    title={isOnline && session ? "Connecte" : "Hors ligne"}
                    aria-label={isOnline && session ? "Statut : connecte" : "Statut : hors ligne"}
                    role="status"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span>Mon espace</span>
                  {profile?.role && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${roleBadgeColor[profile.role] ?? "bg-slate-500/20 text-slate-700 dark:text-slate-300"}`}>
                      {roleLabel}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/parametres")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> Mon profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/parametres")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Parametres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/logs")}>
                  <ScrollText className="mr-2 h-4 w-4" /> Journal & securite
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-slate-400 dark:text-slate-500 text-xs justify-between">
                  <span className="flex items-center gap-2">
                    <Keyboard className="h-3.5 w-3.5" /> Sidebar
                  </span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-white/[0.06] rounded border border-gray-300 dark:border-white/[0.1]">Ctrl+B</kbd>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 focus:text-red-300">
                  <LogOut className="mr-2 h-4 w-4" /> Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <SubscriptionBanner />

        {!isOnline && session && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-center text-sm text-amber-300">
            Mode demonstration — Les donnees ne sont pas sauvegardees dans Supabase
          </div>
        )}
        {!session && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-center text-sm text-amber-300">
            Mode demonstration — <button onClick={() => navigate("/auth")} className="underline hover:text-amber-200">Connectez-vous</button> pour sauvegarder
          </div>
        )}

        <main
          id="main-content"
          className={`overflow-auto transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
          aria-label={`Contenu ${page.title}`}
          aria-live="polite"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.06] flex items-center justify-around px-2 h-16 safe-area-bottom" aria-label="Navigation mobile">
        <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive ? "text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accueil</span>
        </NavLink>
        <NavLink to="/bdd" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive ? "text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Clients</span>
        </NavLink>
        <NavLink to="/registre" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive ? "text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
          <ScrollText className="w-5 h-5" />
          <span className="text-[10px] font-medium">Registre</span>
        </NavLink>
        <button
          onClick={handleSidebarToggle}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          aria-label="Ouvrir le menu complet"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

      <style>{`
        @keyframes progress-bar {
          0% { width: 10%; opacity: 0.8; }
          50% { width: 70%; opacity: 1; }
          100% { width: 95%; opacity: 0.8; }
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </div>
  );
}
