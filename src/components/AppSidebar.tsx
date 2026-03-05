import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Database, Users, AlertTriangle, ClipboardCheck, FileText, Shield } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: BarChart3, label: "Dashboard", emoji: "📊" },
  { to: "/bdd", icon: Database, label: "Base Clients", emoji: "📁" },
  { to: "/gouvernance", icon: Users, label: "Gouvernance", emoji: "👥" },
  { to: "/controle", icon: ClipboardCheck, label: "Contrôle", emoji: "🔍" },
  { to: "/registre", icon: AlertTriangle, label: "Registre LCB", emoji: "📒" },
  { to: "/logs", icon: FileText, label: "Logs", emoji: "🔒" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">MATRICE LCB-FT</h1>
            <p className="text-[10px] text-sidebar-foreground opacity-60">v1.0 · Mémoire DEC 2026</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground opacity-50 text-center">
          NPLAB 2025 · L.561 CMF
        </p>
      </div>
    </aside>
  );
}
