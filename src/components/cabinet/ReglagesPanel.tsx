import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Eye, FileCheck, RefreshCcw, Globe, Bell, RotateCcw, Shield, Upload, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Reglages {
  id: string;
  cabinet_id: string;
  // Existing booleans
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
  // New fields
  notif_revue_echue: boolean;
  notif_doc_expire: boolean;
  notif_alerte_ouverte: boolean;
  frequence_maj_externe: string;
  email_responsable_alertes: string;
  seuil_score_alerte: number;
  delai_rappel_signature_jours: number;
  auto_archive_lettres_jours: number;
  purge_brouillons_jours: number;
  forcer_2fa: boolean;
  mode_strict_lcb: boolean;
  autoriser_acces_stagiaire_docs: boolean;
  limite_taille_upload_mo: number;
}

interface ToggleConfig {
  key: keyof Reglages;
  label: string;
  description: string;
  critical?: boolean;
}

interface NumericFieldConfig {
  key: keyof Reglages;
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
}

interface SelectFieldConfig {
  key: keyof Reglages;
  label: string;
  description: string;
  options: { value: string; label: string }[];
}

interface SectionConfig {
  title: string;
  icon: React.ReactNode;
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
  toggles: ToggleConfig[];
  numericFields?: NumericFieldConfig[];
  selectFields?: SelectFieldConfig[];
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const SECTIONS: SectionConfig[] = [
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
    icon: <FileCheck className="h-4 w-4 text-emerald-400" />,
    toggles: [
      { key: "bloquer_demandes_validation_incompletes", label: "Bloquer les demandes de validation incompletes", description: "Empeche l'envoi d'une demande de validation si tous les champs obligatoires ne sont pas remplis" },
      { key: "bloquer_validations_incompletes", label: "Bloquer les validations incompletes", description: "Empeche la validation si les documents requis ne sont pas tous presents" },
    ],
  },
  {
    title: "Notifications",
    icon: <Bell className="h-4 w-4 text-cyan-400" />,
    toggles: [
      { key: "limiter_notifications_affectes", label: "Limiter les notifications aux collaborateurs affectes", description: "Seuls les collaborateurs affectes a un dossier recoivent les notifications" },
      { key: "notif_revue_echue", label: "Notification de revue echue", description: "Envoie une alerte quand une revue periodique depasse sa date limite" },
      { key: "notif_doc_expire", label: "Notification document expire", description: "Envoie une alerte quand un document KYC est sur le point d'expirer (30 jours avant)" },
      { key: "notif_alerte_ouverte", label: "Notification alerte ouverte", description: "Envoie une notification pour chaque nouvelle alerte ouverte (sanctions, gel d'avoirs, etc.)" },
    ],
  },
  {
    title: "LCB-FT & Scoring",
    icon: <Shield className="h-4 w-4 text-red-400" />,
    badge: { label: "conformite", variant: "default" },
    toggles: [
      { key: "mode_strict_lcb", label: "Mode strict LCB-FT", description: "Applique les regles de conformite les plus strictes (blocage des dossiers non conformes, alertes renforcees)" },
    ],
    numericFields: [
      { key: "seuil_score_alerte", label: "Score minimum declenchant une alerte automatique", description: "Seuil de score de risque a partir duquel une alerte est generee automatiquement (0-120)", min: 0, max: 120, defaultValue: 60 },
    ],
  },
  {
    title: "Maintiens de mission",
    icon: <RefreshCcw className="h-4 w-4 text-amber-400" />,
    toggles: [
      { key: "generation_auto_maintiens", label: "Generation automatique des maintiens", description: "Genere automatiquement les lettres de maintien a echeance" },
    ],
    numericFields: [
      { key: "delai_rappel_signature_jours", label: "Jours avant rappel de signature", description: "Nombre de jours avant l'envoi automatique d'un rappel de signature (1-90)", min: 1, max: 90, defaultValue: 7 },
    ],
  },
  {
    title: "Documents & GED",
    icon: <Upload className="h-4 w-4 text-indigo-400" />,
    toggles: [
      { key: "autoriser_acces_stagiaire_docs", label: "Autoriser l'acces stagiaire aux documents", description: "Permet aux stagiaires de consulter les documents dans la GED (lecture seule)" },
    ],
    numericFields: [
      { key: "limite_taille_upload_mo", label: "Taille max par fichier (Mo)", description: "Limite la taille maximale d'un fichier televerse dans la GED (1-100 Mo)", min: 1, max: 100, defaultValue: 10 },
    ],
  },
  {
    title: "Mises a jour externes",
    icon: <Globe className="h-4 w-4 text-purple-400" />,
    toggles: [
      { key: "mises_a_jour_externes", label: "Mises a jour automatiques via APIs", description: "Actualise automatiquement les donnees via INPI, Pappers, sanctions et autres connecteurs", critical: true },
    ],
    selectFields: [
      {
        key: "frequence_maj_externe",
        label: "Frequence des mises a jour",
        description: "Periodicite de l'actualisation automatique des donnees externes",
        options: [
          { value: "quotidien", label: "Quotidien" },
          { value: "hebdomadaire", label: "Hebdomadaire" },
          { value: "mensuel", label: "Mensuel" },
          { value: "jamais", label: "Jamais" },
        ],
      },
    ],
  },
  {
    title: "Automatisations & Purge",
    icon: <Clock className="h-4 w-4 text-orange-400" />,
    toggles: [],
    numericFields: [
      { key: "auto_archive_lettres_jours", label: "Archiver auto les LM signees apres X jours", description: "Nombre de jours apres signature avant archivage automatique d'une lettre de mission (0-730)", min: 0, max: 730, defaultValue: 365 },
      { key: "purge_brouillons_jours", label: "Supprimer les brouillons apres X jours", description: "Nombre de jours avant suppression automatique des brouillons non modifies (0-365)", min: 0, max: 365, defaultValue: 90 },
      { key: "delai_suspension_jours", label: "Jours d'inactivite avant suspension", description: "Nombre de jours d'inactivite avant suspension automatique d'un dossier (30-365)", min: 30, max: 365, defaultValue: 90 },
    ],
  },
];

