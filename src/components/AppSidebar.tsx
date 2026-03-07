import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Users,
  ClipboardCheck,
  BookOpen,
  ScrollText,
  Shield,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bdd", icon: Database, label: "Base Clients" },
  { to: "/gouvernance", icon: Users, label: "Gouvernance" },
  { to: "/controle", icon: ClipboardCheck, label: "Controle" },
  { to: "/registre", icon: BookOpen, label: "Registre" },
  { to: "/logs", icon: ScrollText, label: "Journal" },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const { alertes, clients } = useAppState();

  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS").length;
  const retardCount = clients.filter(c => c.etatPilotage === "RETARD").length;

  const badges: Record<string, number> = {
    "/": retardCount,
    "/registre": alertesEnCours,
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onToggle} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          bg-[hsl(222,47%,7%)] border-r border-white/[0.06]
          transition-all duration-300 ease-in-out
          ${collapsed ? "-translate-x-full lg:translate-x-0 lg:w-[72px]" : "translate-x-0 w-[260px]"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-white/[0.06] ${collapsed ? "lg:justify-center px-0" : "px-5"}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "lg:gap-0" : ""}`}>
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-white tracking-tight whitespace-nowrap">MATRICE LCB-FT</h1>
                <p className="text-[10px] text-slate-500 whitespace-nowrap">Pilotage Conformite</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-3">
              Navigation
            </p>
          )}
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            const badge = badges[item.to] || 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`
                  relative group flex items-center gap-3 rounded-lg text-[13px] font-medium
                  transition-all duration-200
                  ${collapsed ? "lg:justify-center lg:px-0 px-3 py-2.5" : "px-3 py-2.5"}
                  ${isActive
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }
                `}
                onClick={() => {
                  if (window.innerWidth < 1024) onToggle();
                }}
              >
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5">
                        {badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && badge > 0 && (
                  <span className="absolute right-1 top-1 w-2 h-2 rounded-full bg-red-400" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle - desktop only */}
        <div className="hidden lg:block p-3 border-t border-white/[0.06]">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors text-xs"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>Reduire</span>}
          </button>
        </div>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white">
                EC
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">Expert-Comptable</p>
                <p className="text-[10px] text-slate-500 truncate">NPLAB 2025</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
