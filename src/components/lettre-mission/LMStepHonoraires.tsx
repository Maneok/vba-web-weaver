import { useState, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { FREQUENCES, MODES_PAIEMENT } from "@/lib/lmDefaults";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard, ArrowRight, FileText, Banknote,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

function formatMontant(value: string): string {
  const num = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const [intPart, decPart] = num.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

function formatIBAN(value: string): string {
  return value.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

const PAIEMENT_ICONS: Record<string, React.ReactNode> = {
  virement: <ArrowRight className="w-5 h-5" />,
  prelevement: <CreditCard className="w-5 h-5" />,
  cheque: <FileText className="w-5 h-5" />,
};

const PAIEMENT_LABELS: Record<string, string> = {
  virement: "Virement",
  prelevement: "Prelevement",
  cheque: "Cheque",
};

export default function LMStepHonoraires({ data, onChange }: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = useMemo(() => Math.round((data.honoraires_ht + tva) * 100) / 100, [data.honoraires_ht, tva]);

  const periodLabel = data.frequence_facturation === "MENSUEL" ? "mois" : data.frequence_facturation === "TRIMESTRIEL" ? "trimestre" : "an";
  const divisor = data.frequence_facturation === "MENSUEL" ? 12 : data.frequence_facturation === "TRIMESTRIEL" ? 4 : 1;
  const perPeriod = data.honoraires_ht > 0 ? Math.round(ttc / divisor * 100) / 100 : 0;

  const validateField = (field: string, value: string | number) => {
    let error = "";
    if (field === "honoraires_ht" && (!value || value <= 0)) error = "Montant requis";
    if (field === "honoraires_ht" && value > 500000) error = "Montant anormalement eleve";
    if (field === "iban" && value) {
      const clean = String(value).replace(/\s/g, "");
      if (clean.length > 0 && (!/^FR\d{2}/.test(clean) || clean.length !== 27)) {
        error = "IBAN francais invalide (27 car., prefixe FR)";
      }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  return (
    <div className="space-y-8">
      {/* ── Grand input montant ── */}
      <div className="text-center space-y-5">
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Honoraires annuels HT</p>

        <div className="relative max-w-xs mx-auto">
          <Input
            inputMode="decimal"
            value={data.honoraires_ht ? formatMontant(String(data.honoraires_ht)) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\s/g, "");
              onChange({ honoraires_ht: Number(raw) || 0 });
            }}
            onBlur={() => validateField("honoraires_ht", data.honoraires_ht)}
            className={`text-center text-4xl font-bold h-16 rounded-2xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06] ${
              fieldErrors.honoraires_ht ? "border-red-400/60 dark:border-red-400/40 ring-1 ring-red-400/20" : ""
            }`}
            placeholder="0"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 font-medium pointer-events-none">€ HT / an</span>
        </div>

        {fieldErrors.honoraires_ht && (
          <p className="text-xs text-red-400" role="alert">{fieldErrors.honoraires_ht}</p>
        )}

        {/* TTC */}
        {data.honoraires_ht > 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {data.taux_tva > 0 ? (
              <>Soit <span className="text-slate-900 dark:text-white font-semibold">{formatEur(ttc)}</span> TTC</>
            ) : (
              <>TVA exoneree — <span className="text-slate-900 dark:text-white font-semibold">{formatEur(data.honoraires_ht)}</span> TTC</>
            )}
          </p>
        )}
      </div>

      {/* ── Frequence de facturation ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Frequence de facturation</p>
        <div className="grid grid-cols-3 gap-3">
          {FREQUENCES.map((f) => {
            const active = data.frequence_facturation === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onChange({ frequence_facturation: f.value })}
                className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                  active
                    ? "border-blue-400 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/[0.08] shadow-sm shadow-blue-100/50 dark:shadow-blue-500/10"
                    : "border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-white/[0.1]"
                }`}
              >
                <p className={`text-sm font-semibold ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                  {f.label}
                </p>
              </button>
            );
          })}
        </div>
        {data.honoraires_ht > 0 && data.frequence_facturation !== "ANNUEL" && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Soit <span className="font-medium text-slate-600 dark:text-slate-300">{formatEur(perPeriod)}</span> TTC / {periodLabel}
          </p>
        )}
      </div>

      {/* ── Mode de paiement ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Mode de paiement</p>
        <div className="grid grid-cols-3 gap-3">
          {(["virement", "prelevement", "cheque"] as const).map((value) => {
            const active = data.mode_paiement === value;
            const icon = PAIEMENT_ICONS[value];
            return (
              <button
                key={value}
                onClick={() => onChange({ mode_paiement: value })}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 ${
                  active
                    ? "border-blue-400 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/[0.08] shadow-sm shadow-blue-100/50 dark:shadow-blue-500/10"
                    : "border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-white/[0.1]"
                }`}
              >
                <div className={active ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}>{icon}</div>
                <p className={`text-xs font-medium ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {PAIEMENT_LABELS[value]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEPA fields (animated) ── */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        data.mode_paiement === "prelevement" ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">IBAN</Label>
            <Input
              value={formatIBAN(data.iban)}
              onChange={(e) => onChange({ iban: e.target.value.replace(/\s/g, "") })}
              onBlur={() => validateField("iban", data.iban)}
              className={`h-12 rounded-xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06] font-mono text-sm ${
                fieldErrors.iban ? "border-red-400/60 ring-1 ring-red-400/20" : ""
              }`}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              autoComplete="off"
            />
            {fieldErrors.iban && <p className="text-xs text-red-400" role="alert">{fieldErrors.iban}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">BIC</Label>
            <Input
              value={data.bic}
              onChange={(e) => onChange({ bic: e.target.value.toUpperCase() })}
              className="h-12 rounded-xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06] font-mono text-sm"
              placeholder="BNPAFRPPXXX"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
