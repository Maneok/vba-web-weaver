import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { LM_STATUTS, computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import { buildClientFromWizardData } from "@/lib/lmUtils";
import { useAuth } from "@/lib/auth/AuthContext";
import { sanitizeWizardData } from "@/lib/lmValidation";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
import { buildVariablesMap, resolveModeleSections } from "@/lib/lettreMissionEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, FileText, Send, CheckCircle2, Upload, RotateCcw, ChevronDown,
  Loader2, Trash2, Paperclip,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  saving?: boolean;
}

// ── D) Tactile signature canvas ──
function SignatureCanvas({ value, onSave }: { value: string; onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const initializedRef = useRef(false);

  // Initialize canvas once + restore signature when value changes externally
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size only on first render
    if (!initializedRef.current) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#334155";
      initializedRef.current = true;
    }

    // Restore existing signature (on mount or when value changes externally)
    if (value && !isDrawing.current) {
      const rect = canvas.getBoundingClientRect();
      const img = new Image();
      img.onload = () => {
        const c = canvas.getContext("2d");
        if (c) c.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave("");
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-dashed border-white/[0.12] bg-white dark:bg-white/[0.02] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-[120px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <p className="absolute bottom-1.5 left-3 text-[9px] text-slate-300 dark:text-slate-600 pointer-events-none">
          Dessinez votre signature
        </p>
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Effacer
      </button>
    </div>
  );
}

export default function LMStep6Export({ data, onChange, onSave, onReset, saving }: Props) {
  const { profile } = useAuth();
  const [showSignature, setShowSignature] = useState(false);
  const [emailTo, setEmailTo] = useState(data.email || "");
  const [showEmail, setShowEmail] = useState(false);
  const lockRef = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Cabinet info from profile (avoids hardcoding)
  const cabinetInfo = useMemo(() => ({
    nom: profile?.full_name ? `Cabinet ${profile.full_name}` : "Cabinet Expertise Comptable",
    adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: profile?.email || "", telephone: "",
  }), [profile?.full_name, profile?.email]);

  // E) Compute annexes
  const annexes = useMemo(() => computeAnnexes(data), [data]);
  const prevAnnexesRef = useRef<string>("");
  useEffect(() => {
    const computed = computeAnnexes(data);
    const key = computed.join(",");
    if (key !== prevAnnexesRef.current) {
      prevAnnexesRef.current = key;
      onChange({ annexes: computed });
    }
  }, [data.missions_selected, data.type_mission, data.mission_type_id, data.clause_travail_dissimule]);

  const withLock = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setGenerating(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation");
    } finally {
      setGenerating(null);
      lockRef.current = false;
    }
  }, []);

  const handlePDF = () => withLock("pdf", async () => {
    const sanitized = sanitizeWizardData(data);

    // If a modele is selected, use modele-based generation
    if (data.modele_id) {
      try {
        const { getModeleById } = await import("@/lib/lettreMissionModeles");
        const { generatePdfFromInstance } = await import("@/lib/lettreMissionPdf");
        const modele = await getModeleById(data.modele_id);
        const varsMap = buildVariablesMap(sanitized as unknown as Record<string, unknown>);
        const missionsSelected = sanitized.missions_selected?.map((m) => ({ section_id: m.section_id, selected: m.selected })) ?? [];
        const resolved = resolveModeleSections(modele.sections, varsMap, missionsSelected);
        generatePdfFromInstance({
          sections_snapshot: resolved,
          cgv_snapshot: modele.cgv_content,
          repartition_snapshot: modele.repartition_taches,
          numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
          status: data.statut,
          mission_type: data.mission_type_id || modele.mission_type || "presentation",
        }, cabinetInfo, { signatureExpert: data.signature_expert, signatureClient: data.signature_client });
        toast.success("PDF genere depuis le modele");
        return;
      } catch (err) {
        // Fallback to legacy
        console.warn("Modele PDF failed, falling back to legacy:", err);
      }
    }

    // Legacy generation
    const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
    const client = buildClientFromWizardData(sanitized);
    const lm = {
      numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
      date: new Date().toLocaleDateString("fr-FR"),
      client,
      cabinet: cabinetInfo,
      options: {
        genre: "M" as const,
        missionSociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        missionJuridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        missionControleFiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
        regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
        tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
        periodicite: data.frequence_facturation,
        missionTypeId: data.mission_type_id || "presentation",
      },
    };
    await renderLettreMissionPdf(lm);
    toast.success("PDF genere avec succes");
  });

  const handleDOCX = () => withLock("docx", async () => {
    const sanitized = sanitizeWizardData(data);

    // If a modele is selected, use modele-based generation
    if (data.modele_id) {
      try {
        const { getModeleById } = await import("@/lib/lettreMissionModeles");
        const { generateDocxFromInstance } = await import("@/lib/lettreMissionDocx");
        const modele = await getModeleById(data.modele_id);
        const varsMap = buildVariablesMap(sanitized as unknown as Record<string, unknown>);
        const missionsSelected = sanitized.missions_selected?.map((m) => ({ section_id: m.section_id, selected: m.selected })) ?? [];
        const resolved = resolveModeleSections(modele.sections, varsMap, missionsSelected);
        await generateDocxFromInstance({
          sections_snapshot: resolved,
          cgv_snapshot: modele.cgv_content,
          repartition_snapshot: modele.repartition_taches,
          numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
          status: data.statut,
          mission_type: data.mission_type_id || modele.mission_type || "presentation",
        }, cabinetInfo);
        toast.success("DOCX genere depuis le modele");
        return;
      } catch (err) {
        console.warn("Modele DOCX failed, falling back to legacy:", err);
      }
    }

    // Legacy generation
    const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
    const client = buildClientFromWizardData(sanitized);
    await renderNewLettreMissionDocx({
      sections: DEFAULT_TEMPLATE,
      client,
      genre: "M",
      missions: {
        sociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        juridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        fiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
      },
      honoraires: {
        comptable: data.honoraires_ht,
        constitution: 0,
        juridique: 0,
        frequence: (data.frequence_facturation || "MENSUEL") as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
      },
      cabinet: cabinetInfo,
      variables: {},
      status: data.statut,
      signatureExpert: data.signature_expert,
      signatureClient: data.signature_client,
      missionTypeId: data.mission_type_id || "presentation",
    });
    toast.success("DOCX genere avec succes");
  });

  const handleEmail = () => {
    if (!emailTo) {
      toast.error("Adresse email requise");
      return;
    }
    window.location.href = `mailto:${emailTo}?subject=Lettre de mission - ${data.raison_sociale}&body=Veuillez trouver ci-joint la lettre de mission.`;
    toast.success("Client email ouvert");
  };

  const handleSave = async () => {
    try {
      await onSave();
    } catch {
      // onSave already shows error toasts
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ signature_expert: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      {/* Success animation */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/15 dark:to-emerald-500/10 flex items-center justify-center animate-bounce-once">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <span className="text-slate-900 dark:text-white font-medium">{data.raison_sociale}</span> · {data.type_mission}
        </p>
      </div>

      {/* ── Export buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handlePDF}
          disabled={!!generating}
          aria-label="Telecharger en PDF"
          className="flex flex-col items-center gap-3 p-5 rounded-xl wizard-select-card hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 disabled:opacity-45 hover:shadow-md hover:shadow-blue-100/50 dark:hover:shadow-blue-500/10"
        >
          {generating === "pdf" ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" /> : <FileDown className="w-6 h-6 text-blue-400" />}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telecharger PDF</span>
        </button>

        <button
          onClick={handleDOCX}
          disabled={!!generating}
          aria-label="Telecharger en DOCX"
          className="flex flex-col items-center gap-3 p-5 rounded-xl wizard-select-card hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 disabled:opacity-45 hover:shadow-md hover:shadow-purple-100/50 dark:hover:shadow-purple-500/10"
        >
          {generating === "docx" ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" /> : <FileText className="w-6 h-6 text-purple-400" />}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telecharger DOCX</span>
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          disabled={!!generating}
          aria-label="Envoyer par email"
          className="flex flex-col items-center gap-3 p-5 rounded-xl wizard-select-card hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 disabled:opacity-45 hover:shadow-md hover:shadow-emerald-100/50 dark:hover:shadow-emerald-500/10"
        >
          <Send className="w-6 h-6 text-emerald-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Envoyer par email</span>
        </button>
      </div>

      {/* Email field */}
      {showEmail && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">Adresse email</Label>
            <Input
              type="email"
              inputMode="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white"
              placeholder="client@exemple.fr"
            />
          </div>
          <Button onClick={handleEmail} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" aria-label="Envoyer l'email">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </Button>
        </div>
      )}

      {/* ── E) Annexes auto ── */}
      {annexes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Annexes jointes ({annexes.length})</p>
          </div>
          <div className="space-y-1">
            {annexes.map((id) => (
              <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{ANNEXE_LABELS[id] || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── D) Signature tactile (collapsible) ── */}
      <div className="wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSignature(!showSignature)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Signature</p>
            {data.signature_expert && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">OK</Badge>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showSignature ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${showSignature ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-white/[0.04]">
            {/* Canvas signature */}
            <div className="pt-3">
              <Label className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs mb-2 block">Dessiner la signature</Label>
              <SignatureCanvas
                value={data.signature_expert}
                onSave={(dataUrl) => onChange({ signature_expert: dataUrl })}
              />
            </div>

            {/* Or upload image */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">Ou charger une image</Label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.02] cursor-pointer hover:border-white/[0.15] transition-colors">
                <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                  {data.signature_expert ? "Signature chargee" : "Cliquez pour charger"}
                </span>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">Date de signature</Label>
              <Input
                type="date"
                lang="fr"
                value={data.date_signature}
                onChange={(e) => onChange({ date_signature: e.target.value })}
                className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── C) Statut workflow (5 etats) ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Statut</p>
        <div className="flex flex-wrap gap-2">
          {LM_STATUTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ statut: s.value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.statut === s.value ? s.color : "bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-white/[0.1] transition-all duration-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Save + Reset ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20 h-11 gap-2 disabled:opacity-50" aria-label="Sauvegarder la lettre de mission">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Sauvegarder
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 border-gray-200 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white" aria-label="Commencer une nouvelle lettre de mission">
          <RotateCcw className="w-4 h-4" /> Nouvelle lettre
        </Button>
      </div>
    </div>
  );
}
