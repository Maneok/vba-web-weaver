import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { DEFAULT_TEMPLATE, replaceTemplateVariables } from "@/lib/lettreMissionTemplate";
import type { TemplateSection } from "@/lib/lettreMissionTemplate";
import type { Client } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FileText, LayoutTemplate, Plus, Search, Filter, Copy, Edit3,
  ChevronLeft, ChevronRight, Loader2, ShieldAlert, Save, Eye,
  FileDown, Mail, Check, X, Users, Briefcase, Scale, Building2,
  HandCoins, Clock, Lock, Variable, Download, Trash2, Archive,
  AlertTriangle, RotateCcw, Hash,
} from "lucide-react";

// ─── Types ───
interface LMTemplate {
  id: string;
  cabinet_id: string | null;
  nom: string;
  forme_juridique: string;
  description: string | null;
  sections: TemplateSection[];
  is_default: boolean;
  type_activite: string;
  tags: string[];
  usage_count: number;
  variables_used: string[];
  created_at: string;
  updated_at: string;
}

interface SavedLettre {
  id: string;
  numero: string | null;
  client_ref: string | null;
  client_id: string | null;
  template_id: string | null;
  statut_lm: string;
  wizard_step: number;
  generated_content: Record<string, string>;
  wizard_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  cabinet_id: string | null;
  client_name?: string;
  template_name?: string;
}

// ─── Constants (exported for testing) ───
export const TYPE_ACTIVITE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "tenue", label: "Tenue comptable" },
  { value: "revision", label: "Revision" },
  { value: "social", label: "Social / Paie" },
  { value: "juridique", label: "Juridique" },
  { value: "accompagnement", label: "Accompagnement" },
];

