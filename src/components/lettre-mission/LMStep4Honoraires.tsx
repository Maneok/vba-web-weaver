import { useState, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { FREQUENCES, MODES_PAIEMENT, FEE_PRESETS, getFeeRange, ECHEANCE_OPTIONS } from "@/lib/lmDefaults";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, CreditCard, FileText, ArrowRight, TrendingUp, Info,
  CalendarDays, CalendarRange, Calendar, Zap,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

function formatMontant(value: string): string {
  const num = value.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  if (!num) return "";
  const parts = num.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.length > 1 ? `${intPart},${parts[1].slice(0, 2)}` : intPart;
}

function formatIBAN(value: string): string {
  return value.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

const PAIEMENT_ICONS: Record<string, React.ReactNode> = {
  virement: <ArrowRight className="w-4 h-4" />,
  prelevement: <CreditCard className="w-4 h-4" />,
  cheque: <FileText className="w-4 h-4" />,
};

const FREQ_ICONS: Record<string, React.ReactNode> = {
  "calendar-days": <CalendarDays className="w-3.5 h-3.5" />,
  "calendar-range": <CalendarRange className="w-3.5 h-3.5" />,
  calendar: <Calendar className="w-3.5 h-3.5" />,
};

export default function LMStep4Honoraires({ data, onChange }: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = useMemo(() => Math.round((data.honoraires_ht + tva) * 100) / 100, [data.honoraires_ht, tva]);

  const periodLabel = data.frequence_facturation === "MENSUEL" ? "mois" : data.frequence_facturation === "TRIMESTRIEL" ? "trimestre" : "an";
  const divisor = data.frequence_facturation === "MENSUEL" ? 12 : data.frequence_facturation === "TRIMESTRIEL" ? 4 : 1;
  const perPeriod = useMemo(
    () => data.honoraires_ht > 0 && divisor > 0 ? Math.round(ttc / divisor * 100) / 100 : 0,
    [ttc, divisor, data.honoraires_ht]
  );

  // (36) Fee range comparison
  const feeRange = useMemo(() => getFeeRange(data.forme_juridique), [data.forme_juridique]);

  // (32) Dynamic slider max
  const sliderMax = useMemo(() => {
    if (data.honoraires_ht > 15000) return Math.ceil(data.honoraires_ht / 5000) * 5000;
    return 15000;
  }, [data.honoraires_ht]);

  const validateField = (field: string, value: any) => {
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

  const inputCls = "bg-white/[0.04] border-white/[0.08] text-white focus:ring-2 focus:ring-blue-500/40";
  const errorCls = "bg-white/[0.04] border-red-500/40 text-white ring-1 ring-red-500/20";

  return (
    <div className="space-y-8">
      {/* ── Grand input montant ── */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <DollarSign className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium">Honoraires annuels HT</span>
        </div>
        <div className="relative max-w-sm sm:max-w-xs mx-auto">
          <Input
            inputMode="decimal"
            aria-label="Montant des honoraires annuels HT en euros"
            value={data.honoraires_ht ? formatMontant(String(data.honoraires_ht)) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[\s\u00a0]/g, "").replace(",", ".");
              const num = Math.max(0, Number(raw) || 0);
              onChange({ honoraires_ht: num });
            }}
            onBlur={() => validateField("honoraires_ht", data.honoraires_ht)}
            className={`${fieldErrors.honoraires_ht ? errorCls : inputCls} text-center text-3xl sm:text-4xl font-bold h-14 sm:h-16 pr-20`}
            placeholder="0"
          />
          <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-slate-500 whitespace-nowrap">€ HT / an</span>
        </div>
        {fieldErrors.honoraires_ht && (
          <p className="text-xs text-red-400 animate-shake">{fieldErrors.honoraires_ht}</p>
        )}

        {/* (31) Fee presets quick buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          {FEE_PRESETS.map((fp) => (
            <button
              key={fp.value}
              onClick={() => onChange({ honoraires_ht: fp.value })}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all active:scale-[0.97] focus:ring-2 focus:ring-blue-500/40 focus:outline-none min-h-[32px] ${
                data.honoraires_ht === fp.value
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:text-slate-300"
              }`}
            >
              <Zap className="w-3 h-3 inline mr-1" />{fp.label}
            </button>
          ))}
        </div>

        {/* (36) Fee range comparison with market average */}
        {feeRange && (
          <div className="max-w-sm mx-auto space-y-1.5">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
              <TrendingUp className="w-3 h-3" />
              <span>Fourchette {feeRange.label} : {formatEur(feeRange.min)} — {formatEur(feeRange.max)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
              {/* Fee range bar */}
              <div
                className="absolute h-full bg-blue-500/20 rounded-full"
                style={{
                  left: `${Math.max(0, (feeRange.min / sliderMax) * 100)}%`,
                  width: `${Math.min(100, ((feeRange.max - feeRange.min) / sliderMax) * 100)}%`,
                }}
              />
              {/* Current value indicator */}
              {data.honoraires_ht > 0 && (
                <div
                  className="absolute top-0 w-1 h-full bg-blue-400 rounded-full"
                  style={{ left: `${Math.min(100, (data.honoraires_ht / sliderMax) * 100)}%` }}
                />
              )}
            </div>
            {data.honoraires_ht > 0 && data.honoraires_ht < feeRange.min && (
              <p className="text-[10px] text-amber-400 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" /> En dessous de la fourchette habituelle
              </p>
            )}
            {data.honoraires_ht > feeRange.max && (
              <p className="text-[10px] text-amber-400 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" /> Au dessus de la fourchette habituelle
              </p>
            )}
          </div>
        )}

        {/* TVA + TTC */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm">
          {data.taux_tva > 0 ? (
            <>
              <div>
                <span className="text-slate-500">TVA {data.taux_tva}% : </span>
                <span className="text-slate-300">{formatEur(tva)}</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/[0.1]" />
              <div>
                <span className="text-slate-500">TTC : </span>
                <span className="text-lg sm:text-xl font-bold text-white">{formatEur(ttc)}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-500 text-center">
              {/* (34) TVA exemption visual */}
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] mr-2">Exonere TVA</Badge>
              TTC = <span className="text-white font-bold">{formatEur(data.honoraires_ht)}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Slider optionnel — (32) dynamic max ── */}
      <div className="px-1 sm:px-2">
        <Slider
          value={[Math.max(500, Math.min(data.honoraires_ht, sliderMax))]}
          onValueChange={([v]) => onChange({ honoraires_ht: v })}
          min={500}
          max={sliderMax}
          step={100}
          className="w-full touch-pan-x"
        />
        <div className="flex justify-between text-xs sm:text-[10px] text-slate-600 mt-2 sm:mt-1">
          <span>500 €</span>
          <span>{new Intl.NumberFormat("fr-FR").format(sliderMax)} €</span>
        </div>
      </div>

      {/* ── Fréquence facturation — enriched ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Frequence de facturation</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {FREQUENCES.map((f) => {
            const active = data.frequence_facturation === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onChange({ frequence_facturation: f.value })}
                className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border-2 text-center transition-all duration-200 active:scale-[0.98] min-h-[60px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <div className={`${active ? "text-blue-400" : "text-slate-500"}`}>
                  {FREQ_ICONS[f.icon] || <Calendar className="w-3.5 h-3.5" />}
                </div>
                <p className={`text-xs sm:text-sm font-semibold ${active ? "text-blue-300" : "text-slate-300"}`}>{f.label}</p>
                <p className="text-[9px] text-slate-500 hidden sm:block">{f.description}</p>
              </button>
            );
          })}
        </div>

        {/* (33) Per-period breakdown card */}
        {data.honoraires_ht > 0 && data.frequence_facturation !== "ANNUEL" && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
            <span className="text-xs text-slate-400">Facture par {periodLabel}</span>
            <span className="text-sm font-bold text-blue-300">{formatEur(perPeriod)} TTC</span>
          </div>
        )}
      </div>

      {/* ── Mode de paiement — enriched ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Mode de paiement</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {MODES_PAIEMENT.map(({ value, label, description }) => {
            const active = data.mode_paiement === value;
            const icon = PAIEMENT_ICONS[value];
            return (
              <button
                key={value}
                onClick={() => onChange({ mode_paiement: value })}
                className={`flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] min-h-[60px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <div className={`${active ? "text-blue-400" : "text-slate-500"}`}>{icon}</div>
                <p className={`text-[10px] sm:text-xs font-medium text-center ${active ? "text-blue-300" : "text-slate-400"}`}>{label}</p>
                <p className="text-[9px] text-slate-500 hidden sm:block text-center">{description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── (37) Echeance selector ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Delai de paiement</p>
        <div className="flex flex-wrap gap-2">
          {ECHEANCE_OPTIONS.map((opt) => {
            const active = data.echeance_jours === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange({ echeance_jours: opt.value })}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all active:scale-[0.97] focus:ring-2 focus:ring-blue-500/40 focus:outline-none min-h-[36px] ${
                  active
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEPA fields — (35) auto-populate IBAN from client ── */}
      {data.mode_paiement === "prelevement" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">IBAN</Label>
            <Input
              value={formatIBAN(data.iban)}
              onChange={(e) => onChange({ iban: e.target.value.replace(/\s/g, "") })}
              onBlur={() => validateField("iban", data.iban)}
              className={`${fieldErrors.iban ? errorCls : inputCls} font-mono text-xs sm:text-sm h-11 sm:h-10`}
              placeholder="FR76 XXXX XXXX..."
              autoComplete="off"
            />
            {fieldErrors.iban && <p className="text-xs text-red-400">{fieldErrors.iban}</p>}
            {!data.iban && (
              <p className="text-[10px] text-slate-600">L'IBAN du client est pre-rempli s'il est renseigne dans sa fiche</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">BIC</Label>
            <Input
              value={data.bic}
              onChange={(e) => onChange({ bic: e.target.value.toUpperCase() })}
              className={`${inputCls} font-mono text-sm`}
              placeholder="BNPAFRPPXXX"
              autoComplete="off"
            />
          </div>
        </div>
      )}

      {/* ── Taux horaire complémentaire ── */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 text-xs">Taux horaire complementaire (EUR/h HT)</Label>
        <Input
          inputMode="decimal"
          value={data.taux_horaire_complementaire > 0 ? String(data.taux_horaire_complementaire) : ""}
          onChange={(e) => onChange({ taux_horaire_complementaire: Math.max(0, Number(e.target.value) || 0) })}
          className={`${inputCls} w-full sm:w-32 h-11 sm:h-10`}
          placeholder="150"
        />
        <p className="text-xs sm:text-[10px] text-slate-600">Pour toute prestation hors perimetre de la lettre de mission</p>
      </div>
    </div>
  );
}
