import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { LM_STATUTS, computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { sanitizeWizardData } from "@/lib/lmValidation";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
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
}

function buildClientForExport(data: LMWizardData): Client {
  return {
    ref: data.client_ref,
    raisonSociale: data.raison_sociale,
    forme: data.forme_juridique,
    siren: data.siren,
    dirigeant: data.dirigeant,
    adresse: data.adresse,
    cp: data.cp,
    ville: data.ville,
    capital: Number(data.capital) || 0,
    ape: data.ape,
    mail: data.email,
    tel: data.telephone,
    iban: data.iban,
    bic: data.bic,
    etat: "EN_COURS" as any,
    comptable: "",
    mission: data.type_mission as any,
    domaine: "",
    effectif: "",
    dateCreation: "",
    dateReprise: "",
    honoraires: data.honoraires_ht,
    reprise: 0,
    juridique: 0,
    frequence: data.frequence_facturation,
    associe: data.associe_signataire,
    superviseur: data.chef_mission,
    ppe: "NON" as any,
    paysRisque: "NON" as any,
    atypique: "NON" as any,
    distanciel: "NON" as any,
    cash: "NON" as any,
    pression: "NON" as any,
    scoreActivite: 0, scorePays: 0, scoreMission: 0, scoreMaturite: 0, scoreStructure: 0,
    malus: 0, scoreGlobal: 0,
    nivVigilance: "STANDARD" as any,
    dateCreationLigne: "", dateDerniereRevue: "", dateButoir: "",
    etatPilotage: "A JOUR" as any,
    dateExpCni: "",
    statut: "ACTIF" as any,
    be: "",
  };
}

// ── D) Tactile signature canvas ──
function SignatureCanvas({ value, onSave }: { value: string; onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with proper DPR
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2e8f0";

    // Restore existing signature
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.onerror = () => {
        // Silently ignore invalid signature images
      };
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
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
    // Canvas is 2x scaled, so reset transform before clearing
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    onSave("");
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-label="Zone de signature tactile"
          role="img"
          className="w-full h-[140px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <p className="absolute bottom-1.5 left-3 text-[9px] text-slate-600 pointer-events-none">
          Dessinez votre signature
        </p>
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Effacer
      </button>
    </div>
  );
}

