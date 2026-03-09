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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
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
  Search,
  ClipboardCopy,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  FileIcon,
  ScrollText,
  Inbox,
  Shield,
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

const STATUS_CONFIG: Record<LetterStatus, { label: string; color: string; bg: string; dot: string }> = {
  brouillon: { label: "Brouillon", color: "text-slate-400", bg: "bg-slate-500/20 border-slate-500/30", dot: "bg-slate-400" },
  en_attente: { label: "En attente de signature", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30", dot: "bg-amber-400" },
  signee: { label: "Signee", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30", dot: "bg-emerald-400" },
  archivee: { label: "Archivee", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", dot: "bg-blue-400" },
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
    const stored = sessionStorage.getItem("lcb-cabinet-config");
    if (stored) {
      try { return { ...DEFAULT_CABINET, ...JSON.parse(stored) }; }
      catch { /* corrupted data, use defaults */ }
    }
  } catch { /* ignore */ }
  return DEFAULT_CABINET;
}

// Fix #6: guard against NaN
function formatMontant(n: number): string {
  if (isNaN(n)) return "0 \u20ac";
  return n.toLocaleString("fr-FR") + " \u20ac";
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const cabinet = useMemo(() => loadCabinet(), []);

  // ── Multi-model state ──
  const [modelList, setModelList] = useState<{ key: string; name: string }[]>([
    { key: "modele_lm_standard", name: "Standard" },
  ]);
  const [activeModelKey, setActiveModelKey] = useState("modele_lm_standard");
  const [showNewModelDialog, setShowNewModelDialog] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [renameModelName, setRenameModelName] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Fix #14

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
    sociale: 0,   // Fix #7 / #31: honoraires sociale
    fiscal: 0,    // Fix #32: honoraires controle fiscal
    frequence: "MENSUEL" as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
  });

  // ── Status ──
  const [status, setStatus] = useState<LetterStatus>("brouillon");

  // ── Signatures ──
  const [signatureExpert, setSignatureExpert] = useState<string>("");
  const [signatureClient, setSignatureClient] = useState<string>("");

  // ── Notes internes ──
  const [notesInternes, setNotesInternes] = useState("");

  // ── Objet du contrat ──
  const [objetContrat, setObjetContrat] = useState("Presentation des comptes annuels");

  // ── UI state ──
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState<"pdf" | "docx" | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [allLetters, setAllLetters] = useState<SavedLetter[]>([]); // Fix #9: all user letters for duplicate
  const [sectionFilter, setSectionFilter] = useState(""); // Fix #40
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false); // Fix #41
  const [allSectionsCollapsed, setAllSectionsCollapsed] = useState(true); // Fix #26

  // ── Autosave ──
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(); // Fix #4: ref for autosave

  // Fix #2: timer tick for timeSinceSave re-render
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSaved) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [lastSaved]);

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
        console.warn("[loadModels]", err);
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

  // ── Load client's existing letters ──
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

  // ── Auto-fill when client changes ──
  useEffect(() => {
    if (!client) return;
    setHonoraires({
      comptable: client.honoraires || 0,
      constitution: client.reprise || 0,
      juridique: client.juridique || 0,
      sociale: 0,
      fiscal: 0,
      frequence: client.frequence?.toLowerCase() === "trimestriel" ? "TRIMESTRIEL"
        : client.frequence?.toLowerCase() === "annuel" ? "ANNUEL" : "MENSUEL",
    });
    // Load existing letters for this client
    loadClientLetters(client.ref);
  }, [client, loadClientLetters]); // Fix #3: loadClientLetters in deps

  // Fix #9: Load ALL user letters for the duplicate dialog
  const loadAllLetters = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("lettres_mission")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (data) {
        setAllLetters(data.map((d: Record<string, unknown>) => ({
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

  // ── Autosave — Fix #4: use ref to avoid stale closure ──
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    if (!isDirty || !client) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRef.current?.(true);
    }, 30000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [isDirty, client, honoraires, missions, genre, status, notesInternes, signatureExpert, signatureClient]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  // Fix #27: Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current?.(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fix #39: beforeunload warning when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Save template ──
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
      toast.success("Modele sauvegarde");
    } catch (err) {
      console.error("[saveTemplate]", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setTemplateSaving(false);
    }
  }, [template, activeModelKey, modelList]);

  // ── Create new model ──
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
      toast.success(`Modele "${newModelName.trim()}" cree`);
    } catch { toast.error("Erreur"); }
  }, [newModelName, template]);

  // Fix #14: Delete model with confirmation
  const handleDeleteModel = useCallback(async () => {
    if (modelList.length <= 1) { toast.error("Impossible de supprimer le dernier modele"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("parametres").delete().eq("user_id", user.id).eq("cle", activeModelKey);
      const remaining = modelList.filter((m) => m.key !== activeModelKey);
      setModelList(remaining);
      setActiveModelKey(remaining[0].key);
      await loadModelTemplate(remaining[0].key);
      setShowDeleteConfirm(false);
      toast.success("Modele supprime");
    } catch { toast.error("Erreur"); }
  }, [activeModelKey, modelList, loadModelTemplate]);

  // ── Rename model ──
  const handleRenameModel = useCallback(async () => {
    if (!renameModelName.trim()) return;
    setModelList((prev) => prev.map((m) => m.key === activeModelKey ? { ...m, name: renameModelName.trim() } : m));
    setShowRenameDialog(false);
    toast.success("Modele renomme");
  }, [renameModelName, activeModelKey]);

  const handleResetTemplate = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    toast.success("Modele reinitialise");
  }, []);

  // ── Update section content ──
  const updateSectionContent = useCallback((id: string, content: string) => {
    setTemplate((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
  }, []);

  // ── Add custom clause ──
  const addCustomClause = useCallback((afterId: string) => {
    const newSection: TemplateSection = {
      id: `custom_${Date.now()}`,
      title: "Clause personnalisee",
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

  // ── Remove custom clause ──
  const removeSection = useCallback((id: string) => {
    setTemplate((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Update section title ──
  const updateSectionTitle = useCallback((id: string, title: string) => {
    setTemplate((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Fix #35: Move section up/down
  const moveSection = useCallback((id: string, direction: "up" | "down") => {
    setTemplate((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const copy = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
      return copy;
    });
  }, []);

  // Fix #26: Toggle all sections collapsed/expanded
  const toggleAllSections = useCallback(() => {
    const newState = !allSectionsCollapsed;
    setAllSectionsCollapsed(newState);
    const newCollapsed: Record<string, boolean> = {};
    template.forEach((s) => { newCollapsed[s.id] = newState; });
    setCollapsed(newCollapsed);
  }, [allSectionsCollapsed, template]);

  // ── Save letter to Supabase ──
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
      if (!silent) toast.success("Lettre sauvegardee");
      // Fix #10: reload letters after save
      loadClientLetters(client.ref);
    } catch (err) {
      console.warn("[save]", err);
      if (!silent) toast.error("Erreur de sauvegarde");
    }
  }, [client, status, missions, honoraires, genre, notesInternes, signatureExpert, signatureClient, objetContrat, activeModelKey, loadClientLetters]);

  // ── Duplicate from letter ──
  const handleDuplicate = useCallback(async (letter: SavedLetter) => {
    const data = letter.data;
    if (data.missions) setMissions(data.missions as typeof missions);
    if (data.honoraires) setHonoraires(data.honoraires as typeof honoraires);
    if (data.genre) setGenre(data.genre as "M" | "Mme");
    if (data.notes_internes) setNotesInternes(data.notes_internes as string);
    setShowDuplicateDialog(false);
    toast.success("Parametres dupliques depuis la lettre existante");
  }, []);

  // ── Build variables ──
  const previewVariables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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

  // ── Compteur de pages ──
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

  // ── Unresolved variables ──
  const unresolvedVars = useMemo(() => {
    if (!client) return [];
    const allContent = template.map((s) => s.content).join(" ");
    const resolved = replaceTemplateVariables(allContent, previewVariables);
    const remaining = [...resolved.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    return [...new Set(remaining)];
  }, [template, client, previewVariables]);

  // Fix #33: Preview completeness percentage
  const completionInfo = useMemo(() => {
    if (!client) return { percent: 0, filled: 0, total: 0 };
    const fields = [
      client.raisonSociale, client.forme, client.siren, client.dirigeant,
      client.adresse, client.cp, client.ville, client.associe,
      genre, objetContrat, String(honoraires.comptable > 0),
    ];
    const filled = fields.filter((f) => f && f !== "0" && f !== "false").length;
    const total = fields.length;
    return { percent: Math.round((filled / total) * 100), filled, total };
  }, [client, genre, objetContrat, honoraires.comptable]);

  // ── Signature upload handler ──
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
      toast.success("PDF genere");
    } catch (err) {
      console.error("[PDF]", err);
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
      toast.success("DOCX genere");
    } catch (err) {
      console.error("[DOCX]", err);
      toast.error("Erreur DOCX");
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables, status, signatureExpert, signatureClient]);

  // Fix #38: Email validates client has email
  const handleEmail = useCallback(() => {
    if (!client) return;
    if (!client.mail) {
      toast.error("Ce client n'a pas d'adresse email renseignee");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.mail)) {
      toast.error("Adresse email client invalide");
      return;
    }
    const subject = encodeURIComponent(`Lettre de mission \u2014 ${client.raisonSociale}`);
    const body = encodeURIComponent("Veuillez trouver ci-joint votre lettre de mission.\n\nCordialement,\n" + cabinet.nom);
    window.location.href = `mailto:${client.mail}?subject=${subject}&body=${body}`;
    handleExportPdf();
    toast.success("Client mail ouvert \u2014 PDF telecharge");
  }, [client, cabinet, handleExportPdf]);

  // Fix #15: Print uses requestAnimationFrame
  const handlePrint = useCallback(() => {
    setShowPreviewModal(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  // Fix #36: Copy LM number
  const handleCopyLMNumber = useCallback(() => {
    if (!client) return;
    const lmNumber = `LM-${new Date().getFullYear()}-${client.ref}`;
    navigator.clipboard.writeText(lmNumber).then(() => {
      toast.success(`Numero ${lmNumber} copie`);
    }).catch(() => {
      toast.error("Impossible de copier");
    });
  }, [client]);

  // Fix #37: Auto-save on status change to "signee"
  const handleStatusChange = useCallback((newStatus: LetterStatus) => {
    setStatus(newStatus);
    markDirty();
    if (newStatus === "signee") {
      // Defer save until state updates
      setTimeout(async () => {
        await handleSaveRef.current?.(false);
        toast.success("Lettre marquee comme signee et sauvegardee");
      }, 100);
    }
  }, [markDirty]);

  // ── Time since last save — Fix #2: now re-renders with tick ──
  const timeSinceSave = useMemo(() => {
    if (!lastSaved) return null;
    const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return `il y a ${diff}s`;
    return `il y a ${Math.round(diff / 60)} min`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSaved, /* tick dependency is via setTick triggering re-render */]);

  // Fix #7: totalHT includes sociale and fiscal honoraires when active
  const totalHT = (honoraires.comptable || 0)
    + (honoraires.constitution || 0)
    + (missions.juridique ? honoraires.juridique || 0 : 0)
    + (missions.sociale ? honoraires.sociale || 0 : 0)
    + (missions.fiscal ? honoraires.fiscal || 0 : 0);
  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
  const montantPeriodiqueTTC = Math.round((totalTTC / divisor) * 100) / 100;
  const freqLabel = honoraires.frequence === "MENSUEL" ? "mois" : honoraires.frequence === "TRIMESTRIEL" ? "trimestre" : "an";

  const statusConf = STATUS_CONFIG[status];

  // Fix #44: word count for each editable section
  const sectionWordCounts = useMemo(() => {
    const counts: Record<string, { words: number; chars: number }> = {};
    template.forEach((s) => {
      const words = s.content.trim() ? s.content.trim().split(/\s+/).length : 0;
      counts[s.id] = { words, chars: s.content.length };
    });
    return counts;
  }, [template]);

  // Styled select classes — Fix #17
  const selectClasses = "w-full rounded-lg border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm appearance-none cursor-pointer hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors";

  return (
    <div className="flex flex-col print:block" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ═══ TOOLBAR — Fix #16: better spacing with separators ═══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 shrink-0 print:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white hover:bg-white/5 gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>

            {/* Status badge */}
            <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} mr-1.5 inline-block`} />
              {statusConf.label}
            </Badge>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Fix #30: Estimated pages with document icon */}
            {client && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <FileText className="w-3 h-3" /> ~{estimatedPages} pages
              </span>
            )}

            {/* Fix #36: Copy LM number */}
            {client && (
              <Button variant="ghost" size="sm" onClick={handleCopyLMNumber} className="text-slate-500 hover:text-white h-6 px-1.5 transition-colors" title="Copier le numero LM">
                <ClipboardCopy className="w-3.5 h-3.5" />
              </Button>
            )}

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Autosave indicator */}
            {lastSaved && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" /> {timeSinceSave}
              </span>
            )}

            {/* Fix #23: More visible unsaved indicator with pulsing dot */}
            {isDirty && (
              <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Modifications non sauvegardees
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setShowPreviewModal(true)} disabled={!client} className="gap-1 text-xs hover:bg-white/5 transition-colors">
              <Eye className="h-3.5 w-3.5" /> Apercu
            </Button>

            <div className="w-px h-5 bg-white/10" />

            <Button size="sm" variant="outline" onClick={() => setShowExportDialog("pdf")} disabled={!client} className="gap-1 text-xs hover:bg-white/5 transition-colors">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowExportDialog("docx")} disabled={!client} className="gap-1 text-xs hover:bg-white/5 transition-colors">
              <FileText className="h-3.5 w-3.5" /> DOCX
            </Button>

            <div className="w-px h-5 bg-white/10" />

            <Button size="sm" variant="outline" onClick={handleEmail} disabled={!client} className="gap-1 text-xs hover:bg-white/5 transition-colors">
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!client} className="gap-1 text-xs hover:bg-white/5 transition-colors">
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
              <TabsTrigger value="modele">Modele</TabsTrigger>
              <TabsTrigger value="generer">Generer</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ ONGLET 1: MODELE ═══ */}
          <TabsContent value="modele" className="flex-1 overflow-auto px-4 pb-6 print:hidden">
            {/* Fix #24: Model selector with better layout and grouped actions */}
            <div className="flex items-center gap-3 py-3 sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              {/* Model dropdown group */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Label className="text-xs text-slate-500 shrink-0">Modele :</Label>
                <select
                  value={activeModelKey}
                  onChange={(e) => {
                    setActiveModelKey(e.target.value);
                    loadModelTemplate(e.target.value);
                  }}
                  className={`${selectClasses} max-w-[200px]`}
                >
                  {modelList.map((m) => (
                    <option key={m.key} value={m.key}>{m.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => setShowNewModelDialog(true)} className="gap-1 text-xs h-8 hover:bg-white/5 transition-colors">
                  <Plus className="h-3 w-3" /> Nouveau
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRenameModelName(modelList.find(m => m.key === activeModelKey)?.name || ""); setShowRenameDialog(true); }} className="text-xs h-8 hover:bg-white/5 transition-colors">
                  Renommer
                </Button>
                {/* Fix #14: Delete with confirmation */}
                {modelList.length > 1 && (
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(true)} className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Actions group */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveTemplate} disabled={templateSaving} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8 transition-colors">
                  <Save className="h-3.5 w-3.5" />
                  {templateSaving ? "..." : "Sauvegarder"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleResetTemplate} className="gap-1 text-xs h-8 hover:bg-white/5 transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Reinitialiser
                </Button>
              </div>
            </div>

            {/* Fix #40: Section search + Fix #26: Toggle all */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  placeholder="Filtrer les sections..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-white/10 bg-slate-800/50 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                />
                {sectionFilter && (
                  <button onClick={() => setSectionFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={toggleAllSections} className="gap-1 text-xs h-7 hover:bg-white/5 transition-colors">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allSectionsCollapsed ? "Tout deplier" : "Tout replier"}
              </Button>
            </div>

            {/* Sections with add clause buttons + Fix #25: numbering */}
            <div className="space-y-1">
              {template
                .filter((s) => !sectionFilter || s.title.toLowerCase().includes(sectionFilter.toLowerCase()))
                .map((section, idx) => {
                const isCollapsed2 = collapsed[section.id] ?? true;
                const isCustom = section.id.startsWith("custom_");
                const sectionNumber = idx + 1;
                // Fix #45: detect hidden conditional sections
                const isConditionalHidden = section.type === "conditional" && (
                  (section.condition === "sociale" && !missions.sociale) ||
                  (section.condition === "juridique" && !missions.juridique) ||
                  (section.condition === "fiscal" && !missions.fiscal)
                );
                return (
                  <div key={section.id}>
                    {/* Fix #49: consistent border radius */}
                    <div className={`border border-white/10 rounded-xl overflow-hidden transition-all duration-200 ${isConditionalHidden ? "opacity-50" : ""}`}>
                      <button
                        onClick={() => toggleCollapse(section.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 transition-all duration-150 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {/* Fix #47: smooth transition on chevron */}
                          <span className={`transition-transform duration-200 ${isCollapsed2 ? "" : "rotate-90"}`}>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </span>
                          {/* Fix #25: section numbering */}
                          <span className="text-[10px] text-slate-600 font-mono w-5">{String(sectionNumber).padStart(2, "0")}</span>
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
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              {isConditionalHidden && <EyeOff className="w-2.5 h-2.5" />}
                              {section.condition}
                            </span>
                          )}
                          {section.type === "annexe" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">annexe</span>
                          )}
                          {isCustom && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">personnalisee</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Fix #35: reorder buttons */}
                          <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, "up"); }}
                            className="p-1 text-slate-600 hover:text-slate-300 transition-colors" title="Monter">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, "down"); }}
                            className="p-1 text-slate-600 hover:text-slate-300 transition-colors" title="Descendre">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {isCustom && (
                            <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="p-1 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                            </button>
                          )}
                          {!section.editable && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                        </div>
                      </button>
                      {/* Fix #47: animated expand/collapse */}
                      <div className={`transition-all duration-200 ease-in-out overflow-hidden ${isCollapsed2 ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"}`}>
                        <div className="px-4 py-3 border-t border-white/[0.06]">
                          {!section.editable ? (
                            <div>
                              <div className="text-xs text-amber-400/80 mb-2 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Ce contenu est genere automatiquement
                              </div>
                              <div className="text-sm text-slate-400 bg-slate-800/30 rounded-lg p-3 whitespace-pre-wrap font-mono">{section.content}</div>
                            </div>
                          ) : (
                            <div>
                              <textarea
                                value={section.content}
                                onChange={(e) => updateSectionContent(section.id, e.target.value)}
                                className="w-full rounded-lg border border-white/10 p-3 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y transition-colors"
                                style={{ fontSize: 15, color: "#e2e8f0", backgroundColor: "hsl(217 33% 14%)", minHeight: 100, lineHeight: 1.6 }}
                                rows={Math.min(20, Math.max(4, section.content.split("\n").length + 1))}
                              />
                              {/* Fix #44: word/char count */}
                              <div className="flex justify-end mt-1 text-[10px] text-slate-600">
                                {sectionWordCounts[section.id]?.words} mots / {sectionWordCounts[section.id]?.chars} car.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Add clause button between sections */}
                    <div className="flex justify-center py-0.5">
                      <button
                        onClick={() => addCustomClause(section.id)}
                        className="text-slate-600 hover:text-blue-400 transition-colors p-0.5 hover:scale-110"
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

          {/* ═══ ONGLET 2: GENERER ═══ */}
          <TabsContent value="generer" className="flex-1 overflow-auto print:hidden">
            <div className={`grid ${leftPanelCollapsed ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"} gap-0 h-full`}>
              {/* Left panel — Fix #41: collapsible */}
              {!leftPanelCollapsed && (
                <div className="overflow-auto border-r border-white/10 p-4 space-y-4">
                  {/* Fix #41: collapse toggle */}
                  <div className="flex justify-end lg:hidden-force">
                    <Button size="sm" variant="ghost" onClick={() => setLeftPanelCollapsed(true)} className="text-slate-500 hover:text-white h-6 px-1 transition-colors" title="Replier le panneau">
                      <PanelLeftClose className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Client selector — Fix #42: vigilance badge */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-400 mb-1.5 block">Client</Label>
                      <select
                        value={selectedRef}
                        onChange={(e) => { setSelectedRef(e.target.value); markDirty(); }}
                        className={selectClasses}
                      >
                        <option value="">-- Choisir un client --</option>
                        {clients.map((c) => (
                          <option key={c.ref} value={c.ref}>
                            {c.raisonSociale} ({c.ref}) {c.nivVigilance ? `[${c.nivVigilance}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Duplicate button — Fix #9: loads all letters */}
                    <div className="flex items-end">
                      <Button size="sm" variant="outline" onClick={() => { loadAllLetters(); setShowDuplicateDialog(true); }} className="gap-1 text-xs h-9 hover:bg-white/5 transition-colors">
                        <Copy className="h-3.5 w-3.5" /> Dupliquer
                      </Button>
                    </div>
                  </div>

                  {/* Existing letters badge */}
                  {savedLetters.length > 0 && (
                    <button
                      onClick={() => setShowHistoryDialog(true)}
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      {savedLetters.length} lettre(s) existante(s)
                    </button>
                  )}

                  {/* Fix #48: Better empty state */}
                  {!client && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/10 flex items-center justify-center mb-4">
                        <Inbox className="w-8 h-8 text-slate-600" />
                      </div>
                      <p className="text-slate-400 text-sm font-medium mb-1">Aucun client selectionne</p>
                      <p className="text-slate-600 text-xs">Choisissez un client ci-dessus pour commencer la lettre de mission</p>
                    </div>
                  )}

                  {client && (
                    <>
                      {/* Fix #33: Completion progress indicator */}
                      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/30 border border-white/10">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Previsualisation complete</span>
                            <span className={`text-xs font-medium ${completionInfo.percent === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                              {completionInfo.percent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${completionInfo.percent === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                              style={{ width: `${completionInfo.percent}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-600">{completionInfo.filled}/{completionInfo.total}</span>
                      </div>

                      {/* Missions summary strip */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 font-medium">Missions :</span>
                        <span className={missions.sociale ? "text-emerald-400" : "text-slate-600"}>Comptable {missions.sociale ? "+" : ""} Sociale {missions.sociale ? "OK" : "\u2014"}</span>
                        <span className="text-slate-700">|</span>
                        <span className={missions.juridique ? "text-emerald-400" : "text-slate-600"}>Juridique {missions.juridique ? "OK" : "\u2014"}</span>
                        <span className="text-slate-700">|</span>
                        <span className={missions.fiscal ? "text-emerald-400" : "text-slate-600"}>Fiscal {missions.fiscal ? "OK" : "\u2014"}</span>
                      </div>

                      {/* Fix #18: Client info card with gradient border */}
                      <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20">
                        <div className="bg-slate-900 rounded-xl p-4">
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Client</h3>
                          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
                            {[
                              ["Raison sociale", client.raisonSociale], ["Forme", client.forme],
                              ["SIREN", client.siren], ["Dirigeant", client.dirigeant],
                              ["Associe", client.associe],
                              ["Vigilance", null],
                            ].map(([label, value]) => (
                              <div key={label as string}>
                                <span className="text-slate-500 text-[10px]">{label}</span>
                                {label === "Vigilance" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={`text-[10px] ${
                                      client.nivVigilance === "elevee" || client.nivVigilance === "renforcee"
                                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                                        : client.nivVigilance === "complementaire"
                                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    }`}>
                                      <Shield className="w-2.5 h-2.5 mr-1" />
                                      {client.nivVigilance}
                                    </Badge>
                                    <span className="text-slate-400 text-[10px]">({client.scoreGlobal}/100)</span>
                                  </div>
                                ) : (
                                  <div className="text-slate-200 truncate text-xs">{(value as string) || "\u2014"}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Fix #22: Status selector with colored dots */}
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Statut</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.entries(STATUS_CONFIG) as [LetterStatus, typeof statusConf][]).map(([key, conf]) => (
                            <button
                              key={key}
                              onClick={() => handleStatusChange(key)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all duration-150 ${
                                status === key
                                  ? `${conf.bg} ${conf.color} border-current`
                                  : "border-white/10 text-slate-500 hover:border-white/20 hover:bg-white/5"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                              {conf.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Genre + Objet — Fix #1: remove (#16) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-400 mb-1.5 block">Formule</Label>
                          <select value={genre} onChange={(e) => { setGenre(e.target.value as "M" | "Mme"); markDirty(); }} className={selectClasses}>
                            <option value="M">M. (Monsieur)</option>
                            <option value="Mme">Mme (Madame)</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400 mb-1.5 block">Objet</Label>
                          <input value={objetContrat} onChange={(e) => { setObjetContrat(e.target.value); markDirty(); }}
                            className="w-full rounded-lg border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                        </div>
                      </div>

                      {/* Missions */}
                      <div className="border border-white/10 rounded-xl p-4 space-y-2.5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Missions complementaires</h3>
                        {[
                          { key: "sociale" as const, label: "Mission sociale" },
                          { key: "juridique" as const, label: "Mission juridique" },
                          { key: "fiscal" as const, label: "Controle fiscal" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between py-0.5">
                            <Label className="text-sm text-slate-300">{label}</Label>
                            <Switch checked={missions[key]} onCheckedChange={(v) => { setMissions((p) => ({ ...p, [key]: v })); markDirty(); }} />
                          </div>
                        ))}
                      </div>

                      {/* Honoraires with TVA — Fix #7/#19/#31/#32 */}
                      <div className="border border-white/10 rounded-xl p-4 space-y-2.5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Honoraires</h3>
                        {[
                          { key: "comptable" as const, label: "Forfait comptable annuel (\u20ac HT)", show: true },
                          { key: "constitution" as const, label: "Constitution / Reprise (\u20ac HT)", show: true },
                          { key: "juridique" as const, label: "Juridique annuel (\u20ac HT)", show: true },
                          { key: "sociale" as const, label: "Sociale annuel (\u20ac HT)", show: missions.sociale }, // Fix #31
                          { key: "fiscal" as const, label: "Controle fiscal (\u20ac HT)", show: missions.fiscal }, // Fix #32
                        ].filter((h) => h.show).map(({ key, label }) => (
                          <div key={key}>
                            <Label className="text-[10px] text-slate-500">{label}</Label>
                            <input type="number" value={honoraires[key]}
                              onChange={(e) => { setHonoraires((p) => ({ ...p, [key]: Number(e.target.value) })); markDirty(); }}
                              className="w-full mt-0.5 rounded-lg border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors" />
                            {/* TVA display */}
                            {honoraires[key] > 0 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                TVA 20% : {formatMontant(Math.round(honoraires[key] * 0.20 * 100) / 100)} | TTC : {formatMontant(Math.round(honoraires[key] * 1.20 * 100) / 100)}
                              </div>
                            )}
                          </div>
                        ))}
                        <div>
                          <Label className="text-[10px] text-slate-500">Frequence</Label>
                          <select value={honoraires.frequence} onChange={(e) => { setHonoraires((p) => ({ ...p, frequence: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL" })); markDirty(); }}
                            className={`${selectClasses} mt-0.5 py-1.5`}>
                            <option value="MENSUEL">Mensuel</option>
                            <option value="TRIMESTRIEL">Trimestriel</option>
                            <option value="ANNUEL">Annuel</option>
                          </select>
                        </div>
                        {/* Fix #19: TVA totals with accent line */}
                        <div className="relative pt-3 mt-3 space-y-1 text-xs">
                          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-transparent" />
                          <div className="flex justify-between"><span className="text-slate-400">Total HT</span><span className="text-slate-200 font-medium">{formatMontant(totalHT)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">TVA 20%</span><span className="text-slate-200">{formatMontant(totalTVA)}</span></div>
                          <div className="flex justify-between font-semibold text-sm pt-1"><span className="text-slate-300">Total TTC</span><span className="text-white">{formatMontant(totalTTC)}</span></div>
                          <div className="text-slate-500 text-[10px]">Soit {formatMontant(montantPeriodiqueTTC)} TTC / {freqLabel}</div>
                        </div>
                      </div>

                      {/* Fix #20: Signatures — more prominent upload area */}
                      <div className="border border-white/10 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signatures</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Expert-comptable", sig: signatureExpert, setter: setSignatureExpert, type: "expert" as const },
                            { label: "Client", sig: signatureClient, setter: setSignatureClient, type: "client" as const },
                          ].map(({ label, sig, setter, type }) => (
                            <div key={type}>
                              <Label className="text-[10px] text-slate-500 mb-1.5 block">{label}</Label>
                              {sig ? (
                                <div className="relative border border-white/10 rounded-xl p-3 bg-white/5 group">
                                  <img src={sig} alt={`Signature ${label}`} className="max-h-20 mx-auto" />
                                  <button onClick={() => setter("")} className="absolute top-2 right-2 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-xl p-5 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 text-xs text-slate-500 transition-all duration-200 group">
                                  <Upload className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                  <span className="group-hover:text-blue-400 transition-colors">PNG / JPG</span>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={(e) => { if (e.target.files?.[0]) handleSignatureUpload(type, e.target.files[0]); }} />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fix #21: Notes internes with character count */}
                      <div className="border border-white/10 rounded-xl p-4">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Notes internes (non imprimees)
                        </h3>
                        <textarea
                          value={notesInternes}
                          onChange={(e) => { setNotesInternes(e.target.value); markDirty(); }}
                          placeholder="Notes visibles uniquement par le cabinet..."
                          className="w-full rounded-lg border border-white/10 bg-slate-800/50 text-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                          style={{ minHeight: 60 }}
                          maxLength={2000}
                        />
                        <div className="flex justify-end mt-1 text-[10px] text-slate-600">
                          {notesInternes.length} / 2000
                        </div>
                      </div>

                      {/* Save button */}
                      <Button onClick={() => handleSave(false)} className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                        <Save className="h-4 w-4" /> Sauvegarder
                      </Button>

                      {/* Fix #43: Last save date in footer */}
                      {lastSaved && (
                        <div className="text-center text-[10px] text-slate-600 pb-2">
                          Derniere sauvegarde : {lastSaved.toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Right panel — Live preview */}
              <div className="overflow-auto bg-slate-950/50 relative">
                {/* Fix #41: expand button when panel is collapsed */}
                {leftPanelCollapsed && (
                  <Button size="sm" variant="ghost" onClick={() => setLeftPanelCollapsed(false)}
                    className="absolute top-2 left-2 z-10 text-slate-500 hover:text-white bg-slate-900/80 backdrop-blur transition-colors"
                    title="Afficher le panneau">
                    <PanelLeftOpen className="w-4 h-4" />
                  </Button>
                )}
                {client ? (
                  <div className="relative">
                    <LettreMissionA4Preview
                      sections={template} client={client} genre={genre} missions={missions}
                      honoraires={honoraires} cabinet={cabinet} status={status}
                      signatureExpert={signatureExpert} signatureClient={signatureClient}
                      objetContrat={objetContrat}
                    />
                    {/* Fix #34: Scroll indicator */}
                    <div className="sticky bottom-0 left-0 right-0 flex justify-center py-2 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none">
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <ScrollText className="w-3 h-3" /> Scroll pour voir plus
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Fix #48: Better empty state */
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="w-20 h-20 rounded-2xl bg-slate-800/30 border border-white/5 flex items-center justify-center mb-4">
                      <FileText className="w-10 h-10 text-slate-700" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Apercu de la lettre</p>
                    <p className="text-slate-600 text-xs">Selectionnez un client pour previsualiser la lettre de mission</p>
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
            <Button size="sm" variant="outline" onClick={() => setShowPreviewModal(false)} className="bg-slate-900/90 text-white hover:bg-slate-800 transition-colors">Fermer</Button>
          </div>
          <LettreMissionA4Preview
            sections={template} client={client} genre={genre} missions={missions}
            honoraires={honoraires} cabinet={cabinet} status={status}
            signatureExpert={signatureExpert} signatureClient={signatureClient}
            objetContrat={objetContrat}
          />
        </div>
      )}

      {/* ═══ Fix #46: EXPORT DIALOG — using shadcn Dialog ═══ */}
      <Dialog open={!!showExportDialog} onOpenChange={(open) => { if (!open) setShowExportDialog(null); }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {/* Fix #28: file format icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showExportDialog === "pdf" ? "bg-red-500/20" : "bg-blue-500/20"}`}>
                {showExportDialog === "pdf" ? <FileIcon className="w-4 h-4 text-red-400" /> : <FileText className="w-4 h-4 text-blue-400" />}
              </div>
              Export {showExportDialog?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Verifiez les informations avant l'export
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Pages estimees</span>
              <span className="text-white font-medium">~{estimatedPages}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-slate-400">Statut</span>
              <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} mr-1.5 inline-block`} />
                {statusConf.label}
              </Badge>
            </div>
            {status === "brouillon" && (
              <div className="text-xs text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Le filigrane "PROJET" sera affiche
              </div>
            )}
            {unresolvedVars.length > 0 && (
              <div>
                <div className="text-xs text-red-400 flex items-center gap-1 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Variables non resolues :
                </div>
                <div className="flex flex-wrap gap-1">
                  {unresolvedVars.map((v) => (
                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            )}
            {unresolvedVars.length === 0 && (
              <div className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                <FileCheck className="w-3.5 h-3.5" /> Toutes les variables sont resolues
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowExportDialog(null)} variant="outline" className="flex-1">Annuler</Button>
            <Button onClick={showExportDialog === "pdf" ? handleExportPdf : handleExportDocx}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 transition-colors">
              <FileDown className="h-4 w-4" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Fix #46: NEW MODEL DIALOG — shadcn + Fix #12: Enter key ═══ */}
      <Dialog open={showNewModelDialog} onOpenChange={setShowNewModelDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl sm:max-w-sm"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateModel(); } }}>
          <DialogHeader>
            <DialogTitle className="text-white">Nouveau modele</DialogTitle>
            <DialogDescription className="text-slate-400">Creer un nouveau modele de lettre de mission</DialogDescription>
          </DialogHeader>
          <input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Ex: SCI, EI, SAS..."
            className="w-full rounded-lg border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors" autoFocus />
          <DialogFooter>
            <Button onClick={() => setShowNewModelDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleCreateModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white transition-colors">Creer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Fix #46: RENAME DIALOG — shadcn + Fix #13: Enter key ═══ */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl sm:max-w-sm"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRenameModel(); } }}>
          <DialogHeader>
            <DialogTitle className="text-white">Renommer le modele</DialogTitle>
            <DialogDescription className="text-slate-400">Saisissez le nouveau nom</DialogDescription>
          </DialogHeader>
          <input value={renameModelName} onChange={(e) => setRenameModelName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors" autoFocus />
          <DialogFooter>
            <Button onClick={() => setShowRenameDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleRenameModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white transition-colors">Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Fix #14: DELETE CONFIRMATION DIALOG ═══ */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Supprimer le modele
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Etes-vous sur de vouloir supprimer le modele "{modelList.find(m => m.key === activeModelKey)?.name}" ? Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleDeleteModel} size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-colors">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Fix #46/#9: DUPLICATE DIALOG — shadcn + loads ALL letters ═══ */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Dupliquer depuis une lettre existante</DialogTitle>
            <DialogDescription className="text-slate-400">Selectionnez une lettre pour en copier les parametres</DialogDescription>
          </DialogHeader>
          {allLetters.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune lettre existante trouvee.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {allLetters.map((l) => {
                const lData = l.data || {};
                const lMissions = lData.missions as { sociale?: boolean; juridique?: boolean; fiscal?: boolean } | undefined;
                return (
                  <button key={l.id} onClick={() => handleDuplicate(l)}
                    className="w-full text-left p-3 rounded-xl border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-150">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-200 font-medium">{l.raison_sociale || l.client_ref}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[l.status]?.bg} ${STATUS_CONFIG[l.status]?.color}`}>
                        {STATUS_CONFIG[l.status]?.label}
                      </Badge>
                    </div>
                    {/* Fix #29: more info on history entries */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{new Date(l.updated_at).toLocaleDateString("fr-FR")}</span>
                      {lMissions && (
                        <>
                          <span className="text-slate-700">|</span>
                          {lMissions.sociale && <span className="text-emerald-600">Sociale</span>}
                          {lMissions.juridique && <span className="text-emerald-600">Juridique</span>}
                          {lMissions.fiscal && <span className="text-emerald-600">Fiscal</span>}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Fix #46: HISTORY DIALOG — shadcn + Fix #29: more info ═══ */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white sm:rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Historique des lettres</DialogTitle>
            <DialogDescription className="text-slate-400">Lettres enregistrees pour ce client</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-auto">
            {savedLetters.map((l) => {
              const lData = l.data || {};
              const lMissions = lData.missions as { sociale?: boolean; juridique?: boolean; fiscal?: boolean } | undefined;
              const lHonoraires = lData.honoraires as { comptable?: number } | undefined;
              return (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
                  <div>
                    <div className="text-sm text-slate-200">{new Date(l.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[l.status]?.bg} ${STATUS_CONFIG[l.status]?.color}`}>{STATUS_CONFIG[l.status]?.label}</Badge>
                      {/* Fix #29: show missions and total */}
                      {lMissions && (
                        <span className="text-[10px] text-slate-600">
                          {[lMissions.sociale && "Soc.", lMissions.juridique && "Jur.", lMissions.fiscal && "Fisc."].filter(Boolean).join(" / ") || "Comptable"}
                        </span>
                      )}
                      {lHonoraires?.comptable && (
                        <span className="text-[10px] text-slate-500">{formatMontant(lHonoraires.comptable)} HT</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { handleDuplicate(l); setShowHistoryDialog(false); }} className="text-xs hover:bg-white/5 transition-colors">
                    Charger
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
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