const ALL_TOGGLE_KEYS = SECTIONS.flatMap((s) => s.toggles.map((t) => t.key));

const ALL_NUMERIC_KEYS = SECTIONS.flatMap((s) => (s.numericFields ?? []).map((f) => f.key));

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
  delai_suspension_jours: 90,
  notif_revue_echue: true,
  notif_doc_expire: true,
  notif_alerte_ouverte: true,
  frequence_maj_externe: "hebdomadaire",
  email_responsable_alertes: "",
  seuil_score_alerte: 60,
  delai_rappel_signature_jours: 7,
  auto_archive_lettres_jours: 365,
  purge_brouillons_jours: 90,
  forcer_2fa: false,
  mode_strict_lcb: false,
  autoriser_acces_stagiaire_docs: false,
  limite_taille_upload_mo: 10,
};

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonSettings() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 4 }).map((_, i) => (
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReglagesPanel() {
  const { profile } = useAuth();
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ key: keyof Reglages; value: boolean; label: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Local state for all numeric fields (debounced)
  const [localNumerics, setLocalNumerics] = useState<Record<string, number>>({});
  const numericTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // StrictMode guard to prevent double creation of defaults
  const initRef = useRef(false);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(numericTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load / create
  // ---------------------------------------------------------------------------

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
        if (initRef.current) { setLoading(false); return; }
        initRef.current = true;
        await createDefaults();
        return;
      }

      const reg = data as Reglages;
      setReglages(reg);
      syncLocalNumerics(reg);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur chargement reglages", err);
      toast.error("Erreur lors du chargement des reglages");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncLocalNumerics = (reg: Reglages) => {
    const nums: Record<string, number> = {};
    for (const section of SECTIONS) {
      for (const field of section.numericFields ?? []) {
        const val = reg[field.key];
        nums[field.key as string] = typeof val === "number" ? val : field.defaultValue;
      }
    }
    setLocalNumerics(nums);
  };

  const createDefaults = async () => {
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").eq("id", profile?.cabinet_id).single();
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
      syncLocalNumerics(reg);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur creation reglages", err);
      toast.error("Erreur lors de l'initialisation des reglages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReglages(); }, [loadReglages]);

  // ---------------------------------------------------------------------------
  // Toggle update (with critical confirmation)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Numeric field update (debounced)
  // ---------------------------------------------------------------------------

  const handleNumericChange = (key: string, rawValue: string, min: number, max: number) => {
    const v = parseInt(rawValue);
    if (isNaN(v)) return;
    const clamped = Math.max(min, Math.min(max, v));

    if (v !== clamped) {
      toast.warning(`Valeur ajustee a ${clamped} (limites : ${min}-${max})`);
    }

    setLocalNumerics((prev) => ({ ...prev, [key]: clamped }));

    if (numericTimersRef.current[key]) clearTimeout(numericTimersRef.current[key]);
    numericTimersRef.current[key] = setTimeout(async () => {
      if (!reglages) return;
      const prev = reglages[key as keyof Reglages];
      setReglages({ ...reglages, [key]: clamped });

      const { error } = await supabase
        .from("cabinet_reglages")
        .update({ [key]: clamped })
        .eq("id", reglages.id);

      if (error) {
        toast.error("Erreur lors de la mise a jour");
        return;
      }

      await logAudit({
        action: "MODIFICATION_REGLAGE",
        table_name: "cabinet_reglages",
        record_id: reglages.id,
        old_values: { [key]: prev },
        new_values: { [key]: clamped },
      });
      toast.success("Reglage mis a jour");
    }, 500);
  };

  // ---------------------------------------------------------------------------
  // Select field update (immediate)
  // ---------------------------------------------------------------------------

  const handleSelectChange = async (key: string, value: string) => {
    if (!reglages) return;
    const prev = reglages[key as keyof Reglages];
    setReglages({ ...reglages, [key]: value });

    const { error } = await supabase
      .from("cabinet_reglages")
      .update({ [key]: value })
      .eq("id", reglages.id);

    if (error) {
      setReglages({ ...reglages, [key]: prev });
      toast.error("Erreur lors de la mise a jour");
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
  };

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

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
      const updated = { ...reglages, ...DEFAULT_REGLAGES };
      setReglages(updated);
      syncLocalNumerics(updated);
      toast.success("Reglages reinitialises aux valeurs par defaut");
      setResetOpen(false);
    } catch (err) {
      logger.error("ReglagesPanel", "Erreur reinitialisation", err);
      toast.error("Erreur lors de la reinitialisation");
    } finally {
      setResetting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

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

  const isNumericUnsaved = (key: string): boolean => {
    if (!reglages) return false;
    return localNumerics[key] !== reglages[key as keyof Reglages];
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return <SkeletonSettings />;

  if (!reglages) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-400" /> Reglages du cabinet
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-2">
              {toggleCounts.active}/{toggleCounts.total} actifs
            </span>
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
            Configurez le comportement de votre cabinet. Les modifications sont appliquees immediatement.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
          className="gap-2 border-white/10 text-slate-700 dark:text-slate-300 hover:bg-gray-50/80 dark:bg-white/[0.04]"
          aria-label="Reinitialiser les reglages"
        >
          <RotateCcw className="h-4 w-4" /> Reinitialiser
        </Button>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const hasToggles = section.toggles.length > 0;
        const hasNumeric = (section.numericFields ?? []).length > 0;
        const hasSelect = (section.selectFields ?? []).length > 0;
        if (!hasToggles && !hasNumeric && !hasSelect) return null;

        return (
          <div key={section.title} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
              {section.icon} {section.title}
              {section.badge && (
                <Badge variant={section.badge.variant} className="text-[10px] ml-1">
                  {section.badge.label}
                </Badge>
              )}
            </h3>

            <div className="space-y-1">
              {/* Toggles */}
              {section.toggles.map((toggle) => {
                const value = reglages[toggle.key];
                if (typeof value !== "boolean") return null;
                return (
                  <div
                    key={toggle.key}
                    className={`flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white dark:bg-white/[0.02] transition-colors border border-transparent hover:border-gray-100 dark:border-white/[0.04] ${toggle.critical ? "ring-1 ring-amber-500/10" : ""}`}
                  >
                    <div className="space-y-0.5 flex-1 mr-4">
                      <Label className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-2">
                        {toggle.label}
                        {toggle.critical && (
                          <span className="text-[10px] text-amber-400 font-normal bg-amber-500/10 px-1.5 py-0.5 rounded">critique</span>
                        )}
                      </Label>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{toggle.description}</p>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => updateToggle(toggle.key, checked, toggle.label, toggle.critical)}
                      disabled={updating}
                      aria-label={toggle.label}
                    />
                  </div>
                );
              })}

              {/* Numeric fields */}
              {(section.numericFields ?? []).map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white dark:bg-white/[0.02] transition-colors border border-transparent hover:border-gray-100 dark:border-white/[0.04]"
                >
                  <div className="space-y-0.5 flex-1 mr-4">
                    <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">{field.label}</Label>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{field.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={localNumerics[field.key as string] ?? field.defaultValue}
                      onChange={(e) => handleNumericChange(field.key as string, e.target.value, field.min, field.max)}
                      className="w-20 bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08] text-center"
                      aria-label={field.label}
                    />
                    {field.key === "limite_taille_upload_mo" ? (
                      <span className="text-sm text-slate-400 dark:text-slate-500">Mo</span>
                    ) : field.key === "seuil_score_alerte" ? (
                      <span className="text-sm text-slate-400 dark:text-slate-500">pts</span>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">jours</span>
                    )}
                    {isNumericUnsaved(field.key as string) && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                        non sauvegarde
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Select fields */}
              {(section.selectFields ?? []).map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white dark:bg-white/[0.02] transition-colors border border-transparent hover:border-gray-100 dark:border-white/[0.04]"
                >
                  <div className="space-y-0.5 flex-1 mr-4">
                    <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">{field.label}</Label>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{field.description}</p>
                  </div>
                  <Select
                    value={(reglages[field.key] as string) || field.options[0].value}
                    onValueChange={(val) => handleSelectChange(field.key as string, val)}
                  >
                    <SelectTrigger className="w-44 bg-gray-50 dark:bg-white/[0.03] border-gray-300 dark:border-white/[0.08]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );
      })}

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
