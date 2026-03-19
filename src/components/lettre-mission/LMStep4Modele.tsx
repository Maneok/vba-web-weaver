import { useState, useEffect, useMemo, useRef } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { LMModele } from "@/lib/lettreMissionModeles";
import { getModeles, validateCnoecCompliance } from "@/lib/lettreMissionModeles";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { QUALITES_DIRIGEANT, DUREES } from "@/lib/lmDefaults";
import { logger } from "@/lib/logger";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMStep4Modele({ data, onChange }: Props) {
  const { collaborateurs } = useAppState();
  const { profile } = useAuth();
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [modelesLoading, setModelesLoading] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const referentLcb = collaborateurs.find((c) => c.referentLcb);
  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  // Load modeles
  useEffect(() => {
    const cabinetId = profile?.cabinet_id;
    if (!cabinetId) return;
    let cancelled = false;
    setModelesLoading(true);
    getModeles(cabinetId)
      .then((m) => {
        if (!cancelled) {
          setModeles(m);
          if (!data.modele_id) {
            const defaultModele = m.find((mod) => mod.is_default);
            if (defaultModele) onChange({ modele_id: defaultModele.id });
          }
        }
      })
      .catch((err) => logger.warn("LM", "Failed to load modeles:", err))
      .finally(() => { if (!cancelled) setModelesLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

  // Auto pre-fill associe and referent LCB on first render
  const autoFillDone = useRef(false);
  useEffect(() => {
    if (autoFillDone.current) return;
    autoFillDone.current = true;
    const updates: Partial<LMWizardData> = {};
    if (!data.associe_signataire && collaborateurs.length > 0) {
      const admin = collaborateurs.find((c) => c.fonction?.toLowerCase().includes("associ"));
      if (admin) updates.associe_signataire = admin.nom;
    }
    if (!data.referent_lcb && referentLcb) {
      updates.referent_lcb = referentLcb.nom;
    }
    if (Object.keys(updates).length > 0) onChange(updates);
  }, [collaborateurs]);

  const validateField = (field: string, value: string) => {
    let error = "";
    if (field === "cp" && value && !/^\d{5}$/.test(value)) error = "Code postal invalide";
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Email invalide";
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const inputCls = "wizard-input";
  const clientInfoFilled = data.dirigeant && data.adresse && data.cp && data.ville;

  return (
    <div className="space-y-6">
      {/* Modele selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400 dark:text-blue-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Modele de lettre</p>
        </div>
        {modelesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full bg-gray-100 dark:bg-white/[0.06] rounded-lg" />
            <Skeleton className="h-4 w-48 bg-gray-50/80 dark:bg-white/[0.04]" />
          </div>
        ) : modeles.length === 0 ? (
          <div className="p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
            <p className="text-xs text-slate-400 dark:text-slate-500">Aucun modele configure — le modele GRIMY par defaut sera utilise.</p>
          </div>
        ) : (
          <Select value={data.modele_id || ""} onValueChange={(val) => onChange({ modele_id: val })}>
            <SelectTrigger className="h-11 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white">
              <SelectValue placeholder="Choisir un modele..." />
            </SelectTrigger>
            <SelectContent>
              {modeles.map((m) => {
                const cnoec = validateCnoecCompliance(m.sections);
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.nom}</span>
                      {m.is_default && (
                        <Badge className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">Defaut</Badge>
                      )}
                      {cnoec.valid ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        {data.modele_id && modeles.length > 0 && (() => {
          const selected = modeles.find((m) => m.id === data.modele_id);
          if (!selected) return null;
          const cnoec = validateCnoecCompliance(selected.sections);
          return (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-300 dark:text-slate-600">
                {selected.sections.length} sections · Source: {selected.source === "grimy" ? "GRIMY" : selected.source === "import_docx" ? "Import DOCX" : "Copie"}
              </span>
              {cnoec.valid ? (
                <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400">Conforme CNOEC</Badge>
              ) : (
                <Badge variant="outline" className="text-[8px] border-orange-500/30 text-orange-400">{cnoec.warnings.length} alerte{cnoec.warnings.length > 1 ? "s" : ""}</Badge>
              )}
            </div>
          );
        })()}
      </div>

      {/* Duree et renouvellement */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Duree et renouvellement</p>
        <div className="grid grid-cols-3 gap-3">
          {DUREES.map((d) => {
            const active = data.duree === d.value;
            return (
              <button
                key={d.value}
                onClick={() => onChange({ duree: d.value })}
                className={`p-4 rounded-xl text-center transition-all duration-200 ${
                  active
                    ? "wizard-select-card wizard-select-active"
                    : "wizard-select-card"
                }`}
              >
                <p className={`text-lg font-bold ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>{d.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{d.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] shadow-sm shadow-gray-100/50 dark:shadow-none">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Tacite reconduction</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Renouvellement automatique a echeance</p>
          </div>
          <Switch checked={data.tacite_reconduction} onCheckedChange={(v) => onChange({ tacite_reconduction: v })} />
        </div>

        {data.tacite_reconduction && (
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Preavis (mois)</Label>
            <Select value={String(data.preavis_mois)} onValueChange={(v) => onChange({ preavis_mois: Number(v) })}>
              <SelectTrigger className={`${inputCls} w-32`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois</SelectItem>
                <SelectItem value="2">2 mois</SelectItem>
                <SelectItem value="3">3 mois</SelectItem>
                <SelectItem value="6">6 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de debut</Label>
          <Input
            type="date"
            lang="fr"
            value={data.date_debut}
            onChange={(e) => onChange({ date_debut: e.target.value })}
            className={`${inputCls} w-48`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de cloture exercice</Label>
            <Input
              type="date"
              lang="fr"
              value={data.date_cloture}
              onChange={(e) => onChange({ date_cloture: e.target.value })}
              className={`${inputCls} w-48`}
            />
          </div>
        </div>
      </div>

      {/* Intervenants */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Intervenants</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Associe signataire *</Label>
            <Select value={data.associe_signataire} onValueChange={(v) => onChange({ associe_signataire: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Chef de mission</Label>
            <Select value={data.chef_mission} onValueChange={(v) => onChange({ chef_mission: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Validateur (co-edition)</Label>
            <Select value={data.validateur} onValueChange={(v) => onChange({ validateur: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Aucun validateur" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">Collaborateur qui validera la lettre avant envoi</p>
          </div>
        </div>
        {data.referent_lcb && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
            <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[9px]">LCB</Badge>
            <span className="text-xs text-slate-400 dark:text-slate-500">Referent : {data.referent_lcb}</span>
          </div>
        )}
      </div>

      {/* Client info (collapsible) */}
      <div className="wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClientInfo(!showClientInfo)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:hover:bg-white/[0.02] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 rounded-t-xl"
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Informations client</p>
            {clientInfoFilled && !showClientInfo && (
              <Badge className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[9px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showClientInfo && clientInfoFilled && (
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">{data.dirigeant} · {data.ville}</span>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showClientInfo ? "rotate-180" : ""}`} />
          </div>
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${showClientInfo ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Dirigeant *</Label>
                <Input value={data.dirigeant} onChange={(e) => onChange({ dirigeant: e.target.value })} className={inputCls} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Qualite</Label>
                <Select value={data.qualite_dirigeant} onValueChange={(v) => onChange({ qualite_dirigeant: v })}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITES_DIRIGEANT.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Adresse *</Label>
              <Input value={data.adresse} onChange={(e) => onChange({ adresse: e.target.value })} className={inputCls} autoComplete="street-address" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Code postal *</Label>
                <Input
                  value={data.cp}
                  onChange={(e) => onChange({ cp: e.target.value })}
                  onBlur={(e) => validateField("cp", e.target.value)}
                  inputMode="numeric" maxLength={5}
                  className={fieldErrors.cp ? `${inputCls} border-red-500/40 ring-1 ring-red-500/20` : inputCls}
                />
                {fieldErrors.cp && <p className="text-xs text-red-400" role="alert">{fieldErrors.cp}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Ville *</Label>
                <Input value={data.ville} onChange={(e) => onChange({ ville: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">RCS</Label>
                <Input value={data.rcs} onChange={(e) => onChange({ rcs: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Email</Label>
                <Input
                  type="email" inputMode="email" autoComplete="email"
                  value={data.email} onChange={(e) => onChange({ email: e.target.value })}
                  onBlur={(e) => validateField("email", e.target.value)}
                  className={fieldErrors.email ? `${inputCls} border-red-500/40 ring-1 ring-red-500/20` : inputCls}
                />
                {fieldErrors.email && <p className="text-xs text-red-400" role="alert">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Telephone</Label>
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
    </div>
  );
}
