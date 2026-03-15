import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Eye, CheckSquare, RefreshCcw, FileWarning, Globe, Bell, RotateCcw } from "lucide-react";

interface Reglages {
  id: string;
  cabinet_id: string;
  restreindre_visibilite_affectations: boolean;
  restreindre_visibilite_cabinet: boolean;
  restreindre_validation_responsables: boolean;
  limiter_exports_auteur: boolean;
  limiter_notifications_affectes: boolean;
  bloquer_demandes_validation_incompletes: boolean;
  bloquer_validations_incompletes: boolean;
  generation_auto_maintiens: boolean;
  documents_expires_manquants: boolean;
  mises_a_jour_externes: boolean;
  delai_suspension_jours: number;
  // Notification settings
  email_alertes_critiques: boolean;
  email_resume_hebdo: boolean;
  email_expiration_documents: boolean;
}

interface ToggleConfig {
  key: keyof Reglages;
  label: string;
  description: string;
  critical?: boolean;
}

const SECTIONS: { title: string; icon: React.ReactNode; toggles: ToggleConfig[] }[] = [
  {
    title: "Affectations & Visibilite",
    icon: <Eye className="h-4 w-4 text-blue-400" />,
    toggles: [
      { key: "restreindre_visibilite_affectations", label: "Restreindre la visibilite aux affectations", description: "Les collaborateurs ne voient que les dossiers qui leur sont affectes", critical: true },
      { key: "restreindre_visibilite_cabinet", label: "Restreindre la visibilite au cabinet", description: "Les collaborateurs ne voient que les dossiers de leur cabinet (en multi-cabinet)", critical: true },
      { key: "restreindre_validation_responsables", label: "Restreindre la validation aux responsables", description: "Seuls les responsables de dossier peuvent valider les fiches" },
      { key: "limiter_exports_auteur", label: "Limiter les exports a l'auteur", description: "Seul l'auteur d'un document peut l'exporter" },
    ],
  },
  {
    title: "Demandes de validation",
    icon: <CheckSquare className="h-4 w-4 text-emerald-400" />,
    toggles: [
      { key: "bloquer_demandes_validation_incompletes", label: "Bloquer les demandes de validation incompletes", description: "Empeche l'envoi d'une demande de validation si tous les champs obligatoires ne sont pas remplis" },
      { key: "bloquer_validations_incompletes", label: "Bloquer les validations incompletes", description: "Empeche la validation si les documents requis ne sont pas tous presents" },
      { key: "limiter_notifications_affectes", label: "Limiter les notifications aux collaborateurs affectes", description: "Seuls les collaborateurs affectes a un dossier recoivent les notifications" },
    ],
  },
  {
    title: "Maintiens de mission",
    icon: <RefreshCcw className="h-4 w-4 text-amber-400" />,
    toggles: [
      { key: "generation_auto_maintiens", label: "Generation automatique des maintiens", description: "Genere automatiquement les lettres de maintien a echeance" },
    ],
  },
  {
    title: "Donnees importantes",
    icon: <FileWarning className="h-4 w-4 text-red-400" />,
    toggles: [
      { key: "documents_expires_manquants", label: "Alertes documents expires ou manquants", description: "Envoie des alertes quand des documents KYC arrivent a expiration ou sont manquants" },
    ],
  },
  {
    title: "Mises a jour externes",
    icon: <Globe className="h-4 w-4 text-purple-400" />,
    toggles: [
      { key: "mises_a_jour_externes", label: "Mises a jour automatiques via APIs", description: "Actualise automatiquement les donnees via INPI, Pappers, sanctions et autres connecteurs", critical: true },
    ],
  },
  {
    title: "Notifications",
    icon: <Bell className="h-4 w-4 text-cyan-400" />,
    toggles: [
      { key: "email_alertes_critiques", label: "Alertes critiques par email", description: "Envoie un email pour chaque alerte de niveau critique (sanctions, gel d'avoirs, etc.)" },
      { key: "email_resume_hebdo", label: "Resume hebdomadaire par email", description: "Envoie un email de synthese chaque lundi avec le resume des dossiers en cours et les actions a realiser" },
      { key: "email_expiration_documents", label: "Alerte expiration documents", description: "Envoie un email quand un document KYC est sur le point d'expirer (30 jours avant)" },
    ],
  },
];

const ALL_TOGGLE_KEYS = SECTIONS.flatMap((s) => s.toggles.map((t) => t.key));

