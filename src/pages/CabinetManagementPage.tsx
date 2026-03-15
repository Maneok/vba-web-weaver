import { useState, useEffect, lazy, Suspense } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, ShieldCheck, Settings2, Plug, Key, Crown, ChevronRight } from "lucide-react";

const CabinetsList = lazy(() => import("@/components/cabinet/CabinetsList"));
const CollaborateursList = lazy(() => import("@/components/cabinet/CollaborateursList"));
const RolesMatrix = lazy(() => import("@/components/cabinet/RolesMatrix"));
const ReglagesPanel = lazy(() => import("@/components/cabinet/ReglagesPanel"));
const ConnecteursPanel = lazy(() => import("@/components/cabinet/ConnecteursPanel"));
const ApiKeysPanel = lazy(() => import("@/components/cabinet/ApiKeysPanel"));

type Section = "cabinets" | "collaborateurs" | "roles" | "reglages" | "connecteurs" | "api-keys";

const NAV_SECTIONS = [
  {
    label: "Gestion",
    items: [
      { id: "cabinets" as Section, label: "Cabinets", icon: Building2, description: "Bureaux et sites" },
      { id: "collaborateurs" as Section, label: "Collaborateurs", icon: Users, description: "Equipe et acces" },
      { id: "roles" as Section, label: "Roles", icon: ShieldCheck, description: "Matrice permissions" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "reglages" as Section, label: "Reglages", icon: Settings2, description: "Toggles et parametres" },
      { id: "connecteurs" as Section, label: "Connecteurs", icon: Plug, description: "APIs externes" },
      { id: "api-keys" as Section, label: "Cles API", icon: Key, description: "Acces programmatique" },
    ],
  },
];

function PanelLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function CabinetManagementPage() {
  useDocumentTitle("Gestion du Cabinet");
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("collaborateurs");
  const [cabinetName, setCabinetName] = useState("Mon cabinet");
  const [isPrincipal, setIsPrincipal] = useState(false);

  useEffect(() => {
    const loadCabinetInfo = async () => {
      if (!profile?.cabinet_id) return;
      const { data } = await supabase
        .from("cabinets")
        .select("nom, is_principal")
        .eq("id", profile.cabinet_id)
        .single();
      if (data) {
        setCabinetName(data.nom || "Mon cabinet");
        setIsPrincipal(data.is_principal || false);
      }
    };
    loadCabinetInfo();
  }, [profile?.cabinet_id]);

  const renderContent = () => {
    switch (activeSection) {
      case "cabinets": return <CabinetsList />;
      case "collaborateurs": return <CollaborateursList />;
      case "roles": return <RolesMatrix />;
      case "reglages": return <ReglagesPanel />;
      case "connecteurs": return <ConnecteursPanel />;
      case "api-keys": return <ApiKeysPanel />;
    }
  };

  if (!profile) return null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 border-r border-white/[0.06] bg-white/[0.02] flex flex-col overflow-y-auto">
        {/* Cabinet header */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-100 truncate">{cabinetName}</h2>
              {isPrincipal && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                  <Crown className="h-3 w-3" /> Cabinet principal
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                        isActive
                          ? "bg-blue-500/15 text-blue-200 border-l-[3px] border-blue-400 pl-[9px]"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border-l-[3px] border-transparent pl-[9px]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className={`text-[11px] truncate ${isActive ? "text-blue-300/60" : "text-slate-600"}`}>{item.description}</p>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-all ${isActive ? "text-blue-400 opacity-100" : "opacity-0 group-hover:opacity-50"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-slate-600 text-center">
            GRIMY · Gestion Cabinet
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Suspense fallback={<PanelLoader />}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  );
}
