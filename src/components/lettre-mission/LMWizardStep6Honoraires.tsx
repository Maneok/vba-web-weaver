import { useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const FREQUENCES_FACT = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

const MODES_PAIEMENT = [
  { value: "virement", label: "Virement bancaire" },
  { value: "prelevement", label: "Prelevement SEPA" },
  { value: "cheque", label: "Cheque" },
];

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export default function LMWizardStep6Honoraires({ data, onChange }: Props) {
  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = useMemo(() => Math.round((data.honoraires_ht + tva) * 100) / 100, [data.honoraires_ht, tva]);

  const mensuel = useMemo(() => {
    if (data.frequence_facturation === "MENSUEL") return data.honoraires_ht / 12;
    if (data.frequence_facturation === "TRIMESTRIEL") return data.honoraires_ht / 4;
    return data.honoraires_ht;
  }, [data.honoraires_ht, data.frequence_facturation]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Honoraires et facturation</h2>
        <p className="text-sm text-slate-500">Definissez les conditions financieres de la mission</p>
      </div>

      {/* Montant principal */}
      <div className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-400" />
          <Label className="text-slate-300 text-sm font-medium">Honoraires annuels HT</Label>
        </div>
        <Input
          type="number"
          value={data.honoraires_ht || ""}
          onChange={(e) => onChange({ honoraires_ht: Number(e.target.value) || 0 })}
          className="bg-white/[0.04] border-white/[0.08] text-white text-center text-2xl font-bold max-w-xs mx-auto h-14"
          placeholder="0"
        />
        <div className="flex items-center justify-center gap-6 text-sm">
          <div>
            <span className="text-slate-500">TVA ({data.taux_tva}%) : </span>
            <span className="text-slate-300">{formatEur(tva)}</span>
          </div>
          <div className="w-px h-4 bg-white/[0.1]" />
          <div>
            <span className="text-slate-500">TTC : </span>
            <span className="text-white font-semibold">{formatEur(ttc)}</span>
          </div>
        </div>
        {data.frequence_facturation !== "ANNUEL" && data.honoraires_ht > 0 && (
          <p className="text-xs text-slate-500">
            Soit {formatEur(mensuel)} HT / {data.frequence_facturation === "MENSUEL" ? "mois" : "trimestre"}
          </p>
        )}
      </div>

      {/* Fréquence + échéance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Frequence de facturation</Label>
          <Select value={data.frequence_facturation} onValueChange={(v) => onChange({ frequence_facturation: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCES_FACT.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Echeance (jours)</Label>
          <Select value={String(data.echeance_jours)} onValueChange={(v) => onChange({ echeance_jours: Number(v) })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Comptant</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="45">45 jours</SelectItem>
              <SelectItem value="60">60 jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mode de paiement */}
      <div className="space-y-3">
        <Label className="text-slate-300 text-sm font-medium">Mode de paiement</Label>
        <div className="flex flex-wrap gap-2">
          {MODES_PAIEMENT.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ mode_paiement: value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.mode_paiement === value
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04] hover:border-white/[0.1]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* SEPA fields */}
      {data.mode_paiement === "prelevement" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">IBAN</Label>
            <Input
              value={data.iban}
              onChange={(e) => onChange({ iban: e.target.value })}
              className="bg-white/[0.04] border-white/[0.08] text-white font-mono text-sm"
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">BIC</Label>
            <Input
              value={data.bic}
              onChange={(e) => onChange({ bic: e.target.value })}
              className="bg-white/[0.04] border-white/[0.08] text-white font-mono text-sm"
              placeholder="BNPAFRPPXXX"
            />
          </div>
        </div>
      )}

      {/* Taux horaire complémentaire */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Taux horaire complementaire (€/h HT)</Label>
        <Input
          type="number"
          value={data.taux_horaire_complementaire || ""}
          onChange={(e) => onChange({ taux_horaire_complementaire: Number(e.target.value) || 0 })}
          className="bg-white/[0.04] border-white/[0.08] text-white w-40"
          placeholder="150"
        />
        <p className="text-xs text-slate-500">Pour toute prestation hors perimetre de la lettre de mission</p>
      </div>
    </div>
  );
}
