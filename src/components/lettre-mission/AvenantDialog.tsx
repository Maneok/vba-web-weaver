import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Save,
  Eye,
  Loader2,
} from "lucide-react";
import type { LMInstance } from "@/lib/lettreMissionEngine";
import {
  type LMAvenant,
  type AvenantModifications,
  createAvenant,
  getNextAvenantNumero,
  generateAvenantContent,
} from "@/lib/lettreMissionAvenants";
import { DEFAULT_MISSIONS } from "@/lib/lmDefaults";
import { useAuth } from "@/lib/auth/AuthContext";

interface AvenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: LMInstance;
  onCreated: (avenant: LMAvenant) => void;
}

type ModificationType =
  | "honoraires"
  | "ajout_mission"
  | "retrait_mission"
  | "perimetre"
  | "autre";

const MODIFICATION_TYPES: { id: ModificationType; label: string }[] = [
  { id: "honoraires", label: "Modification des honoraires" },
  { id: "ajout_mission", label: "Ajout de mission(s) complémentaire(s)" },
  { id: "retrait_mission", label: "Retrait de mission(s)" },
  { id: "perimetre", label: "Modification du périmètre" },
  { id: "autre", label: "Autre" },
];

export default function AvenantDialog({
  open,
  onOpenChange,
  instance,
  onCreated,
}: AvenantDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [objet, setObjet] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<ModificationType[]>([]);

  // Step 2
  const [nouveauHonoraires, setNouveauHonoraires] = useState("");
  const [missionsAjoutees, setMissionsAjoutees] = useState<string[]>([]);
  const [missionsRetirees, setMissionsRetirees] = useState<string[]>([]);
  const [autresModifications, setAutresModifications] = useState("");
  const [perimetreModification, setPerimetreModification] = useState("");

  // Step 3
  const [previewText, setPreviewText] = useState("");

  // Honoraires actuels depuis le snapshot
  const honorairesActuels = useMemo(() => {
    const vars = instance.variables_resolved ?? {};
    return vars.honoraires || "0";
  }, [instance]);

  // Missions actives dans la LM d'origine
  const missionsActives = useMemo(() => {
    const wd = (instance.wizard_data ?? {}) as Record<string, any>;
    const missions = wd.missions_selected as
      | { section_id: string; label: string; selected: boolean }[]
      | undefined;
    if (!missions) return [];
    return missions.filter((m) => m.selected);
  }, [instance]);

  // Missions non actives (pour ajout)
  const missionsDisponibles = useMemo(() => {
    const activeIds = new Set(missionsActives.map((m) => m.section_id));
    return DEFAULT_MISSIONS.filter(
      (m) => !activeIds.has(m.section_id) && !m.locked
    );
  }, [missionsActives]);

  const toggleType = (type: ModificationType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleMissionAjoutee = (label: string) => {
    setMissionsAjoutees((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const toggleMissionRetiree = (label: string) => {
    setMissionsRetirees((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const buildModifications = (): AvenantModifications => {
    const mods: AvenantModifications = {};
    if (selectedTypes.includes("honoraires") && nouveauHonoraires) {
      mods.honorairesChange = {
        ancien: honorairesActuels,
        nouveau: nouveauHonoraires,
      };
    }
    if (selectedTypes.includes("ajout_mission") && missionsAjoutees.length > 0) {
      mods.missionsAjoutees = missionsAjoutees;
    }
    if (selectedTypes.includes("retrait_mission") && missionsRetirees.length > 0) {
      mods.missionsRetirees = missionsRetirees;
    }
    const extras: string[] = [];
    if (selectedTypes.includes("perimetre") && perimetreModification) {
      extras.push(perimetreModification);
    }
    if (selectedTypes.includes("autre") && autresModifications) {
      extras.push(autresModifications);
    }
    if (extras.length > 0) {
      mods.autresModifications = extras.join("\n\n");
    }
    return mods;
  };

  const handleGoToPreview = () => {
    const mods = buildModifications();
    const text = generateAvenantContent(instance, mods);
    setPreviewText(text);
    setStep(2);
  };

  const handleSave = async () => {
    if (!profile?.cabinet_id) {
      toast.error("Profil non initialisé. Reconnectez-vous.");
      return;
    }
    setSaving(true);
    try {
      const numero = await getNextAvenantNumero(profile.cabinet_id);
      const mods = buildModifications();
      const { data: authData } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();

      const avenant = await createAvenant({
        cabinet_id: profile.cabinet_id,
        instance_id: instance.id,
        numero,
        objet: objet || selectedTypes.map((t) => MODIFICATION_TYPES.find((mt) => mt.id === t)?.label).join(", "),
        sections_modifiees: mods.sectionsModifiees ?? [],
        honoraires_ancien: mods.honorairesChange?.ancien,
        honoraires_nouveau: mods.honorairesChange?.nouveau,
        missions_ajoutees: mods.missionsAjoutees,
        missions_retirees: mods.missionsRetirees,
        autres_modifications: mods.autresModifications,
        status: "brouillon",
        created_by: authData?.user?.id,
      });

      toast.success(`Avenant ${numero} créé avec succès`);
      onCreated(avenant);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création de l'avenant");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setObjet("");
    setSelectedTypes([]);
    setNouveauHonoraires("");
    setMissionsAjoutees([]);
    setMissionsRetirees([]);
    setAutresModifications("");
    setPerimetreModification("");
    setPreviewText("");
  };

  const canProceedStep1 = selectedTypes.length > 0;
  const canProceedStep2 = (() => {
    if (selectedTypes.includes("honoraires") && !nouveauHonoraires) return false;
    if (selectedTypes.includes("ajout_mission") && missionsAjoutees.length === 0) return false;
    if (selectedTypes.includes("retrait_mission") && missionsRetirees.length === 0) return false;
    if (selectedTypes.includes("autre") && !autresModifications) return false;
    return true;
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Créer un avenant — {instance.numero}
          </DialogTitle>
          <DialogDescription>
            Étape {step + 1} / 3
          </DialogDescription>
        </DialogHeader>

        {/* ─── STEP 1: Objet ─── */}
        {step === 0 && (
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="av-objet">Objet de l'avenant (optionnel)</Label>
              <Input
                id="av-objet"
                placeholder="Ex: Modification des honoraires 2026"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Type(s) de modification</Label>
              {MODIFICATION_TYPES.map((type) => (
                <label
                  key={type.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(1)}
                disabled={!canProceedStep1}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Détails ─── */}
        {step === 1 && (
          <div className="space-y-5 pt-2">
            {/* Honoraires */}
            {selectedTypes.includes("honoraires") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Modification des honoraires</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400">Montant actuel (€ HT)</Label>
                    <Input
                      value={honorairesActuels}
                      readOnly
                      className="mt-1 bg-white/[0.02] text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Nouveau montant (€ HT)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 12000"
                      value={nouveauHonoraires}
                      onChange={(e) => setNouveauHonoraires(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ajout missions */}
            {selectedTypes.includes("ajout_mission") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Missions à ajouter</h3>
                {missionsDisponibles.length === 0 ? (
                  <p className="text-xs text-slate-500">Toutes les missions sont déjà actives.</p>
                ) : (
                  <div className="space-y-2">
                    {missionsDisponibles.map((m) => (
                      <label
                        key={m.section_id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.02] cursor-pointer"
                      >
                        <Checkbox
                          checked={missionsAjoutees.includes(m.label)}
                          onCheckedChange={() => toggleMissionAjoutee(m.label)}
                        />
                        <div>
                          <span className="text-sm">{m.label}</span>
                          <p className="text-[10px] text-slate-500">{m.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Retrait missions */}
            {selectedTypes.includes("retrait_mission") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Missions à retirer</h3>
                {missionsActives.filter((m) => !(m as any).locked).length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune mission retirable.</p>
                ) : (
                  <div className="space-y-2">
                    {missionsActives
                      .filter((m) => !(m as any).locked)
                      .map((m) => (
                        <label
                          key={m.section_id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.02] cursor-pointer"
                        >
                          <Checkbox
                            checked={missionsRetirees.includes(m.label)}
                            onCheckedChange={() => toggleMissionRetiree(m.label)}
                          />
                          <span className="text-sm">{m.label}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Périmètre */}
            {selectedTypes.includes("perimetre") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Modification du périmètre</h3>
                <Textarea
                  placeholder="Décrivez les modifications du périmètre..."
                  value={perimetreModification}
                  onChange={(e) => setPerimetreModification(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Autre */}
            {selectedTypes.includes("autre") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Autres modifications</h3>
                <Textarea
                  placeholder="Décrivez les modifications..."
                  value={autresModifications}
                  onChange={(e) => setAutresModifications(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(0)}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Button>
              <Button
                onClick={handleGoToPreview}
                disabled={!canProceedStep2}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" /> Prévisualiser
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Prévisualisation ─── */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={20}
                className="font-mono text-xs leading-relaxed bg-transparent border-0 resize-none focus-visible:ring-0"
              />
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Modifier
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Sauvegarder brouillon
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
