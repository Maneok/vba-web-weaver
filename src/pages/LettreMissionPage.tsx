import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft, ChevronRight, Check, FileText, History, Plus, Loader2,
  Clock, Edit3, ShieldAlert,
} from "lucide-react";

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
          className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{letter.raison_sociale}</p>
            <p className="text-xs text-slate-500">{letter.numero} — {letter.type_mission} — {new Date(letter.updated_at).toLocaleDateString("fr-FR")}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusBadge(letter.statut)}`}>
            {letter.statut}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-blue-400"
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
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("wizard");

  // ── Permission check ──
  if (!hasPermission("write_clients")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in-up">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-white font-medium">Acces refuse</p>
        <p className="text-slate-400 text-sm">Vous n'avez pas les permissions pour creer une lettre de mission.</p>
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

  // History state
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Progress
  const progress = ((step + 1) / LM_STEP_LABELS.length) * 100;

  // ── Step change animation ──
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

  // ── Restore draft on mount ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lm_wizard_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        setData(parsed);
        if (parsed.wizard_step > 0) setStep(parsed.wizard_step);
      }
    } catch {}
  }, []);

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

  // ── Avertissement LM existante quand on sélectionne un client ──
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
        toast.warning(
          `Ce client a deja ${existing.length} lettre(s) de mission en cours`
        );
      }
    } catch {}
  };

  // ── Auto-save to Supabase every 30s + on step change ──
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
        await supabase
          .from("lettres_mission")
          .update(payload)
          .eq("id", lmId);
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
    } catch (e) {
      console.error("Auto-save error:", e);
    }
  }, [data, step, lmId, profile?.cabinet_id, savedLetters.length]);

  // Auto-save interval (30s)
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

  // Data updater
  const handleChange = useCallback((updates: Partial<LMWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Go to specific step
  const goToStep = useCallback((s: number) => {
    if (s >= 0 && s < LM_STEP_LABELS.length) setStep(s);
  }, []);

  // ── Validated next step ──
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
    // Save on step change
    saveToSupabase();
  }, [step, data, saveToSupabase]);

  // ── Final save with sanitize + audit ──
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
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
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

      // Audit trail
      logAudit({
        action: "LETTRE_MISSION",
        table_name: "lettres_mission",
        record_id: lmId || undefined,
        new_data: {
          client_ref: sanitized.client_ref,
          type: sanitized.type_mission,
          statut: sanitized.statut,
        },
      }).catch(() => {});

      sessionStorage.removeItem("lm_wizard_draft");
      await loadSavedLetters();
      setActiveTab("history");
    } catch (err) {
      console.error("Save error:", err);
      throw err;
    }
  };

  // Edit existing letter
  const handleEditLetter = (letter: SavedLetter) => {
    if (letter.wizard_data) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data });
      setLmId(letter.id);
      setStep(0);
      setActiveTab("wizard");
    }
  };

  // New letter
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

  // Render step content
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
      case 8: return <LMWizardStep9Preview data={data} onChange={handleChange} onGoToStep={goToStep} />;
      case 9: return <LMWizardStep10Export data={data} onChange={handleChange} onSave={handleSave} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lettres de mission</h1>
          <p className="text-sm text-slate-500 mt-1">Creez et gerez vos lettres de mission</p>
        </div>
        <Button
          onClick={handleNewLetter}
          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nouvelle lettre
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/[0.04] border border-white/[0.06]">
          <TabsTrigger value="wizard" className="gap-1.5 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FileText className="w-3.5 h-3.5" /> Nouvelle lettre
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <History className="w-3.5 h-3.5" /> Historique
            {savedLetters.length > 0 && (
              <Badge className="ml-1 bg-white/[0.06] text-slate-400 text-[10px] px-1.5">
                {savedLetters.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── WIZARD TAB ─── */}
        <TabsContent value="wizard" className="space-y-4 mt-4">
          {/* Progress bar */}
          <Progress value={progress} className="h-1" />

          {/* Stepper — responsive: Select on mobile, horizontal on desktop */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-end gap-1.5 mb-2">
              <Clock className="w-3 h-3 text-slate-600" />
              <span className="text-[9px] text-slate-600">
                Etape {step + 1} / {LM_STEP_LABELS.length} — {LM_STEP_DESCRIPTIONS[step]}
              </span>
            </div>

            {isMobile ? (
              /* ── Mobile: Select dropdown ── */
              <Select value={String(step)} onValueChange={(v) => goToStep(Number(v))}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LM_STEP_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i)} disabled={i > step}>
                      {i + 1}. {label} {i < step ? "✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              /* ── Desktop: Horizontal stepper ── */
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
                      <div
                        className={`w-4 lg:w-8 h-0.5 mx-1 rounded-full transition-colors duration-300 ${
                          i < step ? "bg-emerald-500" : "bg-white/[0.06]"
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step content with animation */}
          <div
            className={`glass-card p-6 transition-all duration-300 ${
              fieldsVisible
                ? "opacity-100 translate-y-0"
                : stepDirection === "right"
                ? "opacity-0 translate-x-4"
                : "opacity-0 -translate-x-4"
            }`}
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
          >
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => (step > 0 ? setStep(step - 1) : navigate("/bdd"))}
                className="gap-1.5 border-white/[0.06] hover:bg-white/[0.04] transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
                {step === 0 ? "Retour" : "Precedent"}
              </Button>

              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 tabular-nums">
                  Etape {step + 1} / {LM_STEP_LABELS.length}
                </span>
                {!isMobile && (
                  <span className="text-[9px] text-slate-600">
                    <kbd className="px-1 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono text-[8px]">
                      Esc
                    </kbd>{" "}
                    precedent
                  </span>
                )}
              </div>

              {step < LM_STEP_LABELS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/10"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div /> // Step 10 has its own save button
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-4">
          <div className="glass-card p-6">
            <LetterHistory
              letters={savedLetters}
              loading={historyLoading}
              onEdit={handleEditLetter}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
