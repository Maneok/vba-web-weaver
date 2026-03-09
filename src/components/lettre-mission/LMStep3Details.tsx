import { useState, useEffect, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { QUALITES_DIRIGEANT, DUREES, CLAUSE_TEMPLATES } from "@/lib/lmDefaults";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, ChevronDown, Calendar, Clock, UserCheck, ShieldCheck,
  FileText, Plus, AlertCircle,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMStep3Details({ data, onChange }: Props) {
  const { collaborateurs } = useAppState();
  const { profile } = useAuth();
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [showClauses, setShowClauses] = useState(false);
  const [showClauseLibrary, setShowClauseLibrary] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const referentLcb = useMemo(() => collaborateurs.find((c) => c.referentLcb), [collaborateurs]);

  // (29) Auto-expand client info if fields are incomplete
  const clientInfoFilled = data.dirigeant && data.adresse && data.cp && data.ville;
  useEffect(() => {
    if (!clientInfoFilled && data.client_id) {
      setShowClientInfo(true);
    }
  }, [clientInfoFilled, data.client_id]);

  // Auto pre-fill associe if not set
  useEffect(() => {
    if (!data.associe_signataire && collaborateurs.length > 0) {
      const admin = collaborateurs.find((c) => {
        const fn = c.fonction?.toLowerCase() || "";
        // (F17) Fix operator precedence — parentheses around && condition
        return fn === "associe" || fn === "associé" || (fn.startsWith("associ") && !fn.includes("associatif"));
      });
      if (admin) onChange({ associe_signataire: admin.nom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.associe_signataire, collaborateurs]);

  useEffect(() => {
    if (!data.referent_lcb && referentLcb) {
      onChange({ referent_lcb: referentLcb.nom });
    }
  }, [data.referent_lcb, referentLcb]);

  const validateField = (field: string, value: any) => {
    let error = "";
    if (field === "cp" && value && !/^\d{5}$/.test(value)) error = "Code postal invalide (5 chiffres)";
    // (F19) Consistent email regex with lmValidation.ts — allows +, subdomains
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) error = "Format email invalide";
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  // (F21) Clear field error when user starts typing (not just on blur)
  const handleFieldChange = (field: string, value: string) => {
    onChange({ [field]: value } as any);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const inputCls = "bg-white/[0.04] border-white/[0.08] text-white focus:ring-2 focus:ring-blue-500/40";
  const errorCls = "bg-white/[0.04] border-red-500/40 text-white ring-1 ring-red-500/20";

  // (28) Required fields progress
  const requiredFields = [
    { key: "dirigeant", label: "Dirigeant", filled: !!data.dirigeant },
    { key: "adresse", label: "Adresse", filled: !!data.adresse },
    { key: "cp", label: "Code postal", filled: !!data.cp && /^\d{5}$/.test(data.cp) },
    { key: "ville", label: "Ville", filled: !!data.ville },
    { key: "associe_signataire", label: "Associe signataire", filled: !!data.associe_signataire },
  ];
  const filledCount = requiredFields.filter((f) => f.filled).length;
  const allFilled = filledCount === requiredFields.length;

  // (26) Insert clause template — (F20) trim whitespace
  const insertClause = (text: string) => {
    const current = (data.clauses_supplementaires || "").trim();
    const newText = current ? `${current}\n\n${text}` : text;
    onChange({ clauses_supplementaires: newText });
    setShowClauseLibrary(false);
  };

  return (
    <div className="space-y-6">
      {/* (28) Required fields progress indicator */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allFilled ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${(filledCount / requiredFields.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {filledCount}/{requiredFields.length} requis
        </span>
        {!allFilled && (
          <span className="text-[10px] text-amber-400/70 hidden sm:inline">
            {requiredFields.filter((f) => !f.filled).map((f) => f.label).join(", ")}
          </span>
        )}
      </div>

      {/* ── Section 1: Client info (collapsible) ── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClientInfo(!showClientInfo)}
          aria-expanded={showClientInfo}
          aria-controls="client-info-section"
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-300">Informations client</p>
            {clientInfoFilled && !showClientInfo ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Complet
              </Badge>
            ) : !clientInfoFilled ? (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] gap-1">
                <AlertCircle className="w-3 h-3" /> Incomplet
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {!showClientInfo && clientInfoFilled && (
              <span className="text-xs text-slate-500 hidden sm:block">{data.dirigeant} · {data.ville}</span>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showClientInfo ? "rotate-180" : ""}`} />
          </div>
        </button>

        <div id="client-info-section" className={`overflow-hidden transition-all duration-200 ${showClientInfo ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  Dirigeant <span className="text-red-400">*</span>
                  {data.dirigeant && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </Label>
                <Input value={data.dirigeant} onChange={(e) => onChange({ dirigeant: e.target.value })} className={inputCls} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Qualite</Label>
                <Select value={data.qualite_dirigeant} onValueChange={(v) => onChange({ qualite_dirigeant: v })}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITES_DIRIGEANT.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs flex items-center gap-1">
                Adresse <span className="text-red-400">*</span>
                {data.adresse && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </Label>
              <Input value={data.adresse} onChange={(e) => onChange({ adresse: e.target.value })} className={inputCls} autoComplete="street-address" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  Code postal <span className="text-red-400">*</span>
                  {data.cp && /^\d{5}$/.test(data.cp) && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </Label>
                <Input
                  value={data.cp} onChange={(e) => handleFieldChange("cp", e.target.value)}
                  onBlur={(e) => validateField("cp", e.target.value)}
                  inputMode="numeric" maxLength={5}
                  className={`${fieldErrors.cp ? errorCls : inputCls} h-11 sm:h-10`}
                />
                {fieldErrors.cp && <p className="text-xs text-red-400">{fieldErrors.cp}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  Ville <span className="text-red-400">*</span>
                  {data.ville && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </Label>
                <Input value={data.ville} onChange={(e) => onChange({ ville: e.target.value })} className={`${inputCls} h-11 sm:h-10`} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-slate-400 text-xs">RCS</Label>
                <Input value={data.rcs} onChange={(e) => onChange({ rcs: e.target.value })} className={`${inputCls} h-11 sm:h-10`} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Email</Label>
                <Input
                  type="email" inputMode="email" autoComplete="email"
                  value={data.email} onChange={(e) => handleFieldChange("email", e.target.value)}
                  onBlur={(e) => validateField("email", e.target.value)}
                  className={fieldErrors.email ? errorCls : inputCls}
                />
                {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Telephone</Label>
                <Input
                  inputMode="tel" autoComplete="tel"
                  value={data.telephone} onChange={(e) => onChange({ telephone: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Durée & renouvellement ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-300">Duree et renouvellement</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {DUREES.map((d) => {
            const active = data.duree === d.value;
            return (
              <button
                key={d.value}
                onClick={() => onChange({ duree: d.value })}
                className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all duration-200 active:scale-[0.98] min-h-[60px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <p className={`text-base sm:text-lg font-bold ${active ? "text-blue-300" : "text-slate-300"}`}>{d.label}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">{d.description}</p>
              </button>
            );
          })}
        </div>

        {/* (25) Date debut with visual */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 text-xs">Date de debut</Label>
            <Input
              type="date"
              value={data.date_debut}
              onChange={(e) => onChange({ date_debut: e.target.value })}
              className={`${inputCls} h-11 sm:h-10`}
            />
          </div>
          {/* (30) Preavis visual timeline */}
          {data.date_debut && (
            <div className="flex-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[10px] text-slate-500 mb-1">Echeancier</p>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-blue-400 font-medium whitespace-nowrap">{new Date(data.date_debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500/40 to-emerald-500/40" />
                <span className="text-emerald-400 font-medium whitespace-nowrap">
                  {/* (F18) Guard against invalid duree or date */}
                  {(() => {
                    const end = new Date(data.date_debut);
                    if (isNaN(end.getTime())) return "—";
                    const years = Math.max(1, parseInt(data.duree) || 1);
                    end.setFullYear(end.getFullYear() + years);
                    return end.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] min-h-[52px]">
          <div className="min-w-0">
            <p className="text-sm text-slate-300">Tacite reconduction</p>
            <p className="text-[11px] sm:text-[10px] text-slate-500">Renouvellement automatique a l'echeance</p>
          </div>
          <Switch checked={data.tacite_reconduction} onCheckedChange={(v) => onChange({ tacite_reconduction: v })} />
        </div>

        {data.tacite_reconduction && (
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Preavis de resiliation</Label>
            <Select value={String(data.preavis_mois)} onValueChange={(v) => onChange({ preavis_mois: Number(v) })}>
              <SelectTrigger className={`${inputCls} w-full sm:w-40 h-11 sm:h-10`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois</SelectItem>
                <SelectItem value="2">2 mois</SelectItem>
                <SelectItem value="3">3 mois (standard)</SelectItem>
                <SelectItem value="6">6 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Section 3: Intervenants — (27) with role icons ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-300">Intervenants</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              Associe signataire <span className="text-red-400">*</span>
              {data.associe_signataire && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            </Label>
            <Select value={data.associe_signataire} onValueChange={(v) => onChange({ associe_signataire: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c, i) => (
                  <SelectItem key={`${c.nom}-${i}`} value={c.nom}>
                    <span className="flex items-center gap-2">
                      <UserCheck className="w-3 h-3 text-slate-500" />
                      {c.nom} — {c.fonction}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Chef de mission</Label>
            <Select value={data.chef_mission} onValueChange={(v) => onChange({ chef_mission: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c, i) => (
                  <SelectItem key={`${c.nom}-${i}`} value={c.nom}>
                    <span className="flex items-center gap-2">
                      <UserCheck className="w-3 h-3 text-slate-500" />
                      {c.nom} — {c.fonction}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-slate-400 text-xs">Validateur (co-edition)</Label>
            <Select value={data.validateur} onValueChange={(v) => onChange({ validateur: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Aucun validateur" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c, i) => (
                  <SelectItem key={`${c.nom}-${i}`} value={c.nom}>
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-slate-500" />
                      {c.nom} — {c.fonction}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-600">Collaborateur qui validera la lettre avant envoi</p>
          </div>
        </div>
        {data.referent_lcb && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">LCB</Badge>
            <span className="text-xs text-slate-400">Referent : {data.referent_lcb}</span>
          </div>
        )}
      </div>

      {/* ── Section 4: Clauses (collapsible) ── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClauses(!showClauses)}
          aria-expanded={showClauses}
          aria-controls="clauses-section"
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-slate-300">Clauses obligatoires</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showClauses ? "rotate-180" : ""}`} />
        </button>

        <div id="clauses-section" className={`overflow-hidden transition-all duration-200 ${showClauses ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04]">
            <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-white/[0.02] mt-3 min-h-[48px]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">LCB-FT</span>
              </div>
              <Switch checked={data.clause_lcbft} disabled />
            </div>
            <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-white/[0.02] min-h-[48px]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">Travail dissimule</span>
              </div>
              <Switch checked={data.clause_travail_dissimule} disabled />
            </div>
            <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-white/[0.02] min-h-[48px]">
              <span className="text-sm text-slate-300">RGPD</span>
              <Switch checked={data.clause_rgpd} onCheckedChange={(v) => onChange({ clause_rgpd: v })} />
            </div>

            {/* (26) Clause templates library */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-slate-400 text-xs">Clauses supplementaires</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClauseLibrary(!showClauseLibrary)}
                  className="text-xs text-blue-400 hover:text-blue-300 h-7 px-2 gap-1"
                >
                  <Plus className="w-3 h-3" /> Modeles
                </Button>
              </div>

              {/* (26) Clause template picker */}
              {showClauseLibrary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] mb-2">
                  {CLAUSE_TEMPLATES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => insertClause(ct.text)}
                      className="flex items-center gap-2 p-2 rounded-lg text-left hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors min-h-[36px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
                    >
                      <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{ct.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <Textarea
                value={data.clauses_supplementaires}
                onChange={(e) => onChange({ clauses_supplementaires: e.target.value })}
                className={`${inputCls} min-h-[80px]`}
                placeholder="Clauses additionnelles... Utilisez le bouton 'Modeles' pour inserer des clauses predefinies."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
