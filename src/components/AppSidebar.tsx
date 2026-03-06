import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Database, Users, AlertTriangle, ClipboardCheck, FileText, Shield, Settings, Home } from "lucide-react";
import { useAppState } from "@/lib/AppContext";

const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Cockpit" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { to: "/bdd", icon: Database, label: "Base Clients" },
  { to: "/gouvernance", icon: Users, label: "Gouvernance" },
  { to: "/controle", icon: ClipboardCheck, label: "Contrôle" },
  { to: "/registre", icon: AlertTriangle, label: "Registre LCB" },
  { to: "/logs", icon: FileText, label: "Logs" },
  { to: "/admin", icon: Settings, label: "Paramétrage" },
];

export default function AppSidebar() {
  const location = useLocation();
  const { unreadAlertCount } = useAppState();

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
            <p className="text-[10px] text-sidebar-foreground opacity-60">v2.0 · Mémoire DEC 2026</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          const showBadge = item.to === "/" && unreadAlertCount > 0;
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
              <Icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground opacity-50 text-center">
          NPLAB 2025 · L.561-2 CMF
        </p>
      </div>
    </aside>
  );
}
