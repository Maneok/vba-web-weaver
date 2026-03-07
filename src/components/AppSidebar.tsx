import { NavLink } from "react-router-dom";

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
  { to: "/registre", label: "Registre LCB-FT", icon: AlertTriangle },
  { to: "/logs", label: "Journal", icon: ScrollText },

] as const;

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { alertes, clients } = useAppState();

  const alertesEnCours = alertes.filter((a) => a.statut === "EN COURS").length;
  const retardCount = clients.filter((c) => c.etatPilotage === "RETARD").length;

  const badges: Record<string, number> = {
    "/": retardCount,
    "/registre": alertesEnCours,
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-white/[0.06] bg-slate-950/95 backdrop-blur-xl transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"}`}
    >
      <div className="h-16 px-4 flex items-center border-b border-white/[0.06]">
        <button
          onClick={onToggle}

        >
          {collapsed ? "O90" : "Cabinet O90"}
        </button>
      </div>

      <nav className="p-3 space-y-1">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = badges[item.to];

                  isActive
                    ? "bg-blue-500/15 text-blue-200"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