const DEFAULT_REGLAGES = {
  restreindre_visibilite_affectations: false,
  restreindre_visibilite_cabinet: true,
  restreindre_validation_responsables: false,
  limiter_exports_auteur: false,
  limiter_notifications_affectes: true,
  bloquer_demandes_validation_incompletes: true,
  bloquer_validations_incompletes: false,
  generation_auto_maintiens: true,
  documents_expires_manquants: true,
  mises_a_jour_externes: true,
  delai_suspension_jours: 180,
  email_alertes_critiques: true,
  email_resume_hebdo: true,
  email_expiration_documents: true,
};

function SkeletonSettings() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="flex items-center justify-between py-3 px-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ReglagesPanel() {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ key: keyof Reglages; value: boolean; label: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Debounce timer for delai_suspension_jours
  const delaiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localDelai, setLocalDelai] = useState<number>(180);

  // #3 - StrictMode guard to prevent double creation of defaults
  const initRef = useRef(false);

  useEffect(() => { return () => { if (delaiTimerRef.current) clearTimeout(delaiTimerRef.current); }; }, []);

  const loadReglages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cabinet_reglages")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Auto-create default reglages (with StrictMode guard)
        if (initRef.current) { setLoading(false); return; }
        initRef.current = true;
        await createDefaults();
        return;
      }

      const reg = data as Reglages;
      setReglages(reg);
      setLocalDelai(reg.delai_suspension_jours);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur chargement reglages", err);
      toast.error("Erreur lors du chargement des reglages");
    } finally {
      setLoading(false);
    }
  }, []);

  const createDefaults = async () => {
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) { setLoading(false); return; }

      const { data: newReg, error } = await supabase
        .from("cabinet_reglages")
        .insert({ cabinet_id: cab.id, ...DEFAULT_REGLAGES })
        .select()
        .single();

      if (error) throw error;

      await logAudit({ action: "INITIALISATION_REGLAGES", table_name: "cabinet_reglages" });
      toast.success("Reglages initialises avec les valeurs par defaut");
      const reg = newReg as Reglages;
      setReglages(reg);
      setLocalDelai(reg.delai_suspension_jours);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur creation reglages", err);
      toast.error("Erreur lors de l'initialisation des reglages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReglages(); }, [loadReglages]);

  // #1 - Audit trail logging for toggle changes
  const doUpdateToggle = async (key: keyof Reglages, value: boolean) => {
    if (!reglages) return;
    setUpdating(true);
    const prev = reglages[key];
    setReglages({ ...reglages, [key]: value });

    const { error } = await supabase
      .from("cabinet_reglages")
      .update({ [key]: value })
      .eq("id", reglages.id);

    if (error) {
      setReglages({ ...reglages, [key]: prev });
      toast.error("Erreur lors de la mise a jour");
      setUpdating(false);
      return;
    }

    await logAudit({
      action: "MODIFICATION_REGLAGE",
      table_name: "cabinet_reglages",
      record_id: reglages.id,
      old_values: { [key]: prev },
      new_values: { [key]: value },
    });

    toast.success("Reglage mis a jour");
    setUpdating(false);
  };

  const updateToggle = (key: keyof Reglages, value: boolean, label: string, critical?: boolean) => {
    if (critical) {
      setConfirmToggle({ key, value, label });
    } else {
      doUpdateToggle(key, value);
    }
  };

  const confirmCriticalToggle = async () => {
    if (!confirmToggle) return;
    await doUpdateToggle(confirmToggle.key, confirmToggle.value);
    setConfirmToggle(null);
  };

  // #2 - Toast warning when delai is clamped
  const handleDelaiChange = (rawValue: string) => {
    const v = parseInt(rawValue);
    if (isNaN(v)) return;
    const clamped = Math.max(30, Math.min(365, v));

    if (v !== clamped) {
      toast.warning(`Valeur ajustee a ${clamped} jours (limites : 30-365)`);
    }

    setLocalDelai(clamped);

    if (delaiTimerRef.current) clearTimeout(delaiTimerRef.current);
    delaiTimerRef.current = setTimeout(async () => {
      if (!reglages) return;
      setReglages({ ...reglages, delai_suspension_jours: clamped });

      const { error } = await supabase
        .from("cabinet_reglages")
        .update({ delai_suspension_jours: clamped })
        .eq("id", reglages.id);

      if (error) {
        toast.error("Erreur lors de la mise a jour du delai");
        return;
      }
      toast.success("Delai mis a jour");
    }, 500);
  };

  const handleReset = async () => {
    if (!reglages) return;
    setResetting(true);
    try {
      const { error } = await supabase
        .from("cabinet_reglages")
        .update(DEFAULT_REGLAGES)
        .eq("id", reglages.id);

      if (error) throw error;

      await logAudit({ action: "REINITIALISATION_REGLAGES", table_name: "cabinet_reglages", record_id: reglages.id });
      setReglages({ ...reglages, ...DEFAULT_REGLAGES });
      setLocalDelai(DEFAULT_REGLAGES.delai_suspension_jours);
      toast.success("Reglages reinitialises aux valeurs par defaut");
      setResetOpen(false);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur reinitialisation", err);
      toast.error("Erreur lors de la reinitialisation");
    } finally {
      setResetting(false);
    }
  };

  // #7 - Count of active/total toggles
  const toggleCounts = useMemo(() => {
    if (!reglages) return { active: 0, total: 0 };
    let active = 0;
    let total = 0;
    for (const key of ALL_TOGGLE_KEYS) {
      const val = reglages[key];
      if (typeof val === "boolean") {
        total++;
        if (val) active++;
      }
    }
    return { active, total };
  }, [reglages]);

  // #6 - Check if delai value differs from saved value
  const delaiUnsaved = reglages ? localDelai !== reglages.delai_suspension_jours : false;

  if (loading) return <SkeletonSettings />;

  // #4 - Retry button in empty state calls loadReglages
  if (!reglages) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Impossible de charger les reglages.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            initRef.current = false;
            loadReglages();
          }}
        >
          Reessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-400" /> Reglages du cabinet
            {/* #7 - Toggle count summary */}
            <span className="text-xs font-normal text-slate-500 ml-2">
              {toggleCounts.active}/{toggleCounts.total} actifs
            </span>
          </h2>
          <p className="text-sm text-slate-400">Configurez le comportement de votre cabinet. Les modifications sont appliquees immediatement.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
          className="gap-2 border-white/10 text-slate-300 hover:bg-white/[0.04]"
          aria-label="Reinitialiser les reglages"
        >
          <RotateCcw className="h-4 w-4" /> Reinitialiser
        </Button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
            {section.icon} {section.title}
          </h3>
          <div className="space-y-1">
            {section.toggles.map((toggle) => {
              // Skip toggles that don't exist in DB (notification fields may not exist yet)
              const value = reglages[toggle.key];
              if (typeof value !== "boolean") return null;
              return (
                <div
                  key={toggle.key}
                  className={`flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.04] ${toggle.critical ? "ring-1 ring-amber-500/10" : ""}`}
                >
                  <div className="space-y-0.5 flex-1 mr-4">
                    <Label className="text-sm font-medium text-slate-200 cursor-pointer flex items-center gap-2">
                      {toggle.label}
                      {toggle.critical && (
                        <span className="text-[10px] text-amber-400 font-normal bg-amber-500/10 px-1.5 py-0.5 rounded">critique</span>
                      )}
                    </Label>
                    <p className="text-xs text-slate-500">{toggle.description}</p>
                  </div>
                  {/* #5 - Disable switch while updating */}
                  <Switch
                    checked={value}
                    onCheckedChange={(checked) => updateToggle(toggle.key, checked, toggle.label, toggle.critical)}
                    disabled={updating}
                    aria-label={toggle.label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Delai suspension */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Suspension</h3>
        <div className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white/[0.02] transition-colors">
          <div className="space-y-0.5 flex-1 mr-4">
            <Label className="text-sm font-medium text-slate-200">Delai de suspension automatique</Label>
            <p className="text-xs text-slate-500">Nombre de jours d'inactivite avant suspension automatique d'un dossier (30-365)</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={30}
              max={365}
              value={localDelai}
              onChange={(e) => handleDelaiChange(e.target.value)}
              className="w-20 bg-white/[0.03] border-white/[0.08] text-center"
              aria-label="Delai de suspension en jours"
            />
            <span className="text-sm text-slate-500">jours</span>
            {/* #6 - Visual indicator for unsaved delai */}
            {delaiUnsaved && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                non sauvegarde
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confirm critical toggle */}
      <Dialog open={!!confirmToggle} onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modification d'un reglage critique</DialogTitle>
            <DialogDescription>
              Vous etes sur le point de {confirmToggle?.value ? "activer" : "desactiver"} le reglage "<strong>{confirmToggle?.label}</strong>".
              Ce reglage a un impact important sur le fonctionnement du cabinet. Voulez-vous continuer ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>Annuler</Button>
            <Button onClick={confirmCriticalToggle}>Confirmer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinitialiser les reglages</DialogTitle>
            <DialogDescription>
              Voulez-vous reinitialiser tous les reglages aux valeurs par defaut ? Les personnalisations actuelles seront perdues.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? "Reinitialisation..." : "Reinitialiser"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
