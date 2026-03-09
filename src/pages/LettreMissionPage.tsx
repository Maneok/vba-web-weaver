import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { toast } from "sonner";
import {
  LM_STEP_TITLES,
  LM_TOTAL_STEPS,
  INITIAL_LM_WIZARD_DATA,
  type LMWizardData,
  type SavedLetter,
} from "@/lib/lmWizardTypes";
import { VALIDATORS, sanitizeWizardData } from "@/lib/lmValidation";

import LMStep1Client from "@/components/lettre-mission/LMStep1Client";
import LMStep2Missions from "@/components/lettre-mission/LMStep2Missions";
import LMStep3Details from "@/components/lettre-mission/LMStep3Details";
import LMStep4Honoraires from "@/components/lettre-mission/LMStep4Honoraires";
import LMStep5Preview from "@/components/lettre-mission/LMStep5Preview";
import LMStep6Export from "@/components/lettre-mission/LMStep6Export";
import LMProgressBar from "@/components/lettre-mission/LMProgressBar";
import LMSummaryPanel from "@/components/lettre-mission/LMSummaryPanel";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, FileText, History, Plus,
  Loader2, ShieldAlert, Edit3, Save, Zap,
} from "lucide-react";

// ─────────────────────────────────────────
// Historique inline
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
  const statusColor = (s: string) => {
    if (s === "signee") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "envoyee") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-slate-500/10 text-slate-400 border-slate-500/20";
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
        <p className="text-slate-400 text-sm">Aucune lettre de mission</p>
        <p className="text-slate-500 text-xs mt-1">Creez votre premiere lettre</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {letters.map((letter) => (
        <button
          key={letter.id}
          onClick={() => onEdit(letter)}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{letter.raison_sociale}</p>
            <p className="text-xs text-slate-500 truncate">
              {letter.numero} · {letter.type_mission} · {new Date(letter.updated_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor(letter.statut)}`}>
            {letter.statut}
          </Badge>
          <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </button>
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
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("wizard");

  // ── Permission check ──
  if (!hasPermission("write_clients")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in-up">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-white font-medium">Acces refuse</p>
        <p className="text-slate-400 text-sm text-center px-4">Vous n'avez pas les permissions pour creer une lettre de mission.</p>
        <Button variant="outline" onClick={() => navigate("/bdd")} className="border-white/[0.06]">Retour</Button>
      </div>
    );
  }

  // ── Wizard state ──
  const [step, setStep] = useState(0);
  const [data, setData] = useState<LMWizardData>({ ...INITIAL_LM_WIZARD_DATA });
  const [stepDirection, setStepDirection] = useState<"left" | "right">("right");
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const prevStepRef = useRef(0);
  const [lmId, setLmId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expressMode, setExpressMode] = useState(false);

  // Draft
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ id: string; wizard_data: any; wizard_step: number } | null>(null);

  // History
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Swipe
  const touchStartX = useRef(0);

  // ── Step animation + scroll ──
  useEffect(() => {
    setStepDirection(step > prevStepRef.current ? "right" : "left");
    prevStepRef.current = step;
    setFieldsVisible(false);
    const t = setTimeout(() => setFieldsVisible(true), 50);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => clearTimeout(t);
  }, [step]);

  // ── sessionStorage draft ──
  useEffect(() => {
    sessionStorage.setItem("lm_wizard_draft", JSON.stringify({ ...data, wizard_step: step }));
  }, [data, step]);

  // ── Init: restore draft + load Supabase ──
  useEffect(() => {
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
    loadSupabaseDraft();
    loadSavedLetters();
  }, []);

  const loadSupabaseDraft = async () => {
    try {
      const { data: drafts } = await supabase
        .from("lettres_mission")
        .select("id, wizard_data, wizard_step, created_at")
        .eq("statut", "brouillon")
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

  // ── TVA auto (associations) ──
  useEffect(() => {
    if (data.forme_juridique === "ASSOCIATION" || data.forme_juridique === "ASSO") {
      setData((prev) => ({ ...prev, taux_tva: 0 }));
    }
  }, [data.forme_juridique]);

  // ── Existing LM warning ──
  const warningShown = useRef(false);
  useEffect(() => {
    if (data.client_id && !warningShown.current) {
      warningShown.current = true;
      supabase
        .from("lettres_mission")
        .select("id")
        .eq("client_ref", data.client_id)
        .neq("statut", "archivee")
        .then(({ data: existing }) => {
          if (existing && existing.length > 0) {
            toast.warning("Ce client a deja une lettre de mission active");
          }
        })
        .catch(() => {});
    }
  }, [data.client_id]);

  // ── Auto-save debounce 2s ──
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveToSupabase = useCallback(async () => {
    if (!data.client_id) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const payload = { wizard_data: data, wizard_step: step, updated_at: new Date().toISOString() };
      if (lmId) {
        await supabase.from("lettres_mission").update(payload).eq("id", lmId);
      } else {
        const { data: ins } = await supabase
          .from("lettres_mission")
          .insert({
            user_id: authData.user.id,
            cabinet_id: profile?.cabinet_id,
            client_ref: data.client_ref,
            raison_sociale: data.raison_sociale,
            type_mission: data.type_mission,
            statut: "brouillon",
            wizard_data: data,
            wizard_step: step,
            numero: `LM-${new Date().getFullYear()}-${String(savedLetters.length + 1).padStart(3, "0")}`,
          })
          .select("id")
          .maybeSingle();
        if (ins) setLmId(ins.id);
      }
      setLastSaved(new Date());
      toast.success("Sauvegarde", { duration: 1500 });
    } catch {}
  }, [data, step, lmId, profile?.cabinet_id, savedLetters.length]);

  // Trigger auto-save on data change (debounced 2s)
  useEffect(() => {
    if (!data.client_id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveToSupabase, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [data, step]);

  const loadSavedLetters = async () => {
    setHistoryLoading(true);
    try {
      const { data: rows } = await supabase
        .from("lettres_mission")
        .select("*")
        .order("updated_at", { ascending: false });
      if (rows) {
        setSavedLetters(
          rows.map((r: any, i: number) => ({
            id: r.id,
            numero: r.numero || `LM-${new Date(r.created_at).getFullYear()}-${String(i + 1).padStart(3, "0")}`,
            client_ref: r.client_ref || "",
            raison_sociale: r.raison_sociale || r.wizard_data?.raison_sociale || "—",
            type_mission: r.type_mission || r.wizard_data?.type_mission || "—",
            statut: r.statut || "brouillon",
            created_at: r.created_at,
            updated_at: r.updated_at,
            wizard_data: r.wizard_data || {},
          }))
        );
      }
    } catch {}
    setHistoryLoading(false);
  };

  // ── Handlers ──
  const handleChange = useCallback((updates: Partial<LMWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((s: number) => {
    if (s >= 0 && s < LM_TOTAL_STEPS) setStep(s);
  }, []);

  const isStepValid = useCallback((stepIdx: number): boolean => {
    const validator = VALIDATORS[stepIdx];
    if (!validator) return true;
    return validator(data).length === 0;
  }, [data]);

  const handleNext = useCallback(() => {
    const validator = VALIDATORS[step];
    if (validator) {
      const errors = validator(data);
      if (errors.length > 0) {
        errors.forEach((e) => toast.error(e.message));
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, LM_TOTAL_STEPS - 1));
  }, [step, data]);

  const handlePrevious = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  // Swipe
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 75) { diff > 0 ? handleNext() : handlePrevious(); }
  };

  // ── Final save ──
  const handleSave = async () => {
    const sanitized = sanitizeWizardData(data);
    const payload = {
      client_ref: sanitized.client_ref,
      raison_sociale: sanitized.raison_sociale,
      type_mission: sanitized.type_mission,
      statut: sanitized.statut,
      wizard_data: sanitized,
      numero: sanitized.numero_lettre || `LM-${new Date().getFullYear()}-${String(savedLetters.length + 1).padStart(3, "0")}`,
    };
    if (lmId) {
      const { error } = await supabase.from("lettres_mission").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", lmId);
      if (error) throw error;
    } else {
      const { data: ins, error } = await supabase.from("lettres_mission").insert(payload).select("id").maybeSingle();
      if (error) throw error;
      if (ins) setLmId(ins.id);
    }
    logAudit({
      action: "LETTRE_MISSION_SAVE",
      table_name: "lettres_mission",
      record_id: lmId || undefined,
      new_data: { client_ref: sanitized.client_ref, type: sanitized.type_mission, statut: sanitized.statut },
    }).catch(() => {});
    sessionStorage.removeItem("lm_wizard_draft");
    setLastSaved(new Date());
    await loadSavedLetters();
  };

  const handleReset = () => {
    setData({ ...INITIAL_LM_WIZARD_DATA });
    setLmId(null);
    setStep(0);
    warningShown.current = false;
    setExpressMode(false);
    sessionStorage.removeItem("lm_wizard_draft");
  };

  const handleEditLetter = (letter: SavedLetter) => {
    if (letter.wizard_data) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data });
      setLmId(letter.id);
      setStep(0);
      setActiveTab("wizard");
    }
  };

  // ── Express mode ──
  const handleExpress = () => {
    setExpressMode(!expressMode);
    if (!expressMode && data.client_id) {
      // Jump to step 3 (honoraires)
      setStep(3);
    }
  };

  // Keyboard: Escape → prev
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (activeTab !== "wizard") return;
      if (e.key === "Escape" && step > 0) { e.preventDefault(); setStep(step - 1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [step, activeTab]);

  // Step render
  const renderStep = () => {
    switch (step) {
      case 0: return <LMStep1Client data={data} onChange={handleChange} />;
      case 1: return <LMStep2Missions data={data} onChange={handleChange} />;
      case 2: return <LMStep3Details data={data} onChange={handleChange} />;
      case 3: return <LMStep4Honoraires data={data} onChange={handleChange} />;
      case 4: return <LMStep5Preview data={data} onChange={handleChange} onGoToStep={goToStep} isMobile={isMobile} />;
      case 5: return <LMStep6Export data={data} onChange={handleChange} onSave={handleSave} onReset={handleReset} />;
      default: return null;
    }
  };

  const nextDisabled = !isStepValid(step);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Lettres de mission</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Creez et gerez vos lettres de mission</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpress}
            className={`gap-1.5 border-white/[0.06] text-xs ${expressMode ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "text-slate-400"}`}
          >
            <Zap className="w-3.5 h-3.5" /> Express
          </Button>
          <Button onClick={handleReset} className="gap-1.5 bg-blue-600 hover:bg-blue-700" size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4" /> {!isMobile && "Nouvelle"}
          </Button>
        </div>
      </div>

      {/* Draft resume banner */}
      {showDraftBanner && draftInfo && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-fade-in-up">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-300">Reprendre le brouillon</p>
            <p className="text-xs text-slate-400 truncate">
              {draftInfo.wizard_data?.raison_sociale || "Sans nom"} — Etape {(draftInfo.wizard_step || 0) + 1}/{LM_TOTAL_STEPS}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={resumeDraft} className="bg-blue-600 hover:bg-blue-700">Reprendre</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDraftBanner(false)} className="text-slate-400">Nouveau</Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/[0.04] border border-white/[0.06] w-full sm:w-auto">
          <TabsTrigger value="wizard" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FileText className="w-3.5 h-3.5" /> {isMobile ? "Nouvelle" : "Nouvelle lettre"}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <History className="w-3.5 h-3.5" /> Historique
            {savedLetters.length > 0 && (
              <Badge className="ml-1 bg-white/[0.06] text-slate-400 text-[10px] px-1.5">{savedLetters.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── WIZARD TAB ─── */}
        <TabsContent value="wizard" className="mt-4 space-y-4">
          {/* Progress bar */}
          <LMProgressBar currentStep={step} />

          {/* Step title */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white">{LM_STEP_TITLES[step]}</h2>
            {lastSaved && (
              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                <Save className="w-3 h-3" />
                {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* ── 2-column layout ── */}
          <div className={`${!isMobile ? "flex gap-6" : ""}`}>
            {/* Left: form */}
            <div className={`${!isMobile ? "flex-[3] min-w-0" : "w-full"}`}>
              <div
                className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 transition-all duration-200 ${
                  isMobile ? "pb-32" : ""
                } ${
                  fieldsVisible
                    ? "opacity-100 translate-y-0"
                    : stepDirection === "right"
                    ? "opacity-0 translate-x-6"
                    : "opacity-0 -translate-x-6"
                }`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {renderStep()}
              </div>
            </div>

            {/* Right: summary panel (desktop only) */}
            {!isMobile && (
              <div className="flex-[2] min-w-[260px] max-w-[360px]">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <LMSummaryPanel data={data} />
                </div>
              </div>
            )}
          </div>

          {/* ── Navigation ── */}
          {isMobile ? (
            <>
              {/* Mobile: compact summary band */}
              <div className="fixed bottom-[52px] left-0 right-0 z-40">
                <LMSummaryPanel data={data} compact />
              </div>
              {/* Mobile: sticky bottom nav */}
              <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-white/[0.06] p-3 pb-safe flex items-center justify-between z-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={step === 0}
                  className="gap-1 border-white/[0.06]"
                >
                  <ChevronLeft className="w-4 h-4" /> Prec.
                </Button>
                <span className="text-xs text-slate-500 tabular-nums">{step + 1}/{LM_TOTAL_STEPS}</span>
                {step < LM_TOTAL_STEPS - 1 ? (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={nextDisabled}
                    className="gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                  >
                    Suivant <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="w-20" />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={step === 0}
                className="gap-1.5 border-white/[0.06] hover:bg-white/[0.04]"
              >
                <ChevronLeft className="w-4 h-4" /> Precedent
              </Button>
              <span className="text-xs text-slate-500 tabular-nums">
                Etape {step + 1} / {LM_TOTAL_STEPS}
                <span className="ml-2 text-[9px] text-slate-600">
                  <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">Esc</kbd> prec.
                </span>
              </span>
              {step < LM_TOTAL_STEPS - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={nextDisabled}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10 disabled:opacity-40"
                >
                  Suivant <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div />
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6">
            <LetterHistory letters={savedLetters} loading={historyLoading} onEdit={handleEditLetter} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
