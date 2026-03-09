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
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Star,
  StarOff,
  GripVertical,
  Keyboard,
  ZoomIn,
  ZoomOut,
  ClipboardCopy,
  Tag,
  Calendar,
  Moon,
  Sun,
  FileJson,
  Download,
  ChevronUp,
  MessageSquare,
  Calculator,
  Flag,
  Users,
  Loader2,
  ChevronsUpDown,
  Filter,
  Palette,
  Home,
  Paperclip,
} from "lucide-react";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

type LetterStatus = "brouillon" | "en_attente" | "signee" | "archivee";
type RegimeFiscal = "IS" | "IR" | "BIC" | "BNC" | "BA" | "micro_BIC" | "micro_BNC";
type RegimeTVA = "reel_normal" | "reel_simplifie" | "franchise";
type VolumeComptable = "moins_500" | "500_2000" | "plus_2000";
type Periodicite = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
type ConditionsPaiement = "30j" | "45j" | "60j" | "comptant";
type LetterPriority = "urgent" | "normal" | "low";
type PdfColorTheme = "navy" | "green" | "red";

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

interface ExportLogEntry {
  date: string;
  type: "pdf" | "docx";
  clientRef: string;
}

interface SectionComment {
  sectionId: string;
  text: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<LetterStatus, { label: string; color: string; bg: string }> = {
  brouillon: { label: "Brouillon", color: "text-slate-400", bg: "bg-slate-500/20 border-slate-500/30" },
  en_attente: { label: "En attente de signature", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  signee: { label: "Signée", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  archivee: { label: "Archivée", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
};

const PRIORITY_CONFIG: Record<LetterPriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "text-red-400" },
  normal: { label: "Normal", color: "text-slate-400" },
  low: { label: "Basse", color: "text-blue-400" },
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

// BugFix #1: check BOTH storages
function loadCabinet(): CabinetInfo {
  try {
    const fromSession = sessionStorage.getItem("lcb-cabinet-config");
    if (fromSession) {
      try { return { ...DEFAULT_CABINET, ...JSON.parse(fromSession) }; }
      catch { /* corrupted */ }
    }
    const fromLocal = localStorage.getItem("lcb-cabinet-config");
    if (fromLocal) {
      try { return { ...DEFAULT_CABINET, ...JSON.parse(fromLocal) }; }
      catch { /* corrupted */ }
    }
  } catch { /* ignore */ }
  return DEFAULT_CABINET;
}

// BugFix #34: handle Infinity/NaN
function formatMontant(n: number): string {
  if (!Number.isFinite(n)) return "0 \u20ac";
  return n.toLocaleString("fr-FR") + " \u20ac";
}

// Feature #22: normalize accents for key generation
function normalizeForKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Feature #12: letter numbering
function generateLetterNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `LM-${year}-${seq}`;
}

// Improvement #7: status dot colors
const STATUS_DOT_COLOR: Record<LetterStatus, string> = {
  brouillon: "bg-slate-400",
  en_attente: "bg-amber-400",
  signee: "bg-emerald-400",
  archivee: "bg-blue-400",
};

// Improvement #13/#35: tag color palette
const TAG_COLORS = [
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-green-500/20 text-green-300 border-green-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTagColor(tag: string, index: number): string {
  const h = hashString(tag);
  return TAG_COLORS[(h + index) % TAG_COLORS.length];
}

// Improvement #3: custom select chevron SVG data URI
const SELECT_CHEVRON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E";

const STYLED_SELECT_CLS = `appearance-none bg-no-repeat bg-[length:16px] rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm pr-8 hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors`;

// Improvement #29: checklist categories
const CHECKLIST_CATEGORIES = [
  { label: "Identit\u00e9 client", indices: [0, 1, 2] },
  { label: "Configuration", indices: [3, 4, 7, 8] },
  { label: "Signatures", indices: [5, 6, 9] },
];

// Improvement #42: section type icons
function getSectionTypeIcon(section: TemplateSection): React.ReactNode {
  if (!section.editable) return <Lock className="w-3.5 h-3.5 text-slate-500" />;
  if (section.type === "conditional") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  if (section.type === "annexe") return <Paperclip className="w-3.5 h-3.5 text-blue-400" />;
  if (section.id.startsWith("custom_")) return <Star className="w-3.5 h-3.5 text-purple-400" />;
  return <FileText className="w-3.5 h-3.5 text-slate-400" />;
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients, collaborateurs } = useAppState();
  const cabinet = useMemo(() => loadCabinet(), []);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelScrollRef = useRef(0);

  // ── Multi-model state ──
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
  const [templateVersion, setTemplateVersion] = useState(1);
  const [templateSearch, setTemplateSearch] = useState("");

  // ── Generate state ──
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [genre, setGenre] = useState<"M" | "Mme">("M");
  const [missions, setMissions] = useState({ sociale: false, juridique: false, fiscal: false });
  const [honoraires, setHonoraires] = useState({
    comptable: 0, constitution: 0, juridique: 0,
    frequence: "MENSUEL" as Periodicite,
  });

  // Feature #1: exercise dates
  const [dateDebutExercice, setDateDebutExercice] = useState("");
  const [dateFinExercice, setDateFinExercice] = useState("");

  // Feature #3: regime fiscal
  const [regimeFiscal, setRegimeFiscal] = useState<RegimeFiscal>("IS");

  // Feature #4: regime TVA
  const [regimeTVA, setRegimeTVA] = useState<RegimeTVA>("reel_normal");

  // Feature #5: volume comptable
  const [volumeComptable, setVolumeComptable] = useState<VolumeComptable>("500_2000");

  // Feature #6: outil comptable
  const [outilComptable, setOutilComptable] = useState("");

  // Feature #8: CAC toggle
  const [hasCAC, setHasCAC] = useState(false);

  // ── Status ──
  const [status, setStatus] = useState<LetterStatus>("brouillon");

  // ── Signatures ──
  const [signatureExpert, setSignatureExpert] = useState<string>("");
  const [signatureClient, setSignatureClient] = useState<string>("");
  const [signatureDate, setSignatureDate] = useState("");

  // ── Notes internes ──
  const [notesInternes, setNotesInternes] = useState("");

  // ── Objet du contrat (Feature #39: multiline) ──
  const [objetContrat, setObjetContrat] = useState("Pr\u00e9sentation des comptes annuels");

  // Feature #40: honoraires remise
  const [remisePourcent, setRemisePourcent] = useState(0);

  // Feature #41: acompte
  const [acompte, setAcompte] = useState(0);

  // Feature #42: conditions de paiement
  const [conditionsPaiement, setConditionsPaiement] = useState<ConditionsPaiement>("30j");

  // Feature #43: reference externe
  const [referenceExterne, setReferenceExterne] = useState("");

  // Feature #44: date signature prevue
  const [dateSignaturePrevue, setDateSignaturePrevue] = useState("");

  // Feature #45: responsable dossier
  const [responsableDossier, setResponsableDossier] = useState("");

  // Feature #46: document language
  const [documentLanguage] = useState("FR");

  // Feature #47: letter priority
  const [priority, setPriority] = useState<LetterPriority>("normal");

  // Feature #36: letter tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Feature #17: custom watermark
  const [watermarkText, setWatermarkText] = useState("PROJET");

  // Feature #22: section comments
  const [sectionComments, setSectionComments] = useState<SectionComment[]>([]);

  // Feature #23: clause favorites
  const [favoriteSections, setFavoriteSections] = useState<string[]>([]);

  // Feature #27: PDF orientation
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("portrait");

  // Feature #35: color theme
  const [pdfColorTheme, setPdfColorTheme] = useState<PdfColorTheme>("navy");

  // Feature #29: reminder date
  const [reminderDate, setReminderDate] = useState("");

  // Feature #32: client notes
  const [clientNotes, setClientNotes] = useState("");

  // Feature #12: letter number
  const [letterNumber, setLetterNumber] = useState(() => generateLetterNumber());

  // Feature #18: export history
  const [exportHistory, setExportHistory] = useState<ExportLogEntry[]>([]);

  // Feature #20: zoom
  const [previewZoom, setPreviewZoom] = useState(100);

  // Feature #26: dark preview
  const [darkPreview, setDarkPreview] = useState(false);

  // ── UI state ──
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState<"pdf" | "docx" | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showValidationChecklist, setShowValidationChecklist] = useState(false);
  const [showTemplateJsonDialog, setShowTemplateJsonDialog] = useState(false);
  const [showQuickDuplicateDialog, setShowQuickDuplicateDialog] = useState(false);
  const [quickDuplicateTargetRef, setQuickDuplicateTargetRef] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [activeTab, setActiveTab] = useState("modele");
  const [savingLetter, setSavingLetter] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [leftPanelLoading, setLeftPanelLoading] = useState(false);
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, unknown>>({});

  // ── Autosave ──
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSaveType, setLastSaveType] = useState<"auto" | "manual" | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);
  const [timeSinceSaveStr, setTimeSinceSaveStr] = useState<string | null>(null);

  // Feature #15: recent clients
  const [recentClientRefs, setRecentClientRefs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("lcb-recent-clients");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  // Improvement #31: debounce client search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientSearch(clientSearch), 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // Feature #2: client search filtering
  const filteredClients = useMemo(() => {
    if (!debouncedClientSearch.trim()) return clients;
    const q = debouncedClientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.raisonSociale?.toLowerCase().includes(q) ||
        c.ref?.toLowerCase().includes(q) ||
        c.siren?.toLowerCase().includes(q)
    );
  }, [clients, debouncedClientSearch]);

  // Feature #47: group by vigilance
  const clientsByVigilance = useMemo(() => {
    const groups: Record<string, Client[]> = { RENFORCEE: [], STANDARD: [], SIMPLIFIEE: [] };
    filteredClients.forEach((c) => {
      const level = c.nivVigilance || "STANDARD";
      if (!groups[level]) groups[level] = [];
      groups[level].push(c);
    });
    return groups;
  }, [filteredClients]);

  // ── BugFix #44: recalculate timeSinceSave every 10s ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastSaved) { setTimeSinceSaveStr(null); return; }
      const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
      if (diff < 60) setTimeSinceSaveStr(`il y a ${diff}s`);
      else setTimeSinceSaveStr(`il y a ${Math.round(diff / 60)} min`);
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  // ── BugFix #40: preserve left panel scroll ──
  useEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    const handleScroll = () => { leftPanelScrollRef.current = el.scrollTop; };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const el = leftPanelRef.current;
    if (el && leftPanelScrollRef.current) {
      el.scrollTop = leftPanelScrollRef.current;
    }
  }); // Intentional: runs every render to restore scroll position after re-render


  // ── Load models list and active template from Supabase on mount ──
  useEffect(() => {
    async function loadModels() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTemplateLoaded(true); return; }

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

          const firstModel = allParams[0];
          const val = firstModel.valeur as Record<string, unknown>;
          const sections = val?._sections;
          if (Array.isArray(sections)) {
            setTemplate(sections as TemplateSection[]);
          }
          if (typeof val?._version === "number") {
            setTemplateVersion(val._version as number);
          }
        }
      } catch (err) {
        logger.warn("[loadModels]", err);
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
        if (typeof val?._version === "number") {
          setTemplateVersion(val._version as number);
        }
      } else {
        setTemplate(DEFAULT_TEMPLATE);
        setTemplateVersion(1);
      }
    } catch (err) {
      logger.error("[loadModelTemplate]", err);
    }
  }, []);

  // ── Auto-fill when client changes ──
  useEffect(() => {
    if (!client) return;
    setHonoraires({
      comptable: client.honoraires || 0,
      constitution: client.reprise || 0,
      juridique: client.juridique || 0,
      frequence: client.frequence?.toLowerCase() === "trimestriel" ? "TRIMESTRIEL"
        : client.frequence?.toLowerCase() === "annuel" ? "ANNUEL"
        : client.frequence?.toLowerCase() === "semestriel" ? "SEMESTRIEL" : "MENSUEL",
    });
    // Feature #15: track recent clients
    setRecentClientRefs((prev) => {
      const updated = [client.ref, ...prev.filter((r) => r !== client.ref)].slice(0, 5);
      try { localStorage.setItem("lcb-recent-clients", JSON.stringify(updated)); } catch { /* */ }
      return updated;
    });
    loadClientLetters(client.ref);
  }, [client]);

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
    } catch (err) {
      logger.error("[loadClientLetters]", err);
    }
  }, [clients]);

  // ── Feature #24: auto-populate from last letter ──
  const autoPopulateFromLastLetter = useCallback((letter: SavedLetter) => {
    const data = letter.data;
    if (data.missions) setMissions(data.missions as typeof missions);
    if (data.honoraires) setHonoraires(data.honoraires as typeof honoraires);
    if (data.genre) setGenre(data.genre as "M" | "Mme");
    if (data.notes_internes) setNotesInternes(data.notes_internes as string);
    if (data.status) setStatus(data.status as LetterStatus);
    if (data.model_key) setActiveModelKey(data.model_key as string);
    if (data.objet_contrat) setObjetContrat(data.objet_contrat as string);
    if (data.signature_expert) setSignatureExpert(data.signature_expert as string);
    if (data.signature_client) setSignatureClient(data.signature_client as string);
    if (data.regime_fiscal) setRegimeFiscal(data.regime_fiscal as RegimeFiscal);
    if (data.regime_tva) setRegimeTVA(data.regime_tva as RegimeTVA);
    if (data.volume_comptable) setVolumeComptable(data.volume_comptable as VolumeComptable);
    if (data.outil_comptable) setOutilComptable(data.outil_comptable as string);
    if (data.has_cac !== undefined) setHasCAC(data.has_cac as boolean);
    if (data.remise_pourcent) setRemisePourcent(data.remise_pourcent as number);
    if (data.acompte) setAcompte(data.acompte as number);
    if (data.conditions_paiement) setConditionsPaiement(data.conditions_paiement as ConditionsPaiement);
    if (data.reference_externe) setReferenceExterne(data.reference_externe as string);
    if (data.responsable_dossier) setResponsableDossier(data.responsable_dossier as string);
    if (data.priority) setPriority(data.priority as LetterPriority);
    if (data.tags) setTags(data.tags as string[]);
    if (data.client_notes) setClientNotes(data.client_notes as string);
    if (data.watermark_text) setWatermarkText(data.watermark_text as string);
    if (data.pdf_color_theme) setPdfColorTheme(data.pdf_color_theme as PdfColorTheme);
  }, []);

  // ── Auto-populate when selecting client with existing letter ──
  useEffect(() => {
    if (savedLetters.length > 0 && client) {
      autoPopulateFromLastLetter(savedLetters[0]);
    }
  }, [savedLetters]);

  // Improvement #32: left panel loading skeleton on client change
  useEffect(() => {
    if (client) {
      setLeftPanelLoading(true);
      const timer = setTimeout(() => setLeftPanelLoading(false), 200);
      return () => clearTimeout(timer);
    }
  }, [client?.ref]);

  // Improvement #40: track initial field values for dirty indicator
  useEffect(() => {
    if (client) {
      setInitialFieldValues({
        genre, honoraires_comptable: honoraires.comptable, honoraires_constitution: honoraires.constitution,
        honoraires_juridique: honoraires.juridique, honoraires_frequence: honoraires.frequence,
        objetContrat, regimeFiscal, regimeTVA, volumeComptable, notesInternes,
        signatureExpert, signatureClient, status, priority,
      });
    }
  }, [client?.ref]);

  // ── Autosave with countdown (Feature #10) ──
  useEffect(() => {
    if (!isDirty || !client) {
      setAutoSaveCountdown(null);
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (autoSaveCountdownRef.current) clearInterval(autoSaveCountdownRef.current);

    let remaining = 30;
    let mounted = true;
    setAutoSaveCountdown(remaining);
    autoSaveCountdownRef.current = setInterval(() => {
      remaining -= 1;
      if (mounted) setAutoSaveCountdown(remaining > 0 ? remaining : null);
    }, 1000);

    autoSaveTimerRef.current = setTimeout(() => {
      if (mounted) handleSave(true);
      if (autoSaveCountdownRef.current) clearInterval(autoSaveCountdownRef.current);
      if (mounted) setAutoSaveCountdown(null);
    }, 30000);

    return () => {
      mounted = false;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveCountdownRef.current) clearInterval(autoSaveCountdownRef.current);
    };
  }, [isDirty, honoraires, missions, genre, status, notesInternes, signatureExpert, signatureClient, regimeFiscal, regimeTVA, volumeComptable, priority, tags, clientNotes, remisePourcent, acompte, conditionsPaiement]);

  // BugFix #25: comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveCountdownRef.current) clearInterval(autoSaveCountdownRef.current);
    };
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);

  // ── Keyboard shortcuts (Feature #11, BugFix #13) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        if (client) setShowPreviewModal(true);
      }
      if (e.key === "Escape" && showPreviewModal) {
        setShowPreviewModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [client, showPreviewModal]);

  // ── Save template ──
  const handleSaveTemplate = useCallback(async () => {
    setTemplateSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Connexion requise"); return; }
      const modelName = modelList.find((m) => m.key === activeModelKey)?.name || "Standard";
      const newVersion = templateVersion + 1;
      const { error } = await supabase.from("parametres").upsert({
        user_id: user.id,
        cle: activeModelKey,
        valeur: { _modelName: modelName, _sections: template, _version: newVersion } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,cle" });
      if (error) throw error;
      setTemplateVersion(newVersion);
      toast.success("Mod\u00e8le sauvegard\u00e9");
    } catch (err) {
      logger.error("[saveTemplate]", err);
      // BugFix #46: show error details
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    } finally {
      setTemplateSaving(false);
    }
  }, [template, activeModelKey, modelList, templateVersion]);

  // ── Create new model ──
  const handleCreateModel = useCallback(async () => {
    if (!newModelName.trim()) return;
    // BugFix #22: normalize accents for key
    const key = "modele_lm_" + normalizeForKey(newModelName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("parametres").upsert({
        user_id: user.id,
        cle: key,
        valeur: { _modelName: newModelName.trim(), _sections: template, _version: 1 } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,cle" });
      setModelList((prev) => [...prev, { key, name: newModelName.trim() }]);
      setActiveModelKey(key);
      setShowNewModelDialog(false);
      setNewModelName("");
      toast.success(`Mod\u00e8le \u00ab ${newModelName.trim()} \u00bb cr\u00e9\u00e9`);
    } catch (err) {
      logger.error("[createModel]", err);
      toast.error("Erreur lors de la cr\u00e9ation du mod\u00e8le");
    }
  }, [newModelName, template]);

  // ── Delete model ──
  const handleDeleteModel = useCallback(async () => {
    if (modelList.length <= 1) { toast.error("Impossible de supprimer le dernier mod\u00e8le"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("parametres").delete().eq("user_id", user.id).eq("cle", activeModelKey);
      const remaining = modelList.filter((m) => m.key !== activeModelKey);
      setModelList(remaining);
      setActiveModelKey(remaining[0].key);
      await loadModelTemplate(remaining[0].key);
      toast.success("Mod\u00e8le supprim\u00e9");
    } catch (err) {
      logger.error("[deleteModel]", err);
      toast.error("Erreur lors de la suppression");
    }
  }, [activeModelKey, modelList, loadModelTemplate]);

  // ── Rename model — BugFix #9: persist to Supabase ──
  const handleRenameModel = useCallback(async () => {
    if (!renameModelName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Update local state
      setModelList((prev) => prev.map((m) => m.key === activeModelKey ? { ...m, name: renameModelName.trim() } : m));
      // Persist to DB
      const { data: existing } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("user_id", user.id)
        .eq("cle", activeModelKey)
        .maybeSingle();
      const existingVal = (existing?.valeur as Record<string, unknown>) || {};
      await supabase.from("parametres").upsert({
        user_id: user.id,
        cle: activeModelKey,
        valeur: { ...existingVal, _modelName: renameModelName.trim() } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,cle" });
      setShowRenameDialog(false);
      toast.success("Mod\u00e8le renomm\u00e9");
    } catch (err) {
      logger.error("[renameModel]", err);
      toast.error("Erreur lors du renommage");
    }
  }, [renameModelName, activeModelKey]);

  // BugFix #17: confirm before reset
  const handleResetTemplate = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    setTemplateVersion(1);
    setShowResetConfirm(false);
    toast.success("Mod\u00e8le r\u00e9initialis\u00e9");
  }, []);

  // ── Update section content ──
  const updateSectionContent = useCallback((id: string, content: string) => {
    setTemplate((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
  }, []);

  // ── Add custom clause ──
  const addCustomClause = useCallback((afterId: string) => {
    const newSection: TemplateSection = {
      id: `custom_${Date.now()}`,
      title: "Clause personnalis\u00e9e",
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

  // Feature #9: duplicate section
  const duplicateSection = useCallback((id: string) => {
    setTemplate((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const duplicate: TemplateSection = {
        ...original,
        id: `custom_${Date.now()}`,
        title: `${original.title} (copie)`,
        editable: true,
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicate);
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

  // ── Collapse/Expand all ──
  const collapseAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    template.forEach((s) => { all[s.id] = true; });
    setCollapsed(all);
  }, [template]);

  const expandAll = useCallback(() => {
    setCollapsed({});
  }, []);

  // Feature #23: toggle favorite
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteSections((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  // Feature #22: section comments
  const addSectionComment = useCallback((sectionId: string, text: string) => {
    setSectionComments((prev) => [...prev, { sectionId, text, createdAt: new Date().toISOString() }]);
  }, []);

  const removeSectionComment = useCallback((sectionId: string, idx: number) => {
    setSectionComments((prev) => {
      const forSection = prev.filter((c) => c.sectionId === sectionId);
      const others = prev.filter((c) => c.sectionId !== sectionId);
      forSection.splice(idx, 1);
      return [...others, ...forSection];
    });
  }, []);

  // ── Save letter to Supabase ──
  const handleSave = useCallback(async (silent = false) => {
    // BugFix #24: validate client selected
    if (!client) {
      if (!silent) toast.error("Veuillez s\u00e9lectionner un client avant de sauvegarder");
      return;
    }
    setSavingLetter(true);
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
          regime_fiscal: regimeFiscal,
          regime_tva: regimeTVA,
          volume_comptable: volumeComptable,
          outil_comptable: outilComptable,
          has_cac: hasCAC,
          date_debut_exercice: dateDebutExercice,
          date_fin_exercice: dateFinExercice,
          signature_date: signatureDate,
          remise_pourcent: remisePourcent,
          acompte,
          conditions_paiement: conditionsPaiement,
          reference_externe: referenceExterne,
          date_signature_prevue: dateSignaturePrevue,
          responsable_dossier: responsableDossier,
          priority,
          tags,
          client_notes: clientNotes,
          watermark_text: watermarkText,
          pdf_color_theme: pdfColorTheme,
          pdf_orientation: pdfOrientation,
          reminder_date: reminderDate,
          letter_number: letterNumber,
          section_comments: sectionComments,
          favorite_sections: favoriteSections,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_ref,user_id" });
      setIsDirty(false);
      setLastSaved(new Date());
      setLastSaveType(silent ? "auto" : "manual");
      // BugFix #45: distinguish autosave from manual
      if (!silent) toast.success("Lettre sauvegard\u00e9e");
      else toast.success("Sauvegarde automatique effectu\u00e9e", { duration: 2000 });
    } catch (err) {
      logger.warn("[save]", err);
      if (!silent) toast.error("Erreur de sauvegarde");
    } finally {
      setSavingLetter(false);
    }
  }, [client, status, missions, honoraires, genre, notesInternes, signatureExpert, signatureClient, objetContrat, activeModelKey, regimeFiscal, regimeTVA, volumeComptable, outilComptable, hasCAC, dateDebutExercice, dateFinExercice, signatureDate, remisePourcent, acompte, conditionsPaiement, referenceExterne, dateSignaturePrevue, responsableDossier, priority, tags, clientNotes, watermarkText, pdfColorTheme, pdfOrientation, reminderDate, letterNumber, sectionComments, favoriteSections]);

  // ── Duplicate from saved letter — BugFix #27: copy all fields ──
  const handleDuplicate = useCallback(async (letter: SavedLetter) => {
    setDuplicateLoading(true);
    autoPopulateFromLastLetter(letter);
    setDuplicateLoading(false);
    setShowDuplicateDialog(false);
    toast.success("Param\u00e8tres dupliqu\u00e9s depuis la lettre existante");
  }, [autoPopulateFromLastLetter]);

  // Feature #50: quick duplicate to new client
  const handleQuickDuplicate = useCallback(async () => {
    if (!quickDuplicateTargetRef || !client) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const targetClient = clients.find((c) => c.ref === quickDuplicateTargetRef);
      if (!targetClient) return;
      await supabase.from("lettres_mission").upsert({
        user_id: user.id,
        client_ref: targetClient.ref,
        status: "brouillon",
        data: {
          missions, honoraires, genre, status: "brouillon",
          notes_internes: "", objet_contrat: objetContrat,
          model_key: activeModelKey, regime_fiscal: regimeFiscal,
          regime_tva: regimeTVA, volume_comptable: volumeComptable,
          priority, tags, conditions_paiement: conditionsPaiement,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_ref,user_id" });
      setShowQuickDuplicateDialog(false);
      toast.success(`Lettre dupliqu\u00e9e vers ${targetClient.raisonSociale}`);
    } catch (err) {
      logger.error("[quickDuplicate]", err);
      toast.error("Erreur de duplication");
    }
  }, [quickDuplicateTargetRef, client, missions, honoraires, genre, objetContrat, activeModelKey, regimeFiscal, regimeTVA, volumeComptable, priority, tags, conditionsPaiement, clients]);

  // ── Delete individual saved letter (BugFix #19) ──
  const handleDeleteLetter = useCallback(async (letterId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("lettres_mission").delete().eq("id", letterId).eq("user_id", user.id);
      setSavedLetters((prev) => prev.filter((l) => l.id !== letterId));
      toast.success("Lettre supprim\u00e9e");
    } catch (err) {
      logger.error("[deleteLetter]", err);
      toast.error("Erreur de suppression");
    }
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
      date_cloture: dateFinExercice || `31/12/${now.getFullYear()}`,
      date_validite: dateValidite,
      associe: client.associe,
      nom_cabinet: cabinet.nom, ville_cabinet: cabinet.ville,
      iban: client.iban ? client.iban.replace(/(.{4})/g, "$1 ").trim() : "",
      bic: client.bic || "",
      objet_contrat: objetContrat,
      date_debut_exercice: dateDebutExercice || `01/01/${now.getFullYear()}`,
      date_fin_exercice: dateFinExercice || `31/12/${now.getFullYear()}`,
      regime_fiscal: regimeFiscal,
      regime_tva: regimeTVA === "reel_normal" ? "R\u00e9el normal" : regimeTVA === "reel_simplifie" ? "R\u00e9el simplifi\u00e9" : "Franchise en base",
    } as Record<string, string>;
  }, [client, genre, cabinet, objetContrat, dateDebutExercice, dateFinExercice, regimeFiscal, regimeTVA]);

  // ── Page estimation ──
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

  // Feature #16: template statistics
  const templateStats = useMemo(() => {
    const activeSections = template.filter((s) => {
      if (s.type === "conditional") {
        if (s.condition === "sociale" && !missions.sociale) return false;
        if (s.condition === "juridique" && !missions.juridique) return false;
        if (s.condition === "fiscal" && !missions.fiscal) return false;
      }
      return true;
    });
    const allText = activeSections.map((s) => s.content).join(" ");
    const wordCount = allText.split(/\s+/).filter(Boolean).length;
    return { sectionCount: activeSections.length, wordCount, estimatedPages };
  }, [template, missions, estimatedPages]);

  // Improvement #40: check if field is dirty
  const isFieldDirty = useCallback((fieldKey: string, currentValue: unknown): boolean => {
    return initialFieldValues[fieldKey] !== undefined && initialFieldValues[fieldKey] !== currentValue;
  }, [initialFieldValues]);

  // ── Unresolved variables ──
  const unresolvedVars = useMemo(() => {
    if (!client) return [];
    const allContent = template.map((s) => s.content).join(" ");
    const resolved = replaceTemplateVariables(allContent, previewVariables);
    const remaining = [...resolved.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    return [...new Set(remaining)];
  }, [template, client, previewVariables]);

  // BugFix #30: completion info accounts for signatures, missions, notes
  const completionInfo = useMemo(() => {
    const items: { label: string; done: boolean }[] = [
      { label: "Client s\u00e9lectionn\u00e9", done: !!client },
      { label: "Dirigeant renseign\u00e9", done: !!client?.dirigeant },
      { label: "SIREN renseign\u00e9", done: !!client?.siren },
      { label: "Honoraires d\u00e9finis", done: honoraires.comptable > 0 },
      { label: "Objet du contrat", done: !!objetContrat },
      { label: "Signature expert", done: !!signatureExpert },
      { label: "Signature client", done: !!signatureClient },
      { label: "R\u00e9gime fiscal", done: !!regimeFiscal },
      { label: "Missions s\u00e9lectionn\u00e9es", done: missions.sociale || missions.juridique || missions.fiscal },
      { label: "Notes internes", done: !!notesInternes },
    ];
    const doneCount = items.filter((i) => i.done).length;
    return { items, doneCount, total: items.length, pct: Math.round((doneCount / items.length) * 100) };
  }, [client, honoraires, objetContrat, signatureExpert, signatureClient, regimeFiscal, missions, notesInternes]);

  // Feature #33: honoraires calculator / smart suggestions (Feature #49)
  const honorairesSuggestion = useMemo(() => {
    if (!client) return null;
    const base = volumeComptable === "moins_500" ? 1500 : volumeComptable === "500_2000" ? 3000 : 5000;
    const missionMult = (missions.sociale ? 1.4 : 1) * (missions.juridique ? 1.15 : 1);
    const suggested = Math.round(base * missionMult);
    const current = honoraires.comptable;
    if (current > 0 && current < suggested * 0.5) return { type: "low" as const, suggested };
    if (current > suggested * 2) return { type: "high" as const, suggested };
    return null;
  }, [client, volumeComptable, missions, honoraires.comptable]);

  // ── Signature upload handler — BugFix #11: size limit, BugFix #26: mime check ──
  const handleSignatureUpload = useCallback((type: "expert" | "client", file: File) => {
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      toast.error("Le fichier d\u00e9passe la taille maximale de 2 Mo");
      return;
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non support\u00e9. Utilisez PNG, JPG ou WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (type === "expert") setSignatureExpert(base64);
      else setSignatureClient(base64);
      markDirty();
    };
    reader.readAsDataURL(file);
  }, [markDirty]);

  // BugFix #37: warn if status signee without signatures
  const handleStatusChange = useCallback((newStatus: LetterStatus) => {
    if (newStatus === "signee" && (!signatureExpert || !signatureClient)) {
      toast.warning("Attention : les signatures ne sont pas toutes pr\u00e9sentes");
    }
    setStatus(newStatus);
    markDirty();
  }, [signatureExpert, signatureClient, markDirty]);

  // Improvement #28: export progress simulation
  const startExportProgress = useCallback(() => {
    setExportProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 90) { progress = 90; clearInterval(interval); }
      setExportProgress(Math.min(90, Math.round(progress)));
    }, 200);
    return () => { clearInterval(interval); setExportProgress(100); setTimeout(() => setExportProgress(null), 500); };
  }, []);

  // ── Export PDF — BugFix #20: loading state ──
  const handleExportPdf = useCallback(async () => {
    if (!client) return;
    setExportLoading(true);
    setShowExportDialog(null);
    const finishProgress = startExportProgress();
    try {
      const { renderNewLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
      renderNewLettreMissionPdf({
        sections: template, client, genre, missions, honoraires, cabinet,
        variables: previewVariables, status, signatureExpert, signatureClient,
      });
      // Feature #18: log export
      setExportHistory((prev) => [...prev, { date: new Date().toISOString(), type: "pdf", clientRef: client.ref }]);
      finishProgress();
      toast.success("PDF g\u00e9n\u00e9r\u00e9");
    } catch (err) {
      logger.error("[PDF]", err);
      setExportProgress(null);
      toast.error("Erreur PDF");
    } finally {
      setExportLoading(false);
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables, status, signatureExpert, signatureClient, startExportProgress]);

  // ── Export DOCX ──
  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    setExportLoading(true);
    setShowExportDialog(null);
    const finishProgress = startExportProgress();
    try {
      const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
      await renderNewLettreMissionDocx({
        sections: template, client, genre, missions, honoraires, cabinet,
        variables: previewVariables, status, signatureExpert, signatureClient,
      });
      setExportHistory((prev) => [...prev, { date: new Date().toISOString(), type: "docx", clientRef: client.ref }]);
      finishProgress();
      toast.success("DOCX g\u00e9n\u00e9r\u00e9");
    } catch (err) {
      logger.error("[DOCX]", err);
      setExportProgress(null);
      toast.error("Erreur DOCX");
    } finally {
      setExportLoading(false);
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables, status, signatureExpert, signatureClient, startExportProgress]);

  // ── Email ──
  const handleEmail = useCallback(() => {
    if (!client) return;
    if (!client.mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.mail)) {
      toast.error("Adresse email client invalide");
      return;
    }
    const subject = encodeURIComponent(`Lettre de mission \u2014 ${client.raisonSociale}`);
    const body = encodeURIComponent("Veuillez trouver ci-joint votre lettre de mission.\n\nCordialement,\n" + cabinet.nom);
    window.location.href = `mailto:${client.mail}?subject=${subject}&body=${body}`;
    handleExportPdf();
    toast.success("Client mail ouvert \u2014 PDF t\u00e9l\u00e9charg\u00e9");
  }, [client, cabinet, handleExportPdf]);

  // ── Print ──
  const handlePrint = useCallback(() => {
    setShowPreviewModal(true);
    setTimeout(() => window.print(), 500);
  }, []);

  // Feature #14: copy letter content to clipboard
  const handleCopyContent = useCallback(() => {
    if (!client) return;
    const activeSections = template.filter((s) => {
      if (s.type === "conditional") {
        if (s.condition === "sociale" && !missions.sociale) return false;
        if (s.condition === "juridique" && !missions.juridique) return false;
        if (s.condition === "fiscal" && !missions.fiscal) return false;
      }
      return true;
    });
    const text = activeSections
      .map((s) => `${s.title}\n${"=".repeat(s.title.length)}\n${replaceTemplateVariables(s.content, previewVariables)}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Contenu copi\u00e9 dans le presse-papiers");
  }, [client, template, missions, previewVariables]);

  // Feature #38: template JSON export/import
  const handleTemplateJsonExport = useCallback(() => {
    const json = JSON.stringify({ _sections: template, _version: templateVersion }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${activeModelKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Mod\u00e8le export\u00e9 en JSON");
  }, [template, templateVersion, activeModelKey]);

  const handleTemplateJsonImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data._sections)) {
          setTemplate(data._sections as TemplateSection[]);
          if (typeof data._version === "number") setTemplateVersion(data._version);
          toast.success("Mod\u00e8le import\u00e9 depuis JSON");
        } else {
          toast.error("Format JSON invalide");
        }
      } catch {
        toast.error("Fichier JSON invalide");
      }
    };
    reader.readAsText(file);
  }, []);

  // ── TVA calculations ──
  const totalHT = useMemo(() => {
    const base = (honoraires.comptable || 0) + (honoraires.constitution || 0) + (missions.juridique ? honoraires.juridique || 0 : 0);
    const remise = base * (remisePourcent / 100);
    return Math.max(0, base - remise);
  }, [honoraires, missions, remisePourcent]);

  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : honoraires.frequence === "SEMESTRIEL" ? 2 : 1;
  const montantPeriodiqueTTC = Math.round((totalTTC / divisor) * 100) / 100;
  const freqLabel = honoraires.frequence === "MENSUEL" ? "mois" : honoraires.frequence === "TRIMESTRIEL" ? "trimestre" : honoraires.frequence === "SEMESTRIEL" ? "semestre" : "an";

  const statusConf = STATUS_CONFIG[status];

  // Feature #37: full-text search in template
  const filteredTemplate = useMemo(() => {
    if (!templateSearch.trim()) return template;
    const q = templateSearch.toLowerCase();
    return template.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [template, templateSearch]);

  // Feature #25: tab counter badges
  const templateIssueCount = unresolvedVars.length;
  const generateIssueCount = completionInfo.total - completionInfo.doneCount;

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col print:block" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ══ TOOLBAR ══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-transparent shrink-0 print:hidden" style={{ borderImage: "linear-gradient(to right, rgba(59,130,246,0.3), rgba(168,85,247,0.3), rgba(59,130,246,0.3)) 1" }}>
        {/* Improvement #2: breadcrumb with Home icon */}
        <div className="flex items-center gap-1.5 px-4 pt-1.5 text-[10px] text-slate-500">
          <button onClick={() => navigate("/")} className="hover:text-slate-300 flex items-center gap-1">
            <Home className="w-3 h-3" /> Accueil
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-300">Lettre de Mission</span>
          {client && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-300">{client.raisonSociale}</span>
            </>
          )}
        </div>
        {/* Improvement #1: toolbar grouped with dividers [Nav | Info | Actions | Export] */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Nav group ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white gap-1 hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Retour">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retour \u00e0 la page pr\u00e9c\u00e9dente</TooltipContent>
            </Tooltip>
            <div className="w-px h-5 bg-white/10" />
            {/* ── Info group ── */}
            <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
            {/* Improvement #24: letter number styled badge */}
            <span className="bg-slate-800 border border-white/10 rounded-md px-2 py-1 text-xs font-mono text-slate-400">{letterNumber}</span>
            {/* Improvement #7: status badge with colored dot */}
            <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLOR[status]} animate-pulse inline-block`} />
              {statusConf.label}
            </Badge>
            {/* Improvement #3: styled selects */}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as LetterStatus)}
              className={`text-[10px] rounded-xl border border-white/10 bg-slate-800 text-slate-300 px-2 py-0.5 pr-6 appearance-none bg-no-repeat bg-[length:12px] hover:border-white/20 focus:outline-none transition-colors`}
              style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 4px center" }}
              aria-label="Changer le statut rapidement"
            >
              <option value="brouillon">Brouillon</option>
              <option value="en_attente">En attente</option>
              <option value="signee">Sign\u00e9e</option>
              <option value="archivee">Archiv\u00e9e</option>
            </select>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value as LetterPriority); markDirty(); }}
              className={`text-[10px] rounded-xl border border-white/10 bg-slate-800 px-2 py-0.5 pr-6 appearance-none bg-no-repeat bg-[length:12px] hover:border-white/20 focus:outline-none transition-colors ${PRIORITY_CONFIG[priority].color}`}
              style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 4px center" }}
              aria-label="Priorit\u00e9"
            >
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
              <option value="low">Basse</option>
            </select>
            {client && (
              <span className="text-[10px] text-slate-500">~{estimatedPages} pages</span>
            )}
            <div className="w-px h-5 bg-white/10" />
            {/* ── Status indicators ── */}
            {lastSaved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 cursor-default">
                    <Check className="w-3 h-3 text-emerald-500" /> {timeSinceSaveStr || "maintenant"}
                    {lastSaveType === "auto" && <span className="text-slate-600">(auto)</span>}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Derni\u00e8re sauvegarde {lastSaveType === "auto" ? "automatique" : "manuelle"}</TooltipContent>
              </Tooltip>
            )}
            {isDirty && (
              <span className="text-[10px] text-amber-500 flex items-center gap-1">
                Modifications non sauvegard\u00e9es
                {/* Improvement #8: autosave countdown visible */}
                {autoSaveCountdown !== null && (
                  <span className="bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full text-amber-400 animate-pulse">
                    {autoSaveCountdown}s
                  </span>
                )}
              </span>
            )}
            {/* Improvement #6: wider progress bar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setShowValidationChecklist(true)}>
                  <Progress value={completionInfo.pct} className="w-24 h-2 [&>div]:transition-all [&>div]:duration-500 [&>div]:ease-out" />
                  <span className={`text-[10px] font-medium ${completionInfo.pct === 100 ? "text-emerald-400" : completionInfo.pct >= 70 ? "text-blue-400" : "text-amber-400"}`}>
                    {completionInfo.pct}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{completionInfo.doneCount}/{completionInfo.total} champs compl\u00e9t\u00e9s</TooltipContent>
            </Tooltip>
            {/* Improvement #28: export progress bar */}
            {exportProgress !== null && (
              <div className="flex items-center gap-1.5">
                <Progress value={exportProgress} className="w-20 h-1.5 [&>div]:transition-all [&>div]:duration-300" />
                <span className="text-[10px] text-blue-400">{exportProgress}%</span>
              </div>
            )}
          </div>
          {/* Improvement #1: Actions + Export groups */}
          <div className="flex items-center gap-1">
            {/* ── Actions group ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => handleSave(false)} disabled={!isDirty || !client || savingLetter} className="gap-1 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Sauvegarder (Ctrl+S)">
                  {savingLetter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sauvegarder (Ctrl+S)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setShowPreviewModal(true)} disabled={!client} className="gap-1 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Aper\u00e7u plein \u00e9cran (Ctrl+P)">
                  <Eye className="h-3.5 w-3.5" /> Aper\u00e7u
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aper\u00e7u plein \u00e9cran (Ctrl+P)</TooltipContent>
            </Tooltip>
            <div className="w-px h-5 bg-white/10" />
            {/* ── Export group ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setShowExportDialog("pdf")} disabled={!client} className="gap-1 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Exporter en PDF">
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter en PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setShowExportDialog("docx")} disabled={!client} className="gap-1 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Exporter en DOCX">
                  <FileText className="h-3.5 w-3.5" /> DOCX
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter en DOCX</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleEmail} disabled={!client} className="gap-1 text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Envoyer par email">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              </TooltipTrigger>
              <TooltipContent>Envoyer par email</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handlePrint} disabled={!client} className="text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Imprimer">
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Imprimer</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleCopyContent} disabled={!client} className="text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Copier le contenu">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copier le contenu</TooltipContent>
            </Tooltip>
            <div className="w-px h-5 bg-white/10" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={() => setShowKeyboardShortcuts(true)} className="text-xs text-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Raccourcis clavier (Ctrl+K)">
                  <Keyboard className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Raccourcis clavier (Ctrl+K)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="flex-1 overflow-auto print:overflow-visible">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-3 shrink-0 print:hidden">
            {/* Improvement #30: active tab indicator with blue underline */}
            <TabsList className="bg-slate-800/50">
              <TabsTrigger value="modele" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
                Mod\u00e8le
                {templateIssueCount > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-red-500/20 text-red-400 border-red-500/30">{templateIssueCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="generer" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
                G\u00e9n\u00e9rer
                {generateIssueCount > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-amber-500/20 text-amber-400 border-amber-500/30">{generateIssueCount}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ══ TAB 1: MODELE ══ */}
          <TabsContent value="modele" className="flex-1 overflow-auto px-4 pb-6 print:hidden transition-opacity duration-150">
            {/* BugFix #43: loading skeleton */}
            {!templateLoaded ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800/50" />
                ))}
              </div>
            ) : (
              <>
                {/* Model selector & actions */}
                <div className="flex items-center gap-2 py-3 sticky top-0 z-10 bg-slate-900/95 backdrop-blur flex-wrap">
                  <select
                    value={activeModelKey}
                    onChange={(e) => {
                      setActiveModelKey(e.target.value);
                      loadModelTemplate(e.target.value);
                    }}
                    className={STYLED_SELECT_CLS + " text-xs py-1.5"}
                    style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                    aria-label="S\u00e9lectionner un mod\u00e8le"
                  >
                    {modelList.map((m) => (
                      <option key={m.key} value={m.key}>{m.name}</option>
                    ))}
                  </select>
                  {/* Feature #31: template version */}
                  <span className="text-[10px] text-slate-500">v{templateVersion}</span>
                  <Button size="sm" variant="outline" onClick={() => setShowNewModelDialog(true)} className="gap-1 text-xs h-7" aria-label="Cr\u00e9er un nouveau mod\u00e8le">
                    <Plus className="h-3 w-3" /> Nouveau
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRenameModelName(modelList.find(m => m.key === activeModelKey)?.name || ""); setShowRenameDialog(true); }} className="text-xs h-7" aria-label="Renommer le mod\u00e8le">
                    Renommer
                  </Button>
                  {modelList.length > 1 && (
                    <Button size="sm" variant="outline" onClick={handleDeleteModel} className="text-xs h-7 text-red-400 hover:text-red-300" aria-label="Supprimer le mod\u00e8le">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="w-px h-5 bg-white/10" />
                  {/* BugFix #33: loading spinner on save button */}
                  <Button size="sm" onClick={handleSaveTemplate} disabled={templateSaving} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7" aria-label="Sauvegarder le mod\u00e8le">
                    {templateSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {templateSaving ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                  {/* BugFix #17: confirm dialog for reset */}
                  <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(true)} className="gap-1 text-xs h-7" aria-label="R\u00e9initialiser le mod\u00e8le">
                    <RotateCcw className="h-3.5 w-3.5" /> R\u00e9initialiser
                  </Button>
                  <div className="w-px h-5 bg-white/10" />
                  {/* BugFix #29: tooltip on collapse/expand */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={collapseAll} className="text-xs h-7 text-slate-400" aria-label="Tout replier">
                        <ChevronsUpDown className="h-3.5 w-3.5" /> Replier
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Replier toutes les sections</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={expandAll} className="text-xs h-7 text-slate-400" aria-label="Tout d\u00e9plier">
                        <ChevronDown className="h-3.5 w-3.5" /> D\u00e9plier
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>D\u00e9plier toutes les sections</TooltipContent>
                  </Tooltip>
                  <div className="w-px h-5 bg-white/10" />
                  {/* Feature #38: JSON export/import */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={handleTemplateJsonExport} className="text-xs h-7 text-slate-400" aria-label="Exporter le mod\u00e8le en JSON">
                        <FileJson className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Exporter en JSON</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="cursor-pointer" aria-label="Importer un mod\u00e8le JSON">
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-slate-400 pointer-events-none" tabIndex={-1}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <input type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleTemplateJsonImport(e.target.files[0]); }} />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>Importer depuis JSON</TooltipContent>
                  </Tooltip>
                </div>

                {/* Feature #37: search in template + Feature #16: stats */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="Rechercher dans le mod\u00e8le..."
                      className="w-full pl-7 pr-3 py-1.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 text-xs"
                    />
                    {templateSearch && (
                      <button onClick={() => setTemplateSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Effacer la recherche">
                        <X className="w-3 h-3 text-slate-500 hover:text-white" />
                      </button>
                    )}
                  </div>
                  {/* Section filter */}
                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className={STYLED_SELECT_CLS + " text-xs py-1.5"}
                    style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                    aria-label="Filtrer par type de section"
                  >
                    <option value="">Toutes les sections</option>
                    <option value="fixed">Fixes</option>
                    <option value="conditional">Conditionnelles</option>
                    <option value="annexe">Annexes</option>
                    <option value="custom">Personnalis\u00e9es</option>
                    <option value="favorite">Favoris</option>
                  </select>
                  {/* Stats */}
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {templateStats.sectionCount} sections \u00b7 {templateStats.wordCount} mots \u00b7 ~{templateStats.estimatedPages} pages
                  </span>
                </div>

                {/* Sections */}
                <div className="space-y-1">
                  {(() => {
                    let displaySections = filteredTemplate;
                    if (sectionFilter) {
                      displaySections = displaySections.filter((s) => {
                        if (sectionFilter === "custom") return s.id.startsWith("custom_");
                        if (sectionFilter === "favorite") return favoriteSections.includes(s.id);
                        return s.type === sectionFilter;
                      });
                    }

                    // BugFix #16: no results message
                    if (displaySections.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-500 text-sm">
                          Aucun r\u00e9sultat pour ce filtre
                        </div>
                      );
                    }

                    return displaySections.map((section) => {
                      // BugFix #15: show original index
                      const originalIdx = template.findIndex((s) => s.id === section.id);
                      // Improvement #9: sections start expanded (default false = not collapsed)
                      const isCollapsed2 = collapsed[section.id] ?? false;
                      const isCustom = section.id.startsWith("custom_");
                      const isAnnexe = section.type === "annexe";
                      const isFavorite = favoriteSections.includes(section.id);
                      const commentsForSection = sectionComments.filter((c) => c.sectionId === section.id);
                      // Improvement #25: conditional hidden indicator
                      const isConditionalHidden = section.type === "conditional" && (
                        (section.condition === "sociale" && !missions.sociale) ||
                        (section.condition === "juridique" && !missions.juridique) ||
                        (section.condition === "fiscal" && !missions.fiscal)
                      );

                      return (
                        <div key={section.id}>
                          {/* BugFix #39: visual separator before annexes */}
                          {isAnnexe && originalIdx > 0 && template[originalIdx - 1]?.type !== "annexe" && (
                            <div className="flex items-center gap-2 py-2 my-1">
                              <div className="flex-1 h-px bg-blue-500/30" />
                              <span className="text-[10px] text-blue-400 uppercase tracking-wider font-medium">Annexes</span>
                              <div className="flex-1 h-px bg-blue-500/30" />
                            </div>
                          )}
                          <div className={`border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-all duration-200 ${isConditionalHidden ? "opacity-50" : ""}`}>
                            <button
                              onClick={() => toggleCollapse(section.id)}
                              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                              aria-label={`${isCollapsed2 ? "D\u00e9plier" : "Replier"} la section ${section.title}`}
                            >
                              <div className="flex items-center gap-2">
                                {/* Feature #34: position number */}
                                <span className="text-[10px] text-slate-600 font-mono w-5">{originalIdx + 1}.</span>
                                <GripVertical className="w-3.5 h-3.5 text-slate-600 cursor-grab" />
                                {isCollapsed2 ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                {/* Improvement #42: section type icons */}
                                {getSectionTypeIcon(section)}
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
                                {isAnnexe && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">annexe</span>
                                )}
                                {isCustom && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">personnalis\u00e9e</span>
                                )}
                                {commentsForSection.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    <MessageSquare className="w-3 h-3 inline" /> {commentsForSection.length}
                                  </span>
                                )}
                                {/* Improvement #25: crossed-eye icon for hidden conditionals */}
                                {isConditionalHidden && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <EyeOff className="w-3 h-3" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Cette section conditionnelle est masqu\u00e9e car la mission &laquo;{section.condition}&raquo; n&apos;est pas activ\u00e9e</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Feature #23: favorite toggle */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(section.id); }}
                                  className="p-1 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                  aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                                >
                                  {isFavorite ? <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> : <StarOff className="w-3.5 h-3.5 text-slate-600 hover:text-yellow-400" />}
                                </button>
                                {/* Feature #9: duplicate section */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
                                  className="p-1 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                  aria-label="Dupliquer cette section"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400" />
                                </button>
                                {isCustom && (
                                  <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="p-1 hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Supprimer cette section">
                                    <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                                  </button>
                                )}
                                {!section.editable && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                              </div>
                            </button>
                            {/* Improvement #10: smooth section open/close animation */}
                            <div
                              className="transition-all duration-200 ease-in-out overflow-hidden"
                              style={{ maxHeight: isCollapsed2 ? 0 : 2000, opacity: isCollapsed2 ? 0 : 1 }}
                            >
                              <div className="px-4 py-3 border-t border-white/[0.06]">
                                {!section.editable ? (
                                  <div>
                                    <div className="text-xs text-amber-400/80 mb-2 flex items-center gap-1">
                                      <Lock className="w-3 h-3" /> Ce contenu est g\u00e9n\u00e9r\u00e9 automatiquement
                                    </div>
                                    <div className="text-sm text-slate-400 bg-slate-800/30 rounded p-3 whitespace-pre-wrap font-mono">{section.content}</div>
                                  </div>
                                ) : (
                                  /* BugFix #38: auto-grow textarea + Improvement #11: placeholder */
                                  <textarea
                                    value={section.content}
                                    onChange={(e) => updateSectionContent(section.id, e.target.value)}
                                    placeholder="Saisissez le contenu de cette section..."
                                    className="w-full rounded-md border border-white/10 p-3 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y"
                                    style={{
                                      fontSize: 15, color: "#e2e8f0", backgroundColor: "hsl(217 33% 14%)",
                                      minHeight: Math.max(100, Math.min(600, section.content.split("\n").length * 24 + 48)),
                                      lineHeight: 1.6,
                                    }}
                                    rows={Math.min(30, Math.max(4, section.content.split("\n").length + 2))}
                                  />
                                )}
                                {/* Feature #22: section comments */}
                                <div className="mt-2 border-t border-white/5 pt-2">
                                  <details className="text-xs">
                                    <summary className="text-slate-500 cursor-pointer hover:text-slate-300 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> Commentaires internes ({commentsForSection.length})
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                      {commentsForSection.map((c, ci) => (
                                        <div key={ci} className="flex items-start gap-1 text-slate-400 bg-slate-800/30 rounded px-2 py-1">
                                          <span className="flex-1">{c.text}</span>
                                          <button onClick={() => removeSectionComment(section.id, ci)} className="text-red-400/60 hover:text-red-400" aria-label="Supprimer le commentaire">
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex gap-1">
                                        <input
                                          placeholder="Ajouter un commentaire..."
                                          className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-300 text-xs"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                                              addSectionComment(section.id, (e.target as HTMLInputElement).value.trim());
                                              (e.target as HTMLInputElement).value = "";
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Improvement #12: visible add clause button */}
                          <div className="flex justify-center py-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => addCustomClause(section.id)}
                                  className="text-slate-600 hover:text-blue-400 transition-all p-0.5 w-5 h-5 flex items-center justify-center rounded-full border border-dashed border-slate-700 hover:border-blue-400"
                                  aria-label="Ajouter une clause apr\u00e8s cette section"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Ajouter une clause</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </TabsContent>

          {/* ══ TAB 2: GENERER ══ */}
          {/* Improvement #17: tab transition */}
          <TabsContent value="generer" className="flex-1 overflow-auto print:hidden transition-opacity duration-150">
            {/* Improvement #38: mobile responsive layout */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-0 h-full">
              {/* Left panel */}
              <div ref={leftPanelRef} className="overflow-auto border-r border-white/10 p-4 space-y-4 relative">
                {/* Improvement #18: sticky left panel header */}
                <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur pb-2 -mx-4 px-4 -mt-4 pt-4">
                {/* Client selector with search (Feature #2) */}
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-slate-400 mb-1.5 block">
                      {/* Improvement #44: required field asterisk */}
                      Client <span className="text-red-400">*</span>
                      {/* BugFix #14: client count */}
                      <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0">{clients.length}</Badge>
                    </Label>
                    {/* Feature #2: search input (Improvement #31: debounced) */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Rechercher par nom, r\u00e9f\u00e9rence, SIREN..."
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-white/10 bg-slate-800 text-slate-200 text-xs hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                      />
                    </div>
                    <select
                      value={selectedRef}
                      onChange={(e) => { setSelectedRef(e.target.value); markDirty(); }}
                      className={STYLED_SELECT_CLS}
                      style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center", width: "100%" }}
                      aria-label="S\u00e9lectionner un client"
                    >
                      <option value="">-- Choisir un client --</option>
                      {/* Feature #15: recent clients */}
                      {recentClientRefs.length > 0 && (
                        <optgroup label="R\u00e9cents">
                          {recentClientRefs.map((ref) => {
                            const c = clients.find((cl) => cl.ref === ref);
                            if (!c) return null;
                            return <option key={`recent-${ref}`} value={ref}>{c.raisonSociale} ({ref})</option>;
                          })}
                        </optgroup>
                      )}
                      {/* Feature #47: group by vigilance */}
                      {Object.entries(clientsByVigilance).map(([level, grpClients]) => (
                        grpClients.length > 0 && (
                          <optgroup key={level} label={`Vigilance ${level} (${grpClients.length})`}>
                            {grpClients.map((c) => (
                              <option key={c.ref} value={c.ref}>{c.raisonSociale} ({c.ref})</option>
                            ))}
                          </optgroup>
                        )
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-1">
                    {/* Improvement #39: highlight duplicate button when letters exist */}
                    <div className="relative">
                      <Button size="sm" variant="outline" onClick={() => setShowDuplicateDialog(true)} className="gap-1 text-xs h-9 hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Dupliquer depuis une lettre existante">
                        <Copy className="h-3.5 w-3.5" /> Dupliquer
                      </Button>
                      {savedLetters.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      )}
                    </div>
                    {/* Feature #50: quick duplicate to other client */}
                    <Button size="sm" variant="outline" onClick={() => setShowQuickDuplicateDialog(true)} disabled={!client} className="text-xs h-9 hover:scale-[1.02] active:scale-[0.98] transition-transform" aria-label="Dupliquer vers un autre client">
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                </div>{/* end sticky header */}

                {/* Existing letters badge */}
                {savedLetters.length > 0 && (
                  <button
                    onClick={() => setShowHistoryDialog(true)}
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                    aria-label="Voir l'historique des lettres"
                  >
                    <History className="w-3.5 h-3.5" />
                    {savedLetters.length} lettre(s) existante(s)
                  </button>
                )}

                {/* Improvement #4: beautiful empty state */}
                {!client && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
                      <FileText className="w-12 h-12 text-slate-500 animate-pulse" />
                      <div className="text-center">
                        <h3 className="text-base font-semibold text-slate-300 mb-1">S\u00e9lectionnez un client</h3>
                        <p className="text-sm text-slate-500">Choisissez un client dans la liste ci-dessus pour g\u00e9n\u00e9rer ou modifier sa lettre de mission.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Improvement #32: left panel loading skeleton */}
                {client && leftPanelLoading && (
                  <div className="space-y-3 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-800/50 rounded-lg" />
                    ))}
                  </div>
                )}

                {client && !leftPanelLoading && (
                  <>
                    {/* Missions summary strip */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-400 font-medium">Missions :</span>
                      <span className={missions.sociale ? "text-emerald-400" : "text-slate-600"}>Comptable {missions.sociale ? "+" : ""} Sociale {missions.sociale ? "OK" : "\u2014"}</span>
                      <span className="text-slate-700">|</span>
                      <span className={missions.juridique ? "text-emerald-400" : "text-slate-600"}>Juridique {missions.juridique ? "OK" : "\u2014"}</span>
                      <span className="text-slate-700">|</span>
                      <span className={missions.fiscal ? "text-emerald-400" : "text-slate-600"}>Fiscal {missions.fiscal ? "OK" : "\u2014"}</span>
                    </div>

                    {/* Improvement #5: client info card gradient border */}
                    <div className="bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 p-[1px] rounded-lg">
                    <div className="border-0 rounded-lg p-3 bg-slate-900 hover:bg-slate-800/30 transition-all duration-200">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Client</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                        {([
                          ["Raison sociale", client.raisonSociale], ["Forme", client.forme],
                          ["SIREN", client.siren], ["Dirigeant", client.dirigeant],
                          ["Associ\u00e9", client.associe], ["Vigilance", `${client.nivVigilance} (${client.scoreGlobal}/100)`],
                        ] as [string, string][]).map(([label, value]) => (
                          <Tooltip key={label}>
                            <TooltipTrigger asChild>
                              <div>
                                <span className="text-slate-500 text-[10px]">{label}</span>
                                <div className="text-slate-200 truncate text-xs">{value || "\u2014"}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{value || "\u2014"}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                    </div>{/* end gradient wrapper */}

                    {/* Letter number + reference externe */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">N\u00b0 de lettre</Label>
                        <input value={letterNumber} onChange={(e) => { setLetterNumber(e.target.value); markDirty(); }}
                          className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">R\u00e9f\u00e9rence externe</Label>
                        <input value={referenceExterne} onChange={(e) => { setReferenceExterne(e.target.value); markDirty(); }}
                          className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" />
                      </div>
                    </div>

                    {/* Status selector */}
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Statut</Label>
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value as LetterStatus)}
                        className={STYLED_SELECT_CLS + " w-full"}
                        style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                        aria-label="Statut de la lettre"
                      >
                        <option value="brouillon">Brouillon</option>
                        <option value="en_attente">En attente de signature</option>
                        <option value="signee">Sign\u00e9e</option>
                        <option value="archivee">Archiv\u00e9e</option>
                      </select>
                    </div>

                    {/* Genre + Objet (Feature #39: multiline) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        {/* Improvement #45: genre selector with icon */}
                        <Label className="text-xs text-slate-400 mb-1.5 block">Formule</Label>
                        <select value={genre} onChange={(e) => { setGenre(e.target.value as "M" | "Mme"); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Formule de politesse">
                          <option value="M">{"\ud83d\udc64"} M. (Monsieur)</option>
                          <option value="Mme">{"\ud83d\udc64"} Mme (Madame)</option>
                        </select>
                      </div>
                      <div>
                        {/* Improvement #44: required field asterisk */}
                        <Label className="text-xs text-slate-400 mb-1.5 block flex items-center gap-1">
                          Objet du contrat <span className="text-red-400">*</span>
                          {isFieldDirty("objetContrat", objetContrat) && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                        </Label>
                        <textarea value={objetContrat} onChange={(e) => { setObjetContrat(e.target.value); markDirty(); }}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm resize-y hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" rows={2} />
                      </div>
                    </div>

                    {/* Feature #1: Exercise dates (Improvement #36: French lang) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">D\u00e9but exercice</Label>
                        <input type="date" lang="fr" value={dateDebutExercice} onChange={(e) => { setDateDebutExercice(e.target.value); markDirty(); }}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Fin exercice</Label>
                        <input type="date" lang="fr" value={dateFinExercice} onChange={(e) => { setDateFinExercice(e.target.value); markDirty(); }}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" />
                      </div>
                    </div>

                    {/* Feature #3, #4, #5: regime fiscal, TVA, volume (Improvement #15: responsive) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">R\u00e9gime fiscal</Label>
                        <select value={regimeFiscal} onChange={(e) => { setRegimeFiscal(e.target.value as RegimeFiscal); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="R\u00e9gime fiscal">
                          <option value="IS">IS</option>
                          <option value="IR">IR</option>
                          <option value="BIC">BIC</option>
                          <option value="BNC">BNC</option>
                          <option value="BA">BA</option>
                          <option value="micro_BIC">Micro-BIC</option>
                          <option value="micro_BNC">Micro-BNC</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">R\u00e9gime TVA</Label>
                        <select value={regimeTVA} onChange={(e) => { setRegimeTVA(e.target.value as RegimeTVA); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="R\u00e9gime TVA">
                          <option value="reel_normal">R\u00e9el normal</option>
                          <option value="reel_simplifie">R\u00e9el simplifi\u00e9</option>
                          <option value="franchise">Franchise en base</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Volume comptable</Label>
                        <select value={volumeComptable} onChange={(e) => { setVolumeComptable(e.target.value as VolumeComptable); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Volume comptable">
                          <option value="moins_500">&lt; 500 \u00e9critures</option>
                          <option value="500_2000">500 \u2013 2000 \u00e9critures</option>
                          <option value="plus_2000">&gt; 2000 \u00e9critures</option>
                        </select>
                      </div>
                    </div>

                    {/* Feature #6: outil comptable + Feature #8: CAC + Feature #45: responsable */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Outil comptable</Label>
                        <input value={outilComptable} onChange={(e) => { setOutilComptable(e.target.value); markDirty(); }}
                          placeholder="Ex: Sage, Cegid..."
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">CAC</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Switch checked={hasCAC} onCheckedChange={(v) => { setHasCAC(v); markDirty(); }} />
                          <span className="text-xs text-slate-300">{hasCAC ? "Oui" : "Non"}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Responsable dossier</Label>
                        <select value={responsableDossier} onChange={(e) => { setResponsableDossier(e.target.value); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Responsable du dossier">
                          <option value="">-- Choisir --</option>
                          {collaborateurs.map((c) => (
                            <option key={c.nom} value={c.nom}>{c.nom} ({c.fonction})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Missions (Improvement #49: card hover) */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-2 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Missions compl\u00e9mentaires</h3>
                      {[
                        { key: "sociale" as const, label: "Mission sociale" },
                        { key: "juridique" as const, label: "Mission juridique" },
                        { key: "fiscal" as const, label: "Contr\u00f4le fiscal" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-sm text-slate-300">{label}</Label>
                          <Switch checked={missions[key]} onCheckedChange={(v) => { setMissions((p) => ({ ...p, [key]: v })); markDirty(); }} />
                        </div>
                      ))}
                    </div>

                    {/* Honoraires — BugFix #10: min={0}, Improvement #34: icon, #49: hover */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-2 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5" /> Honoraires
                      </h3>
                      {[
                        { key: "comptable" as const, label: "Forfait comptable annuel (\u20ac HT)" },
                        { key: "constitution" as const, label: "Constitution / Reprise (\u20ac HT)" },
                        { key: "juridique" as const, label: "Juridique annuel (\u20ac HT)" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-[10px] text-slate-500 flex items-center gap-1">
                            {label}
                            {key === "comptable" && <span className="text-red-400">*</span>}
                            {isFieldDirty(`honoraires_${key}`, honoraires[key]) && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                          </Label>
                          <input type="number" min={0} step="0.01" value={honoraires[key]}
                            onChange={(e) => { setHonoraires((p) => ({ ...p, [key]: Math.max(0, Number(e.target.value)) })); markDirty(); }}
                            className="w-full mt-0.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm" />
                          {honoraires[key] > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              TVA 20% : {formatMontant(Math.round(honoraires[key] * 0.20 * 100) / 100)} | TTC : {formatMontant(Math.round(honoraires[key] * 1.20 * 100) / 100)}
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Feature #7: more periodicite options */}
                      <div>
                        <Label className="text-[10px] text-slate-500">P\u00e9riodicit\u00e9</Label>
                        <select value={honoraires.frequence} onChange={(e) => { setHonoraires((p) => ({ ...p, frequence: e.target.value as Periodicite })); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full mt-0.5 py-1.5"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="P\u00e9riodicit\u00e9 de facturation">
                          <option value="MENSUEL">Mensuel</option>
                          <option value="TRIMESTRIEL">Trimestriel</option>
                          <option value="SEMESTRIEL">Semestriel</option>
                          <option value="ANNUEL">Annuel</option>
                        </select>
                      </div>
                      {/* Feature #40: remise */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-500">Remise (%)</Label>
                          <input type="number" min={0} max={100} value={remisePourcent}
                            onChange={(e) => { setRemisePourcent(Math.min(100, Math.max(0, Number(e.target.value)))); markDirty(); }}
                            className="w-full mt-0.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm" />
                        </div>
                        {/* Feature #41: acompte */}
                        <div>
                          <Label className="text-[10px] text-slate-500">Acompte (\u20ac)</Label>
                          <input type="number" min={0} value={acompte}
                            onChange={(e) => { setAcompte(Math.max(0, Number(e.target.value))); markDirty(); }}
                            className="w-full mt-0.5 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm" />
                        </div>
                      </div>
                      {/* Feature #42: conditions de paiement */}
                      <div>
                        <Label className="text-[10px] text-slate-500">Conditions de paiement</Label>
                        <select value={conditionsPaiement} onChange={(e) => { setConditionsPaiement(e.target.value as ConditionsPaiement); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full mt-0.5 py-1.5"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Conditions de paiement">
                          <option value="comptant">Comptant</option>
                          <option value="30j">30 jours</option>
                          <option value="45j">45 jours</option>
                          <option value="60j">60 jours</option>
                        </select>
                      </div>
                      {/* TVA totals */}
                      <div className="border-t border-white/10 pt-2 mt-2 space-y-0.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-400">Total HT</span><span className="text-slate-200 font-medium">{formatMontant(totalHT)}</span></div>
                        {remisePourcent > 0 && (
                          <div className="flex justify-between text-emerald-400"><span>Remise {remisePourcent}%</span><span>-{formatMontant(Math.round((honoraires.comptable + honoraires.constitution + (missions.juridique ? honoraires.juridique : 0)) * remisePourcent / 100))}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-slate-400">TVA 20%</span><span className="text-slate-200">{formatMontant(totalTVA)}</span></div>
                        {/* Improvement #22: prominent total TTC */}
                        <div className="flex justify-between font-bold text-lg bg-emerald-500/10 rounded-lg px-3 py-2 -mx-1"><span className="text-slate-200">Total TTC</span><span className="text-white">{formatMontant(totalTTC)}</span></div>
                        <div className="text-slate-500 text-[10px]">Soit {formatMontant(montantPeriodiqueTTC)} TTC / {freqLabel}</div>
                        {acompte > 0 && (
                          <div className="flex justify-between text-blue-400"><span>Acompte</span><span>{formatMontant(acompte)}</span></div>
                        )}
                      </div>
                      {/* Improvement #21: bigger honoraires suggestion with apply button */}
                      {honorairesSuggestion && (
                        <div className={`flex items-center gap-2 text-xs p-3 rounded-lg ${honorairesSuggestion.type === "low" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                          <Calculator className="w-4 h-4 shrink-0" />
                          <div className="flex-1">
                            <span className="font-bold">
                              {honorairesSuggestion.type === "low" ? "Honoraires possiblement bas" : "Honoraires \u00e9lev\u00e9s pour ce profil"}
                            </span>
                            <br />
                            Suggestion : <span className="font-semibold">{formatMontant(honorairesSuggestion.suggested)}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setHonoraires((p) => ({ ...p, comptable: honorairesSuggestion.suggested })); markDirty(); }}
                            className="text-xs h-7 shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                          >
                            Appliquer
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Signatures — BugFix #11, #26, Improvement #49: hover */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-3 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
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
                                <button onClick={() => setter("")} className="absolute top-1 right-1 text-slate-400 hover:text-red-400" aria-label={`Supprimer la signature ${label}`}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20 rounded-lg py-8 cursor-pointer hover:border-white/40 text-xs text-slate-500 transition-colors">
                                <Upload className="w-5 h-5" />
                                <span className="font-medium text-slate-400">Importer votre signature</span>
                                <span className="text-[10px]">PNG/JPG (max 2 Mo)</span>
                                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                                  onChange={(e) => { if (e.target.files?.[0]) handleSignatureUpload(type, e.target.files[0]); }} />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Improvement #48: distinct signature dates with colored borders */}
                      <div className={`${signatureDate ? "border-l-2 border-l-emerald-500 pl-2" : ""}`}>
                        <Label className="text-[10px] text-slate-500 mb-1 block">Date de signature</Label>
                        <input type="date" lang="fr" value={signatureDate} onChange={(e) => { setSignatureDate(e.target.value); markDirty(); }}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" />
                      </div>
                      <div className={`${dateSignaturePrevue ? "border-l-2 border-l-amber-500 pl-2" : ""}`}>
                        <Label className="text-[10px] text-slate-500 mb-1 block">Date de signature pr\u00e9vue</Label>
                        <input type="date" lang="fr" value={dateSignaturePrevue} onChange={(e) => { setDateSignaturePrevue(e.target.value); markDirty(); }}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 text-slate-200 px-3 py-1.5 text-sm hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors" />
                      </div>
                    </div>

                    {/* Feature #29: reminder date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Date de rappel</Label>
                        <input type="date" value={reminderDate} onChange={(e) => { setReminderDate(e.target.value); markDirty(); }}
                          className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" />
                      </div>
                      {/* Feature #17: custom watermark */}
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Filigrane brouillon</Label>
                        <input value={watermarkText} onChange={(e) => { setWatermarkText(e.target.value); markDirty(); }}
                          placeholder="PROJET"
                          className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" />
                      </div>
                    </div>

                    {/* Feature #36: tags (Improvement #13: bigger, #35: colored, #49: hover) */}
                    <div className="border border-white/10 rounded-lg p-3 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">\u00c9tiquettes</h3>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className={`text-xs gap-1.5 px-2.5 py-1 border ${getTagColor(tag, i)}`}>
                            <Tag className="w-3 h-3" /> {tag}
                            <button onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:scale-[1.1] transition-transform" aria-label={`Supprimer l'\u00e9tiquette ${tag}`}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nouvelle \u00e9tiquette..."
                          className="flex-1 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-2 py-1 text-xs"
                          onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { setTags((prev) => [...prev, newTag.trim()]); setNewTag(""); markDirty(); } }} />
                        <Button size="sm" variant="outline" onClick={() => { if (newTag.trim()) { setTags((prev) => [...prev, newTag.trim()]); setNewTag(""); markDirty(); } }} className="text-xs h-7" aria-label="Ajouter une \u00e9tiquette">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Feature #35: color theme + Feature #27: orientation (Improvement #15: responsive) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Couleur PDF</Label>
                        <select value={pdfColorTheme} onChange={(e) => { setPdfColorTheme(e.target.value as PdfColorTheme); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Th\u00e8me de couleur du PDF">
                          <option value="navy">Bleu marine</option>
                          <option value="green">Vert</option>
                          <option value="red">Rouge</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400 mb-1.5 block">Orientation PDF</Label>
                        <select value={pdfOrientation} onChange={(e) => { setPdfOrientation(e.target.value as "portrait" | "landscape"); markDirty(); }}
                          className={STYLED_SELECT_CLS + " w-full"}
                          style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
                          aria-label="Orientation du PDF">
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Paysage</option>
                        </select>
                      </div>
                    </div>

                    {/* Notes internes — BugFix #35: clear button, Improvement #14: maxLength, #49: hover */}
                    <div className="border border-white/10 rounded-lg p-3 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Notes internes (non imprim\u00e9es)
                        </h3>
                        {notesInternes && (
                          <button onClick={() => { setNotesInternes(""); markDirty(); }} className="text-[10px] text-slate-500 hover:text-red-400" aria-label="Effacer les notes">
                            Effacer
                          </button>
                        )}
                      </div>
                      <textarea
                        value={notesInternes}
                        onChange={(e) => { setNotesInternes(e.target.value); markDirty(); }}
                        placeholder="Notes visibles uniquement par le cabinet..."
                        maxLength={2000}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/50 text-slate-300 px-3 py-2 text-sm resize-y hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        style={{ minHeight: 60 }}
                      />
                      <div className="text-[10px] text-slate-600 text-right mt-1">{notesInternes.length} / 2000</div>
                    </div>

                    {/* Feature #32: client notes, Improvement #49: hover */}
                    <div className="border border-white/10 rounded-lg p-3 hover:border-white/20 hover:bg-slate-800/30 transition-all duration-200">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Notes client (sp\u00e9cifiques \u00e0 cette lettre)
                      </h3>
                      <textarea
                        value={clientNotes}
                        onChange={(e) => { setClientNotes(e.target.value); markDirty(); }}
                        placeholder="Notes sp\u00e9cifiques au client pour cette lettre..."
                        className="w-full rounded-xl border border-white/10 bg-slate-800/50 text-slate-300 px-3 py-2 text-sm resize-y hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors"
                        style={{ minHeight: 60 }}
                      />
                    </div>

                    {/* Feature #46: document language indicator */}
                    <div className="text-[10px] text-slate-600 text-right">
                      Langue du document : {documentLanguage}
                    </div>

                    {/* Save button — BugFix #31: disabled when no changes */}
                    <Button onClick={() => handleSave(false)} disabled={!isDirty || savingLetter} className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] active:scale-[0.99] transition-transform">
                      {savingLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Sauvegarder
                    </Button>
                  </>
                )}
                {/* Improvement #37: left panel scroll fade */}
                <div className="sticky bottom-0 h-6 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none -mx-4 -mb-4" />
              </div>

              {/* Improvement #38: mobile toggle for preview */}
              <div className="lg:hidden px-4 py-2 border-t border-white/10">
                <Button size="sm" variant="outline" onClick={() => setShowMobilePreview(!showMobilePreview)} className="w-full gap-1 text-xs">
                  <Eye className="w-3.5 h-3.5" /> {showMobilePreview ? "Masquer l'aper\u00e7u" : "Afficher l'aper\u00e7u"}
                </Button>
              </div>
              {/* Right panel — Live preview */}
              <div className={`overflow-auto bg-slate-950/50 ${showMobilePreview ? "block" : "hidden lg:block"}`}>
                {/* Improvement #19: zoom slider, #20: dark toggle label, #33: bigger zoom */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-slate-900/90 backdrop-blur border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewZoom((z) => Math.max(50, z - 10))} className="h-8 w-8 p-0 border border-white/10" aria-label="Zoom arri\u00e8re">
                      <ZoomOut className="w-4 h-4 text-slate-400" />
                    </Button>
                    {/* Improvement #19: range slider for zoom */}
                    <input
                      type="range" min={50} max={200} step={10} value={previewZoom}
                      onChange={(e) => setPreviewZoom(Number(e.target.value))}
                      className="w-24 h-1.5 accent-blue-500"
                      aria-label="Zoom"
                    />
                    <Button size="sm" variant="ghost" onClick={() => setPreviewZoom((z) => Math.min(200, z + 10))} className="h-8 w-8 p-0 border border-white/10" aria-label="Zoom avant">
                      <ZoomIn className="w-4 h-4 text-slate-400" />
                    </Button>
                    <span className="text-[10px] text-slate-500 w-8 text-center">{previewZoom}%</span>
                  </div>
                  {/* Improvement #20: dark toggle with label */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={() => setDarkPreview((v) => !v)} className="h-8 gap-1.5 px-2" aria-label={darkPreview ? "Mode clair" : "Mode sombre"}>
                        {darkPreview ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-[10px] text-slate-400">Sombre</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{darkPreview ? "Aper\u00e7u clair" : "Aper\u00e7u sombre"}</TooltipContent>
                  </Tooltip>
                </div>
                <div style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: "top center" }} className={darkPreview ? "invert" : ""}>
                  {client ? (
                    <LettreMissionA4Preview
                      sections={template} client={client} genre={genre} missions={missions}
                      honoraires={honoraires} cabinet={cabinet} status={status}
                      signatureExpert={signatureExpert} signatureClient={signatureClient}
                      objetContrat={objetContrat}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm py-20 gap-3">
                      <FileText className="w-10 h-10 text-slate-600 animate-pulse" />
                      S\u00e9lectionnez un client pour pr\u00e9visualiser la lettre
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ══ FULLSCREEN PREVIEW MODAL — Improvement #50: with action toolbar ══ */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-[95vw] h-[95vh] overflow-auto bg-white p-0 print:bg-white print:static data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader className="sr-only">
            <DialogTitle>Aper\u00e7u de la lettre de mission</DialogTitle>
            <DialogDescription>Pr\u00e9visualisation plein \u00e9cran de la lettre de mission</DialogDescription>
          </DialogHeader>
          {/* Improvement #50: preview modal toolbar */}
          <div className="print:hidden sticky top-0 z-10 flex items-center justify-between p-2 bg-white/80 backdrop-blur border-b">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1 text-xs">
                <Printer className="h-3.5 w-3.5" /> Imprimer
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPreviewModal(false); setShowExportDialog("pdf"); }} className="gap-1 text-xs">
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPreviewModal(false); setShowExportDialog("docx"); }} className="gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" /> DOCX
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPreviewModal(false); handleEmail(); }} disabled={!client} className="gap-1 text-xs">
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
            </div>
            <DialogClose asChild>
              <Button size="sm" variant="outline">Fermer (\u00c9chap)</Button>
            </DialogClose>
          </div>
          {client && (
            <LettreMissionA4Preview
              sections={template} client={client} genre={genre} missions={missions}
              honoraires={honoraires} cabinet={cabinet} status={status}
              signatureExpert={signatureExpert} signatureClient={signatureClient}
              objetContrat={objetContrat}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ══ EXPORT DIALOG — BugFix #20, #28 ══ */}
      <Dialog open={!!showExportDialog} onOpenChange={(open) => { if (!open) setShowExportDialog(null); }}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">
              Export {showExportDialog?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {/* BugFix #28: show client name */}
              {client ? `Pour : ${client.raisonSociale}` : "Aucun client sélectionné"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Pages estimées</span>
              <span className="text-white">~{estimatedPages}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Statut</span>
              <Badge variant="outline" className={`text-xs ${statusConf.bg} ${statusConf.color}`}>{statusConf.label}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Orientation</span>
              <span className="text-white">{pdfOrientation === "portrait" ? "Portrait" : "Paysage"}</span>
            </div>
            {status === "brouillon" && (
              <div className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Le filigrane "{watermarkText}" sera affiché
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
            {/* Feature #18: export history */}
            {exportHistory.length > 0 && (
              <div className="text-[10px] text-slate-500">
                Dernière exportation : {new Date(exportHistory[exportHistory.length - 1].date).toLocaleDateString("fr-FR")} ({exportHistory[exportHistory.length - 1].type.toUpperCase()})
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowExportDialog(null)} variant="outline" className="flex-1">Annuler</Button>
            <Button
              onClick={showExportDialog === "pdf" ? handleExportPdf : handleExportDocx}
              disabled={exportLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {exportLoading ? "Génération..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ NEW MODEL DIALOG ══ */}
      <Dialog open={showNewModelDialog} onOpenChange={setShowNewModelDialog}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Nouveau modèle</DialogTitle>
            <DialogDescription className="text-slate-400">Créer un nouveau modèle de lettre de mission</DialogDescription>
          </DialogHeader>
          <input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Ex: SCI, EI, SAS..."
            className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" autoFocus />
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowNewModelDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleCreateModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ RENAME DIALOG ══ */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Renommer le modèle</DialogTitle>
            <DialogDescription className="text-slate-400">Saisissez le nouveau nom du modèle</DialogDescription>
          </DialogHeader>
          <input value={renameModelName} onChange={(e) => setRenameModelName(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm" autoFocus />
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowRenameDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleRenameModel} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ RESET CONFIRM DIALOG (BugFix #17) ══ */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Réinitialiser le modèle ?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Êtes-vous sûr de vouloir réinitialiser ce modèle ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowResetConfirm(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleResetTemplate} size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white">Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ DUPLICATE DIALOG — BugFix #18: loading spinner ══ */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Dupliquer depuis un client existant</DialogTitle>
            <DialogDescription className="text-slate-400">Sélectionnez une lettre existante pour copier ses paramètres</DialogDescription>
          </DialogHeader>
          {duplicateLoading && (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          )}
          {!duplicateLoading && savedLetters.length === 0 && (
            <p className="text-sm text-slate-400 py-4">Aucune lettre existante trouvée.</p>
          )}
          {!duplicateLoading && savedLetters.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-auto">
              {savedLetters.map((l) => (
                <button key={l.id} onClick={() => handleDuplicate(l)}
                  className="w-full text-left p-3 rounded border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors">
                  <div className="text-sm text-slate-200">{l.raison_sociale || l.client_ref}</div>
                  <div className="text-xs text-slate-500">{new Date(l.updated_at).toLocaleDateString("fr-FR")} — {STATUS_CONFIG[l.status]?.label}</div>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDuplicateDialog(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ HISTORY DIALOG — BugFix #19: delete option, Improvement #43: empty state ══ */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Historique des lettres</DialogTitle>
            <DialogDescription className="text-slate-400">G\u00e9rez vos lettres sauvegard\u00e9es</DialogDescription>
          </DialogHeader>
          {savedLetters.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <History className="w-10 h-10 mb-2 text-slate-600" />
              <p className="text-sm">Aucune lettre sauvegard\u00e9e pour ce client</p>
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-auto">
            {savedLetters.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded border border-white/10">
                <div>
                  <div className="text-sm text-slate-200">{new Date(l.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[l.status]?.bg} ${STATUS_CONFIG[l.status]?.color}`}>{STATUS_CONFIG[l.status]?.label}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => { handleDuplicate(l); setShowHistoryDialog(false); }} className="text-xs">
                    Charger
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteLetter(l.id)} className="text-xs text-red-400 hover:text-red-300" aria-label="Supprimer cette lettre">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHistoryDialog(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ KEYBOARD SHORTCUTS DIALOG (Feature #11) ══ */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Raccourcis clavier</DialogTitle>
            <DialogDescription className="text-slate-400">Actions rapides disponibles</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ["Ctrl+S", "Sauvegarder"],
              ["Ctrl+P", "Aperçu plein écran"],
              ["Ctrl+K", "Raccourcis clavier"],
              ["Échap", "Fermer le dialogue"],
            ].map(([key, action]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-300">{action}</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-xs text-slate-400 font-mono">{key}</kbd>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyboardShortcuts(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ VALIDATION CHECKLIST — Improvement #29: categorized ══ */}
      <Dialog open={showValidationChecklist} onOpenChange={setShowValidationChecklist}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Checklist de validation</DialogTitle>
            <DialogDescription className="text-slate-400">V\u00e9rifiez les \u00e9l\u00e9ments avant export</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {CHECKLIST_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{cat.label}</h4>
                <div className="space-y-1.5">
                  {cat.indices.map((idx) => {
                    const item = completionInfo.items[idx];
                    if (!item) return null;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {item.done ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className={item.done ? "text-slate-300" : "text-amber-300"}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Progress value={completionInfo.pct} className="h-2" />
            <div className="text-[10px] text-slate-500 mt-1 text-center">{completionInfo.pct}% complété</div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowValidationChecklist(false)} variant="outline" size="sm" className="w-full">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ QUICK DUPLICATE TO NEW CLIENT (Feature #50) ══ */}
      <Dialog open={showQuickDuplicateDialog} onOpenChange={setShowQuickDuplicateDialog}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogHeader>
            <DialogTitle className="text-white">Dupliquer vers un autre client</DialogTitle>
            <DialogDescription className="text-slate-400">
              Copier la configuration actuelle vers un autre client
            </DialogDescription>
          </DialogHeader>
          <select
            value={quickDuplicateTargetRef}
            onChange={(e) => setQuickDuplicateTargetRef(e.target.value)}
            className={STYLED_SELECT_CLS + " w-full"}
            style={{ backgroundImage: `url("${SELECT_CHEVRON_SVG}")`, backgroundPosition: "right 8px center" }}
            aria-label="Client cible"
          >
            <option value="">-- Choisir un client cible --</option>
            {clients.filter((c) => c.ref !== selectedRef).map((c) => (
              <option key={c.ref} value={c.ref}>{c.raisonSociale} ({c.ref})</option>
            ))}
          </select>
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowQuickDuplicateDialog(false)} variant="outline" size="sm" className="flex-1">Annuler</Button>
            <Button onClick={handleQuickDuplicate} disabled={!quickDuplicateTargetRef} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Dupliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature #30: bulk export placeholder */}
      {/* Bulk export would require backend support — button/UI would appear in a future toolbar iteration */}

      {/* Feature #28: letter comparison — would compare current vs last saved (placeholder for complex diff UI) */}

      {/* BugFix #49: print-specific CSS — Improvement #41: better print CSS */}
      <style>{`
        @media print {
          body > *:not(.print-target) { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:static { position: static !important; }
          .print\\:overflow-visible { overflow: visible !important; }
          @page {
            margin: 20mm;
            size: A4;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          [role="dialog"], [data-radix-popper-content-wrapper],
          [data-sonner-toaster], [role="tooltip"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
}
