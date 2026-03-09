import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const DUREES = ["1 an", "2 ans", "3 ans", "Personnalise"];
const FREQUENCES_RDV = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];
const LIEUX = [
  { value: "cabinet", label: "Au cabinet" },
  { value: "client", label: "Chez le client" },
  { value: "mixte", label: "Mixte" },
];

export default function LMWizardStep5Modalites({ data, onChange }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Modalites du contrat</h2>
        <p className="text-sm text-slate-500">Definissez la duree, les rendez-vous et le lieu d'execution</p>
      </div>

      {/* Durée */}
      <div className="space-y-3">
        <Label className="text-slate-300 text-sm font-medium">Duree de la mission</Label>
        <div className="flex flex-wrap gap-2">
          {DUREES.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ duree: d })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.duree === d
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04] hover:border-white/[0.1]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Date de début */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Date de debut</Label>
          <Input
            type="date"
            value={data.date_debut}
            onChange={(e) => onChange({ date_debut: e.target.value })}
            className="bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
      </div>

      {/* Tacite reconduction + préavis */}
      <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Tacite reconduction</p>
            <p className="text-xs text-slate-500">Renouvellement automatique a echeance</p>
          </div>
          <Switch
            checked={data.tacite_reconduction}
            onCheckedChange={(v) => onChange({ tacite_reconduction: v })}
          />
        </div>

        {data.tacite_reconduction && (
          <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
            <Label className="text-slate-400 text-xs">Preavis de resiliation</Label>
            <Select
              value={String(data.preavis_mois ?? 3)}
              onValueChange={(v) => onChange({ preavis_mois: Number(v) })}
            >
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois</SelectItem>
                <SelectItem value="2">2 mois</SelectItem>
                <SelectItem value="3">3 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Fréquence RDV */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Frequence des rendez-vous</Label>
        <Select value={data.frequence_rdv} onValueChange={(v) => onChange({ frequence_rdv: v })}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCES_RDV.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lieu d'exécution */}
      <div className="space-y-3">
        <Label className="text-slate-300 text-sm font-medium">Lieu d'execution</Label>
        <div className="flex flex-wrap gap-2">
          {LIEUX.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ lieu_execution: value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.lieu_execution === value
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04] hover:border-white/[0.1]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
