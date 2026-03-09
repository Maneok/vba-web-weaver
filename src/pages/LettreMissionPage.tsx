import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { toast } from "sonner";
import {
  LM_STEP_LABELS,
  LM_STEP_DESCRIPTIONS,
  INITIAL_LM_WIZARD_DATA,
  type LMWizardData,
  type SavedLetter,
} from "@/lib/lmWizardTypes";
import { VALIDATORS, sanitizeWizardData } from "@/lib/lmValidation";

import LMWizardStep1Client from "@/components/lettre-mission/LMWizardStep1Client";
import LMWizardStep2Type from "@/components/lettre-mission/LMWizardStep2Type";
import LMWizardStep3Infos from "@/components/lettre-mission/LMWizardStep3Infos";
import LMWizardStep4Missions from "@/components/lettre-mission/LMWizardStep4Missions";
import LMWizardStep5Modalites from "@/components/lettre-mission/LMWizardStep5Modalites";
import LMWizardStep6Honoraires from "@/components/lettre-mission/LMWizardStep6Honoraires";
import LMWizardStep7Intervenants from "@/components/lettre-mission/LMWizardStep7Intervenants";
import LMWizardStep8Clauses from "@/components/lettre-mission/LMWizardStep8Clauses";
import LMWizardStep9Preview from "@/components/lettre-mission/LMWizardStep9Preview";
import LMWizardStep10Export from "@/components/lettre-mission/LMWizardStep10Export";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft, ChevronRight, Check, FileText, History, Plus, Loader2,
  Clock, Edit3, ShieldAlert, Save,
} from "lucide-react";

