// ──────────────────────────────────────────────
// Dialog de creation d'avenant — 4 etapes
// OPT 43-50: stepper, changement responsable, send for signature, step 4
// ──────────────────────────────────────────────
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
  Send,
  UserCog,
  Check,
} from "lucide-react";
import type { LMInstance } from "@/lib/lettreMissionEngine";
import {
  type LMAvenant,
  type AvenantModifications,
  createAvenant,
  getNextAvenantNumero,
  generateAvenantContent,
  markAvenantSent,
} from "@/lib/lettreMissionAvenants";
import { sendForSignature } from "@/lib/lettreMissionSignature";
import { DEFAULT_MISSIONS } from "@/lib/lmDefaults";
import { useAuth } from "@/lib/auth/AuthContext";

interface AvenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: LMInstance;
  onCreated: (avenant: LMAvenant) => void;
}

// OPT-47: Added changement_responsable type
type ModificationType =
  | "honoraires"
  | "ajout_mission"
  | "retrait_mission"
  | "perimetre"
  | "changement_responsable"
  | "autre";

const MODIFICATION_TYPES: { id: ModificationType; label: string; icon?: typeof FileText }[] = [
  { id: "honoraires", label: "Modification des honoraires" },
  { id: "ajout_mission", label: "Ajout de mission(s) complementaire(s)" },
  { id: "retrait_mission", label: "Retrait de mission(s)" },
  { id: "changement_responsable", label: "Changement de responsable de dossier", icon: UserCog },
  { id: "perimetre", label: "Modification du perimetre" },
  { id: "autre", label: "Autre" },
];

const TOTAL_STEPS = 4;