export default function LMStep6Export({ data, onChange, onSave, onReset }: Props) {
  const [showSignature, setShowSignature] = useState(false);
  const [emailTo, setEmailTo] = useState(data.email || "");

  // Sync emailTo when data.email changes (e.g. after editing step 3)
  useEffect(() => {
    if (data.email && !emailTo) setEmailTo(data.email);
  }, [data.email]);
  const [showEmail, setShowEmail] = useState(false);
  const lockRef = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // E) Compute annexes with stable memoization
  const annexes = useMemo(() => computeAnnexes(data), [
    data.mode_paiement,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    data.missions_selected?.map((m) => `${m.section_id}:${m.selected}`).join(","),
  ]);
  const annexesKey = annexes.join(",");
  useEffect(() => {
    if ((data.annexes || []).join(",") !== annexesKey) {
      onChange({ annexes });
    }
  }, [annexesKey]);

  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => { if (cooldownTimer.current) clearTimeout(cooldownTimer.current); };
  }, []);

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
      setCooldown(true);
      cooldownTimer.current = setTimeout(() => { lockRef.current = false; setCooldown(false); }, 3000);
    }
  }, []);

  const handlePDF = () => withLock("pdf", async () => {
    const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
    const sanitized = sanitizeWizardData(data);
    const client = buildClientForExport(sanitized);
    const lm = {
      numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
      date: new Date().toLocaleDateString("fr-FR"),
      client,
      cabinet: {
        nom: "Cabinet Expertise Comptable",
        adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "",
      },
      options: {
        genre: "M" as const,
        missionSociale: (data.missions_selected || []).some((m) => m.section_id === "social" && m.selected),
        missionJuridique: (data.missions_selected || []).some((m) => m.section_id === "juridique" && m.selected),
        missionControleFiscal: (data.missions_selected || []).some((m) => m.section_id === "fiscal" && m.selected),
        regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
        tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
        periodicite: data.frequence_facturation,
      },
    };
    await renderLettreMissionPdf(lm);
    toast.success("PDF genere avec succes");
  });

  const handleDOCX = () => withLock("docx", async () => {
    const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
    const sanitized = sanitizeWizardData(data);
    const client = buildClientForExport(sanitized);
    await renderNewLettreMissionDocx({
      sections: DEFAULT_TEMPLATE,
      client,
      genre: "M",
      missions: {
        sociale: (data.missions_selected || []).some((m) => m.section_id === "social" && m.selected),
        juridique: (data.missions_selected || []).some((m) => m.section_id === "juridique" && m.selected),
        fiscal: (data.missions_selected || []).some((m) => m.section_id === "fiscal" && m.selected),
      },
      honoraires: {
        comptable: data.honoraires_ht,
        constitution: 0,
        juridique: 0,
        frequence: (data.frequence_facturation || "MENSUEL") as any,
      },
      cabinet: {
        nom: "Cabinet Expertise Comptable",
        adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "",
      },
      variables: {},
      status: data.statut,
      signatureExpert: data.signature_expert,
      signatureClient: data.signature_client,
    });
    toast.success("DOCX genere avec succes");
  });

  const handleEmail = () => {
    if (!emailTo) {
      toast.error("Adresse email requise");
      return;
    }
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(`Lettre de mission - ${data.raison_sociale}`)}&body=${encodeURIComponent("Veuillez trouver ci-joint la lettre de mission.")}`;
    toast.success("Client email ouvert");
  };

  const handleSave = async () => {
    try {
      await onSave();
      toast.success("Lettre sauvegardee");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate file size (max 500KB)
    if (file.size > 500_000) {
      toast.error("Image trop volumineuse (max 500 Ko)");
      return;
    }
    // Validate file type (no SVG for XSS safety)
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast.error("Format d'image non supporte");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ signature_expert: ev.target?.result as string });
    };
    reader.onerror = () => {
      toast.error("Impossible de lire le fichier");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      {/* Success animation */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center animate-bounce-once">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">{data.raison_sociale}</span> · {data.type_mission}
        </p>
      </div>

      {/* ── Export buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handlePDF}
          disabled={!!generating || cooldown}
          aria-label="Telecharger au format PDF"
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating === "pdf" ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" /> : <FileDown className="w-6 h-6 text-blue-400" />}
          <span className="text-sm font-medium text-slate-300">Telecharger PDF</span>
        </button>

        <button
          onClick={handleDOCX}
          disabled={!!generating || cooldown}
          aria-label="Telecharger au format DOCX"
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating === "docx" ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" /> : <FileText className="w-6 h-6 text-purple-400" />}
          <span className="text-sm font-medium text-slate-300">Telecharger DOCX</span>
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200"
        >
          <Send className="w-6 h-6 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">Envoyer par email</span>
        </button>
      </div>

      {/* Email field */}
      {showEmail && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 text-xs">Adresse email</Label>
            <Input
              type="email"
              inputMode="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white"
              placeholder="client@exemple.fr"
            />
          </div>
          <Button onClick={handleEmail} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </Button>
        </div>
      )}

      {/* ── E) Annexes auto ── */}
      {annexes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-medium text-slate-300">Annexes jointes ({annexes.length})</p>
          </div>
          <div className="space-y-1">
            {annexes.map((id) => (
              <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-400">{ANNEXE_LABELS[id] || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── D) Signature tactile (collapsible) ── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSignature(!showSignature)}
          aria-expanded={showSignature}
          aria-controls="signature-section"
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-300">Signature</p>
            {data.signature_expert && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">OK</Badge>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showSignature ? "rotate-180" : ""}`} />
        </button>
        <div id="signature-section" className={`overflow-hidden transition-all duration-200 ${showSignature ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
            {/* Canvas signature */}
            <div className="pt-3">
              <Label className="text-slate-400 text-xs mb-2 block">Dessiner la signature</Label>
              <SignatureCanvas
                value={data.signature_expert}
                onSave={(dataUrl) => onChange({ signature_expert: dataUrl })}
              />
            </div>

            {/* Or upload image */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Ou charger une image</Label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] cursor-pointer hover:border-white/[0.15] transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-400">
                  {data.signature_expert ? "Signature chargee" : "Cliquez pour charger"}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSignatureUpload} className="hidden" />
              </label>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Date de signature</Label>
              <Input
                type="date"
                value={data.date_signature}
                onChange={(e) => onChange({ date_signature: e.target.value })}
                className="bg-white/[0.04] border-white/[0.08] text-white w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── C) Statut workflow (5 etats) ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Statut</p>
        <div className="flex flex-wrap gap-2">
          {LM_STATUTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ statut: s.value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.statut === s.value ? s.color : "bg-white/[0.02] border-white/[0.06] text-slate-500"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Save + Reset ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 h-11 gap-2">
          <CheckCircle2 className="w-4 h-4" /> Sauvegarder
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 border-white/[0.06] text-slate-400 hover:text-white">
          <RotateCcw className="w-4 h-4" /> Nouvelle lettre
        </Button>
      </div>
    </div>
  );
}
