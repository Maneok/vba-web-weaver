import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";


const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Cockpit", emoji: "🏠" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard", emoji: "📊" },
  { to: "/bdd", icon: Database, label: "Base Clients", emoji: "📁" },

  { to: "/logs", icon: FileText, label: "Logs", emoji: "🔒" },
  { to: "/diagnostic", icon: ShieldCheck, label: "Diagnostic 360°", emoji: "🛡" },
];
type BadgeKey = "formationsAFaire" | "alertesNonTraitees";

const ADMIN_ITEMS = [
  { to: "/admin/users", icon: UserCog, label: "Utilisateurs", emoji: "👤", permission: "manage_users" as const },
  { to: "/admin/audit", icon: ScrollText, label: "Piste d'audit", emoji: "📜", permission: "view_audit" as const },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-primary text-primary-foreground",
  SUPERVISEUR: "bg-[hsl(38,92%,50%)] text-black",
  COLLABORATEUR: "bg-[hsl(210,60%,60%)] text-white",
  STAGIAIRE: "bg-muted text-muted-foreground",
};

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
            <p className="text-[10px] text-sidebar-foreground opacity-60">v1.0 · Memoire DEC 2026</p>
          </div>
        </div>
      </div>

      {/* Urgency indicator */}
      {totalUrgencies > 0 && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-[11px] font-medium text-red-400">
              {totalUrgencies} urgence{totalUrgencies > 1 ? "s" : ""} critique{totalUrgencies > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to;
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
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
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}

        {visibleAdminItems.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {visibleAdminItems.map((item) => {
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
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {profile && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-bold text-sidebar-primary">
                {profile.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                  {profile.full_name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Badge className={`text-[10px] ${ROLE_COLORS[profile.role] || ""}`}>
                {profile.role}
              </Badge>
              <button
                onClick={signOut}
                className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60 hover:text-destructive transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Deconnexion
              </button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-sidebar-foreground opacity-50 text-center">
          NPLAB 2025 · L.561 CMF
        </p>
      </div>
    </aside>
  );
}
