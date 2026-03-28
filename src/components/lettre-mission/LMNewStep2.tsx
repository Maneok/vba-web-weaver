import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Euro, Info } from "lucide-react";

// ---------------------------------------------------------------------------

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  cabinetTarifs: Record<string, number>;
}

const VOLUMES = [
  "Volume faible (< 20 pièces/mois)",
  "50 factures d'achats et de ventes par mois",
  "100 factures par mois",
  "Volume important (> 300 pièces/mois)",
];

const OUTILS = ["Idépôt", "Inqom", "Pennylane", "Dext", "Email", "Autre"];
const FREQUENCES = [
  { value: "MENSUEL", label: "Mensuellement" },
  { value: "TRIMESTRIEL", label: "Trimestriellement" },
  { value: "ANNUEL", label: "Annuellement" },
];

export default function LMNewStep2({ data, onChange, cabinetTarifs }: Props) {
  const mensualite = data.honoraires_annuels > 0 ? (data.honoraires_annuels / 12).toFixed(2) : "—";

  const updateTarifSocial = (key: keyof LMWizardData["tarifs_sociaux"], val: string) => {
    const num = parseFloat(val);
    onChange({ tarifs_sociaux: { ...data.tarifs_sociaux, [key]: isNaN(num) ? 0 : num } });
  };

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Modalités ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Modalités</h3>
        <div className="border rounded-lg p-4 space-y-4">
          {/* Volume comptable */}
          <div className="space-y-1.5">
            <Label className="text-sm">Volume comptable <span className="text-red-400">*</span></Label>
            <Select value={data.volume_comptable} onValueChange={(v) => onChange({ volume_comptable: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner le volume..." /></SelectTrigger>
              <SelectContent>
                {VOLUMES.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outil transmission */}
          <div className="space-y-1.5">
            <Label className="text-sm">Outil de transmission</Label>
            <Select value={data.outil_transmission} onValueChange={(v) => onChange({ outil_transmission: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {OUTILS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fréquence facturation */}
          <div className="space-y-1.5">
            <Label className="text-sm">Périodicité de facturation</Label>
            <Select value={data.frequence_facturation} onValueChange={(v) => onChange({ frequence_facturation: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {FREQUENCES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Honoraires comptables ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Honoraires comptables</h3>
        <div className="border rounded-lg p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Forfait annuel HT <span className="text-red-400">*</span></Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={100}
                value={data.honoraires_annuels || ""}
                onChange={(e) => onChange({ honoraires_annuels: parseFloat(e.target.value) || 0 })}
                placeholder="3600"
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT / an</span>
            </div>
            {data.honoraires_annuels > 0 && (
              <p className="text-xs text-muted-foreground">
                Mensualité : <span className="font-medium text-foreground">{mensualite} € HT</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Constitution de dossier</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                value={data.forfait_constitution || ""}
                onChange={(e) => onChange({ forfait_constitution: parseFloat(e.target.value) || 0 })}
                placeholder="500"
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Tarifs mission sociale ── */}
      {data.mission_sociale && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Tarifs mission sociale</h3>
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                <Info className="w-3 h-3 mr-1" /> Défauts cabinet
              </Badge>
              <span className="text-[10px] text-muted-foreground">Modifiables pour ce client</span>
            </div>

            {([
              { key: "prix_bulletin" as const, label: "Bulletin de paie", unit: "€ HT / bulletin" },
              { key: "prix_fin_contrat" as const, label: "Solde de tout compte", unit: "€ HT" },
              { key: "prix_coffre_fort" as const, label: "Coffre-fort numérique", unit: "€ HT / salarié / mois" },
              { key: "prix_contrat_simple" as const, label: "Contrat de travail simple", unit: "€ HT" },
              { key: "prix_entree_salarie" as const, label: "Entrée salarié (DPAE)", unit: "€ HT" },
              { key: "prix_attestation_maladie" as const, label: "Attestation maladie", unit: "€ HT" },
              { key: "prix_bordereaux" as const, label: "Bordereaux de charges", unit: "€ HT / mois" },
              { key: "prix_sylae" as const, label: "Déclarations SYLAE", unit: "€ HT / salarié" },
            ]).map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <span className="text-xs flex-1 min-w-0 truncate">{row.label}</span>
                <Input
                  type="number"
                  min={0}
                  value={data.tarifs_sociaux[row.key]}
                  onChange={(e) => updateTarifSocial(row.key, e.target.value)}
                  className="w-20 h-7 text-xs text-right"
                />
                <span className="text-[10px] text-muted-foreground w-28 shrink-0">{row.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: Honoraires juridiques ── */}
      {data.mission_juridique && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Honoraires juridiques</h3>
          <div className="border rounded-lg p-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Honoraires juridiques annuels</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={data.honoraires_juridique || ""}
                  onChange={(e) => onChange({ honoraires_juridique: parseFloat(e.target.value) || 0 })}
                  placeholder="300"
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT / an</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
