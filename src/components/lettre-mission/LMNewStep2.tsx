import { useCallback } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Euro, Building2, Scale, Briefcase } from "lucide-react";

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

  const updateTarifSocial = useCallback((key: keyof LMWizardData["tarifs_sociaux"], val: string) => {
    const num = parseFloat(val);
    onChange({ tarifs_sociaux: { ...data.tarifs_sociaux, [key]: isNaN(num) ? 0 : num } });
  }, [data.tarifs_sociaux, onChange]);

  return (
    <div className="space-y-6">
      {/* ── MODALITÉS ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10"><FileText className="w-4 h-4 text-blue-400" /></div>
          <h3 className="text-sm font-semibold">Modalités de la mission</h3>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Volume comptable <span className="text-red-400">*</span></Label>
            <Select value={data.volume_comptable} onValueChange={(v) => onChange({ volume_comptable: v })}>
              <SelectTrigger className="h-10 bg-white/50 dark:bg-white/[0.03]"><SelectValue placeholder="Sélectionner le volume..." /></SelectTrigger>
              <SelectContent>{VOLUMES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Outil de transmission</Label>
              <Select value={data.outil_transmission} onValueChange={(v) => onChange({ outil_transmission: v })}>
                <SelectTrigger className="h-10 bg-white/50 dark:bg-white/[0.03]"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{OUTILS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Périodicité facturation</Label>
              <Select value={data.frequence_facturation} onValueChange={(v) => onChange({ frequence_facturation: v })}>
                <SelectTrigger className="h-10 bg-white/50 dark:bg-white/[0.03]"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{FREQUENCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── HONORAIRES COMPTABLES ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10"><Euro className="w-4 h-4 text-emerald-500" /></div>
          <h3 className="text-sm font-semibold">Honoraires comptables</h3>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Forfait annuel HT <span className="text-red-400">*</span></Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="number" min={0} step={100}
                value={data.honoraires_annuels || ""}
                onChange={(e) => onChange({ honoraires_annuels: parseFloat(e.target.value) || 0 })}
                placeholder="3 600" className="pl-10 pr-16 h-11 text-base font-medium bg-white/50 dark:bg-white/[0.03]" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT / an</span>
            </div>
            {data.honoraires_annuels > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
                <span className="text-xs text-emerald-500 font-medium">Mensualité : {mensualite} € HT</span>
                <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/20 to-transparent" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Constitution de dossier</Label>
            <div className="relative">
              <Input type="number" min={0}
                value={data.forfait_constitution || ""}
                onChange={(e) => onChange({ forfait_constitution: parseFloat(e.target.value) || 0 })}
                placeholder="500" className="pr-12 h-10 bg-white/50 dark:bg-white/[0.03]" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TARIFS MISSION SOCIALE ── */}
      {data.mission_sociale && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10"><Scale className="w-4 h-4 text-purple-500" /></div>
            <h3 className="text-sm font-semibold">Tarifs mission sociale</h3>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
            {/* Cabinet tarifs indicator */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-blue-500/[0.06] dark:to-indigo-500/[0.03] border-b border-gray-200/60 dark:border-white/[0.06] flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Tarifs par défaut du cabinet</span>
                <span className="text-[10px] text-muted-foreground ml-2">Modifiables pour ce client</span>
              </div>
            </div>

            <div className="p-3 space-y-1">
              {([
                { key: "prix_bulletin" as const, label: "Bulletin de paie", unit: "/ bulletin" },
                { key: "prix_fin_contrat" as const, label: "Solde de tout compte", unit: "" },
                { key: "prix_coffre_fort" as const, label: "Coffre-fort numérique", unit: "/ salarié / mois" },
                { key: "prix_contrat_simple" as const, label: "Contrat de travail", unit: "" },
                { key: "prix_entree_salarie" as const, label: "Entrée salarié (DPAE)", unit: "" },
                { key: "prix_attestation_maladie" as const, label: "Attestation maladie", unit: "" },
                { key: "prix_bordereaux" as const, label: "Bordereaux charges", unit: "/ mois" },
                { key: "prix_sylae" as const, label: "Déclarations SYLAE", unit: "/ salarié" },
              ]).map((row) => (
                <div key={row.key} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/30 transition-colors">
                  <span className="text-xs flex-1 min-w-0">{row.label}</span>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0}
                      value={data.tarifs_sociaux?.[row.key] ?? 0}
                      onChange={(e) => updateTarifSocial(row.key, e.target.value)}
                      className="w-[70px] h-7 text-xs text-right bg-white/50 dark:bg-white/[0.03] px-2" />
                    <span className="text-[10px] text-muted-foreground w-[72px]">€ HT {row.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HONORAIRES JURIDIQUES ── */}
      {data.mission_juridique && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10"><Briefcase className="w-4 h-4 text-amber-500" /></div>
            <h3 className="text-sm font-semibold">Honoraires juridiques</h3>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-blue-500/[0.06] dark:to-indigo-500/[0.03] border-b border-gray-200/60 dark:border-white/[0.06] flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Tarif par défaut du cabinet</span>
            </div>
            <div className="p-4">
              <div className="relative">
                <Input type="number" min={0}
                  value={data.honoraires_juridique || ""}
                  onChange={(e) => onChange({ honoraires_juridique: parseFloat(e.target.value) || 0 })}
                  placeholder="300" className="pr-16 h-10 bg-white/50 dark:bg-white/[0.03]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€ HT / an</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
