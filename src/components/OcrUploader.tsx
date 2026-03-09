import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, XCircle, FileText, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { validateIBAN } from "@/lib/ibanValidator";
import { logger } from "@/lib/logger";

// ====== TYPES ======

export interface OcrCniResult {
  nom: string | null;
  prenom: string | null;
  dateNaissance: string | null;
  lieuNaissance: string | null;
  dateExpiration: string | null;
  numeroDocument: string | null;
  sexe: string | null;
  nationalite: string | null;
}

export interface OcrRibResult {
  iban: string | null;
  bic: string | null;
  titulaire: string | null;
  banque: string | null;
  domiciliation: string | null;
}

export interface OcrKbisResult {
  siren: string | null;
  siret: string | null;
  denomination: string | null;
  formeJuridique: string | null;
  capital: number | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  activite: string | null;
  dateImmatriculation: string | null;
  dirigeant: string | null;
  rcs: string | null;
}

type OcrMode = "cni" | "rib" | "kbis";
type OcrResult = OcrCniResult | OcrRibResult | OcrKbisResult;

interface OcrUploaderProps {
  mode: OcrMode;
  onExtracted?: (data: OcrResult, mode: OcrMode) => void;
  clientSiren?: string; // For Kbis SIREN cross-check
  compact?: boolean;
  label?: string;
}

const MODE_CONFIG: Record<OcrMode, { label: string; icon: React.ReactNode; accept: string; description: string }> = {
  cni: {
    label: "CNI / Pièce d'identité",
    icon: <CreditCard className="w-5 h-5" />,
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    description: "Glissez ou sélectionnez une photo de CNI",
  },
  rib: {
    label: "RIB bancaire",
    icon: <FileText className="w-5 h-5" />,
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    description: "Glissez ou sélectionnez une image de RIB",
  },
  kbis: {
    label: "Extrait Kbis",
    icon: <Building2 className="w-5 h-5" />,
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    description: "Glissez ou sélectionnez un Kbis scanné",
  },
};

