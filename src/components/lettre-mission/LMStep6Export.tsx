import { useState, useRef, useCallback, useEffect } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { LM_STATUTS, computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, Send, CheckCircle2, Upload, ChevronDown,
  Loader2, Trash2, Paperclip, FileText, Save, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [showSignature, setShowSignature] = useState(false);
  const [emailTo, setEmailTo] = useState(data.email || "");
  const [showEmail, setShowEmail] = useState(false);
  const lockRef = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // E) Compute annexes
  const prevAnnexesRef = useRef<string>("");
  useEffect(() => {
    const computed = computeAnnexes(data);
    const key = computed.join(",");
    if (key !== prevAnnexesRef.current) {
      prevAnnexesRef.current = key;
      onChange({ annexes: computed });
    }
  }, [data.missions_selected, data.type_mission, data.mission_type_id, data.clause_travail_dissimule]);

  const annexes = data.annexes || [];

  const withLock = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setGenerating(key);
    try {
      await fn();
    } catch (e: any) {
      console.error(`[${key.toUpperCase()}] Generation error:`, e);
      const msg = e?.message || "Erreur inconnue";
      toast.error(`Erreur ${key.toUpperCase()} : ${msg}`, { duration: 8000 });
    } finally {
      setGenerating(null);
      lockRef.current = false;
    }
  }, []);

  // ── Generate via Edge Function (generate-lm) ──
  const handleGenerate = () => withLock("docx", async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Session expirée, veuillez vous reconnecter");
      return;
    }

    // Build complementary missions list
    const missionsComp: string[] = [];
    if (data.missions_selected?.some((m) => m.section_id === "social" && m.selected)) missionsComp.push("sociale");
    if (data.missions_selected?.some((m) => m.section_id === "juridique" && m.selected)) missionsComp.push("juridique");
    if (data.missions_selected?.some((m) => m.section_id === "fiscal" && m.selected)) missionsComp.push("controle_fiscal");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lm`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: data.client_id,
          lettre_mission_id: null,
          volume_comptable: data.volume_comptable,
          outil_transmission: data.outil_transmission || "",
          missions_complementaires: missionsComp,
          option_controle_fiscal: data.option_controle_fiscal || "none",
          honoraires: {
            annuel: `${data.honoraires_ht} €`,
            setup: data.forfait_constitution ? `${data.forfait_constitution} €` : "",
            juridique: data.honoraires_juridique ? `${data.honoraires_juridique} €` : "",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || "Erreur lors de la génération");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LDM_${data.numero_lettre || "DRAFT"}_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Lettre de mission générée avec succès !");
  });

  // TODO C9: Remplacer mailto par envoi email via Supabase Edge Function (avec PDF en pièce jointe)
  const handleEmail = () => {
    if (!emailTo) {
      toast.error("Adresse email requise");
      return;
    }
    window.location.href = `mailto:${emailTo}?subject=Lettre de mission - ${data.raison_sociale}&body=Veuillez trouver ci-joint la lettre de mission.`;
    toast.success("Client email ouvert");
  };

  // TODO C10: Export ZIP (PDF + DOCX + annexes) via JSZip

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
        <p className="text-sm text-slate-400 dark:text-slate-500">
          <span className="text-slate-900 dark:text-white font-medium">{data.raison_sociale}</span> · {data.type_mission}
        </p>
      </div>

      {/* ── Export: principal + secondaire ── */}
      <div className="space-y-4">
        {/* Bouton principal */}
        <button
          onClick={handleGenerate}
          disabled={!!generating || !data.volume_comptable}
          className="w-full flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100/60 dark:hover:bg-blue-500/15 transition-all duration-200 disabled:opacity-50"
        >
          {generating === "docx" ? (
            <Loader2 className="w-6 h-6 text-blue-500 dark:text-blue-400 animate-spin" />
          ) : (
            <FileDown className="w-6 h-6 text-blue-500 dark:text-blue-400" />
          )}
          <div className="text-left">
            <span className="text-base font-medium text-slate-900 dark:text-white">Générer la lettre de mission</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">Document Word conforme à votre modèle</p>
          </div>
        </button>

        {/* Validation message si volume_comptable manquant */}
        {!data.volume_comptable && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Veuillez renseigner le volume comptable à l'étape précédente
          </p>
        )}

        {/* Actions secondaires */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowEmail(!showEmail)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all"
          >
            <Send className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Envoyer par email</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Sauvegarder</span>
          </button>
        </div>
      </div>

      {/* Email field */}
      {showEmail && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Adresse email</Label>
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
                <span className="text-xs text-slate-400 dark:text-slate-500">{ANNEXE_LABELS[id] || id}</span>
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
              <Label className="text-slate-400 dark:text-slate-500 text-xs mb-2 block">Dessiner la signature</Label>
              <SignatureCanvas
                value={data.signature_expert}
                onSave={(dataUrl) => onChange({ signature_expert: dataUrl })}
              />
            </div>

            {/* Or upload image */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Ou charger une image</Label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.02] cursor-pointer hover:border-white/[0.15] transition-colors">
                <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {data.signature_expert ? "Signature chargee" : "Cliquez pour charger"}
                </span>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de signature</Label>
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
        <Button variant="outline" onClick={onReset} className="gap-2 border-gray-200 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-white" aria-label="Commencer une nouvelle lettre de mission">
          <RotateCcw className="w-4 h-4" /> Nouvelle lettre
        </Button>
      </div>
    </div>
  );
}
