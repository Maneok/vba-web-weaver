import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/types";
import {
  DEFAULT_TEMPLATE,
  replaceTemplateVariables,
  type TemplateSection,
} from "@/lib/lettreMissionTemplate";
import LettreMissionA4Preview from "@/components/lettre-mission/LettreMissionA4Preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  ArrowLeft,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Eye,
  Lock,
  Plus,
  Trash2,
  Copy,
  Mail,
  Printer,
  Upload,
  X,
  History,
  FileCheck,
  Check,
  AlertTriangle,
} from "lucide-react";

// ── Types ──
type LetterStatus = "brouillon" | "en_attente" | "signee" | "archivee";

interface CabinetInfo {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
}

interface SavedLetter {
  id: string;
  client_ref: string;
  raison_sociale: string;
  status: LetterStatus;
  updated_at: string;
  data: Record<string, unknown>;
}

const STATUS_CONFIG: Record<LetterStatus, { label: string; color: string; bg: string }> = {
  brouillon: { label: "Brouillon", color: "text-slate-400", bg: "bg-slate-500/20 border-slate-500/30" },
  en_attente: { label: "En attente de signature", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  signee: { label: "Signée", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  archivee: { label: "Archivée", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
};

const DEFAULT_CABINET: CabinetInfo = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
};

function loadCabinet(): CabinetInfo {
  try {
    const stored = localStorage.getItem("lcb-cabinet-config");
    if (stored) return { ...DEFAULT_CABINET, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_CABINET;
}

function formatMontant(n: number): string {
  return n.toLocaleString("fr-FR") + " €";
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const cabinet = useMemo(() => loadCabinet(), []);

  // ── Multi-model state (#1) ──
  const [modelList, setModelList] = useState<{ key: string; name: string }[]>([
    { key: "modele_lm_standard", name: "Standard" },
  ]);
  const [activeModelKey, setActiveModelKey] = useState("modele_lm_standard");
  const [showNewModelDialog, setShowNewModelDialog] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [renameModelName, setRenameModelName] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // ── Template state ──
  const [template, setTemplate] = useState<TemplateSection[]>(DEFAULT_TEMPLATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  // ── Generate state ──
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [genre, setGenre] = useState<"M" | "Mme">("M");
  const [missions, setMissions] = useState({ sociale: false, juridique: false, fiscal: false });
  const [honoraires, setHonoraires] = useState({
    comptable: 0, constitution: 0, juridique: 0,
    frequence: "MENSUEL" as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
  });

  // ── Status (#4) ──
  const [status, setStatus] = useState<LetterStatus>("brouillon");

  // ── Signatures (#5) ──
  const [signatureExpert, setSignatureExpert] = useState<string>("");
  const [signatureClient, setSignatureClient] = useState<string>("");

  // ── Notes internes (#11) ──
  const [notesInternes, setNotesInternes] = useState("");

  // ── Objet du contrat (#16) ──
  const [objetContrat, setObjetContrat] = useState("Présentation des comptes annuels");

  // ── UI state ──
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState<"pdf" | "docx" | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);

  // ── Autosave (#15) ──
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  // ── Load models list and active template from Supabase on mount ──
  useEffect(() => {
    async function loadModels() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTemplateLoaded(true); return; }

        // Load all model keys
        const { data: allParams } = await supabase
          .from("parametres")
          .select("cle, valeur")
          .eq("user_id", user.id)
          .like("cle", "modele_lm_%");

        if (allParams && allParams.length > 0) {
          const models = allParams.map((p) => {
            const val = p.valeur as Record<string, unknown>;
            return {
              key: p.cle,
              name: (val?._modelName as string) || p.cle.replace("modele_lm_", "").replace(/_/g, " "),
            };
          });
          setModelList(models);
          setActiveModelKey(models[0].key);

          // Load the first model's template
          const firstModel = allParams[0];
          const sections = (firstModel.valeur as Record<string, unknown>)?._sections;
          if (Array.isArray(sections)) {
            setTemplate(sections as TemplateSection[]);
          }
        }
      } catch (err) {
        logger.warn("LDM", "loadModels error", err);
      } finally {
        setTemplateLoaded(true);
      }
    }
    loadModels();
  }, []);

  // ── Load template when active model changes ──
  const loadModelTemplate = useCallback(async (key: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("user_id", user.id)
        .eq("cle", key)
        .maybeSingle();
      if (data?.valeur) {
        const val = data.valeur as Record<string, unknown>;
        const sections = val?._sections;
        if (Array.isArray(sections)) {
          setTemplate(sections as TemplateSection[]);
        }
      } else {
        setTemplate(DEFAULT_TEMPLATE);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Auto-fill when client changes ──
  useEffect(() => {
    if (!client) return;
    setHonoraires({
      comptable: client.honoraires || 0,
      constitution: client.reprise || 0,
      juridique: client.juridique || 0,
      frequence: client.frequence?.toLowerCase() === "trimestriel" ? "TRIMESTRIEL"
        : client.frequence?.toLowerCase() === "annuel" ? "ANNUEL" : "MENSUEL",
    });
    // Load existing letters for this client
    loadClientLetters(client.ref);
  }, [client]);

  // ── Load client's existing letters (#20) ──
  const loadClientLetters = useCallback(async (ref: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("lettres_mission")
        .select("*")
        .eq("user_id", user.id)
        .eq("client_ref", ref)
        .order("updated_at", { ascending: false });
      if (data) {
        setSavedLetters(data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          client_ref: d.client_ref as string,
          raison_sociale: clients.find((c) => c.ref === d.client_ref)?.raisonSociale || "",
          status: (d.status as LetterStatus) || "brouillon",
          updated_at: d.updated_at as string,
          data: (d.data as Record<string, unknown>) || {},
        })));
      }
    } catch { /* ignore */ }
  }, [clients]);

  // ── Autosave (#15) ──
  useEffect(() => {
    if (!isDirty || !client) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 30000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [isDirty, honoraires, missions, genre, status, notesInternes, signatureExpert, signatureClient]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  // ── Save template (#1) ──
  const handleSaveTemplate = useCallback(async () => {
    setTemplateSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Connexion requise"); return; }
      const modelName = modelList.find((m) => m.key === activeModelKey)?.name || "Standard";
      const { error } = await supabase.from("parametres").upsert({
        user_id: user.id,
        cle: activeModelKey,
        valeur: { _modelName: modelName, _sections: template } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,cle" });
      if (error) throw error;
      toast.success("Modèle sauvegardé");
    } catch (err) {
      logger.error("LDM", "saveTemplate error", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setTemplateSaving(false);
    }
  }, [template, activeModelKey, modelList]);

  // ── Create new model (#1) ──
  const handleCreateModel = useCallback(async () => {
    if (!newModelName.trim()) return;
    const key = "modele_lm_" + newModelName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("parametres").upsert({
        user_id: user.id,
        cle: key,
        valeur: { _modelName: newModelName.trim(), _sections: template } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,cle" });
      setModelList((prev) => [...prev, { key, name: newModelName.trim() }]);
      setActiveModelKey(key);
      setShowNewModelDialog(false);
      setNewModelName("");
      toast.success(`Modèle "${newModelName.trim()}" créé`);
    } catch { toast.error("Erreur"); }
  }, [newModelName, template]);

  // ── Delete model (#1) ──
  const handleDeleteModel = useCallback(async () => {
    if (modelList.length <= 1) { toast.error("Impossible de supprimer le dernier modèle"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("parametres").delete().eq("user_id", user.id).eq("cle", activeModelKey);
      const remaining = modelList.filter((m) => m.key !== activeModelKey);
      setModelList(remaining);
      setActiveModelKey(remaining[0].key);
      await loadModelTemplate(remaining[0].key);
      toast.success("Modèle supprimé");
    } catch { toast.error("Erreur"); }
  }, [activeModelKey, modelList, loadModelTemplate]);

  // ── Rename model (#1) ──
  const handleRenameModel = useCallback(async () => {
    if (!renameModelName.trim()) return;
    setModelList((prev) => prev.map((m) => m.key === activeModelKey ? { ...m, name: renameModelName.trim() } : m));
    setShowRenameDialog(false);
    // Will be persisted on next save
    toast.success("Modèle renommé");
  }, [renameModelName, activeModelKey]);

  const handleResetTemplate = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    toast.success("Modèle réinitialisé");
  }, []);

  // ── Update section content ──
  const updateSectionContent = useCallback((id: string, content: string) => {
    setTemplate((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
  }, []);

  // ── Add custom clause (#7) ──
  const addCustomClause = useCallback((afterId: string) => {
    const newSection: TemplateSection = {
      id: `custom_${Date.now()}`,
      title: "Clause personnalisée",
      content: "",
      type: "fixed",
      editable: true,
    };
    setTemplate((prev) => {
      const idx = prev.findIndex((s) => s.id === afterId);
      if (idx === -1) return [...prev, newSection];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newSection);
      return copy;
    });
  }, []);

  // ── Remove custom clause (#7) ──
  const removeSection = useCallback((id: string) => {
    setTemplate((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Update section title (#7) ──
  const updateSectionTitle = useCallback((id: string, title: string) => {
    setTemplate((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Save letter to Supabase (#15) ──
  const handleSave = useCallback(async (silent = false) => {
    if (!client) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("lettres_mission").upsert({
        user_id: user.id,
        client_ref: client.ref,
        status,
        data: {
          missions, honoraires, genre, status,
          notes_internes: notesInternes,
          signature_expert: signatureExpert,
          signature_client: signatureClient,
          objet_contrat: objetContrat,
          model_key: activeModelKey,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_ref,user_id" });
      setIsDirty(false);
      setLastSaved(new Date());
      if (!silent) toast.success("Lettre sauvegardée");
    } catch (err) {
      logger.warn("LDM", "save error", err);
      if (!silent) toast.error("Erreur de sauvegarde");
    }
  }, [client, status, missions, honoraires, genre, notesInternes, signatureExpert, signatureClient, objetContrat, activeModelKey]);

  // ── Duplicate from client (#2) ──
  const handleDuplicate = useCallback(async (letter: SavedLetter) => {
    const data = letter.data;
    if (data.missions) setMissions(data.missions as typeof missions);
    if (data.honoraires) setHonoraires(data.honoraires as typeof honoraires);
    if (data.genre) setGenre(data.genre as "M" | "Mme");
    if (data.notes_internes) setNotesInternes(data.notes_internes as string);
    setShowDuplicateDialog(false);
    toast.success("Paramètres dupliqués depuis la lettre existante");
  }, []);

  // ── Build variables ──
  const previewVariables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    // Date de validité (#10)
    const validite = new Date(now);
    validite.setFullYear(validite.getFullYear() + 1);
    const dateValidite = validite.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return {
      formule_politesse: formule,
      dirigeant: client.dirigeant, raison_sociale: client.raisonSociale,
      forme_juridique: client.forme, adresse: client.adresse,
      code_postal: client.cp, ville: client.ville, siren: client.siren,
      frequence: client.frequence,
      date_du_jour: dateStr,
      date_cloture: `31/12/${now.getFullYear()}`,
      date_validite: dateValidite,
      associe: client.associe,
      nom_cabinet: cabinet.nom, ville_cabinet: cabinet.ville,
      iban: client.iban ? client.iban.replace(/(.{4})/g, "$1 ").trim() : "",
      bic: client.bic || "",
      objet_contrat: objetContrat,
    } as Record<string, string>;
  }, [client, genre, cabinet, objetContrat]);

  // ── Compteur de pages (#14) ──
  const estimatedPages = useMemo(() => {
    const totalChars = template
      .filter((s) => {
        if (s.type === "conditional") {
          if (s.condition === "sociale" && !missions.sociale) return false;
          if (s.condition === "juridique" && !missions.juridique) return false;
          if (s.condition === "fiscal" && !missions.fiscal) return false;
        }
        return true;
      })
      .reduce((sum, s) => sum + s.content.length, 0);
    return Math.max(1, Math.ceil(totalChars / 3000));
  }, [template, missions]);

  // ── Unresolved variables (#17) ──
  const unresolvedVars = useMemo(() => {
    if (!client) return [];
    const allContent = template.map((s) => s.content).join(" ");
    const resolved = replaceTemplateVariables(allContent, previewVariables);
    const remaining = [...resolved.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    return [...new Set(remaining)];
  }, [template, client, previewVariables]);

  // ── Signature upload handler (#5) ──
  const handleSignatureUpload = useCallback((type: "expert" | "client", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (type === "expert") setSignatureExpert(base64);
      else setSignatureClient(base64);
      markDirty();
    };
    reader.readAsDataURL(file);
  }, [markDirty]);

  // ── Export PDF ──
  const handleExportPdf = useCallback(async () => {
    if (!client) return;
    setShowExportDialog(null);
    try {
      const { renderNewLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
      renderNewLettreMissionPdf({
        sections: template, client, genre, missions, honoraires, cabinet,
        variables: previewVariables, status, signatureExpert, signatureClient,
      });
      toast.success("PDF généré");
    } catch (err) {
      logger.error("LDM", "PDF generation error", err);
      toast.error("Erreur PDF");
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables, status, signatureExpert, signatureClient]);

  // ── Export DOCX ──
  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    setShowExportDialog(null);
    try {
      const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
      await renderNewLettreMissionDocx({
        sections: template, client, genre, missions, honoraires, cabinet,
        variables: previewVariables, status, signatureExpert, signatureClient,
      });
      toast.success("DOCX généré");
    } catch (err) {
      logger.error("LDM", "DOCX generation error", err);
      toast.error("Erreur DOCX");
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables, status, signatureExpert, signatureClient]);

  // ── Email (#12) ──
  const handleEmail = useCallback(() => {
    if (!client) return;
    const subject = encodeURIComponent(`Lettre de mission — ${client.raisonSociale}`);
    const body = encodeURIComponent("Veuillez trouver ci-joint votre lettre de mission.\n\nCordialement,\n" + cabinet.nom);
    window.open(`mailto:${client.mail}?subject=${subject}&body=${body}`);
    handleExportPdf();
    toast.success("Client mail ouvert — PDF téléchargé");
  }, [client, cabinet, handleExportPdf]);

  // ── Print (#13) ──
  const handlePrint = useCallback(() => {
    setShowPreviewModal(true);
    setTimeout(() => window.print(), 500);
  }, []);

  // ── Time since last save ──
  const timeSinceSave = useMemo(() => {
    if (!lastSaved) return null;
    const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return `il y a ${diff}s`;
    return `il y a ${Math.round(diff / 60)} min`;
  }, [lastSaved]);

  // ── TVA calculations (#6) ──
  const totalHT = (honoraires.comptable || 0) + (honoraires.constitution || 0) + (missions.juridique ? honoraires.juridique || 0 : 0);
  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
  const montantPeriodiqueTTC = Math.round((totalTTC / divisor) * 100) / 100;
  const freqLabel = honoraires.frequence === "MENSUEL" ? "mois" : honoraires.frequence === "TRIMESTRIEL" ? "trimestre" : "an";

  const statusConf = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col print:block" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ═══ TOOLBAR ═══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 shrink-0 print:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white gap-1">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
            <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
            {/* Status badge (#4) */}
            <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color}`}>
              {statusConf.label}
            </Badge>
            {/* Estimated pages (#14) */}
            {client && (
              <span className="text-[10px] text-slate-500">~{estimatedPages} pages</span>
            )}
            {/* Autosave indicator (#15) */}
            {lastSaved && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" /> {timeSinceSave}
              </span>
            )}
            {isDirty && (
              <span className="text-[10px] text-amber-500">Modifications non sauvegardées</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setShowPreviewModal(true)} disabled={!client} className="gap-1 text-xs">
              <Eye className="h-3.5 w-3.5" /> Aperçu
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowExportDialog("pdf")} disabled={!client} className="gap-1 text-xs">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowExportDialog("docx")} disabled={!client} className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> DOCX
            </Button>
            <Button size="sm" variant="outline" onClick={handleEmail} disabled={!client} className="gap-1 text-xs">
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!client} className="gap-1 text-xs">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 overflow-auto print:overflow-visible">
        <Tabs defaultValue="modele" className="h-full flex flex-col">
          <div className="px-4 pt-3 shrink-0 print:hidden">
            <TabsList className="bg-slate-800/50">
              <TabsTrigger value="modele">Modèle</TabsTrigger>
              <TabsTrigger value="generer">Générer</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ ONGLET 1: MODÈLE ═══ */}
          <TabsContent value="modele" className="flex-1 overflow-auto px-4 pb-6 print:hidden">
            {/* Model selector & actions (#1) */}
            <div className="flex items-center gap-2 py-3 sticky top-0 z-10 bg-slate-900/95 backdrop-blur flex-wrap">
              {/* Model dropdown */}
              <select
                value={activeModelKey}
                onChange={(e) => {
                  setActiveModelKey(e.target.value);
                  loadModelTemplate(e.target.value);
                }}
                className="rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-xs"
              >
                {modelList.map((m) => (
                  <option key={m.key} value={m.key}>{m.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => setShowNewModelDialog(true)} className="gap-1 text-xs h-7">
                <Plus className="h-3 w-3" /> Nouveau
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setRenameModelName(modelList.find(m => m.key === activeModelKey)?.name || ""); setShowRenameDialog(true); }} className="text-xs h-7">
                Renommer
              </Button>
              {modelList.length > 1 && (
                <Button size="sm" variant="outline" onClick={handleDeleteModel} className="text-xs h-7 text-red-400 hover:text-red-300">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <div className="w-px h-5 bg-white/10" />
              <Button size="sm" onClick={handleSaveTemplate} disabled={templateSaving} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7">
                <Save className="h-3.5 w-3.5" />
                {templateSaving ? "..." : "Sauvegarder"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetTemplate} className="gap-1 text-xs h-7">
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </Button>
            </div>

            {/* Sections with add clause buttons (#7) */}
            <div className="space-y-1">
              {template.map((section, idx) => {
                const isCollapsed2 = collapsed[section.id] ?? true;
                const isCustom = section.id.startsWith("custom_");
                return (
                  <div key={section.id}>
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCollapse(section.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed2 ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          {isCustom ? (
                            <input
                              value={section.title}
                              onChange={(e) => { e.stopPropagation(); updateSectionTitle(section.id, e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-slate-200 bg-transparent border-b border-dashed border-white/20 outline-none"
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-200">{section.title}</span>
                          )}
                          {section.type === "conditional" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">{section.condition}</span>
                          )}
                          {section.type === "annexe" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">annexe</span>
                          )}
                          {isCustom && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">personnalisée</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isCustom && (
                            <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="p-1 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                            </button>
                          )}
                          {!section.editable && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                        </div>
                      </button>
                      {!isCollapsed2 && (
                        <div className="px-4 py-3 border-t border-white/[0.06]">
                          {!section.editable ? (
                            <div>
                              <div className="text-xs text-amber-400/80 mb-2 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Ce contenu est généré automatiquement
                              </div>
                              <div className="text-sm text-slate-400 bg-slate-800/30 rounded p-3 whitespace-pre-wrap font-mono">{section.content}</div>
                            </div>
                          ) : (
                            <textarea
                              value={section.content}
                              onChange={(e) => updateSectionContent(section.id, e.target.value)}
                              className="w-full rounded-md border border-white/10 p-3 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y"
                              style={{ fontSize: 15, color: "#e2e8f0", backgroundColor: "hsl(217 33% 14%)", minHeight: 100, lineHeight: 1.6 }}
                              rows={Math.min(20, Math.max(4, section.content.split("\n").length + 1))}
                            />
                          )}
                        </div>
                      )}
                    </div>
                    {/* Add clause button between sections (#7) */}
                    <div className="flex justify-center py-0.5">
                      <button
                        onClick={() => addCustomClause(section.id)}
                        className="text-slate-600 hover:text-blue-400 transition-colors p-0.5"
                        title="Ajouter une clause"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══ ONGLET 2: GÉNÉRER ═══ */}
          <TabsContent value="generer" className="flex-1 overflow-auto print:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full">
              {/* Left panel */}
              <div className="overflow-auto border-r border-white/10 p-4 space-y-4">
                {/* Client selector */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-400 mb-1.5 block">Client</Label>
                    <select
                      value={selectedRef}
                      onChange={(e) => { setSelectedRef(e.target.value); markDirty(); }}
                      className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">-- Choisir un client --</option>
                      {clients.map((c) => (
                        <option key={c.ref} value={c.ref}>{c.raisonSociale} ({c.ref})</option>
                      ))}
                    </select>
                  </div>
                  {/* Duplicate button (#2) */}
                  <div className="flex items-end">
                    <Button size="sm" variant="outline" onClick={() => setShowDuplicateDialog(true)} className="gap-1 text-xs h-9">
                      <Copy className="h-3.5 w-3.5" /> Dupliquer
                    </Button>
                  </div>
                </div>

                {/* Existing letters badge (#20) */}
                {savedLetters.length > 0 && (
                  <button
                    onClick={() => setShowHistoryDialog(true)}
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <History className="w-3.5 h-3.5" />
                    {savedLetters.length} lettre(s) existante(s)
                  </button>
                )}

                {client && (
                  <>
                    {/* Missions summary strip (#19) */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-400 font-medium">Missions :</span>
                      <span className={missions.sociale ? "text-emerald-400" : "text-slate-600"}>Comptable {missions.sociale ? "+" : ""} Sociale {missions.sociale ? "OK" : "—"}</span>
                      <span className="text-slate-700">|</span>
                      <span className={missions.juridique ? "text-emerald-400" : "text-slate-600"}>Juridique {missions.juridique ? "OK" : "—"}</span>
                      <span className="text-slate-700">|</span>
                      <span className={missions.fiscal ? "text-emerald-400" : "text-slate-600"}>Fiscal {missions.fiscal ? "OK" : "—"}</span>
                    </div>

                    {/* Client info */}
                    <div className="border border-white/10 rounded-lg p-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Client</h3>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                        {[
                          ["Raison sociale", client.raisonSociale], ["Forme", client.forme],
                          ["SIREN", client.siren], ["Dirigeant", client.dirigeant],
                          ["Associé", client.associe], ["Vigilance", `${client.nivVigilance} (${client.scoreGlobal}/100)`],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span className="text-slate-500 text-[10px]">{label}</span>
                            <div className="text-slate-200 truncate text-xs">{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status selector (#4) */}
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Statut</Label>
                      <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value as LetterStatus); markDirty(); }}
                        className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="brouillon">Brouillon</option>
                        <option value="en_attente">En attente de signature</option>
                        <option value="signee">Signée</option>
                        <option value="archivee">Archivée</option>
                      </select>
                    </div>

                    {/* Genre + Objet */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Formule</Label>
                        <select value={genre} onChange={(e) => { setGenre(e.target.value as "M" | "Mme"); markDirty(); }} className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm">
                          <option value="M">M. (Monsieur)</option>
                          <option value="Mme">Mme (Madame)</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Objet (#16)</Label>
                        <input value={objetContrat} onChange={(e) => { setObjetContrat(e.target.value); markDirty(); }}
                          className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" />
                      </div>
                    </div>

                    {/* Missions */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Missions complémentaires</h3>
                      {[
                        { key: "sociale" as const, label: "Mission sociale" },
                        { key: "juridique" as const, label: "Mission juridique" },
                        { key: "fiscal" as const, label: "Contrôle fiscal" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-sm text-slate-300">{label}</Label>
                          <Switch checked={missions[key]} onCheckedChange={(v) => { setMissions((p) => ({ ...p, [key]: v })); markDirty(); }} />
                        </div>
                      ))}
                    </div>

                    {/* Honoraires with TVA (#6) */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Honoraires</h3>
                      {[
                        { key: "comptable" as const, label: "Forfait comptable annuel (€ HT)" },
                        { key: "constitution" as const, label: "Constitution / Reprise (€ HT)" },
                        { key: "juridique" as const, label: "Juridique annuel (€ HT)" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-[10px] text-slate-500">{label}</Label>
                          <input type="number" value={honoraires[key]}
                            onChange={(e) => { setHonoraires((p) => ({ ...p, [key]: Number(e.target.value) })); markDirty(); }}
                            className="w-full mt-0.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm" />
                          {/* TVA display */}
                          {honoraires[key] > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              TVA 20% : {formatMontant(Math.round(honoraires[key] * 0.20 * 100) / 100)} | TTC : {formatMontant(Math.round(honoraires[key] * 1.20 * 100) / 100)}
                            </div>
                          )}
                        </div>
                      ))}
                      <div>
                        <Label className="text-[10px] text-slate-500">Fréquence</Label>
                        <select value={honoraires.frequence} onChange={(e) => { setHonoraires((p) => ({ ...p, frequence: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL" })); markDirty(); }}
                          className="w-full mt-0.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm">
                          <option value="MENSUEL">Mensuel</option>
                          <option value="TRIMESTRIEL">Trimestriel</option>
                          <option value="ANNUEL">Annuel</option>
                        </select>
                      </div>
                      {/* TVA totals (#6) */}
                      <div className="border-t border-white/10 pt-2 mt-2 space-y-0.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-400">Total HT</span><span className="text-slate-200 font-medium">{formatMontant(totalHT)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">TVA 20%</span><span className="text-slate-200">{formatMontant(totalTVA)}</span></div>
                        <div className="flex justify-between font-semibold"><span className="text-slate-300">Total TTC</span><span className="text-white">{formatMontant(totalTTC)}</span></div>
                        <div className="text-slate-500 text-[10px]">Soit {formatMontant(montantPeriodiqueTTC)} TTC / {freqLabel}</div>
                      </div>
                    </div>

                    {/* Signatures (#5) */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signatures</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Expert-comptable", sig: signatureExpert, setter: setSignatureExpert, type: "expert" as const },
                          { label: "Client", sig: signatureClient, setter: setSignatureClient, type: "client" as const },
                        ].map(({ label, sig, setter, type }) => (
                          <div key={type}>
                            <Label className="text-[10px] text-slate-500 mb-1 block">{label}</Label>
                            {sig ? (
                              <div className="relative border border-white/10 rounded p-2 bg-white/5">
                                <img src={sig} alt={`Signature ${label}`} className="max-h-16 mx-auto" />
                                <button onClick={() => setter("")} className="absolute top-1 right-1 text-slate-400 hover:text-red-400">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center gap-1 border border-dashed border-white/20 rounded p-3 cursor-pointer hover:border-white/40 text-xs text-slate-500">
                                <Upload className="w-3.5 h-3.5" /> PNG/JPG
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={(e) => { if (e.target.files?.[0]) handleSignatureUpload(type, e.target.files[0]); }} />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes internes (#11) */}
                    <div className="border border-white/10 rounded-lg p-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Notes internes (non imprimées)
                      </h3>
                      <textarea
                        value={notesInternes}
                        onChange={(e) => { setNotesInternes(e.target.value); markDirty(); }}
                        placeholder="Notes visibles uniquement par le cabinet..."
                        className="w-full rounded-md border border-white/10 bg-slate-800/50 text-slate-300 px-3 py-2 text-sm resize-y"
                        style={{ minHeight: 60 }}
                      />
                    </div>

                    {/* Save button */}
                    <Button onClick={() => handleSave(false)} className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Save className="h-4 w-4" /> Sauvegarder
                    </Button>
                  </>
                )}
              </div>

              {/* Right panel — Live preview */}
              <div className="overflow-auto bg-slate-950/50">
                {client ? (
                  <LettreMissionA4Preview
                    sections={template} client={client} genre={genre} missions={missions}
                    honoraires={honoraires} cabinet={cabinet} status={status}
                    signatureExpert={signatureExpert} signatureClient={signatureClient}
                    objetContrat={objetContrat}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    Sélectionnez un client pour prévisualiser la lettre
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ FULLSCREEN PREVIEW MODAL ═══ */}
      {showPreviewModal && client && (
        <div className="fixed inset-0 z-50 bg-black/80 overflow-auto print:bg-white print:static">
          <div className="sticky top-0 z-10 flex justify-end p-4 print:hidden">
            <Button size="sm" variant="outline" onClick={() => setShowPreviewModal(false)} className="bg-slate-900/90 text-white">Fermer</Button>
          </div>
          <LettreMissionA4Preview
            sections={template} client={client} genre={genre} missions={missions}
            honoraires={honoraires} cabinet={cabinet} status={status}
            signatureExpert={signatureExpert} signatureClient={signatureClient}
            objetContrat={objetContrat}
          />
        </div>
      )}

      {/* ═══ EXPORT PREVIEW DIALOG (#17) ═══ */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Export {showExportDialog.toUpperCase()}
            </h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Pages estimées</span>
                <span className="text-white">~{estimatedPages}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Statut</span>
                <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color}`}>{statusConf.label}</Badge>
              </div>
              {status === "brouillon" && (
                <div className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Le filigrane "PROJET" sera affiché
                </div>
              )}
              {unresolvedVars.length > 0 && (
                <div>
                  <div className="text-xs text-red-400 flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Variables non résolues :
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unresolvedVars.map((v) => (
                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              )}
              {unresolvedVars.length === 0 && (
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> Toutes les variables sont résolues
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowExportDialog(null)} variant="outline" className="flex-1">Annuler</Button>
              <Button onClick={showExportDialog === "pdf" ? handleExportPdf : handleExportDocx}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                <FileDown className="h-4 w-4" /> Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW MODEL DIALOG (#1) ═══ */}
      {showNewModelDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-white mb-3">Nouveau modèle</h2>
            <input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Ex: SCI, EI, SAS..."
              className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm mb-3" autoFocus />
            <div className="flex gap-2">
              <Button onClick={() => setShowNewModelDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
              <Button onClick={handleCreateModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Créer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RENAME DIALOG (#1) ═══ */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-white mb-3">Renommer le modèle</h2>
            <input value={renameModelName} onChange={(e) => setRenameModelName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm mb-3" autoFocus />
            <div className="flex gap-2">
              <Button onClick={() => setShowRenameDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
              <Button onClick={handleRenameModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Renommer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DUPLICATE DIALOG (#2) ═══ */}
      {showDuplicateDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-sm font-semibold text-white mb-3">Dupliquer depuis un client existant</h2>
            {savedLetters.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">Aucune lettre existante trouvée.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto mb-4">
                {savedLetters.map((l) => (
                  <button key={l.id} onClick={() => handleDuplicate(l)}
                    className="w-full text-left p-3 rounded border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors">
                    <div className="text-sm text-slate-200">{l.raison_sociale || l.client_ref}</div>
                    <div className="text-xs text-slate-500">{new Date(l.updated_at).toLocaleDateString("fr-FR")} — {STATUS_CONFIG[l.status]?.label}</div>
                  </button>
                ))}
              </div>
            )}
            <Button onClick={() => setShowDuplicateDialog(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </div>
        </div>
      )}

      {/* ═══ HISTORY DIALOG (#20) ═══ */}
      {showHistoryDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-sm font-semibold text-white mb-3">Historique des lettres</h2>
            <div className="space-y-2 max-h-64 overflow-auto mb-4">
              {savedLetters.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded border border-white/10">
                  <div>
                    <div className="text-sm text-slate-200">{new Date(l.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[l.status]?.bg} ${STATUS_CONFIG[l.status]?.color}`}>{STATUS_CONFIG[l.status]?.label}</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { handleDuplicate(l); setShowHistoryDialog(false); }} className="text-xs">
                    Charger
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowHistoryDialog(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </div>
        </div>
      )}

      {/* Print styles (#13) */}
      <style>{`
        @media print {
          body > *:not(.print-target) { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:static { position: static !important; }
          .print\\:overflow-visible { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