// ====== FILE VALIDATION ======
const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_OCR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function validateOcrFile(file: File): string | null {
  if (file.size > MAX_OCR_FILE_SIZE) {
    return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 10 Mo.`;
  }
  if (!ALLOWED_OCR_TYPES.has(file.type)) {
    return `Type de fichier non autorisé (${file.type || "inconnu"}). Formats acceptés : JPG, PNG, WebP, PDF.`;
  }
  if (/\.\./.test(file.name) || /[/\\]/.test(file.name)) {
    return "Nom de fichier invalide.";
  }
  return null;
}

// ====== HELPERS ======

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function daysExpired(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const expDate = new Date(dateStr);
  if (isNaN(expDate.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - expDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ====== COMPONENT ======

export default function OcrUploader({ mode, onExtracted, clientSiren, compact, label }: OcrUploaderProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [extracted, setExtracted] = useState<OcrResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [alerts, setAlerts] = useState<Array<{ type: "error" | "warning" | "info"; message: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = MODE_CONFIG[mode];

  const processFile = useCallback(
    async (file: File) => {
      setStatus("loading");
      setExtracted(null);
      setErrorMsg("");
      setAlerts([]);
      setFileName(file.name);

      // Validate file before processing
      const validationError = validateOcrFile(file);
      if (validationError) {
        setStatus("error");
        setErrorMsg(validationError);
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || "image/jpeg";

        const { data, error } = await supabase.functions.invoke("ocr-document", {
          body: { imageBase64: base64, mimeType, mode },
        });

        if (error) throw new Error(error.message);

        const result = data?.extracted;
        if (!result) {
          setStatus("error");
          setErrorMsg("Extraction automatique impossible — saisie manuelle");
          return;
        }

        setExtracted(result);
        setStatus("success");

        // Post-extraction checks
        const newAlerts: Array<{ type: "error" | "warning" | "info"; message: string }> = [];

        if (mode === "cni") {
          const cniData = result as OcrCniResult;
          // Check document expiration (idée 26)
          const expired = daysExpired(cniData.dateExpiration);
          if (expired !== null && expired > 0) {
            newAlerts.push({
              type: "error",
              message: `CNI expirée depuis ${expired} jour${expired > 1 ? "s" : ""}`,
            });
          } else if (expired !== null && expired <= 0 && expired > -90) {
            newAlerts.push({
              type: "warning",
              message: `CNI expire dans ${Math.abs(expired)} jour${Math.abs(expired) > 1 ? "s" : ""}`,
            });
          }
        }

        if (mode === "rib") {
          const ribData = result as OcrRibResult;
          // IBAN validation (idée 8)
          if (ribData.iban) {
            const validation = validateIBAN(ribData.iban);
            if (!validation.valid) {
              newAlerts.push({ type: "error", message: `IBAN invalide : ${validation.error}` });
            } else if (validation.bankName) {
              newAlerts.push({ type: "info", message: `Banque détectée : ${validation.bankName}` });
            }
          }
        }

        if (mode === "kbis") {
          const kbisData = result as OcrKbisResult;
          // SIREN cross-check (idée 25)
          if (clientSiren && kbisData.siren) {
            const cleanClient = clientSiren.replace(/\s/g, "");
            const cleanKbis = kbisData.siren.replace(/\s/g, "");
            if (cleanClient !== cleanKbis) {
              newAlerts.push({
                type: "error",
                message: `SIREN du Kbis (${kbisData.siren}) ne correspond pas au SIREN du client (${clientSiren})`,
              });
            } else {
              newAlerts.push({ type: "info", message: "SIREN vérifié — correspondance OK" });
            }
          }
        }

        setAlerts(newAlerts);
        onExtracted?.(result, mode);
      } catch (err) {
        setStatus("error");
        setErrorMsg("Extraction automatique impossible — saisie manuelle");
        logger.error("OCR", "OCR extraction error", err);
      }
    },
    [mode, clientSiren, onExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleValidate = useCallback(() => {
    if (extracted && onExtracted) {
      onExtracted(extracted, mode);
    }
  }, [extracted, mode, onExtracted]);

  const reset = useCallback(() => {
    setStatus("idle");
    setExtracted(null);
    setErrorMsg("");
    setAlerts([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ====== RENDER ======

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => status !== "loading" && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-${compact ? "3" : "6"} text-center cursor-pointer transition-all
          ${dragOver ? "border-blue-400 bg-blue-500/10" : "border-white/10 hover:border-white/20 bg-white/[0.02]"}
          ${status === "loading" ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          onChange={handleFileChange}
          className="hidden"
        />

        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <span className="text-sm text-blue-400">Analyse OCR en cours...</span>
            {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              {config.icon}
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-sm text-slate-400">{label || config.description}</span>
            <span className="text-xs text-slate-600">JPG, PNG ou PDF</span>
          </div>
        )}
      </div>

      {/* Alerts (expiration, IBAN, SIREN mismatch) */}
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            alert.type === "error"
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : alert.type === "warning"
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
          }`}
        >
          {alert.type === "error" ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : alert.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{alert.message}</span>
        </div>
      ))}

      {/* Error state */}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto text-xs">
            Réessayer
          </Button>
        </div>
      )}

      {/* Extracted data display */}
      {status === "success" && extracted && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Données extraites</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[10px]">OCR auto</Badge>
              {fileName && <span className="text-[10px] text-slate-600">{fileName}</span>}
            </div>
          </div>

          {mode === "cni" && <CniDataDisplay data={extracted as OcrCniResult} />}
          {mode === "rib" && <RibDataDisplay data={extracted as OcrRibResult} />}
          {mode === "kbis" && <KbisDataDisplay data={extracted as OcrKbisResult} />}

          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleValidate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Valider et remplir
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-slate-400">
              Nouveau scan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== DATA DISPLAY SUB-COMPONENTS ======

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${value ? "text-slate-200" : "text-slate-600"}`}>{value || "—"}</span>
    </div>
  );
}

function CniDataDisplay({ data }: { data: OcrCniResult }) {
  const expired = daysExpired(data.dateExpiration);
  return (
    <div className="space-y-1 mt-2">
      <DataRow label="Nom" value={data.nom} />
      <DataRow label="Prénom" value={data.prenom} />
      <DataRow label="Date de naissance" value={formatDateDisplay(data.dateNaissance)} />
      <DataRow label="Lieu de naissance" value={data.lieuNaissance} />
      <DataRow label="N° document" value={data.numeroDocument} />
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Date expiration</span>
        <span
          className={`font-mono ${
            expired !== null && expired > 0 ? "text-red-400 font-semibold" : "text-slate-200"
          }`}
        >
          {formatDateDisplay(data.dateExpiration)}
          {expired !== null && expired > 0 && " (EXPIRÉE)"}
        </span>
      </div>
    </div>
  );
}

function RibDataDisplay({ data }: { data: OcrRibResult }) {
  const ibanValidation = data.iban ? validateIBAN(data.iban) : null;
  return (
    <div className="space-y-1 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">IBAN</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-200">{data.iban || "—"}</span>
          {ibanValidation && (
            <Badge
              className={`text-[9px] border-0 ${
                ibanValidation.valid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              {ibanValidation.valid ? "Valide" : "Invalide"}
            </Badge>
          )}
        </div>
      </div>
      <DataRow label="BIC" value={data.bic} />
      <DataRow label="Titulaire" value={data.titulaire} />
      <DataRow label="Banque" value={data.banque || ibanValidation?.bankName} />
      <DataRow label="Domiciliation" value={data.domiciliation} />
    </div>
  );
}

function KbisDataDisplay({ data }: { data: OcrKbisResult }) {
  return (
    <div className="space-y-1 mt-2">
      <DataRow label="SIREN" value={data.siren} />
      <DataRow label="Dénomination" value={data.denomination} />
      <DataRow label="Forme juridique" value={data.formeJuridique} />
      <DataRow label="Capital" value={data.capital ? `${data.capital.toLocaleString("fr-FR")} €` : null} />
      <DataRow label="Adresse" value={data.adresse} />
      <DataRow label="Ville" value={data.ville} />
      <DataRow label="Activité" value={data.activite} />
      <DataRow label="Dirigeant" value={data.dirigeant} />
      <DataRow label="Immatriculation" value={formatDateDisplay(data.dateImmatriculation)} />
    </div>
  );
}
