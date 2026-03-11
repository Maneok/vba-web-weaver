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
import {
  LM_STEP_TITLES,
  LM_TOTAL_STEPS,
  INITIAL_LM_WIZARD_DATA,
  LM_STATUTS,
  formatDuration,
  type LMWizardData,
  type SavedLetter,
} from "@/lib/lmWizardTypes";
import { VALIDATORS, sanitizeWizardData } from "@/lib/lmValidation";
import { incrementCounter } from "@/lib/lettreMissionEngine";
import type { Client } from "@/lib/types";

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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, FileText, History, Plus,
  Loader2, ShieldAlert, Edit3, Save, Zap, Copy, Archive,
  FileDown, Search, Clock, AlertTriangle, Filter,
} from "lucide-react";

// ─────────────────────────────────────────
// G) Advanced history with filters, duplicate, archive
// ─────────────────────────────────────────
function LetterHistory({
  letters,
  loading,
  onEdit,
  onDuplicate,
  onArchive,
  onDownloadPdf,
}: {
  letters: SavedLetter[];
  loading: boolean;
  onEdit: (letter: SavedLetter) => void;
  onDuplicate: (letter: SavedLetter) => void;
  onArchive: (letter: SavedLetter) => void;
  onDownloadPdf: (letter: SavedLetter) => void;
}) {
  const [searchQ, setSearchQ] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterPeriode, setFilterPeriode] = useState("all");

  const filtered = useMemo(() => {
    let result = [...letters];

    // Filter by statut
    if (filterStatut !== "all") {
      result = result.filter((l) => l.statut === filterStatut);
    }

    // Filter by periode
    if (filterPeriode !== "all") {
      const now = new Date();
      const safeDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
      if (filterPeriode === "7j") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        result = result.filter((l) => { const dt = safeDate(l.updated_at); return dt ? dt >= d : false; });
      } else if (filterPeriode === "30j") {
        const d = new Date(); d.setDate(d.getDate() - 30);
        result = result.filter((l) => { const dt = safeDate(l.updated_at); return dt ? dt >= d : false; });
      } else if (filterPeriode === "annee") {
        result = result.filter((l) => { const dt = safeDate(l.updated_at); return dt ? dt.getFullYear() === now.getFullYear() : false; });
      }
    }

    // Search
    if (searchQ.length >= 2) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        (l) =>
          l.raison_sociale.toLowerCase().includes(q) ||
          l.numero.toLowerCase().includes(q) ||
          l.client_ref.toLowerCase().includes(q)
      );
    }

    return result;
  }, [letters, filterStatut, filterPeriode, searchQ]);

  const statusColor = (s: string) => {
    const found = LM_STATUTS.find((st) => st.value === s);
    return found?.color || "bg-slate-500/10 text-slate-400 border-slate-500/20";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 p-6 lg:p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-400 text-sm">Chargement...</span>
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="text-center py-20 p-6 lg:p-8">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Aucune lettre de mission</p>
        <p className="text-slate-500 text-xs mt-1">Creez votre premiere lettre</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input
            placeholder="Rechercher par nom, numero..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="pl-9 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-full sm:w-[150px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
            <Filter className="w-3 h-3 mr-1.5 text-slate-500" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {LM_STATUTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPeriode} onValueChange={setFilterPeriode}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
            <Clock className="w-3 h-3 mr-1.5 text-slate-500" />
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes periodes</SelectItem>
            <SelectItem value="7j">7 derniers jours</SelectItem>
            <SelectItem value="30j">30 derniers jours</SelectItem>
            <SelectItem value="annee">Cette annee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-[10px] text-slate-600">{filtered.length} lettre{filtered.length > 1 ? "s" : ""}</p>

      {/* Table header (desktop) */}
      <div className="hidden sm:grid grid-cols-[1fr_120px_100px_100px_80px_120px] gap-2 px-4 text-[10px] text-slate-600 uppercase tracking-wider">
        <span>Client</span>
        <span>Numero</span>
        <span>Type</span>
        <span>Statut</span>
        <span>Duree</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {filtered.map((letter) => (
          <div
            key={letter.id}
            className="group sm:grid sm:grid-cols-[1fr_120px_100px_100px_80px_120px] sm:items-center gap-2 p-3 sm:px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          >
            {/* Client */}
            <button onClick={() => onEdit(letter)} className="flex items-center gap-2 text-left min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{letter.raison_sociale}</p>
                <p className="text-[10px] text-slate-500 sm:hidden">
                  {letter.numero} · {new Date(letter.updated_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </button>

            {/* Numero */}
            <span className="hidden sm:block text-xs text-slate-400 font-mono truncate">{letter.numero}</span>

            {/* Type */}
            <span className="hidden sm:block text-xs text-slate-500">{letter.type_mission}</span>

            {/* Statut */}
            <div className="hidden sm:block">
              <Badge variant="outline" className={`text-[9px] ${statusColor(letter.statut)}`}>
                {letter.statut}
              </Badge>
            </div>

            {/* H) Duration */}
            <span className="hidden sm:block text-[10px] text-slate-600">
              {letter.duration_seconds ? formatDuration(letter.duration_seconds) : "—"}
            </span>

            {/* Actions */}
            <div className="hidden sm:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(letter)}
                className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-blue-400 transition-colors"
                title="Modifier"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDuplicate(letter)}
                className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-emerald-400 transition-colors"
                title="Dupliquer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDownloadPdf(letter)}
                className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-purple-400 transition-colors"
                title="PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onArchive(letter)}
                className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-amber-400 transition-colors"
                title="Archiver"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile actions */}
            <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
              <Badge variant="outline" className={`text-[9px] ${statusColor(letter.statut)}`}>{letter.statut}</Badge>
              <div className="flex-1" />
              <button onClick={() => onDuplicate(letter)} className="p-1.5 text-slate-500"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDownloadPdf(letter)} className="p-1.5 text-slate-500"><FileDown className="w-3.5 h-3.5" /></button>
              <button onClick={() => onArchive(letter)} className="p-1.5 text-slate-500"><Archive className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && letters.length > 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">Aucun resultat pour ces filtres</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// F) Renewal alerts
// ─────────────────────────────────────────
function RenewalAlerts({ letters }: { letters: SavedLetter[] }) {
  const expiringSoon = useMemo(() => {
    const now = new Date();
    const in60Days = new Date(); in60Days.setDate(in60Days.getDate() + 60);
    return letters.filter((l) => {
      if (l.statut !== "signee") return false;
      const wd = l.wizard_data;
      if (!wd?.date_debut || !wd?.duree) return false;
      const start = new Date(wd.date_debut);
      const years = parseInt(wd.duree, 10) || 1;
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + years);
      return end >= now && end <= in60Days;
    });
  }, [letters]);

  if (expiringSoon.length === 0) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in-up">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-300">
          {expiringSoon.length} lettre{expiringSoon.length > 1 ? "s" : ""} expire{expiringSoon.length > 1 ? "nt" : ""} dans 60 jours
        </p>
        <div className="mt-1.5 space-y-1">
          {expiringSoon.slice(0, 3).map((l) => (
            <p key={l.id} className="text-xs text-amber-400/70">{l.raison_sociale} — {l.numero}</p>
          ))}
          {expiringSoon.length > 3 && (
            <p className="text-[10px] text-amber-400/50">+{expiringSoon.length - 3} autres</p>
          )}
        </div>
      </div>
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

  useDocumentTitle("Lettre de Mission");

  // ── Wizard state (all hooks must be declared before any early return) ──
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
  const [draftInfo, setDraftInfo] = useState<{ id: string; wizard_data: Record<string, unknown>; wizard_step: number } | null>(null);

  // History
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Swipe
  const touchStartX = useRef<number | null>(null);

  // ── Permission check (after all hooks) ──
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

  // ── H) Time tracking ──
  useEffect(() => {
    if (!data.started_at) {
      setData((prev) => ({ ...prev, started_at: new Date().toISOString() }));
    }
  }, []);

  // ── Warn on unsaved changes (beforeunload) ──
  useEffect(() => {
    if (!data.client_id) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [data.client_id]);

  // ── Clean up auto-save timer on unmount ──
  useEffect(() => {
    return () => { clearTimeout(saveTimer.current); };
  }, []);

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
    try { sessionStorage.setItem("lm_wizard_draft", JSON.stringify({ ...data, wizard_step: step })); } catch { /* storage full */ }
  }, [data, step]);

  // ── Init: restore draft + load Supabase ──
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem("lm_wizard_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.client_id) {
          setData(parsed);
          if (parsed.wizard_step > 0) setStep(parsed.wizard_step);
        }
      }
    } catch (e) {
      logger.warn("LM", "Failed to restore session draft:", e);
    }
    loadSupabaseDraft(cancelled);
    loadSavedLetters();
    return () => { cancelled = true; };
  }, []);

  const loadSupabaseDraft = async (cancelled: boolean) => {
    try {
      const { data: drafts } = await supabase
        .from("lettres_mission")
        .select("id, wizard_data, wizard_step, created_at")
        .eq("statut", "brouillon")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (drafts && drafts.length > 0 && drafts[0].wizard_data?.client_id) {
        setDraftInfo(drafts[0] as { id: string; wizard_data: Record<string, unknown>; wizard_step: number });
        setShowDraftBanner(true);
      }
    } catch (e) {
      logger.warn("LM", "Failed to load Supabase draft:", e);
    }
  };

  const resumeDraft = () => {
    if (draftInfo) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...draftInfo.wizard_data });
      setLmId(draftInfo.id);
      setStep(draftInfo.wizard_step || 0);
      setShowDraftBanner(false);
      setActiveTab("wizard");
      warningShown.current = false;
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
        .catch((e) => logger.warn("LM", "Existing LM check failed:", e));
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
        const { error: updErr } = await supabase.from("lettres_mission").update(payload).eq("id", lmId);
        if (updErr) throw updErr;
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
            numero: incrementCounter(),
          })
          .select("id")
          .maybeSingle();
        if (ins) setLmId(ins.id);
      }
      setLastSaved(new Date());
      toast.success("Sauvegarde", { duration: 1500 });
    } catch (e) {
      logger.warn("LM", "Auto-save failed:", e);
    }
  }, [data, step, lmId, profile?.cabinet_id]);

  // Trigger auto-save on data change (debounced 2s)
  useEffect(() => {
    if (!data.client_id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveToSupabase, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [data, step, saveToSupabase]);

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
            duration_seconds: r.wizard_data?.duration_seconds || 0,
            honoraires_ht: r.wizard_data?.honoraires_ht || 0,
            missions_count: r.wizard_data?.missions_selected?.filter((m: any) => m.selected)?.length || 0,
          }))
        );
      }
    } catch (e) {
      logger.warn("LM", "Failed to load letters:", e);
    }
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
  const handleTouchStart = (e: React.TouchEvent) => { if (e.targetTouches.length > 0) touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 0) return;
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 75) { diff > 0 ? handleNext() : handlePrevious(); }
  };

  // ── H) Compute duration on final save ──
  const handleSave = async () => {
   try {
    // Compute duration
    let duration = 0;
    if (data.started_at) {
      duration = Math.round((Date.now() - new Date(data.started_at).getTime()) / 1000);
    }
    const finalData = { ...data, duration_seconds: duration };

    const sanitized = sanitizeWizardData(finalData);
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      client_ref: sanitized.client_ref,
      raison_sociale: sanitized.raison_sociale,
      type_mission: sanitized.type_mission,
      statut: sanitized.statut,
      wizard_data: sanitized,
      numero: sanitized.numero_lettre || incrementCounter(),
    };
    if (lmId) {
      const { error } = await supabase.from("lettres_mission").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", lmId);
      if (error) throw error;
    } else {
      if (!profile?.cabinet_id) {
        toast.error("Impossible de sauvegarder : profil non initialise. Reconnectez-vous.");
        return;
      }
      const { data: ins, error } = await supabase.from("lettres_mission").insert({ ...payload, user_id: authData?.user?.id, cabinet_id: profile.cabinet_id }).select("id").maybeSingle();
      if (error) throw error;
      if (ins) setLmId(ins.id);
    }
    setData(finalData);
    logAudit({
      action: "LETTRE_MISSION_SAVE",
      table_name: "lettres_mission",
      record_id: lmId || undefined,
      new_data: { client_ref: sanitized.client_ref, type: sanitized.type_mission, statut: sanitized.statut, duration_seconds: duration },
    }).catch((e) => logger.warn("LM", "Audit log failed:", e));
    sessionStorage.removeItem("lm_wizard_draft");
    setLastSaved(new Date());
    await loadSavedLetters();
   } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
    toast.error(msg);
   }
  };

  const handleReset = () => {
    setData({ ...INITIAL_LM_WIZARD_DATA, started_at: new Date().toISOString() });
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

  // G) Duplicate
  const handleDuplicate = async (letter: SavedLetter) => {
    if (!letter.wizard_data) return;
    const newData = {
      ...INITIAL_LM_WIZARD_DATA,
      ...letter.wizard_data,
      statut: "brouillon",
      numero_lettre: "",
      signature_expert: "",
      signature_client: "",
      date_signature: "",
      started_at: new Date().toISOString(),
      duration_seconds: 0,
    };
    setData(newData);
    setLmId(null);
    setStep(0);
    setActiveTab("wizard");
    toast.success("Lettre dupliquee — modifiez et sauvegardez");
  };

  // G) Archive
  const handleArchive = async (letter: SavedLetter) => {
    try {
      const { error } = await supabase.from("lettres_mission").update({ statut: "archivee", updated_at: new Date().toISOString() }).eq("id", letter.id);
      if (error) throw error;
      toast.success("Lettre archivee");
      await loadSavedLetters();
    } catch {
      toast.error("Erreur lors de l'archivage");
    }
  };

  // G) Download PDF from history
  const handleDownloadPdf = async (letter: SavedLetter) => {
    if (!letter.wizard_data) return;
    try {
      const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
      const wd = letter.wizard_data;
      const client = {
        ref: wd.client_ref, raisonSociale: wd.raison_sociale, forme: wd.forme_juridique,
        siren: wd.siren, dirigeant: wd.dirigeant, adresse: wd.adresse, cp: wd.cp, ville: wd.ville,
        capital: Number(wd.capital) || 0, ape: wd.ape, mail: wd.email, tel: wd.telephone,
        iban: wd.iban, bic: wd.bic, etat: "EN_COURS", comptable: "", mission: wd.type_mission,
        domaine: "", effectif: "", dateCreation: "", dateReprise: "",
        honoraires: wd.honoraires_ht, reprise: 0, juridique: 0, frequence: wd.frequence_facturation,
        associe: wd.associe_signataire, superviseur: wd.chef_mission,
        ppe: "NON", paysRisque: "NON", atypique: "NON", distanciel: "NON", cash: "NON", pression: "NON",
        scoreActivite: 0, scorePays: 0, scoreMission: 0, scoreMaturite: 0, scoreStructure: 0,
        malus: 0, scoreGlobal: 0, nivVigilance: "STANDARD",
        dateCreationLigne: "", dateDerniereRevue: "", dateButoir: "",
        etatPilotage: "A JOUR", dateExpCni: "", statut: "ACTIF", be: "",
      };
      await renderLettreMissionPdf({
        numero: letter.numero, date: new Date().toLocaleDateString("fr-FR"),
        client: client as Client,
        cabinet: { nom: "Cabinet Expertise Comptable", adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "" },
        options: {
          genre: "M" as const,
          missionSociale: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "social" && m.selected),
          missionJuridique: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "juridique" && m.selected),
          missionControleFiscal: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "fiscal" && m.selected),
          regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
          tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
          periodicite: wd.frequence_facturation,
        },
      });
      toast.success("PDF genere");
    } catch (e: any) {
      toast.error(e?.message || "Erreur PDF");
    }
  };

  // ── Express mode ──
  const handleExpress = () => {
    setExpressMode(!expressMode);
    if (!expressMode && data.client_id) {
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

  // H) Elapsed time display
  const elapsed = data.started_at
    ? Math.round((Date.now() - new Date(data.started_at).getTime()) / 1000)
    : 0;

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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-fade-in-up">
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

      {/* F) Renewal alerts */}
      <RenewalAlerts letters={savedLetters} />

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

          {/* Step title + H) elapsed time */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white">{LM_STEP_TITLES[step]}</h2>
            <div className="flex items-center gap-3">
              {elapsed > 0 && (
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDuration(elapsed)}
                </span>
              )}
              {lastSaved && (
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
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
            <LetterHistory
              letters={savedLetters}
              loading={historyLoading}
              onEdit={handleEditLetter}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDownloadPdf={handleDownloadPdf}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
