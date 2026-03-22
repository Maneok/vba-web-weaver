import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData, IntervenantMission } from "@/lib/lmWizardTypes";
import { ROLES_MISSION } from "@/lib/lmWizardTypes";
import type { LMModele, LMSection } from "@/lib/lettreMissionModeles";
import { getModeles, validateCnoecCompliance, getModelesForClientType, GRIMY_DEFAULT_SECTIONS } from "@/lib/lettreMissionModeles";
import { CLIENT_TYPES } from "@/lib/lettreMissionTypes";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { QUALITES_DIRIGEANT, DUREES } from "@/lib/lmDefaults";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown, Layers, Eye, EyeOff, Users, Plus, X, UserCheck, Shield } from "lucide-react";

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
  const [showSections, setShowSections] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const referentLcb = collaborateurs.find((c) => c.referentLcb);
  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);
  const clientTypeConfig = CLIENT_TYPES[data.client_type_id || ''] || null;

  // Superviseurs (ADMIN + SUPERVISEUR profiles)
  const [superviseurs, setSuperviseurs] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  useEffect(() => {
    const cabinetId = profile?.cabinet_id;
    if (!cabinetId) return;
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("cabinet_id", cabinetId)
      .eq("is_active", true)
      .in("role", ["ADMIN", "SUPERVISEUR"])
      .order("full_name")
      .then(({ data: rows }) => {
        if (rows) setSuperviseurs(rows as any);
      })
      .catch((e) => logger.warn("LM", "Failed to load superviseurs:", e));
  }, [profile?.cabinet_id]);

  // Active collaborateurs for selectors
  const activeCollabs = useMemo(() => collaborateurs.filter((c) => c.isActive !== false), [collaborateurs]);

  // Handlers for intervenants multi-select
  const addIntervenant = useCallback(() => {
    const liste = [...(data.intervenants_liste || [])];
    liste.push({ collaborateur_id: "", nom: "", role_mission: "" });
    onChange({ intervenants_liste: liste });
  }, [data.intervenants_liste, onChange]);

  const updateIntervenant = useCallback((idx: number, updates: Partial<IntervenantMission>) => {
    const liste = [...(data.intervenants_liste || [])];
    liste[idx] = { ...liste[idx], ...updates };
    onChange({ intervenants_liste: liste });
  }, [data.intervenants_liste, onChange]);

  const removeIntervenant = useCallback((idx: number) => {
    const liste = (data.intervenants_liste || []).filter((_, i) => i !== idx);
    onChange({ intervenants_liste: liste });
  }, [data.intervenants_liste, onChange]);

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
            const filtered = getModelesForClientType(m, data.client_type_id || 'sas_is');
            const defaultModele = filtered.find((mod) => mod.is_default) || filtered[0];
            if (defaultModele) onChange({ modele_id: defaultModele.id });
          }
        }
      })
      .catch((err) => logger.warn("LM", "Failed to load modeles:", err))
      .finally(() => { if (!cancelled) setModelesLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

  // Filter modeles by client type
  const filteredModeles = useMemo(
    () => getModelesForClientType(modeles, data.client_type_id || 'sas_is'),
    [modeles, data.client_type_id]
  );

  // Get selected modele sections
  const selectedModele = useMemo(
    () => filteredModeles.find((m) => m.id === data.modele_id),
    [filteredModeles, data.modele_id]
  );
  const sections = useMemo(
    () => (selectedModele?.sections ?? GRIMY_DEFAULT_SECTIONS) as LMSection[],
    [selectedModele]
  );

  // CNOEC compliance for selected modele
  const cnoecResult = useMemo(() => {
    if (!selectedModele) return null;
    return validateCnoecCompliance(selectedModele.sections, selectedModele.mission_type);
  }, [selectedModele]);

  // Validation warnings
  const validationWarnings = useMemo(() => {
    const warnings: { type: 'error' | 'warning'; message: string }[] = [];
    if (!sections.find(s => s.id === 'honoraires')) {
      warnings.push({ type: 'warning', message: "Le modèle ne contient pas de section Honoraires" });
    }
    if (!selectedModele?.cgv_content || selectedModele.cgv_content.trim().length < 50) {
      warnings.push({ type: 'error', message: "Le modèle n'a pas de Conditions Générales d'Intervention (CGV)" });
    }
    if (cnoecResult && !cnoecResult.valid) {
      for (const w of cnoecResult.warnings.slice(0, 3)) {
        warnings.push({ type: 'warning', message: w.message });
      }
    }
    return warnings;
  }, [sections, selectedModele, cnoecResult]);

  // Count active sections
  const activeSections = sections.filter(s => !s.hidden);
  const totalSections = sections.length;
  const obligatoireSections = sections.filter(s => s.cnoec_obligatoire);
  const activeObligatoire = activeSections.filter(s => s.cnoec_obligatoire);

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
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Modèle de lettre</p>
        </div>
        {modelesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full bg-gray-100 dark:bg-white/[0.06] rounded-lg" />
            <Skeleton className="h-4 w-48 bg-gray-50/80 dark:bg-white/[0.04]" />
          </div>
        ) : filteredModeles.length === 0 ? (
          <div className="p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/[0.06]">
            <p className="text-xs text-muted-foreground">
              Aucun modèle pour les clients {clientTypeConfig?.shortLabel || ''}.
              Le modèle GRIMY par défaut sera utilisé.
            </p>
          </div>
        ) : (
          <Select value={data.modele_id || ""} onValueChange={(val) => onChange({ modele_id: val })}>
            <SelectTrigger className="h-11 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white">
              <SelectValue placeholder="Choisir un modèle..." />
            </SelectTrigger>
            <SelectContent>
              {filteredModeles.map((m) => {
                const cnoec = validateCnoecCompliance(m.sections);
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.nom}</span>
                      {m.is_default && (
                        <Badge className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">Par défaut</Badge>
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

        {/* Modele info + CNOEC badge */}
        {data.modele_id && selectedModele && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-300 dark:text-slate-600">
                {activeSections.length}/{totalSections} sections · Source : {selectedModele.source === "grimy" ? "GRIMY" : selectedModele.source === "import_docx" ? "Import DOCX" : "Copie"}
              </span>
              {cnoecResult?.valid ? (
                <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400 gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> Conforme CNOEC
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[8px] border-orange-500/30 text-orange-400 gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> {cnoecResult?.warnings.length || 0} alerte{(cnoecResult?.warnings.length || 0) > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
              <div className="space-y-1">
                {validationWarnings.map((w, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[10px] ${
                    w.type === 'error'
                      ? 'bg-red-50/60 dark:bg-red-500/[0.06] border border-red-200/60 dark:border-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-orange-50/60 dark:bg-orange-500/[0.06] border border-orange-200/60 dark:border-orange-500/10 text-orange-600 dark:text-orange-400'
                  }`}>
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sections overview (collapsible) */}
            <div className="wizard-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSections(!showSections)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-white dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Sections du modèle
                  </span>
                  <Badge variant="outline" className="text-[9px] border-slate-300 dark:border-white/10">
                    {activeObligatoire.length}/{obligatoireSections.length} obligatoires
                  </Badge>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-400 transition-transform ${showSections ? "rotate-180" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${showSections ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-white/[0.04] space-y-1 pt-2 max-h-[400px] overflow-y-auto">
                  {sections.map((s) => {
                    const isActive = !s.hidden;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-colors ${
                          isActive ? '' : 'opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isActive ? (
                            <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{s.titre}</span>
                          {s.cnoec_obligatoire && (
                            <Badge className="text-[7px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/20 shrink-0">CNOEC</Badge>
                          )}
                          {s.group && (
                            <span className="text-[8px] text-slate-300 dark:text-slate-600 shrink-0">{s.group}</span>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[7px] px-1 shrink-0 ${
                          isActive ? 'border-green-500/30 text-green-500' : 'border-slate-300/30 text-slate-600 dark:text-slate-400'
                        }`}>
                          {isActive ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Duree et renouvellement */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Durée et renouvellement</p>
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
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Renouvellement automatique à échéance</p>
          </div>
          <Switch checked={data.tacite_reconduction} onCheckedChange={(v) => onChange({ tacite_reconduction: v })} />
        </div>

        {data.tacite_reconduction && (
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Préavis (mois)</Label>
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
          <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de début</Label>
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
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de clôture exercice</Label>
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

      {/* Équipe mission */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Équipe mission</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Collaborateur principal (obligatoire) */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Collaborateur principal *
            </Label>
            <Select
              value={data.collaborateur_principal_id || ""}
              onValueChange={(v) => {
                const collab = activeCollabs.find((c) => c.id === v);
                onChange({
                  collaborateur_principal_id: v,
                  collaborateur_principal_nom: collab ? `${collab.nom}` : "",
                });
              }}
            >
              <SelectTrigger className={inputCls}><SelectValue placeholder="Sélectionner le responsable" /></SelectTrigger>
              <SelectContent>
                {activeCollabs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom} — {c.fonction || "Collaborateur"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">Responsable du dossier</p>
          </div>

          {/* Superviseur (optionnel) */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
              <Shield className="w-3 h-3" /> Superviseur
            </Label>
            <Select
              value={data.superviseur_id || ""}
              onValueChange={(v) => {
                const sup = superviseurs.find((s) => s.id === v);
                onChange({
                  superviseur_id: v,
                  superviseur_nom: sup?.full_name || "",
                });
              }}
            >
              <SelectTrigger className={inputCls}><SelectValue placeholder="Aucun superviseur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {superviseurs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email} — {s.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">Valide le dossier (Admin ou Superviseur)</p>
          </div>
        </div>

        {/* Intervenants additionnels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Intervenants additionnels</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addIntervenant}
              className="h-7 text-xs text-blue-400 hover:text-blue-500 gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </Button>
          </div>
          {(data.intervenants_liste || []).length === 0 && (
            <p className="text-[10px] text-slate-300 dark:text-slate-600 italic">Aucun intervenant additionnel</p>
          )}
          {(data.intervenants_liste || []).map((interv, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={interv.collaborateur_id || ""}
                  onValueChange={(v) => {
                    const collab = activeCollabs.find((c) => c.id === v);
                    updateIntervenant(idx, {
                      collaborateur_id: v,
                      nom: collab?.nom || "",
                    });
                  }}
                >
                  <SelectTrigger className={`${inputCls} h-8 text-xs`}><SelectValue placeholder="Collaborateur" /></SelectTrigger>
                  <SelectContent>
                    {activeCollabs
                      .filter((c) => c.id !== data.collaborateur_principal_id && !(data.intervenants_liste || []).some((iv, i) => i !== idx && iv.collaborateur_id === c.id))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nom} — {c.fonction || "Collaborateur"}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <Select
                  value={interv.role_mission || ""}
                  onValueChange={(v) => updateIntervenant(idx, { role_mission: v })}
                >
                  <SelectTrigger className={`${inputCls} h-8 text-xs`}><SelectValue placeholder="Rôle mission" /></SelectTrigger>
                  <SelectContent>
                    {ROLES_MISSION.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => removeIntervenant(idx)}
                className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                aria-label="Supprimer cet intervenant"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-gray-100 dark:border-white/[0.04] pt-3" />

        {/* Legacy intervenants (associe, chef de mission, validateur) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Associé signataire *</Label>
            <Select value={data.associe_signataire} onValueChange={(v) => onChange({ associe_signataire: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Chef de mission</Label>
            <Select value={data.chef_mission} onValueChange={(v) => onChange({ chef_mission: v })}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {collaborateurs.map((c) => <SelectItem key={c.nom} value={c.nom}>{c.nom} — {c.fonction}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Validateur (co-édition)</Label>
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
            <span className="text-xs text-slate-400 dark:text-slate-500">Référent : {data.referent_lcb}</span>
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
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Qualité</Label>
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
                <Label className="text-slate-400 dark:text-slate-500 text-xs">Téléphone</Label>
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
