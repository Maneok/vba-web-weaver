import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Building2, Building, Home, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const FORME_CARDS = [
  { id: "SARL", label: "SARL / EURL", icon: Building2, desc: "Societe a responsabilite limitee" },
  { id: "SAS", label: "SAS / SASU", icon: Building, desc: "Societe par actions simplifiee" },
  { id: "SCI", label: "SCI", icon: Home, desc: "Societe civile immobiliere" },
  { id: "ENTREPRISE INDIVIDUELLE", label: "EI / Micro", icon: User, desc: "Entreprise individuelle" },
] as const;

const TYPE_MISSIONS = [
  { id: "TENUE" as const, label: "Tenue comptable", desc: "Mission de tenue et presentation des comptes" },
  { id: "SURVEILLANCE" as const, label: "Surveillance", desc: "Mission de surveillance et revision des comptes" },
  { id: "REVISION" as const, label: "Revision contractuelle", desc: "Revision contractuelle des comptes annuels" },
  { id: "CAC" as const, label: "Commissariat aux comptes", desc: "Mission legale de certification" },
];

export default function LMWizardStep2Type({ data, onChange }: Props) {
  const matchForme = (formeId: string) => {
    const f = data.forme_juridique?.toUpperCase() || "";
    if (formeId === "SARL") return f.includes("SARL") || f.includes("EURL");
    if (formeId === "SAS") return f.includes("SAS") || f.includes("SASU");
    if (formeId === "SCI") return f.includes("SCI");
    if (formeId === "ENTREPRISE INDIVIDUELLE") return f.includes("INDIVIDUELLE") || f.includes("EI") || f.includes("MICRO");
    return false;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Type de lettre de mission</h2>
        <p className="text-sm text-slate-500">Selectionnez la forme juridique et le type de mission</p>
      </div>

      {/* Forme juridique */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Forme juridique</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FORME_CARDS.map(({ id, label, icon: Icon, desc }) => {
            const isSelected = matchForme(id);
            return (
              <button
                key={id}
                onClick={() => onChange({ forme_juridique: id })}
                className={`relative p-4 rounded-xl border transition-all duration-200 text-left ${
                  isSelected
                    ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/5"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                }`}
              >
                {isSelected && data.client_ref && (
                  <Badge className="absolute -top-2 -right-2 bg-emerald-500 text-[9px] px-1.5">Auto</Badge>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  isSelected ? "bg-blue-500/20" : "bg-white/[0.04]"
                }`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                </div>
                <p className={`text-sm font-medium ${isSelected ? "text-blue-300" : "text-white"}`}>{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type de mission */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Type de mission</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TYPE_MISSIONS.map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => onChange({ type_mission: id })}
              className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                data.type_mission === id
                  ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
              }`}
            >
              <p className={`text-sm font-medium ${data.type_mission === id ? "text-blue-300" : "text-white"}`}>{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