export const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  GENERE: { label: "Genere", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SIGNE: { label: "Signe", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  ENVOYE: { label: "Envoye", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

// FIX #4: Correct status progression order
export const STATUT_ORDER = ["BROUILLON", "GENERE", "SIGNE", "ENVOYE"] as const;

export function getNextStatut(current: string): string {
  const idx = STATUT_ORDER.indexOf(current as any);
  if (idx === -1 || idx >= STATUT_ORDER.length - 1) return current;
  return STATUT_ORDER[idx + 1];
}

export function getPrevStatut(current: string): string {
  const idx = STATUT_ORDER.indexOf(current as any);
  if (idx <= 0) return current;
  return STATUT_ORDER[idx - 1];
}

const SECTION_ICONS: Record<string, any> = {
  parties: Users,
  objet: Briefcase,
  missions: FileText,
  honoraires: HandCoins,
  duree: Clock,
  lcbft: ShieldAlert,
  confidentialite: Lock,
  signature: Edit3,
};

export const TEMPLATE_VARIABLES = [
  { key: "raison_sociale", label: "Raison sociale" },
  { key: "siren", label: "SIREN" },
  { key: "dirigeant", label: "Dirigeant" },
  { key: "adresse", label: "Adresse" },
  { key: "ville", label: "Ville" },
  { key: "cp", label: "Code postal" },
  { key: "capital", label: "Capital" },
  { key: "forme_juridique", label: "Forme juridique" },
  { key: "honoraires", label: "Honoraires" },
  { key: "frequence", label: "Frequence" },
  { key: "associe", label: "Associe signataire" },
  { key: "date_du_jour", label: "Date du jour" },
  { key: "nom_cabinet", label: "Nom du cabinet" },
  { key: "effectif", label: "Effectif" },
  { key: "ape", label: "Code APE" },
  { key: "date_cloture", label: "Date de cloture" },
];

export const EDITOR_SECTIONS = [
  { id: "parties", label: "Parties", sectionIds: ["destinataire", "introduction", "entite"] },
  { id: "objet", label: "Objet", sectionIds: ["mission", "nature_limite"] },
  { id: "missions", label: "Missions", sectionIds: ["missions_complementaires_intro", "mission_sociale", "mission_juridique", "mission_fiscal"] },
  { id: "honoraires", label: "Honoraires", sectionIds: ["honoraires", "modalites"] },
  { id: "duree", label: "Duree", sectionIds: ["duree", "organisation"] },
  { id: "lcbft", label: "LCB-FT", sectionIds: ["lcbft", "lcbft_sci_specifique", "lcbft_lmnp_specifique"] },
  { id: "confidentialite", label: "Confidentialite", sectionIds: ["annexe_cgv"] },
  { id: "signature", label: "Signature", sectionIds: ["signature"] },
];

// ─── Helpers (exported for testing) ───
export function generateLMNumero(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LM-${y}-${rand}`;
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function countVariables(sections: TemplateSection[]): number {
  if (!sections || sections.length === 0) return 0;
  const allContent = sections.map((s) => s.content || "").join(" ");
  const matches = allContent.match(/\{\{\w+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

export function buildClientVariables(client: Client | null | undefined): Record<string, string> {
  if (!client) return {};
  const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const now = new Date();
  return {
    raison_sociale: client.raisonSociale || "",
    siren: client.siren || "",
    dirigeant: client.dirigeant || "",
    adresse: client.adresse || "",
    ville: client.ville || "",
    cp: client.cp || "",
    code_postal: client.cp || "",
    capital: String(client.capital || ""),
    forme_juridique: client.forme || "",
    honoraires: String(client.honoraires || 0),
    frequence: client.frequence || "MENSUEL",
    associe: client.associe || "",
    date_du_jour: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    nom_cabinet: "Cabinet d'expertise comptable",
    effectif: client.effectif || "",
    ape: client.ape || "",
    date_cloture: client.dateCloture || "31/12",
    formule_politesse: "Monsieur",
    iban: client.iban || "",
    bic: client.bic || "",
    ref: client.ref || "",
  };
}

// FIX #4: validate statut transition
export function isValidStatutTransition(from: string, to: string): boolean {
  const fromIdx = STATUT_ORDER.indexOf(from as any);
  const toIdx = STATUT_ORDER.indexOf(to as any);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

// ═══════════════════════════════════════════════
// Confirmation Dialog Component
// ═══════════════════════════════════════════════
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-slate-900 border border-white/[0.1] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${destructive ? "bg-red-500/10" : "bg-amber-500/10"}`}>
            <AlertTriangle className={`w-5 h-5 ${destructive ? "text-red-400" : "text-amber-400"}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-400">Annuler</Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={destructive ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Template Editor (split-screen)
// ═══════════════════════════════════════════════
function TemplateEditor({
  template,
  onSave,
  onClose,
}: {
  template: LMTemplate | null;
  onSave: (t: Partial<LMTemplate>) => Promise<void>;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [nom, setNom] = useState(template?.nom || "");
  const [typeActivite, setTypeActivite] = useState(template?.type_activite || "tenue");
  const [description, setDescription] = useState(template?.description || "");
  const [sections, setSections] = useState<TemplateSection[]>(template?.sections || [...DEFAULT_TEMPLATE]);
  const [activeSection, setActiveSection] = useState(EDITOR_SECTIONS[0].id);
  const [disabledSections, setDisabledSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showVarMenu, setShowVarMenu] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // FIX #6: use refs for latest state in keyboard handler
  const nomRef = useRef(nom);
  const typeActiviteRef = useRef(typeActivite);
  const descriptionRef = useRef(description);
  const sectionsRef = useRef(sections);
  nomRef.current = nom;
  typeActiviteRef.current = typeActivite;
  descriptionRef.current = description;
  sectionsRef.current = sections;

  const activeSectionDef = EDITOR_SECTIONS.find((s) => s.id === activeSection);
  const matchingSections = sections.filter((s) => activeSectionDef?.sectionIds.includes(s.id));

  const toggleSection = (sectionId: string) => {
    setHasChanges(true);
    setDisabledSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    setHasChanges(true);
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content } : s)));
  };

  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const insertion = `{{${varKey}}}`;
    const newText = text.slice(0, start) + insertion + text.slice(end);
    if (matchingSections.length > 0) {
      updateSectionContent(matchingSections[0].id, newText);
    }
    setShowVarMenu(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 50);
  };

  // FIX #6: Stable save function using refs
  const doSave = useCallback(async () => {
    const currentNom = nomRef.current;
    if (!currentNom.trim()) { toast.error("Le nom du modele est requis"); return; }
    setSaving(true);
    try {
      await onSave({
        id: template?.id,
        nom: currentNom.trim(),
        type_activite: typeActiviteRef.current,
        description: descriptionRef.current.trim(),
        sections: sectionsRef.current,
        forme_juridique: typeActiviteRef.current,
      });
      setHasChanges(false);
      toast.success("Modele sauvegarde");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la sauvegarde");
    }
    setSaving(false);
  }, [template?.id, onSave, onClose]);

  // FIX #6: Keyboard shortcut with stable reference
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doSave]);

  // FIX #7: Proper click-outside handling for var menu
  useEffect(() => {
    if (!showVarMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-var-menu]")) {
        setShowVarMenu(false);
      }
    };
    // Add on next tick to avoid catching the opening click
    const timer = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handler);
    });
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [showVarMenu]);

  const handleClose = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) =>
      /^\{\{\w+\}\}$/.test(part) ? (
        <span key={i} className="bg-blue-500/20 text-blue-300 px-1 rounded text-xs font-mono">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <ConfirmDialog
        open={showExitConfirm}
        title="Modifications non sauvegardees"
        message="Vous avez des modifications en cours. Voulez-vous vraiment quitter sans sauvegarder ?"
        confirmLabel="Quitter sans sauvegarder"
        destructive
        onConfirm={onClose}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-slate-400 hover:text-white shrink-0">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />
          <Input
            value={nom}
            onChange={(e) => { setNom(e.target.value); setHasChanges(true); }}
            placeholder="Nom du modele..."
            className="bg-transparent border-none text-base sm:text-lg font-semibold text-white w-full sm:w-[300px] focus-visible:ring-0 px-0"
          />
          {hasChanges && <Badge className="bg-amber-500/10 text-amber-400 text-[9px] shrink-0">Non sauvegarde</Badge>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Select value={typeActivite} onValueChange={(v) => { setTypeActivite(v); setHasChanges(true); }}>
            <SelectTrigger className="w-[140px] sm:w-[180px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ACTIVITE_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={doSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Sauvegarder</span>
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 sm:px-6 py-2 border-b border-white/[0.04]">
        <Input
          value={description}
          onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
          placeholder="Description du modele..."
          className="bg-transparent border-none text-sm text-slate-400 focus-visible:ring-0 px-0"
        />
      </div>

      {/* Split view */}
      <div className={`flex flex-1 min-h-0 ${isMobile ? "flex-col" : ""}`}>
        {/* Left: Section menu */}
        <div className={`${isMobile ? "flex overflow-x-auto border-b border-white/[0.06] py-2 px-2 gap-1 shrink-0" : "w-[240px] border-r border-white/[0.06] py-4 overflow-y-auto shrink-0"}`}>
          {!isMobile && <p className="px-4 text-[10px] text-slate-600 uppercase tracking-wider mb-3">Sections</p>}
          {EDITOR_SECTIONS.map((sec) => {
            const Icon = SECTION_ICONS[sec.id] || FileText;
            const isActive = activeSection === sec.id;
            const isDisabled = disabledSections.has(sec.id);
            return isMobile ? (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all ${
                  isActive ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "text-slate-500 border border-transparent"
                } ${isDisabled ? "opacity-40" : ""}`}
              >
                {sec.label}
              </button>
            ) : (
              <div key={sec.id} className="px-3 mb-1">
                <button
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent"
                  } ${isDisabled ? "opacity-40" : ""}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{sec.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSection(sec.id); }}
                    className="p-0.5 hover:bg-white/[0.06] rounded"
                    title={isDisabled ? "Activer" : "Desactiver"}
                  >
                    {isDisabled ? <X className="w-3 h-3 text-red-400" /> : <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: Content editor */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">{activeSectionDef?.label}</h3>
            <div className="relative" data-var-menu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVarMenu(!showVarMenu)}
                className="gap-1.5 border-white/[0.08] text-xs text-slate-400"
              >
                <Variable className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Inserer une variable</span>
              </Button>
              {showVarMenu && (
                <div className="absolute right-0 top-full mt-1 w-[260px] bg-slate-900 border border-white/[0.1] rounded-xl shadow-xl z-50 p-2 max-h-[300px] overflow-y-auto" data-var-menu>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] text-sm text-left"
                    >
                      <span className="text-slate-300">{v.label}</span>
                      <code className="text-[10px] text-blue-400 font-mono">{`{{${v.key}}}`}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {disabledSections.has(activeSection) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300 flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              Cette section est desactivee et ne sera pas incluse dans les lettres generees.
            </div>
          )}

          {matchingSections.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucune sous-section pour cette categorie dans le modele selectionne.</p>
          ) : (
            matchingSections.map((sec) => (
              <div key={sec.id} className="space-y-2">
                <label className="text-xs text-slate-500 font-medium">{sec.title}</label>
                {sec.content === "TABLEAU_ENTITE" || sec.content === "TABLEAU_HONORAIRES" || sec.content === "TABLEAU_REPARTITION" || sec.content === "BLOC_LCBFT" ? (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    <p className="text-xs text-slate-500 italic">Contenu genere automatiquement : {sec.content}</p>
                  </div>
                ) : (
                  <Textarea
                    ref={matchingSections.indexOf(sec) === 0 ? textareaRef : undefined}
                    value={sec.content}
                    onChange={(e) => updateSectionContent(sec.id, e.target.value)}
                    rows={Math.max(6, sec.content.split("\n").length + 2)}
                    className="bg-white/[0.02] border-white/[0.06] text-slate-200 text-sm font-mono leading-relaxed resize-y"
                    disabled={!sec.editable}
                  />
                )}
                {sec.editable && sec.content.includes("{{") && (
                  <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-3 text-sm leading-relaxed">
                    <p className="text-[10px] text-slate-600 mb-2">Apercu des variables :</p>
                    <div className="whitespace-pre-wrap text-slate-400">{renderHighlightedText(sec.content)}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Wizard: 4-step letter generation
// ═══════════════════════════════════════════════
function LetterWizard({
  clients,
  templates,
  cabinetId,
  onClose,
  onSaved,
  initialLetter,
}: {
  clients: Client[];
  templates: LMTemplate[];
  cabinetId: string | null;
  onClose: () => void;
  onSaved: () => void;
  initialLetter?: SavedLettre | null;
}) {
  const [wizardStep, setWizardStep] = useState(initialLetter?.wizard_step || 1);
  const [selectedClientId, setSelectedClientId] = useState(initialLetter?.client_id || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialLetter?.template_id || "");
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>(initialLetter?.generated_content || {});
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [letterId, setLetterId] = useState<string | null>(initialLetter?.id || null);
  const [clientSearch, setClientSearch] = useState("");
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  // FIX #8: track per-template generation
  const lastGeneratedTemplateId = useRef<string | null>(null);

  const selectedClient = useMemo(() => clients.find((c) => c.ref === selectedClientId), [clients, selectedClientId]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId]);
  const variables = useMemo(() => buildClientVariables(selectedClient), [selectedClient]);

  // FIX #1: use refs for saveToSupabase to avoid stale closures
  const stateRef = useRef({
    cabinetId, selectedClientId, selectedTemplateId, wizardStep,
    generatedContent, selectedClient, selectedTemplate, letterId,
  });
  stateRef.current = {
    cabinetId, selectedClientId, selectedTemplateId, wizardStep,
    generatedContent, selectedClient, selectedTemplate, letterId,
  };

  // Generate content from template + variables when entering step 3
  useEffect(() => {
    // FIX #8: Only regenerate if template actually changed
    if (wizardStep === 3 && selectedTemplate && lastGeneratedTemplateId.current !== selectedTemplate.id) {
      const content: Record<string, string> = {};
      const toggles: Record<string, boolean> = {};
      for (const section of selectedTemplate.sections) {
        const resolved = replaceTemplateVariables(section.content, variables);
        content[section.id] = resolved;
        toggles[section.id] = true;
      }
      setGeneratedContent(content);
      setSectionToggles(toggles);
      lastGeneratedTemplateId.current = selectedTemplate.id;
    }
  }, [wizardStep, selectedTemplate, variables]);

  // FIX #8: Reset when template changes
  useEffect(() => {
    lastGeneratedTemplateId.current = null;
  }, [selectedTemplateId]);

  // FIX #1: Stable save function using refs
  const saveToSupabase = useCallback(async (statut: string) => {
    const s = stateRef.current;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const payload: Record<string, any> = {
        cabinet_id: s.cabinetId,
        template_id: s.selectedTemplateId || null,
        // FIX #3: Use client_ref (string) not client_id (uuid) — store in client_ref column
        client_ref: s.selectedClient?.ref || null,
        wizard_step: s.wizardStep,
        statut_lm: statut,
        generated_content: s.generatedContent,
        wizard_data: { client_name: s.selectedClient?.raisonSociale, template_name: s.selectedTemplate?.nom },
        updated_at: new Date().toISOString(),
      };
      if (s.letterId) {
        await supabase.from("lettres_mission").update(payload).eq("id", s.letterId);
      } else {
        payload.user_id = authData.user.id;
        payload.numero = generateLMNumero();
        const { data: ins } = await supabase.from("lettres_mission").insert(payload).select("id").maybeSingle();
        if (ins) setLetterId(ins.id);
      }
    } catch (e) {
      logger.warn("LM", "Save failed:", e);
    }
  }, []);

  // Auto-save every 30s — FIX #1: uses stable saveToSupabase
  useEffect(() => {
    if (!selectedClientId) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await saveToSupabase("BROUILLON");
      setLastAutoSave(new Date());
    }, 30000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [selectedClientId, selectedTemplateId, generatedContent, wizardStep, saveToSupabase]);

  // Warn on browser close
  useEffect(() => {
    if (!selectedClientId) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [selectedClientId]);

  const handleSaveDraft = async () => {
    setSaving(true);
    await saveToSupabase("BROUILLON");
    toast.success("Brouillon sauvegarde");
    setSaving(false);
  };

  // FIX #9: Guard functions that build export params
  const getExportSections = (): TemplateSection[] => {
    if (!selectedTemplate) return [];
    return selectedTemplate.sections
      .filter((s) => sectionToggles[s.id] !== false)
      .map((s) => ({ ...s, content: generatedContent[s.id] || s.content }));
  };

  const getExportParams = () => {
    if (!selectedClient) return null;
    return {
      client: selectedClient,
      genre: "M" as const,
      missions: {
        sociale: sectionToggles["mission_sociale"] !== false,
        juridique: sectionToggles["mission_juridique"] !== false,
        fiscal: sectionToggles["mission_fiscal"] !== false,
      },
      honoraires: {
        comptable: selectedClient.honoraires || 0,
        constitution: 0,
        juridique: selectedClient.juridique || 0,
        frequence: (selectedClient.frequence as any) || "MENSUEL",
      },
      cabinet: {
        nom: "Cabinet d'expertise comptable",
        adresse: "", cp: "", ville: "",
        siret: "", numeroOEC: "", email: "", telephone: "",
      },
      variables,
    };
  };

  const handleExportPdf = async () => {
    const params = getExportParams();
    if (!params || !selectedTemplate) return;
    setSaving(true);
    try {
      const { renderNewLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
      renderNewLettreMissionPdf({ sections: getExportSections(), ...params });
      await saveToSupabase("GENERE");
      logAudit({
        action: "LETTRE_MISSION_EXPORT_PDF",
        table_name: "lettres_mission",
        record_id: stateRef.current.letterId || undefined,
        new_data: { client_ref: params.client.ref, template: selectedTemplate.nom },
      }).catch(() => {});
      toast.success("PDF genere avec succes");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation du PDF");
    }
    setSaving(false);
  };

  const handleExportDocx = async () => {
    const params = getExportParams();
    if (!params || !selectedTemplate) return;
    setSaving(true);
    try {
      const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
      await renderNewLettreMissionDocx({ sections: getExportSections(), ...params });
      await saveToSupabase("GENERE");
      logAudit({
        action: "LETTRE_MISSION_EXPORT_DOCX",
        table_name: "lettres_mission",
        record_id: stateRef.current.letterId || undefined,
        new_data: { client_ref: params.client.ref, template: selectedTemplate.nom },
      }).catch(() => {});
      toast.success("DOCX genere avec succes");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation du DOCX");
    }
    setSaving(false);
  };

  // FIX #2: await saveToSupabase in handleEmail
  const handleEmail = async () => {
    if (!selectedClient) return;
    const subject = encodeURIComponent(`Lettre de mission — ${selectedClient.raisonSociale}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-jointe la lettre de mission pour ${selectedClient.raisonSociale}.\n\nCordialement`);
    window.open(`mailto:${selectedClient.mail || ""}?subject=${subject}&body=${body}`, "_self");
    await saveToSupabase("ENVOYE");
    toast.success("Statut mis a jour : Envoye");
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch || clientSearch.length < 2) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) => c.raisonSociale?.toLowerCase().includes(q) || c.ref?.toLowerCase().includes(q) || c.siren?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const canNext = () => {
    if (wizardStep === 1) return !!selectedClientId;
    if (wizardStep === 2) return !!selectedTemplateId;
    return true;
  };

  // FIX #10: Stable keyboard handler using functional setState
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setWizardStep((s) => (s > 1 ? s - 1 : s));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // Empty deps — handler uses functional setState

  const stepTitles = ["", "Choisir un client", "Choisir un modele", "Previsualisation", "Export"];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {initialLetter?.id ? "Modifier la lettre" : "Nouvelle lettre de mission"}
          </h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {lastAutoSave && (
            <span className="text-[10px] text-slate-600 hidden sm:flex items-center gap-1">
              <Save className="w-3 h-3" />
              {lastAutoSave.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="gap-1.5 border-white/[0.08] text-slate-400">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Sauvegarder</span>
          </Button>
        </div>
      </div>

      {/* Progress — clickable completed steps */}
      <div className="px-4 sm:px-6 py-3 border-b border-white/[0.04] flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => { if (s < wizardStep) setWizardStep(s); }}
              disabled={s > wizardStep}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                s === wizardStep ? "bg-blue-600 text-white" : s < wizardStep ? "bg-emerald-500/20 text-emerald-400 cursor-pointer hover:bg-emerald-500/30" : "bg-white/[0.04] text-slate-600 cursor-default"
              }`}
            >
              {s < wizardStep ? <Check className="w-3.5 h-3.5" /> : s}
            </button>
            <span className={`text-xs hidden sm:block ${s === wizardStep ? "text-white font-medium" : "text-slate-600"}`}>
              {stepTitles[s]}
            </span>
            {s < 4 && <div className={`flex-1 h-px ${s < wizardStep ? "bg-emerald-500/30" : "bg-white/[0.06]"}`} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[900px] mx-auto">

          {/* Step 1: Client */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Rechercher un client par nom, reference ou SIREN..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10 h-11 bg-white/[0.04] border-white/[0.08] text-white"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-600">{filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}</p>
              <div className="grid gap-2 max-h-[calc(100vh-360px)] overflow-y-auto">
                {filteredClients.slice(0, 50).map((client) => (
                  <button
                    key={client.ref}
                    onClick={() => setSelectedClientId(client.ref)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      selectedClientId === client.ref
                        ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{client.raisonSociale}</p>
                      <p className="text-xs text-slate-500">{client.forme} · {client.siren} · {client.ref}</p>
                    </div>
                    {client.nivVigilance && (
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${
                        client.nivVigilance === "RENFORCEE" ? "border-red-500/20 text-red-400" :
                        client.nivVigilance === "STANDARD" ? "border-amber-500/20 text-amber-400" :
                        "border-emerald-500/20 text-emerald-400"
                      }`}>
                        {client.nivVigilance}
                      </Badge>
                    )}
                    {selectedClientId === client.ref && (
                      <Check className="w-5 h-5 text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-10">Aucun client trouve</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              {selectedClient && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-4">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <div className="text-sm">
                    <span className="text-white font-medium">{selectedClient.raisonSociale}</span>
                    <span className="text-slate-500 ml-2">{selectedClient.forme} · {selectedClient.siren}</span>
                  </div>
                </div>
              )}
              <div className="grid gap-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      selectedTemplateId === tpl.id
                        ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <LayoutTemplate className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{tpl.nom}</p>
                      <p className="text-xs text-slate-500">{tpl.description || tpl.type_activite} · {tpl.sections?.length || 0} sections</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-white/[0.1] text-slate-500 shrink-0">
                      {tpl.usage_count} utilisation{tpl.usage_count !== 1 ? "s" : ""}
                    </Badge>
                    {selectedTemplateId === tpl.id && <Check className="w-5 h-5 text-blue-400 shrink-0" />}
                  </button>
                ))}
                {templates.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-10">Aucun modele disponible. Creez-en un dans l'onglet Modeles.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {wizardStep === 3 && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">
                  <span className="text-white font-medium">{selectedClient?.raisonSociale}</span> — {selectedTemplate.nom}
                </p>
                <span className="text-[10px] text-slate-600">
                  {selectedTemplate.sections.filter((s) => sectionToggles[s.id] !== false).length} / {selectedTemplate.sections.length} sections
                </span>
              </div>
              {selectedTemplate.sections.map((section) => {
                const isActive = sectionToggles[section.id] !== false;
                const content = generatedContent[section.id] || section.content;
                const isAuto = ["TABLEAU_ENTITE", "TABLEAU_HONORAIRES", "TABLEAU_REPARTITION", "BLOC_LCBFT"].includes(section.content);
                return (
                  <div key={section.id} className={`rounded-xl border transition-all ${isActive ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/[0.01] border-white/[0.03] opacity-40"}`}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                      <span className="text-sm font-medium text-white">{section.title}</span>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => setSectionToggles((prev) => ({ ...prev, [section.id]: v }))}
                      />
                    </div>
                    {isActive && (
                      <div className="p-4">
                        {isAuto ? (
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs text-slate-500 italic">Contenu genere automatiquement ({section.content})</p>
                          </div>
                        ) : (
                          <Textarea
                            value={content}
                            onChange={(e) => setGeneratedContent((prev) => ({ ...prev, [section.id]: e.target.value }))}
                            rows={Math.max(3, content.split("\n").length)}
                            className="bg-transparent border-none text-sm text-slate-300 leading-relaxed resize-y focus-visible:ring-0 p-0"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 4: Export */}
          {wizardStep === 4 && (
            <div className="space-y-6 max-w-[500px] mx-auto py-10">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Votre lettre est prete</h3>
                <p className="text-sm text-slate-400 mt-2">
                  {selectedClient?.raisonSociale} — {selectedTemplate?.nom}
                </p>
                {selectedTemplate && (
                  <p className="text-[10px] text-slate-600 mt-1">
                    {selectedTemplate.sections.filter((s) => sectionToggles[s.id] !== false).length} sections actives
                  </p>
                )}
              </div>
              <div className="grid gap-3">
                <Button onClick={handleExportPdf} disabled={saving} className="h-14 bg-red-600/90 hover:bg-red-600 gap-3 text-base">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                  Telecharger en PDF
                </Button>
                <Button onClick={handleExportDocx} disabled={saving} variant="outline" className="h-14 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 gap-3 text-base">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Telecharger en DOCX
                </Button>
                <Button onClick={handleEmail} variant="outline" className="h-14 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-3 text-base">
                  <Mail className="w-5 h-5" />
                  Envoyer par email
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-white/[0.06] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
          disabled={wizardStep === 1}
          className="gap-1.5 border-white/[0.08]"
        >
          <ChevronLeft className="w-4 h-4" /> Precedent
        </Button>
        <span className="text-xs text-slate-600">
          Etape {wizardStep} / 4
          <span className="ml-2 text-[9px] hidden sm:inline">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">Esc</kbd> prec.
          </span>
        </span>
        {wizardStep < 4 ? (
          <Button
            onClick={() => setWizardStep((s) => Math.min(4, s + 1))}
            disabled={!canNext()}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="w-24" />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const { hasPermission, profile } = useAuth();
  const isMobile = useIsMobile();

  useDocumentTitle("Lettres de mission");

  const [activeTab, setActiveTab] = useState("modeles");
  const [templates, setTemplates] = useState<LMTemplate[]>([]);
  const [lettres, setLettres] = useState<SavedLettre[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingLettres, setLoadingLettres] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchTemplates, setSearchTemplates] = useState("");
  const [searchLettres, setSearchLettres] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [editingTemplate, setEditingTemplate] = useState<LMTemplate | null | "new">(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingLettre, setEditingLettre] = useState<SavedLettre | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "template" | "lettre"; id: string; name: string } | null>(null);

  // Permission check
  if (!hasPermission("write_clients")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in-up">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-white font-medium">Acces refuse</p>
        <p className="text-slate-400 text-sm text-center px-4">Vous n'avez pas les permissions pour gerer les lettres de mission.</p>
        <Button variant="outline" onClick={() => navigate("/bdd")} className="border-white/[0.06]">Retour</Button>
      </div>
    );
  }

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("lm_templates")
        .select("*")
        .order("usage_count", { ascending: false });
      if (error) throw error;
      if (data) setTemplates(data as LMTemplate[]);
    } catch (e) {
      logger.warn("LM", "Failed to load templates:", e);
      setTemplates([]);
    }
    setLoadingTemplates(false);
  }, []);

  const loadLettres = useCallback(async () => {
    setLoadingLettres(true);
    try {
      const { data, error } = await supabase
        .from("lettres_mission")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (data) {
        setLettres(
          data.map((r: any) => ({
            id: r.id,
            numero: r.numero,
            client_ref: r.client_ref,
            client_id: r.client_id,
            template_id: r.template_id,
            statut_lm: r.statut_lm || "BROUILLON",
            wizard_step: r.wizard_step || 1,
            generated_content: r.generated_content || {},
            wizard_data: r.wizard_data || {},
            created_at: r.created_at,
            updated_at: r.updated_at,
            cabinet_id: r.cabinet_id,
            client_name: r.wizard_data?.client_name || r.client_ref || "—",
            template_name: r.wizard_data?.template_name || "—",
          }))
        );
      }
    } catch (e) {
      logger.warn("LM", "Failed to load lettres:", e);
    }
    setLoadingLettres(false);
  }, []);

  useEffect(() => { loadTemplates(); loadLettres(); }, []);

  const handleSaveTemplate = async (tpl: Partial<LMTemplate>) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error("Non authentifie");
    const payload = {
      nom: tpl.nom!,
      forme_juridique: tpl.forme_juridique || "standard",
      description: tpl.description || null,
      sections: tpl.sections || [],
      type_activite: tpl.type_activite || "tenue",
      cabinet_id: profile?.cabinet_id || null,
    };
    if (tpl.id) {
      const { error } = await supabase.from("lm_templates").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", tpl.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("lm_templates").insert(payload);
      if (error) throw error;
    }
    await loadTemplates();
  };

  const handleDuplicateTemplate = async (tpl: LMTemplate) => {
    try {
      const { error } = await supabase.from("lm_templates").insert({
        nom: `${tpl.nom} (copie)`,
        forme_juridique: tpl.forme_juridique,
        description: tpl.description,
        sections: tpl.sections,
        type_activite: tpl.type_activite,
        cabinet_id: profile?.cabinet_id || null,
        usage_count: 0,
      });
      if (error) throw error;
      toast.success("Modele duplique");
      await loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la duplication");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase.from("lm_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Modele supprime");
      await loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    }
    setDeleteConfirm(null);
  };

  const handleDeleteLettre = async (id: string) => {
    try {
      const { error } = await supabase.from("lettres_mission").delete().eq("id", id);
      if (error) throw error;
      toast.success("Lettre supprimee");
      await loadLettres();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    }
    setDeleteConfirm(null);
  };

  // FIX #4: Proper status progression
  const handleAdvanceStatut = async (lettre: SavedLettre) => {
    const nextStatut = getNextStatut(lettre.statut_lm);
    if (nextStatut === lettre.statut_lm) {
      toast.info("Cette lettre est deja au statut final");
      return;
    }
    try {
      const { error } = await supabase.from("lettres_mission").update({ statut_lm: nextStatut, updated_at: new Date().toISOString() }).eq("id", lettre.id);
      if (error) throw error;
      toast.success(`Statut mis a jour : ${STATUT_CONFIG[nextStatut]?.label || nextStatut}`);
      await loadLettres();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleDuplicateLettre = async (lettre: SavedLettre) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { error } = await supabase.from("lettres_mission").insert({
        user_id: authData.user.id,
        cabinet_id: lettre.cabinet_id,
        template_id: lettre.template_id,
        client_ref: lettre.client_ref,
        wizard_step: 1,
        statut_lm: "BROUILLON",
        generated_content: lettre.generated_content,
        wizard_data: lettre.wizard_data,
        numero: generateLMNumero(),
      });
      if (error) throw error;
      toast.success("Lettre dupliquee");
      await loadLettres();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la duplication");
    }
  };

  // FIX #5: await usage count update
  const handleUseTemplate = async (tpl: LMTemplate) => {
    await supabase.from("lm_templates").update({ usage_count: (tpl.usage_count || 0) + 1 }).eq("id", tpl.id);
    // FIX #13: Properly typed initial letter
    setEditingLettre({
      id: "",
      numero: null,
      client_ref: null,
      client_id: null,
      template_id: tpl.id,
      statut_lm: "BROUILLON",
      wizard_step: 1,
      generated_content: {},
      wizard_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cabinet_id: null,
    });
    setShowWizard(true);
  };

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (filterType !== "all") result = result.filter((t) => t.type_activite === filterType);
    if (searchTemplates.length >= 2) {
      const q = searchTemplates.toLowerCase();
      result = result.filter((t) => t.nom.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
    }
    return result;
  }, [templates, filterType, searchTemplates]);

  const filteredLettres = useMemo(() => {
    let result = [...lettres];
    if (filterStatut !== "all") result = result.filter((l) => l.statut_lm === filterStatut);
    if (searchLettres.length >= 2) {
      const q = searchLettres.toLowerCase();
      result = result.filter((l) =>
        (l.client_name || "").toLowerCase().includes(q) ||
        (l.numero || "").toLowerCase().includes(q) ||
        (l.client_ref || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [lettres, filterStatut, searchLettres]);

  const stats = useMemo(() => ({
    total: lettres.length,
    brouillons: lettres.filter((l) => l.statut_lm === "BROUILLON").length,
    generes: lettres.filter((l) => l.statut_lm === "GENERE").length,
    signes: lettres.filter((l) => l.statut_lm === "SIGNE").length,
  }), [lettres]);

  // ─── Overlays ───
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate === "new" ? null : editingTemplate}
        onSave={handleSaveTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  if (showWizard) {
    return (
      <LetterWizard
        clients={clients}
        templates={templates}
        cabinetId={profile?.cabinet_id || null}
        onClose={() => { setShowWizard(false); setEditingLettre(null); }}
        onSaved={() => { loadLettres(); loadTemplates(); }}
        initialLetter={editingLettre}
      />
    );
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "tenue": return <FileText className="w-4 h-4 text-blue-400" />;
      case "revision": return <Eye className="w-4 h-4 text-emerald-400" />;
      case "social": return <Users className="w-4 h-4 text-violet-400" />;
      case "juridique": return <Scale className="w-4 h-4 text-amber-400" />;
      case "accompagnement": return <Briefcase className="w-4 h-4 text-rose-400" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">
      <ConfirmDialog
        open={!!deleteConfirm}
        title={deleteConfirm?.type === "template" ? "Supprimer le modele" : "Supprimer la lettre"}
        message={`Etes-vous sur de vouloir supprimer "${deleteConfirm?.name}" ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deleteConfirm?.type === "template") handleDeleteTemplate(deleteConfirm.id);
          else if (deleteConfirm) handleDeleteLettre(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Lettres de mission</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Gerez vos modeles et generez vos lettres</p>
        </div>
        {stats.total > 0 && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <Hash className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] text-slate-400">{stats.total}</span>
            </div>
            {stats.brouillons > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[11px] text-amber-400">{stats.brouillons}</span>
              </div>
            )}
            {stats.signes > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400">{stats.signes}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/[0.04] border border-white/[0.06] w-full sm:w-auto">
          <TabsTrigger value="modeles" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <LayoutTemplate className="w-3.5 h-3.5" /> Modeles
            {templates.length > 0 && <Badge className="ml-1 bg-white/[0.06] text-slate-400 text-[10px] px-1.5">{templates.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="lettres" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FileText className="w-3.5 h-3.5" /> Mes lettres
            {lettres.length > 0 && <Badge className="ml-1 bg-white/[0.06] text-slate-400 text-[10px] px-1.5">{lettres.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* MODELES TAB */}
        <TabsContent value="modeles" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input placeholder="Rechercher un modele..." value={searchTemplates} onChange={(e) => setSearchTemplates(e.target.value)} className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
                <Filter className="w-3 h-3 mr-1.5 text-slate-500" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ACTIVITE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingTemplate("new")} className="gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="w-4 h-4" /> Creer un modele
            </Button>
          </div>

          {!loadingTemplates && filteredTemplates.length > 0 && (
            <p className="text-[10px] text-slate-600">{filteredTemplates.length} modele{filteredTemplates.length > 1 ? "s" : ""}</p>
          )}

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /><span className="ml-2 text-slate-400 text-sm">Chargement...</span></div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <LayoutTemplate className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Aucun modele{filterType !== "all" ? " pour ce type" : ""}</p>
              <Button onClick={() => setEditingTemplate("new")} className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm"><Plus className="w-4 h-4" /> Creer un modele</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.map((tpl) => (
                <div key={tpl.id} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">{typeIcon(tpl.type_activite)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tpl.nom}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{tpl.type_activite}</p>
                      </div>
                    </div>
                    {tpl.is_default && <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-400 shrink-0">Par defaut</Badge>}
                  </div>
                  {tpl.description && <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-slate-600">
                    <span>{tpl.sections?.length || 0} sections</span>
                    <span>{countVariables(tpl.sections || [])} variables</span>
                    <span>{tpl.usage_count} utilisation{tpl.usage_count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-600">{formatRelativeDate(tpl.updated_at)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleUseTemplate(tpl)} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors">Utiliser</button>
                      <button onClick={() => setEditingTemplate(tpl)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors" title="Modifier"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDuplicateTemplate(tpl)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-emerald-400 transition-colors" title="Dupliquer"><Copy className="w-3.5 h-3.5" /></button>
                      {!tpl.is_default && (
                        <button onClick={() => setDeleteConfirm({ type: "template", id: tpl.id, name: tpl.nom })} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MES LETTRES TAB */}
        <TabsContent value="lettres" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input placeholder="Rechercher par client, numero..." value={searchLettres} onChange={(e) => setSearchLettres(e.target.value)} className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs" />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
                <Filter className="w-3 h-3 mr-1.5 text-slate-500" /><SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUT_CONFIG).map(([val, cfg]) => (<SelectItem key={val} value={val}>{cfg.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingLettre(null); setShowWizard(true); }} className="gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="w-4 h-4" /> Nouvelle lettre
            </Button>
          </div>

          {!loadingLettres && filteredLettres.length > 0 && (
            <p className="text-[10px] text-slate-600">{filteredLettres.length} lettre{filteredLettres.length > 1 ? "s" : ""}</p>
          )}

          {loadingLettres ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /><span className="ml-2 text-slate-400 text-sm">Chargement...</span></div>
          ) : filteredLettres.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">{lettres.length === 0 ? "Aucune lettre de mission" : "Aucun resultat pour ces filtres"}</p>
              {lettres.length === 0 && (
                <Button onClick={() => { setEditingLettre(null); setShowWizard(true); }} className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm"><Plus className="w-4 h-4" /> Nouvelle lettre</Button>
              )}
              {lettres.length > 0 && filterStatut !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setFilterStatut("all")} className="mt-3 gap-1.5 border-white/[0.08] text-slate-400"><RotateCcw className="w-3 h-3" /> Reinitialiser</Button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_120px_100px_100px_100px_140px] gap-2 px-4 text-[10px] text-slate-600 uppercase tracking-wider">
                <span>Client</span><span>Numero</span><span>Modele</span><span>Date</span><span>Statut</span><span className="text-right">Actions</span>
              </div>
              <div className="space-y-1.5">
                {filteredLettres.map((lettre) => {
                  const statut = STATUT_CONFIG[lettre.statut_lm] || STATUT_CONFIG.BROUILLON;
                  return (
                    <div key={lettre.id} className="group sm:grid sm:grid-cols-[1fr_120px_100px_100px_100px_140px] sm:items-center gap-2 p-3 sm:px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                      <button onClick={() => { setEditingLettre(lettre); setShowWizard(true); }} className="flex items-center gap-2 text-left min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-blue-400" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lettre.client_name}</p>
                          <p className="text-[10px] text-slate-500 sm:hidden">{lettre.template_name} · {formatRelativeDate(lettre.updated_at)}</p>
                        </div>
                      </button>
                      <span className="hidden sm:block text-xs text-slate-400 font-mono truncate">{lettre.numero || "—"}</span>
                      <span className="hidden sm:block text-xs text-slate-500 truncate">{lettre.template_name}</span>
                      <span className="hidden sm:block text-xs text-slate-500">{formatRelativeDate(lettre.updated_at)}</span>
                      <div className="hidden sm:block"><Badge variant="outline" className={`text-[9px] ${statut.color}`}>{statut.label}</Badge></div>
                      <div className="hidden sm:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingLettre(lettre); setShowWizard(true); }} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-blue-400 transition-colors" title="Modifier"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDuplicateLettre(lettre)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-emerald-400 transition-colors" title="Dupliquer"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleAdvanceStatut(lettre)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-violet-400 transition-colors" title="Avancer le statut"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: "lettre", id: lettre.id, name: lettre.client_name || "cette lettre" })} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
                        <Badge variant="outline" className={`text-[9px] ${statut.color}`}>{statut.label}</Badge>
                        <div className="flex-1" />
                        <button onClick={() => handleDuplicateLettre(lettre)} className="p-1.5 text-slate-500"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleAdvanceStatut(lettre)} className="p-1.5 text-slate-500"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: "lettre", id: lettre.id, name: lettre.client_name || "cette lettre" })} className="p-1.5 text-slate-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