// OPT-43: Stepper component
function Stepper({ current, total }: { current: number; total: number }) {
  const labels = ["Objet", "Details", "Apercu", "Actions"];
  return (
    <div className="flex items-center gap-1 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i < current
                  ? "bg-emerald-500 text-white"
                  : i === current
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.06] text-slate-500"
              }`}
            >
              {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] truncate hidden sm:inline ${
                i === current ? "text-white font-medium" : "text-slate-500"
              }`}
            >
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div
              className={`flex-1 h-px mx-1.5 ${
                i < current ? "bg-emerald-500" : "bg-white/[0.06]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AvenantDialog({
  open,
  onOpenChange,
  instance,
  onCreated,
}: AvenantDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);
  const [savedAvenant, setSavedAvenant] = useState<LMAvenant | null>(null);

  // Step 1
  const [objet, setObjet] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<ModificationType[]>([]);

  // Step 2
  const [nouveauHonoraires, setNouveauHonoraires] = useState("");
  const [missionsAjoutees, setMissionsAjoutees] = useState<string[]>([]);
  const [missionsRetirees, setMissionsRetirees] = useState<string[]>([]);
  const [autresModifications, setAutresModifications] = useState("");
  const [perimetreModification, setPerimetreModification] = useState("");
  // OPT-47: Changement responsable
  const [ancienResponsable, setAncienResponsable] = useState("");
  const [nouveauResponsable, setNouveauResponsable] = useState("");

  // Step 3
  const [previewText, setPreviewText] = useState("");

  // Step 4: OPT-48 signature email
  const [signatureEmail, setSignatureEmail] = useState("");
  const [signatureNom, setSignatureNom] = useState("");

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

  // Responsable actuel
  const responsableActuel = useMemo(() => {
    const wd = (instance.wizard_data ?? {}) as Record<string, any>;
    return wd.chef_mission || wd.associe_signataire || "";
  }, [instance]);

  // Pre-fill ancien responsable
  useState(() => {
    if (responsableActuel && !ancienResponsable) {
      setAncienResponsable(responsableActuel);
    }
  });

  // Pre-fill signature info from wizard_data
  useState(() => {
    const wd = (instance.wizard_data ?? {}) as Record<string, any>;
    if (wd.email_client && !signatureEmail) setSignatureEmail(String(wd.email_client));
    if (wd.dirigeant && !signatureNom) setSignatureNom(String(wd.dirigeant));
  });

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
    // OPT-47: Changement responsable
    if (selectedTypes.includes("changement_responsable") && nouveauResponsable) {
      mods.changementResponsable = {
        ancien: ancienResponsable || responsableActuel,
        nouveau: nouveauResponsable,
      };
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

  // OPT-48: Save as brouillon (step 3 or 4)
  const handleSave = async (): Promise<LMAvenant | null> => {
    if (!profile?.cabinet_id) {
      toast.error("Profil non initialise. Reconnectez-vous.");
      return null;
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
        responsable_ancien: mods.changementResponsable?.ancien,
        responsable_nouveau: mods.changementResponsable?.nouveau,
        status: "brouillon",
        created_by: authData?.user?.id,
      });

      toast.success(`Avenant ${numero} cree avec succes`);
      setSavedAvenant(avenant);
      onCreated(avenant);
      return avenant;
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la creation de l'avenant");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // OPT-49: Save + go to step 4 (actions)
  const handleSaveAndContinue = async () => {
    const avenant = await handleSave();
    if (avenant) {
      setStep(3);
    }
  };

  // OPT-50: Send for signature from step 4
  const handleSendForSignature = async () => {
    if (!savedAvenant || !signatureEmail.trim() || !signatureNom.trim()) return;
    setSendingForSignature(true);
    try {
      await sendForSignature(
        instance.id,
        signatureEmail.trim(),
        signatureNom.trim(),
        undefined,
        { avenantId: savedAvenant.id }
      );
      await markAvenantSent(savedAvenant.id);
      toast.success("Avenant envoye pour signature");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi pour signature");
    } finally {
      setSendingForSignature(false);
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
    setAncienResponsable("");
    setNouveauResponsable("");
    setSavedAvenant(null);
    setSignatureEmail("");
    setSignatureNom("");
  };

  const canProceedStep1 = selectedTypes.length > 0;
  const canProceedStep2 = (() => {
    if (selectedTypes.includes("honoraires") && !nouveauHonoraires) return false;
    if (selectedTypes.includes("ajout_mission") && missionsAjoutees.length === 0) return false;
    if (selectedTypes.includes("retrait_mission") && missionsRetirees.length === 0) return false;
    if (selectedTypes.includes("changement_responsable") && !nouveauResponsable) return false;
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
            Creer un avenant — {instance.numero}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Assistant de creation d'avenant en {TOTAL_STEPS} etapes
          </DialogDescription>
        </DialogHeader>

        {/* OPT-43: Stepper */}
        <div className="pb-2 pt-1">
          <Stepper current={step} total={TOTAL_STEPS} />
        </div>

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
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTypes.includes(type.id)
                      ? "border-blue-500/30 bg-blue-500/5"
                      : "border-white/[0.06] hover:bg-white/[0.02]"
                  }`}
                >
                  <Checkbox
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                  />
                  <span className="text-sm">{type.label}</span>
                  {type.id === "changement_responsable" && (
                    <Badge className="ml-auto text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Nouveau</Badge>
                  )}
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
                    <Label className="text-xs text-slate-400">Montant actuel (EUR HT)</Label>
                    <Input
                      value={honorairesActuels}
                      readOnly
                      className="mt-1 bg-white/[0.02] text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Nouveau montant (EUR HT)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 12000"
                      value={nouveauHonoraires}
                      onChange={(e) => setNouveauHonoraires(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {nouveauHonoraires && Number(nouveauHonoraires) > 0 && (
                  <p className="text-[10px] text-slate-500">
                    Variation : {((Number(nouveauHonoraires) - Number(honorairesActuels)) / Number(honorairesActuels) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {/* Ajout missions */}
            {selectedTypes.includes("ajout_mission") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Missions a ajouter</h3>
                {missionsDisponibles.length === 0 ? (
                  <p className="text-xs text-slate-500">Toutes les missions sont deja actives.</p>
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
                <h3 className="text-sm font-semibold">Missions a retirer</h3>
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

            {/* OPT-47: Changement responsable */}
            {selectedTypes.includes("changement_responsable") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-amber-400" />
                  Changement de responsable de dossier
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400">Responsable actuel</Label>
                    <Input
                      value={ancienResponsable || responsableActuel}
                      onChange={(e) => setAncienResponsable(e.target.value)}
                      className="mt-1 bg-white/[0.02] text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Nouveau responsable</Label>
                    <Input
                      placeholder="Nom du nouveau responsable"
                      value={nouveauResponsable}
                      onChange={(e) => setNouveauResponsable(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Périmètre */}
            {selectedTypes.includes("perimetre") && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold">Modification du perimetre</h3>
                <Textarea
                  placeholder="Decrivez les modifications du perimetre..."
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
                  placeholder="Decrivez les modifications..."
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
                <ChevronLeft className="w-4 h-4" /> Precedent
              </Button>
              <Button
                onClick={handleGoToPreview}
                disabled={!canProceedStep2}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4" /> Previsualiser
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
                  onClick={handleSaveAndContinue}
                  disabled={saving}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Sauvegarder
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Actions (OPT-48/49/50) ─── */}
        {step === 3 && (
          <div className="space-y-5 pt-2">
            {/* Success indicator */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Check className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Avenant sauvegarde</p>
                <p className="text-[11px] text-slate-400">
                  {savedAvenant?.numero} — Statut : brouillon
                </p>
              </div>
            </div>

            {/* Send for signature */}
            <div className="space-y-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                Envoyer pour signature
              </h3>
              <p className="text-[11px] text-slate-500">
                Envoyez l'avenant au client pour signature electronique. Un lien securise sera genere.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Nom du signataire</Label>
                  <Input
                    placeholder="Jean DUPONT"
                    value={signatureNom}
                    onChange={(e) => setSignatureNom(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Email du signataire</Label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={signatureEmail}
                    onChange={(e) => setSignatureEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={handleSendForSignature}
                disabled={sendingForSignature || !signatureEmail.trim() || !signatureNom.trim()}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {sendingForSignature ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Envoyer pour signature
              </Button>
            </div>

            {/* Or close */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
