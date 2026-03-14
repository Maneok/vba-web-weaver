import { useState, useEffect, useRef, useTransition } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import SubscriptionBanner from "./SubscriptionBanner";
import { ThemeToggle } from "./ThemeToggle";

import { ArrowLeft, ChevronRight, Keyboard, LogOut, Menu, ScrollText, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAppState } from "@/lib/AppContext";
import { ROLE_LABELS } from "@/lib/auth/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, { title: string; breadcrumb: { label: string; path?: string }[] }> = {
  "/": { title: "Dashboard", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Dashboard" }] },
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
  "/aide": { title: "Aide", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Aide" }] },
  "/notifications": { title: "Notifications", breadcrumb: [{ label: "Accueil", path: "/" }, { label: "Notifications" }] },
};

/** Compute user initials safely for single-word or empty names */
function getUserInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format date with relative time for today/yesterday, otherwise short date */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Aujourd'hui";
  if (isYesterday) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      return stored !== null ? stored === "true" : true;
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

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
    } catch {
      // Ignore storage errors (e.g. private browsing)
    }
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

  // Page transition fade on route change
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setIsTransitioning(true);
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
    ADMIN: "bg-primary/20 text-primary",
    SUPERVISEUR: "bg-violet-500/20 text-violet-600 dark:text-violet-300",
    COLLABORATEUR: "bg-success/20 text-[hsl(var(--success))]",
    STAGIAIRE: "bg-warning/20 text-[hsl(var(--warning))]",
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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 bg-primary text-primary-foreground px-3 py-2 rounded focus:outline-2 focus:outline-offset-2 focus:outline-primary">
        Aller au contenu principal
      </a>
      <AppSidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />

      <div ref={scrollRef} className={`transition-all duration-300 ${sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 bg-card/80 backdrop-blur-xl border-b border-border">
          {/* Mobile menu button with animation */}
          <button
            onClick={handleSidebarToggle}
            aria-label="Ouvrir ou fermer le menu"
            className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 active:scale-90"
          >
            <Menu className={`w-5 h-5 transition-transform duration-200 ${!sidebarCollapsed ? "rotate-90" : ""}`} />
          </button>

          {/* Retour button on detail pages */}
          {isDetailPage && (
            <button
              onClick={() => navigate(isClientDetail ? "/bdd" : "/lettre-mission")}
              className="hidden lg:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1 hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          )}

          <nav className="flex items-center gap-1.5 text-sm" aria-label="Fil d'ariane">
            <ol className="flex items-center gap-1.5 list-none m-0 p-0">
              {page.breadcrumb.map((item, i) => {
                const isLast = i === page.breadcrumb.length - 1;
                return (
                  <li key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    {!isLast && item.path ? (
                      <button
                        onClick={() => startTransition(() => navigate(item.path!))}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ) : (
                      // OPT-17: aria-current on last breadcrumb for screen readers
                      <span className={isLast ? "text-foreground font-medium" : "text-muted-foreground"} aria-current={isLast ? "page" : undefined}>
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate("/parametres")}
              className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/80 hover:bg-muted px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Parametres
            </button>
            {/* OPT-34: Accessible date display */}
            <time dateTime={new Date().toISOString().split("T")[0]} className="hidden sm:inline text-[11px] text-muted-foreground font-mono">
              {formatRelativeDate(new Date())}
            </time>
            <div className="w-px h-5 bg-border" />

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Ouvrir le menu utilisateur"
                  className="relative group w-9 h-9 rounded-full p-[2px] bg-[hsl(var(--primary))] hover:opacity-90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-center w-full h-full rounded-full bg-background text-[11px] font-bold text-foreground">
                    {userInitials}
                  </span>
                  {/* Connection status indicator */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                      isOnline && session ? "bg-emerald-500" : "bg-destructive"
                    }`}
                    title={isOnline && session ? "Connecte" : "Hors ligne"}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span>Mon espace</span>
                  {profile?.role && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${roleBadgeColor[profile.role] ?? "bg-muted text-muted-foreground"}`}>
                      {roleLabel}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/parametres")}>
                  <User className="mr-2 h-4 w-4" /> Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/parametres")}>
                  <Settings className="mr-2 h-4 w-4" /> Parametres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/logs")}>
                  <ScrollText className="mr-2 h-4 w-4" /> Journal & securite
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-muted-foreground text-xs justify-between">
                  <span className="flex items-center gap-2">
                    <Keyboard className="h-3.5 w-3.5" /> Sidebar
                  </span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">Ctrl+B</kbd>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
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

      <style>{`
        @keyframes progress-bar {
          0% { width: 10%; opacity: 0.8; }
          50% { width: 70%; opacity: 1; }
          100% { width: 95%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
