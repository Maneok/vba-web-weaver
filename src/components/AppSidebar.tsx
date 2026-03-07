import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ShieldCheck, ClipboardCheck, AlertTriangle, ScrollText, Settings, UserPlus, FolderOpen, Activity } from "lucide-react";
import { useAppState } from "@/lib/AppContext";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const MENU_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bdd", label: "Base Clients", icon: Users },
  { to: "/gouvernance", label: "Gouvernance", icon: ShieldCheck },
  { to: "/controle", label: "Controle Qualite", icon: ClipboardCheck },
  { to: "/registre", label: "Registre LCB", icon: AlertTriangle },
  { to: "/ged", label: "Documents / GED", icon: FolderOpen },
  { to: "/diagnostic", label: "Diagnostic 360", icon: Activity },
  { to: "/logs", label: "Journal d'audit", icon: ScrollText },
  { to: "/parametres", label: "Parametres", icon: Settings },
] as const;

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { alertes, clients } = useAppState();
  const navigate = useNavigate();

  const alertesEnCours = alertes.filter((a) => a.statut === "EN COURS").length;
  const retardCount = clients.filter((c) => c.etatPilotage === "RETARD").length;

  const badges: Record<string, number> = {
    "/": retardCount,
    "/bdd": clients.length,
    "/registre": alertesEnCours,
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-white/[0.06] bg-slate-950/95 backdrop-blur-xl transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"}`}
    >
      <div className="h-16 px-4 flex items-center border-b border-white/[0.06]">
        <button
          onClick={onToggle}
          aria-label="Reduire ou etendre le menu lateral"
          className="w-full text-left text-sm font-semibold tracking-wide text-slate-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {collapsed ? "O90" : "Cabinet O90"}
        </button>
      </div>

      <nav className="p-3 space-y-1">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = badges[item.to];

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? "bg-blue-500/15 text-blue-200"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badge !== undefined && badge > 0 && (
                <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* New Client button */}
        <div className="pt-3 mt-3 border-t border-white/[0.06]">
          <button
            onClick={() => navigate("/nouveau-client")}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Nouveau Client</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}