// ── useMediaQuery hook ──
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ─────────────────────────────────────────
// Historique — tableau des lettres sauvées
// ─────────────────────────────────────────
function LetterHistory({
  letters,
  loading,
  onEdit,
}: {
  letters: SavedLetter[];
  loading: boolean;
  onEdit: (letter: SavedLetter) => void;
}) {
  const statusBadge = (s: string) => {
    switch (s) {
      case "BROUILLON": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "ENVOYEE": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "SIGNEE": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "ARCHIVEE": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-400 text-sm">Chargement...</span>
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Aucune lettre de mission creee</p>
        <p className="text-slate-500 text-xs mt-1">Creez votre premiere lettre avec le wizard</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {letters.map((letter) => (
        <div
          key={letter.id}
          className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{letter.raison_sociale}</p>
            <p className="text-xs text-slate-500 truncate">{letter.numero} — {letter.type_mission} — {new Date(letter.updated_at).toLocaleDateString("fr-FR")}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusBadge(letter.statut)}`}>
            {letter.statut}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-blue-400 shrink-0"
            onClick={() => onEdit(letter)}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const { hasPermission, profile } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [activeTab, setActiveTab] = useState("wizard");

  // ── Permission check ──
  if (!hasPermission("write_clients")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in-up">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-white font-medium">Acces refuse</p>
        <p className="text-slate-400 text-sm text-center px-4">Vous n'avez pas les permissions pour creer une lettre de mission.</p>
        <Button variant="outline" onClick={() => navigate("/bdd")} className="border-white/[0.06]">
          Retour
        </Button>
      </div>
    );
  }

  // Wizard state
  const [step, setStep] = useState(0);
  const [data, setData] = useState<LMWizardData>({ ...INITIAL_LM_WIZARD_DATA });
  const [stepDirection, setStepDirection] = useState<"left" | "right">("right");
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const prevStepRef = useRef(0);
  const [lmId, setLmId] = useState<string | null>(null);
  const [existingLmWarningShown, setExistingLmWarningShown] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Draft resume
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ id: string; wizard_data: any; wizard_step: number } | null>(null);

  // History state
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Swipe refs
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Progress
  const progress = ((step + 1) / LM_STEP_LABELS.length) * 100;

  // ── Step change animation + scroll to top ──
  useEffect(() => {
    setStepDirection(step > prevStepRef.current ? "right" : "left");
    prevStepRef.current = step;
    setFieldsVisible(false);
    const t = setTimeout(() => setFieldsVisible(true), 50);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => clearTimeout(t);
  }, [step]);

  // ── Auto-save draft to sessionStorage ──
  useEffect(() => {
    sessionStorage.setItem("lm_wizard_draft", JSON.stringify({ ...data, wizard_step: step }));
  }, [data, step]);

  // ── Restore draft on mount + check Supabase drafts ──
  useEffect(() => {
    // SessionStorage draft
    try {
      const raw = sessionStorage.getItem("lm_wizard_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.client_id) {
          setData(parsed);
          if (parsed.wizard_step > 0) setStep(parsed.wizard_step);
        }
      }
    } catch {}
    // Supabase draft
    loadSupabaseDraft();
  }, []);

  const loadSupabaseDraft = async () => {
    try {
      const { data: drafts } = await supabase
        .from("lettres_mission")
        .select("id, wizard_data, wizard_step, created_at")
        .eq("statut", "BROUILLON")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (drafts && drafts.length > 0 && drafts[0].wizard_data?.client_id) {
        setDraftInfo(drafts[0] as any);
        setShowDraftBanner(true);
      }
    } catch {}
  };

  const resumeDraft = () => {
    if (draftInfo) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...draftInfo.wizard_data });
      setLmId(draftInfo.id);
      setStep(draftInfo.wizard_step || 0);
      setShowDraftBanner(false);
      setActiveTab("wizard");
    }
  };

  // Load saved letters
  useEffect(() => {
    loadSavedLetters();
  }, []);

  // ── TVA auto selon forme juridique ──
  useEffect(() => {
    if (data.forme_juridique === "ASSOCIATION" || data.forme_juridique === "ASSO") {
      setData((prev) => ({ ...prev, taux_tva: 0 }));
    }
  }, [data.forme_juridique]);

  // ── Pre-remplissage intelligent ──
  useEffect(() => {
    if (!data.client_id) return;
    const client = clients.find((c) => c.ref === data.client_id);
    if (!client) return;

    const updates: Partial<LMWizardData> = {};

    // SCI → pre-check immobilier missions
    if (data.forme_juridique === "SCI" && data.missions_selected.length > 0) {
      const updated = data.missions_selected.map((m) =>
        m.section_id === "juridique" ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) } : m
      );
      if (JSON.stringify(updated) !== JSON.stringify(data.missions_selected)) {
        updates.missions_selected = updated;
      }
    }

    // Effectif > 0 → pre-check social
    if (client.effectif && parseInt(client.effectif) > 0 && data.missions_selected.length > 0) {
      const updated = data.missions_selected.map((m) =>
        m.section_id === "social" ? { ...m, selected: true } : m
      );
      if (JSON.stringify(updated) !== JSON.stringify(data.missions_selected)) {
        updates.missions_selected = updated;
      }
    }

    if (Object.keys(updates).length > 0) {
      setData((prev) => ({ ...prev, ...updates }));
    }
  }, [data.client_id, data.forme_juridique, data.missions_selected.length]);

  // ── Avertissement LM existante ──
  useEffect(() => {
    if (data.client_id && !existingLmWarningShown) {
      checkExistingLM(data.client_id);
      setExistingLmWarningShown(true);
    }
  }, [data.client_id]);

  const checkExistingLM = async (clientId: string) => {
    try {
      const { data: existing } = await supabase
        .from("lettres_mission")
        .select("id, statut, created_at")
        .eq("client_ref", clientId)
        .neq("statut", "ARCHIVEE");
      if (existing && existing.length > 0) {
        toast.warning(`Ce client a deja ${existing.length} lettre(s) de mission en cours`);
      }
    } catch {}
  };

  // ── Auto-save to Supabase every 30s ──
  const saveToSupabase = useCallback(async () => {
    if (!data.client_id) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const payload = {
        wizard_data: data,
        wizard_step: step,
        updated_at: new Date().toISOString(),
      };

      if (lmId) {
        await supabase.from("lettres_mission").update(payload).eq("id", lmId);
      } else {
        const { data: inserted } = await supabase
          .from("lettres_mission")
          .insert({
            user_id: authData.user.id,
            cabinet_id: profile?.cabinet_id,
            client_ref: data.client_ref,
            raison_sociale: data.raison_sociale,
            type_mission: data.type_mission,
            statut: "BROUILLON",
            wizard_data: data,
            wizard_step: step,
            numero: `LM-${new Date().getFullYear()}-${String(savedLetters.length + 1).padStart(3, "0")}`,
          })
          .select("id")
          .maybeSingle();
        if (inserted) setLmId(inserted.id);
      }
      setLastSaved(new Date());
    } catch (e) {
      console.error("Auto-save error:", e);
    }
  }, [data, step, lmId, profile?.cabinet_id, savedLetters.length]);

  useEffect(() => {
    const interval = setInterval(saveToSupabase, 30000);
    return () => clearInterval(interval);
  }, [saveToSupabase]);

  const loadSavedLetters = async () => {
    setHistoryLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("lettres_mission")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!error && rows) {
        setSavedLetters(
          rows.map((r: any) => ({
            id: r.id,
            numero: r.numero || `LM-${new Date(r.created_at).getFullYear()}-${String(rows.indexOf(r) + 1).padStart(3, "0")}`,
            client_ref: r.client_ref || "",
            raison_sociale: r.raison_sociale || r.wizard_data?.raison_sociale || "—",
            type_mission: r.type_mission || r.wizard_data?.type_mission || "—",
            statut: r.statut || "BROUILLON",
            created_at: r.created_at,
            updated_at: r.updated_at,
            wizard_data: r.wizard_data || {},
          }))
        );
      }
    } catch {}
    setHistoryLoading(false);
  };

  const handleChange = useCallback((updates: Partial<LMWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((s: number) => {
    if (s >= 0 && s < LM_STEP_LABELS.length) setStep(s);
  }, []);

  // ── Navigation handlers ──
  const handleNext = useCallback(() => {
    const validator = VALIDATORS[step];
    if (validator) {
      const errors = validator(data);
      if (errors.length > 0) {
        errors.forEach((e) => toast.error(e.message));
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, LM_STEP_LABELS.length - 1));
    saveToSupabase();
  }, [step, data, saveToSupabase]);

  const handlePrevious = useCallback(() => {
    if (step > 0) setStep(step - 1);
    else navigate("/bdd");
  }, [step, navigate]);

  // ── Swipe handlers ──
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 75) {
      if (diff > 0) handleNext();
      else handlePrevious();
    }
  };

  // ── Final save ──
  const handleSave = async () => {
    const sanitized = sanitizeWizardData(data);
    try {
      const payload = {
        client_ref: sanitized.client_ref,
        raison_sociale: sanitized.raison_sociale,
        type_mission: sanitized.type_mission,
        statut: sanitized.statut,
        wizard_data: sanitized,
        numero: `LM-${new Date().getFullYear()}-${String(savedLetters.length + 1).padStart(3, "0")}`,
      };

      if (lmId) {
        const { error } = await supabase
          .from("lettres_mission")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", lmId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("lettres_mission")
          .insert(payload)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (inserted) setLmId(inserted.id);
      }

      logAudit({
        action: "LETTRE_MISSION",
        table_name: "lettres_mission",
        record_id: lmId || undefined,
        new_data: { client_ref: sanitized.client_ref, type: sanitized.type_mission, statut: sanitized.statut },
      }).catch(() => {});

      sessionStorage.removeItem("lm_wizard_draft");
      setLastSaved(new Date());
      await loadSavedLetters();
      setActiveTab("history");
    } catch (err) {
      console.error("Save error:", err);
      throw err;
    }
  };

  const handleEditLetter = (letter: SavedLetter) => {
    if (letter.wizard_data) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data });
      setLmId(letter.id);
      setStep(0);
      setActiveTab("wizard");
    }
  };

  const handleNewLetter = () => {
    setData({ ...INITIAL_LM_WIZARD_DATA });
    setLmId(null);
    setStep(0);
    setExistingLmWarningShown(false);
    sessionStorage.removeItem("lm_wizard_draft");
    setActiveTab("wizard");
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (activeTab !== "wizard") return;
      if (e.key === "Escape" && step > 0) {
        e.preventDefault();
        setStep(step - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, activeTab]);

  const renderStep = () => {
    switch (step) {
      case 0: return <LMWizardStep1Client data={data} onChange={handleChange} />;
      case 1: return <LMWizardStep2Type data={data} onChange={handleChange} />;
      case 2: return <LMWizardStep3Infos data={data} onChange={handleChange} />;
      case 3: return <LMWizardStep4Missions data={data} onChange={handleChange} />;
      case 4: return <LMWizardStep5Modalites data={data} onChange={handleChange} />;
      case 5: return <LMWizardStep6Honoraires data={data} onChange={handleChange} />;
      case 6: return <LMWizardStep7Intervenants data={data} onChange={handleChange} />;
      case 7: return <LMWizardStep8Clauses data={data} onChange={handleChange} />;
      case 8: return <LMWizardStep9Preview data={data} onChange={handleChange} onGoToStep={goToStep} isMobile={isMobile} />;
      case 9: return <LMWizardStep10Export data={data} onChange={handleChange} onSave={handleSave} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Lettres de mission</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Creez et gerez vos lettres de mission</p>
        </div>
        <Button onClick={handleNewLetter} className="gap-1.5 bg-blue-600 hover:bg-blue-700" size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4" /> {!isMobile && "Nouvelle lettre"}
        </Button>
      </div>

      {/* Draft resume banner */}
      {showDraftBanner && draftInfo && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-fade-in-up">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-300">Brouillon en cours</p>
            <p className="text-xs text-slate-400 truncate">
              {draftInfo.wizard_data?.raison_sociale || "Sans nom"} — Etape {(draftInfo.wizard_step || 0) + 1}/10
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={resumeDraft} className="bg-blue-600 hover:bg-blue-700">Reprendre</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDraftBanner(false)} className="text-slate-400">Ignorer</Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/[0.04] border border-white/[0.06] w-full sm:w-auto">
          <TabsTrigger value="wizard" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FileText className="w-3.5 h-3.5" /> {isMobile ? "Wizard" : "Nouvelle lettre"}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <History className="w-3.5 h-3.5" /> Historique
            {savedLetters.length > 0 && (
              <Badge className="ml-1 bg-white/[0.06] text-slate-400 text-[10px] px-1.5">{savedLetters.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── WIZARD TAB ─── */}
        <TabsContent value="wizard" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
          {/* Progress bar */}
          <Progress value={progress} className="h-1" />

          {/* Stepper */}
          <div className="glass-card p-3 sm:p-4 shadow-lg">
            {isMobile ? (
              /* ── Mobile: Compact band with chevrons ── */
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => step > 0 && setStep(step - 1)}
                  disabled={step === 0}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] disabled:opacity-30 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <div className="flex-1 text-center min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    Etape {step + 1}/10 — {LM_STEP_LABELS[step]}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{LM_STEP_DESCRIPTIONS[step]}</p>
                </div>
                <button
                  onClick={() => step < LM_STEP_LABELS.length - 1 && handleNext()}
                  disabled={step === LM_STEP_LABELS.length - 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] disabled:opacity-30 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ) : (
              /* ── Desktop: Horizontal stepper ── */
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] text-slate-600">
                      Etape {step + 1} / {LM_STEP_LABELS.length} — {LM_STEP_DESCRIPTIONS[step]}
                    </span>
                  </div>
                  {lastSaved && (
                    <span className="text-[9px] text-slate-600 animate-fade-in-up">
                      <Save className="w-3 h-3 inline mr-0.5" />
                      Sauvegarde {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-1">
                  {LM_STEP_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => i <= step && setStep(i)}
                      disabled={i > step}
                      className={`flex items-center gap-1.5 transition-opacity shrink-0 ${
                        i <= step ? "cursor-pointer opacity-100" : "cursor-default opacity-40"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          i < step
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-90"
                            : i === step
                            ? "bg-blue-500 text-white ring-4 ring-blue-500/20 shadow-xl shadow-blue-500/30 scale-110"
                            : "bg-white/[0.06] text-slate-500"
                        }`}
                      >
                        {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span
                        className={`text-[10px] font-medium hidden lg:inline transition-colors ${
                          i < step ? "text-emerald-400" : i === step ? "text-slate-200" : "text-slate-600"
                        }`}
                      >
                        {label}
                      </span>
                      {i < LM_STEP_LABELS.length - 1 && (
                        <div className={`w-4 lg:w-8 h-0.5 mx-1 rounded-full transition-colors duration-300 ${i < step ? "bg-emerald-500" : "bg-white/[0.06]"}`} />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Mobile: last saved indicator */}
          {isMobile && lastSaved && (
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
              <Save className="w-3 h-3" />
              Sauvegarde {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          {/* Step content with animation + swipe */}
          <div
            className={`glass-card p-4 sm:p-6 transition-all duration-300 ${isMobile ? "pb-28" : ""} ${
              fieldsVisible
                ? "opacity-100 translate-y-0"
                : stepDirection === "right"
                ? "opacity-0 translate-x-4"
                : "opacity-0 -translate-x-4"
            }`}
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {renderStep()}
          </div>

          {/* Navigation — sticky on mobile, inline on desktop */}
          {isMobile ? (
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-white/[0.06] p-3 pb-safe flex items-center justify-between z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={step === 0}
                className="gap-1 border-white/[0.06] hover:bg-white/[0.04]"
              >
                <ChevronLeft className="w-4 h-4" />
                {step === 0 ? "Retour" : "Prec."}
              </Button>
              <span className="text-xs text-slate-500 tabular-nums">{step + 1}/10</span>
              {step < LM_STEP_LABELS.length - 1 ? (
                <Button size="sm" onClick={handleNext} className="gap-1 bg-blue-600 hover:bg-blue-700">
                  Suivant <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="w-20" />
              )}
            </div>
          ) : (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="gap-1.5 border-white/[0.06] hover:bg-white/[0.04] transition-all duration-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {step === 0 ? "Retour" : "Precedent"}
                </Button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 tabular-nums">Etape {step + 1} / {LM_STEP_LABELS.length}</span>
                  <span className="text-[9px] text-slate-600">
                    <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">Esc</kbd> precedent
                  </span>
                </div>
                {step < LM_STEP_LABELS.length - 1 ? (
                  <Button onClick={handleNext} className="gap-1.5 bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/10">
                    Suivant <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-3 sm:mt-4">
          <div className="glass-card p-4 sm:p-6">
            <LetterHistory letters={savedLetters} loading={historyLoading} onEdit={handleEditLetter} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
