import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { ChevronRight, LogOut, Menu, ScrollText, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAppState } from "@/lib/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  "/": { title: "Dashboard", breadcrumb: ["Accueil", "Dashboard"] },
  "/bdd": { title: "Base Clients", breadcrumb: ["Accueil", "Base Clients"] },
  "/nouveau-client": { title: "Nouveau Client", breadcrumb: ["Accueil", "Base Clients", "Nouveau Client"] },
  "/gouvernance": { title: "Gouvernance", breadcrumb: ["Accueil", "Gouvernance"] },
  "/controle": { title: "Controle Qualite", breadcrumb: ["Accueil", "Controle Qualite"] },
  "/registre": { title: "Registre LCB-FT", breadcrumb: ["Accueil", "Registre LCB-FT"] },
  "/logs": { title: "Journal d'audit", breadcrumb: ["Accueil", "Journal d'audit"] },
  "/diagnostic": { title: "Diagnostic 360", breadcrumb: ["Accueil", "Diagnostic 360"] },
  "/ged": { title: "Documents / GED", breadcrumb: ["Accueil", "Documents / GED"] },
  "/parametres": { title: "Parametres", breadcrumb: ["Accueil", "Parametres"] },
  "/lettre-mission": { title: "Lettre de Mission", breadcrumb: ["Accueil", "Lettre de Mission"] },
  "/aide": { title: "Aide", breadcrumb: ["Accueil", "Aide"] },
};

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, session } = useAuth();
  const { isOnline } = useAppState();

  const userInitials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  // Dynamic breadcrumb for client detail pages
  let page = PAGE_TITLES[location.pathname];
  if (!page && location.pathname.startsWith("/client/")) {
    const ref = location.pathname.split("/client/")[1];
    page = { title: ref, breadcrumb: ["Accueil", "Base Clients", ref] };
  }
  if (!page && location.pathname.startsWith("/lettre-mission/")) {
    const ref = location.pathname.split("/lettre-mission/")[1];
    page = { title: `LDM ${ref}`, breadcrumb: ["Accueil", "Lettre de Mission", ref] };
  }
  if (!page) page = { title: "Page", breadcrumb: ["Accueil"] };

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 bg-blue-600 text-white px-3 py-2 rounded">
        Aller au contenu principal
      </a>
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Ouvrir ou fermer le menu"
            className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="flex items-center gap-1.5 text-sm" aria-label="Fil d'ariane">
            {page.breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                <span className={i === page.breadcrumb.length - 1 ? "text-slate-200 font-medium" : "text-slate-500"}>
                  {item}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => navigate("/parametres")}
              className="hidden md:flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Settings className="h-3.5 w-3.5" />
              Parametres
            </button>
            <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
              {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <div className="w-px h-5 bg-white/[0.06]" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Ouvrir le menu utilisateur"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {userInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mon espace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <User className="mr-2 h-4 w-4" /> Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/parametres")}>
                  <Settings className="mr-2 h-4 w-4" /> Parametres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/logs")}>
                  <ScrollText className="mr-2 h-4 w-4" /> Journal & securite
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 focus:text-red-300">
                  <LogOut className="mr-2 h-4 w-4" /> Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

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

        <main id="main-content" className="overflow-auto" aria-label={`Contenu ${page.title}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
