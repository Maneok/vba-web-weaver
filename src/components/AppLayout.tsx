import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { Menu, ChevronRight } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  "/": { title: "Dashboard", breadcrumb: ["Accueil", "Dashboard"] },
  "/bdd": { title: "Base Clients", breadcrumb: ["Accueil", "Base Clients"] },
  "/gouvernance": { title: "Gouvernance", breadcrumb: ["Accueil", "Gouvernance"] },
  "/controle": { title: "Controle Qualite", breadcrumb: ["Accueil", "Controle Qualite"] },
  "/registre": { title: "Registre LCB-FT", breadcrumb: ["Accueil", "Registre LCB-FT"] },
  "/logs": { title: "Journal des Actions", breadcrumb: ["Accueil", "Journal"] },
};

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const location = useLocation();
  const page = PAGE_TITLES[location.pathname] || { title: "Page", breadcrumb: ["Accueil"] };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] text-slate-400"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            {page.breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                <span className={i === page.breadcrumb.length - 1 ? "text-slate-200 font-medium" : "text-slate-500"}>
                  {item}
                </span>
              </span>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
              {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <div className="w-px h-5 bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white">
              EC
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
