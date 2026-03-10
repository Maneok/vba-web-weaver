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
import { DEFAULT_TEMPLATE, SCI_TEMPLATE, LMNP_TEMPLATE, replaceTemplateVariables } from "@/lib/lettreMissionTemplate";
import type { TemplateSection } from "@/lib/lettreMissionTemplate";
import type { Client } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, LayoutTemplate, Plus, Search, Filter, Copy, Edit3,
  ChevronLeft, ChevronRight, Loader2, ShieldAlert, Save, Eye,
  FileDown, Mail, Check, X, Users, Briefcase, Scale, Building2,
  HandCoins, Clock, Lock, Unlock, Variable, Download, Send,
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
  // joined
  client_name?: string;
  template_name?: string;
}

// ─── Constants ───
const TYPE_ACTIVITE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "tenue", label: "Tenue comptable" },
  { value: "revision", label: "Revision" },
  { value: "social", label: "Social / Paie" },
  { value: "juridique", label: "Juridique" },
  { value: "accompagnement", label: "Accompagnement" },
];

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  GENERE: { label: "Genere", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SIGNE: { label: "Signe", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  ENVOYE: { label: "Envoye", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

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

const TEMPLATE_VARIABLES = [
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

// ─── Section mapping for template editor ───
const EDITOR_SECTIONS = [
  { id: "parties", label: "Parties", sectionIds: ["destinataire", "introduction", "entite"] },
  { id: "objet", label: "Objet", sectionIds: ["mission", "nature_limite"] },
  { id: "missions", label: "Missions", sectionIds: ["missions_complementaires_intro", "mission_sociale", "mission_juridique", "mission_fiscal"] },
  { id: "honoraires", label: "Honoraires", sectionIds: ["honoraires", "modalites"] },
  { id: "duree", label: "Duree", sectionIds: ["duree", "organisation"] },
  { id: "lcbft", label: "LCB-FT", sectionIds: ["lcbft", "lcbft_sci_specifique", "lcbft_lmnp_specifique"] },
  { id: "confidentialite", label: "Confidentialite", sectionIds: ["annexe_cgv"] },
  { id: "signature", label: "Signature", sectionIds: ["signature"] },
];

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
  const [nom, setNom] = useState(template?.nom || "");
  const [typeActivite, setTypeActivite] = useState(template?.type_activite || "tenue");
  const [description, setDescription] = useState(template?.description || "");
  const [sections, setSections] = useState<TemplateSection[]>(template?.sections || [...DEFAULT_TEMPLATE]);
  const [activeSection, setActiveSection] = useState(EDITOR_SECTIONS[0].id);
  const [disabledSections, setDisabledSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showVarMenu, setShowVarMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSectionDef = EDITOR_SECTIONS.find((s) => s.id === activeSection);
  const matchingSections = sections.filter((s) => activeSectionDef?.sectionIds.includes(s.id));

  const toggleSection = (sectionId: string) => {
    setDisabledSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const updateSectionContent = (sectionId: string, content: string) => {
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
    // find the section being edited
    if (matchingSections.length > 0) {
      updateSectionContent(matchingSections[0].id, newText);
    }
    setShowVarMenu(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 50);
  };

  const handleSave = async () => {
    if (!nom.trim()) { toast.error("Le nom du modele est requis"); return; }
    setSaving(true);
    try {
      await onSave({
        id: template?.id,
        nom: nom.trim(),
        type_activite: typeActivite,
        description: description.trim(),
        sections,
        forme_juridique: typeActivite,
      });
      toast.success("Modele sauvegarde");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  // Highlight variables in text
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
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div className="h-6 w-px bg-white/[0.08]" />
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du modele..."
            className="bg-transparent border-none text-lg font-semibold text-white w-[300px] focus-visible:ring-0 px-0"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={typeActivite} onValueChange={setTypeActivite}>
            <SelectTrigger className="w-[180px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ACTIVITE_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 py-2 border-b border-white/[0.04]">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description du modele..."
          className="bg-transparent border-none text-sm text-slate-400 focus-visible:ring-0 px-0"
        />
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Section menu */}
        <div className="w-[240px] border-r border-white/[0.06] py-4 overflow-y-auto shrink-0">
          <p className="px-4 text-[10px] text-slate-600 uppercase tracking-wider mb-3">Sections</p>
          {EDITOR_SECTIONS.map((sec) => {
            const Icon = SECTION_ICONS[sec.id] || FileText;
            const isActive = activeSection === sec.id;
            const isDisabled = disabledSections.has(sec.id);
            return (
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">{activeSectionDef?.label}</h3>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVarMenu(!showVarMenu)}
                className="gap-1.5 border-white/[0.08] text-xs text-slate-400"
              >
                <Variable className="w-3.5 h-3.5" /> Inserer une variable
              </Button>
              {showVarMenu && (
                <div className="absolute right-0 top-full mt-1 w-[260px] bg-slate-900 border border-white/[0.1] rounded-xl shadow-xl z-50 p-2 max-h-[300px] overflow-y-auto">
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
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
              Cette section est desactivee. Elle ne sera pas incluse dans les lettres generees.
            </div>
          )}

          {matchingSections.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucune sous-section pour cette categorie dans le modele selectionne.</p>
          ) : (
            matchingSections.map((sec) => (
              <div key={sec.id} className="space-y-2">
                <label className="text-xs text-slate-500 font-medium">{sec.title}</label>
                {sec.content === "TABLEAU_ENTITE" || sec.content === "TABLEAU_HONORAIRES" || sec.content === "TABLEAU_REPARTITION" || sec.content === "BLOC_LCBFT" ? (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
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
                {/* Preview with highlighted variables */}
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
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const selectedClient = useMemo(() => clients.find((c) => c.ref === selectedClientId), [clients, selectedClientId]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId]);

  // Build variables from client
  const variables = useMemo(() => {
    if (!selectedClient) return {};
    const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
    const now = new Date();
    return {
      raison_sociale: selectedClient.raisonSociale || "",
      siren: selectedClient.siren || "",
      dirigeant: selectedClient.dirigeant || "",
      adresse: selectedClient.adresse || "",
      ville: selectedClient.ville || "",
      cp: selectedClient.cp || "",
      code_postal: selectedClient.cp || "",
      capital: String(selectedClient.capital || ""),
      forme_juridique: selectedClient.forme || "",
      honoraires: String(selectedClient.honoraires || 0),
      frequence: selectedClient.frequence || "MENSUEL",
      associe: selectedClient.associe || "",
      date_du_jour: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
      nom_cabinet: "Cabinet d'expertise comptable",
      effectif: selectedClient.effectif || "",
      ape: selectedClient.ape || "",
      date_cloture: selectedClient.dateCloture || "31/12",
      formule_politesse: "Monsieur",
      iban: selectedClient.iban || "",
      bic: selectedClient.bic || "",
      ref: selectedClient.ref || "",
    };
  }, [selectedClient]);

  // Generate content from template + variables when entering step 3
  useEffect(() => {
    if (wizardStep === 3 && selectedTemplate && Object.keys(generatedContent).length === 0) {
      const content: Record<string, string> = {};
      const toggles: Record<string, boolean> = {};
      for (const section of selectedTemplate.sections) {
        const resolved = replaceTemplateVariables(section.content, variables);
        content[section.id] = resolved;
        toggles[section.id] = true;
      }
      setGeneratedContent(content);
      setSectionToggles(toggles);
    }
  }, [wizardStep, selectedTemplate, variables]);

  // Auto-save every 30s
  useEffect(() => {
    if (!selectedClientId) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveToSupabase("BROUILLON"), 30000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [selectedClientId, selectedTemplateId, generatedContent, wizardStep]);

  const saveToSupabase = async (statut: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const payload: Record<string, any> = {
        cabinet_id: cabinetId,
        template_id: selectedTemplateId || null,
        client_id: selectedClientId || null,
        client_ref: selectedClient?.ref || null,
        wizard_step: wizardStep,
        statut_lm: statut,
        generated_content: generatedContent,
        wizard_data: { client_name: selectedClient?.raisonSociale, template_name: selectedTemplate?.nom },
        updated_at: new Date().toISOString(),
      };
      if (letterId) {
        await supabase.from("lettres_mission").update(payload).eq("id", letterId);
      } else {
        payload.user_id = authData.user.id;
        const { data: ins } = await supabase.from("lettres_mission").insert(payload).select("id").maybeSingle();
        if (ins) setLetterId(ins.id);
      }
    } catch (e) {
      logger.warn("LM", "Auto-save failed:", e);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    await saveToSupabase("BROUILLON");
    toast.success("Brouillon sauvegarde");
    setSaving(false);
  };

  const handleExportPdf = async () => {
    if (!selectedClient || !selectedTemplate) return;
    setSaving(true);
    try {
      const { renderNewLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
      const activeSections = selectedTemplate.sections.filter((s) => sectionToggles[s.id] !== false);
      // override content with user edits
      const editedSections = activeSections.map((s) => ({
        ...s,
        content: generatedContent[s.id] || s.content,
      }));
      renderNewLettreMissionPdf({
        sections: editedSections,
        client: selectedClient,
        genre: "M",
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
      });
      await saveToSupabase("GENERE");
      toast.success("PDF genere");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur PDF");
    }
    setSaving(false);
  };

  const handleExportDocx = async () => {
    if (!selectedClient || !selectedTemplate) return;
    setSaving(true);
    try {
      const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
      const activeSections = selectedTemplate.sections.filter((s) => sectionToggles[s.id] !== false);
      const editedSections = activeSections.map((s) => ({
        ...s,
        content: generatedContent[s.id] || s.content,
      }));
      await renderNewLettreMissionDocx({
        sections: editedSections,
        client: selectedClient,
        genre: "M",
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
      });
      await saveToSupabase("GENERE");
      toast.success("DOCX genere");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur DOCX");
    }
    setSaving(false);
  };

  const handleEmail = () => {
    if (!selectedClient) return;
    const subject = encodeURIComponent(`Lettre de mission — ${selectedClient.raisonSociale}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-jointe la lettre de mission pour ${selectedClient.raisonSociale}.\n\nCordialement`);
    window.open(`mailto:${selectedClient.mail || ""}?subject=${subject}&body=${body}`, "_self");
    saveToSupabase("ENVOYE");
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

  const stepTitles = ["", "Choisir un client", "Choisir un modele", "Previsualisation", "Export"];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div className="h-6 w-px bg-white/[0.08]" />
          <h2 className="text-lg font-semibold text-white">Nouvelle lettre de mission</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="gap-1.5 border-white/[0.08] text-slate-400">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-6 py-3 border-b border-white/[0.04] flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              s === wizardStep ? "bg-blue-600 text-white" : s < wizardStep ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.04] text-slate-600"
            }`}>
              {s < wizardStep ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            <span className={`text-xs hidden sm:block ${s === wizardStep ? "text-white font-medium" : "text-slate-600"}`}>
              {stepTitles[s]}
            </span>
            {s < 4 && <div className={`flex-1 h-px ${s < wizardStep ? "bg-emerald-500/30" : "bg-white/[0.06]"}`} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
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
              <div className="grid gap-2 max-h-[calc(100vh-320px)] overflow-y-auto">
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
                    <p className="text-xs text-slate-500">{tpl.description || tpl.type_activite}</p>
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
          )}

          {/* Step 3: Preview */}
          {wizardStep === 3 && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">
                  <span className="text-white font-medium">{selectedClient?.raisonSociale}</span> — {selectedTemplate.nom}
                </p>
              </div>
              {selectedTemplate.sections.map((section) => {
                const isActive = sectionToggles[section.id] !== false;
                const content = generatedContent[section.id] || section.content;
                const isAuto = ["TABLEAU_ENTITE", "TABLEAU_HONORAIRES", "TABLEAU_REPARTITION", "BLOC_LCBFT"].includes(section.content);
                return (
                  <div key={section.id} className={`rounded-xl border transition-all ${isActive ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/[0.01] border-white/[0.03] opacity-40"}`}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                      <span className="text-sm font-medium text-white">{section.title}</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(v) => setSectionToggles((prev) => ({ ...prev, [section.id]: v }))}
                        />
                      </div>
                    </div>
                    {isActive && (
                      <div className="p-4">
                        {isAuto ? (
                          <p className="text-xs text-slate-500 italic">Contenu genere automatiquement ({section.content})</p>
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
              </div>

              <div className="grid gap-3">
                <Button
                  onClick={handleExportPdf}
                  disabled={saving}
                  className="h-14 bg-red-600/90 hover:bg-red-600 gap-3 text-base"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                  Telecharger en PDF
                </Button>
                <Button
                  onClick={handleExportDocx}
                  disabled={saving}
                  variant="outline"
                  className="h-14 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 gap-3 text-base"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Telecharger en DOCX
                </Button>
                <Button
                  onClick={handleEmail}
                  variant="outline"
                  className="h-14 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-3 text-base"
                >
                  <Mail className="w-5 h-5" />
                  Envoyer par email
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
          disabled={wizardStep === 1}
          className="gap-1.5 border-white/[0.08]"
        >
          <ChevronLeft className="w-4 h-4" /> Precedent
        </Button>
        <span className="text-xs text-slate-600">Etape {wizardStep} / 4</span>
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

  // Editor / Wizard states
  const [editingTemplate, setEditingTemplate] = useState<LMTemplate | null | "new">(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingLettre, setEditingLettre] = useState<SavedLettre | null>(null);

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

  // ─── Data loading ───
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("lm_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (data) setTemplates(data as LMTemplate[]);
    } catch (e) {
      logger.warn("LM", "Failed to load templates:", e);
      // Fallback: create default templates from local data
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

  // ─── Template CRUD ───
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
    // Increment usage count not needed here
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

  const handleUseTemplate = (tpl: LMTemplate) => {
    // Increment usage count
    supabase.from("lm_templates").update({ usage_count: (tpl.usage_count || 0) + 1 }).eq("id", tpl.id).then();
    setEditingLettre(null);
    setShowWizard(true);
    // Pre-select template in wizard — we pass it via initialLetter
    setEditingLettre({ template_id: tpl.id, wizard_step: 1 } as any);
  };

  // ─── Filtered data ───
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

  // ─── Template Editor overlay ───
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate === "new" ? null : editingTemplate}
        onSave={handleSaveTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  // ─── Wizard overlay ───
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Lettres de mission</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Gerez vos modeles et generez vos lettres</p>
        </div>
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

        {/* ═══ MODELES TAB ═══ */}
        <TabsContent value="modeles" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                placeholder="Rechercher un modele..."
                value={searchTemplates}
                onChange={(e) => setSearchTemplates(e.target.value)}
                className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
                <Filter className="w-3 h-3 mr-1.5 text-slate-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ACTIVITE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingTemplate("new")} className="gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="w-4 h-4" /> Creer un modele
            </Button>
          </div>

          {/* Template cards */}
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-slate-400 text-sm">Chargement...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <LayoutTemplate className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Aucun modele{filterType !== "all" ? " pour ce type" : ""}</p>
              <p className="text-slate-500 text-xs mt-1">Creez votre premier modele de lettre de mission</p>
              <Button onClick={() => setEditingTemplate("new")} className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm">
                <Plus className="w-4 h-4" /> Creer un modele
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        {typeIcon(tpl.type_activite)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tpl.nom}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{tpl.type_activite}</p>
                      </div>
                    </div>
                    {tpl.is_default && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-400 shrink-0">Par defaut</Badge>
                    )}
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-600">{tpl.usage_count} utilisation{tpl.usage_count !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUseTemplate(tpl)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors"
                      >
                        Utiliser
                      </button>
                      <button
                        onClick={() => setEditingTemplate(tpl)}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicateTemplate(tpl)}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-emerald-400 transition-colors"
                        title="Dupliquer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ MES LETTRES TAB ═══ */}
        <TabsContent value="lettres" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                placeholder="Rechercher par client, numero..."
                value={searchLettres}
                onChange={(e) => setSearchLettres(e.target.value)}
                className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
              />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
                <Filter className="w-3 h-3 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUT_CONFIG).map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => { setEditingLettre(null); setShowWizard(true); }}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="w-4 h-4" /> Nouvelle lettre
            </Button>
          </div>

          {/* Letters list */}
          {loadingLettres ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-slate-400 text-sm">Chargement...</span>
            </div>
          ) : filteredLettres.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">
                {lettres.length === 0 ? "Aucune lettre de mission" : "Aucun resultat pour ces filtres"}
              </p>
              {lettres.length === 0 && (
                <>
                  <p className="text-slate-500 text-xs mt-1">Creez votre premiere lettre</p>
                  <Button
                    onClick={() => { setEditingLettre(null); setShowWizard(true); }}
                    className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" /> Nouvelle lettre
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_120px_140px_100px_120px] gap-2 px-4 text-[10px] text-slate-600 uppercase tracking-wider">
                <span>Client</span>
                <span>Modele</span>
                <span>Date</span>
                <span>Statut</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="space-y-1.5">
                {filteredLettres.map((lettre) => {
                  const statut = STATUT_CONFIG[lettre.statut_lm] || STATUT_CONFIG.BROUILLON;
                  return (
                    <div
                      key={lettre.id}
                      className="group sm:grid sm:grid-cols-[1fr_120px_140px_100px_120px] sm:items-center gap-2 p-3 sm:px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Client */}
                      <button
                        onClick={() => { setEditingLettre(lettre); setShowWizard(true); }}
                        className="flex items-center gap-2 text-left min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lettre.client_name}</p>
                          <p className="text-[10px] text-slate-500 sm:hidden">
                            {lettre.template_name} · {new Date(lettre.updated_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </button>

                      {/* Modele */}
                      <span className="hidden sm:block text-xs text-slate-500 truncate">{lettre.template_name}</span>

                      {/* Date */}
                      <span className="hidden sm:block text-xs text-slate-500">
                        {new Date(lettre.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>

                      {/* Statut */}
                      <div className="hidden sm:block">
                        <Badge variant="outline" className={`text-[9px] ${statut.color}`}>{statut.label}</Badge>
                      </div>

                      {/* Actions */}
                      <div className="hidden sm:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingLettre(lettre); setShowWizard(true); }}
                          className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-blue-400 transition-colors"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Mobile row */}
                      <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
                        <Badge variant="outline" className={`text-[9px] ${statut.color}`}>{statut.label}</Badge>
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
