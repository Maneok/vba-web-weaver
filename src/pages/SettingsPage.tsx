import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { toast } from "sonner";
import { Building2, Target, ShieldCheck, CreditCard, Save, Loader2, RotateCcw, Info, Check, Globe, Scale, HelpCircle, BookOpen, Users, Key, Plug, Settings2, MapPin, Palette, Hash, Building, Fingerprint, Award, Mail, Phone, User, Clock, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeFr } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";
import { recalculateAllCabinetScores, clearScoringCache } from "@/lib/riskEngine";

/** Retry dynamic import up to 2 times with a reload on final failure (handles stale deployments) */
function lazyRetry<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
): Promise<T> {
  return factory().catch(() =>
    new Promise<T>((resolve) => setTimeout(resolve, 500)).then(() =>
      factory().catch(() => {
        const key = "chunk-reload-" + window.location.pathname;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        }
        return factory();
      })
    )
  );
}

const SubscriptionSettings = lazy(() => lazyRetry(() => import("@/components/settings/SubscriptionSettings")));
const RefMissionsTab = lazy(() => lazyRetry(() => import("@/components/settings/RefMissionsTab")));
const RefPaysTab = lazy(() => lazyRetry(() => import("@/components/settings/RefPaysTab")));
const RefTypesJuridiquesTab = lazy(() => lazyRetry(() => import("@/components/settings/RefTypesJuridiquesTab")));
const RefActivitesTab = lazy(() => lazyRetry(() => import("@/components/settings/RefActivitesTab")));
const RefQuestionsTab = lazy(() => lazyRetry(() => import("@/components/settings/RefQuestionsTab")));

// Cabinet management sub-components
const CabinetsList = lazy(() => lazyRetry(() => import("@/components/cabinet/CabinetsList")));
const CollaborateursList = lazy(() => lazyRetry(() => import("@/components/cabinet/CollaborateursList")));
const RolesMatrix = lazy(() => lazyRetry(() => import("@/components/cabinet/RolesMatrix")));
const ReglagesPanel = lazy(() => lazyRetry(() => import("@/components/cabinet/ReglagesPanel")));
const ConnecteursPanel = lazy(() => lazyRetry(() => import("@/components/cabinet/ConnecteursPanel")));
const ApiKeysPanel = lazy(() => lazyRetry(() => import("@/components/cabinet/ApiKeysPanel")));

/* ---------- types ---------- */

type CabinetInfo = {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
  couleurPrimaire: string;
  couleurSecondaire: string;
  associe_principal: string;
  police: string;
  // Extended identity fields
  croec: string;
  assureur_nom: string;
  assureur_adresse: string;
  tva_intracommunautaire: string;
  site_web: string;
  logo: string; // base64 data URL
};

type ScoringConfig = {
  seuil_bas: number;
  seuil_haut: number;
  malus_cash: number;
  malus_pression: number;
  malus_distanciel: number;
  malus_ppe: number;
  malus_atypique: number;
  revue_standard_mois: number;
  revue_renforcee_mois: number;
  revue_simplifiee_mois: number;
};

type LcbftConfig = {
  referent_lcb: string;
  suppleant_lcb: string;
  date_derniere_formation: string;
  date_signature_manuel: string;
  version_manuel: string;
  pays_risque: string[];
  pays_greylist: string[];
};

/* ---------- defaults ---------- */

const DEFAULT_CABINET: CabinetInfo = {
  nom: "",
  adresse: "",
  cp: "",
  ville: "",
  siret: "",
  numeroOEC: "",
  email: "",
  telephone: "",
  couleurPrimaire: "#3b82f6",
  couleurSecondaire: "#8b5cf6",
  associe_principal: "",
  police: "Inter",
  croec: "",
  assureur_nom: "",
  assureur_adresse: "",
  tva_intracommunautaire: "",
  site_web: "",
  logo: "",
};

const DEFAULT_SCORING: ScoringConfig = {
  seuil_bas: 25,
  seuil_haut: 60,
  malus_cash: 40,
  malus_pression: 40,
  malus_distanciel: 30,
  malus_ppe: 20,
  malus_atypique: 15,
  revue_standard_mois: 24,
  revue_renforcee_mois: 12,
  revue_simplifiee_mois: 36,
};

const DEFAULT_LCBFT: LcbftConfig = {
  referent_lcb: "",
  suppleant_lcb: "",
  date_derniere_formation: "",
  date_signature_manuel: "",
  version_manuel: "",
  pays_risque: [],
  pays_greylist: [],
};

/* ---------- validation ---------- */

type ValidationErrors = Record<string, string>;

function validateEmail(email: string): boolean {
  if (!email) return true; // empty is ok (not required)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSiret(siret: string): boolean {
  if (!siret) return true;
  const digits = siret.replace(/\s/g, "");
  return /^\d{14}$/.test(digits);
}

function validateCabinet(c: CabinetInfo): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!c.nom.trim()) errors.nom = "Le nom du cabinet est requis";
  if (c.email && !validateEmail(c.email)) errors.email = "Format email invalide (ex: contact@cabinet.fr)";
  if (c.siret && !validateSiret(c.siret)) errors.siret = "Le SIRET doit contenir exactement 14 chiffres";
  return errors;
}

function validateScoring(s: ScoringConfig): ValidationErrors {
  const errors: ValidationErrors = {};
  if (s.seuil_bas >= s.seuil_haut) errors.seuil_bas = "Le seuil bas doit etre inferieur au seuil haut";
  if (s.seuil_bas < 0) errors.seuil_bas = "Le seuil bas doit etre positif";
  if (s.seuil_haut < 0) errors.seuil_haut = "Le seuil haut doit etre positif";
  return errors;
}

function validateLcbft(l: LcbftConfig): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!l.referent_lcb.trim()) errors.referent_lcb = "Le referent LCB-FT est requis";
  return errors;
}

function formatTimestamp(iso: string): string {
  return formatDateTimeFr(iso) || iso;
}

/* ---------- InfoTip ---------- */

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-help inline ml-1.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------- Cabinet tab helpers ---------- */

const CABINET_FIELDS: (keyof CabinetInfo)[] = ["nom", "adresse", "cp", "ville", "siret", "numeroOEC", "email", "telephone", "associe_principal", "couleurPrimaire", "couleurSecondaire", "police", "croec", "assureur_nom", "tva_intracommunautaire", "site_web"];

function computeCabinetCompletion(c: CabinetInfo): number {
  const filled = CABINET_FIELDS.filter((k) => {
    const v = c[k];
    return typeof v === "string" && v.trim().length > 0;
  }).length;
  return Math.round((filled / CABINET_FIELDS.length) * 100);
}

function formatSiretInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + " " + digits.slice(3);
  if (digits.length <= 9) return digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6);
  return digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6, 9) + " " + digits.slice(9);
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
  return parts.join(" ");
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "a l'instant";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins} minute${mins > 1 ? "s" : ""}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

const COLOR_PRESETS = [
  { label: "Bleu", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Emeraude", value: "#10b981" },
  { label: "Ambre", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Orange", value: "#f97316" },
  { label: "Ardoise", value: "#64748b" },
];

const FONT_OPTIONS = ["Inter", "Roboto", "Times New Roman", "Arial", "Open Sans"];

function getInitials(name: string): string {
  if (!name) return "CB";
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "CB";
}

/* ---------- Gestion Cabinet sub-tabs ---------- */

const CABINET_SUB_TABS = [
  { value: "cabinets", label: "Cabinets", icon: Building2 },
  { value: "collaborateurs", label: "Collaborateurs", icon: Users },
  { value: "roles", label: "Roles", icon: ShieldCheck },
  { value: "reglages", label: "Reglages", icon: Settings2 },
  { value: "connecteurs", label: "Connecteurs", icon: Plug },
  { value: "cles-api", label: "Cles API", icon: Key },
] as const;

function CabinetSubTabs() {
  const [subTab, setSubTab] = useState("cabinets");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Gestion du Cabinet
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">Cabinets, collaborateurs, roles, reglages, connecteurs et cles API.</p>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex-wrap h-auto gap-1">
          {CABINET_SUB_TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2">
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {CABINET_SUB_TABS.map(({ value }) => (
          <TabsContent key={value} value={value}>
            <Suspense
              fallback={
                <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-3">
                  <div className="h-5 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                  <div className="h-64 w-full bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                </div>
              }
            >
              {value === "cabinets" && <CabinetsList />}
              {value === "collaborateurs" && <CollaborateursList />}
              {value === "roles" && <RolesMatrix />}
              {value === "reglages" && <ReglagesPanel />}
              {value === "connecteurs" && <ConnecteursPanel />}
              {value === "cles-api" && <ApiKeysPanel />}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ---------- Referentiels sub-tabs ---------- */

const REF_SUB_TABS = [
  { value: "missions", label: "Missions", icon: Target },
  { value: "pays", label: "Pays", icon: Globe },
  { value: "types-juridiques", label: "Types Juridiques", icon: Scale },
  { value: "activites", label: "Activites", icon: Building2 },
  { value: "questions", label: "Questions", icon: HelpCircle },
] as const;

function RefSubTabs() {
  const [subTab, setSubTab] = useState("missions");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Referentiels
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">Tables de reference pour le calcul de risque et la conformite LCB-FT.</p>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          {REF_SUB_TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2">
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {REF_SUB_TABS.map(({ value }) => (
          <TabsContent key={value} value={value}>
            <Suspense
              fallback={
                <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-3">
                  <div className="h-5 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                  <div className="h-64 w-full bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                </div>
              }
            >
              {value === "missions" && <RefMissionsTab />}
              {value === "pays" && <RefPaysTab />}
              {value === "types-juridiques" && <RefTypesJuridiquesTab />}
              {value === "activites" && <RefActivitesTab />}
              {value === "questions" && <RefQuestionsTab />}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ---------- component ---------- */

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cabinetId, setCabinetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCabinet, setSavingCabinet] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);
  const [savingLcbft, setSavingLcbft] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [savedCabinet, setSavedCabinet] = useState(false);
  const [savedScoring, setSavedScoring] = useState(false);
  const [savedLcbft, setSavedLcbft] = useState(false);
  const savedTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = savedTimersRef.current;
    return () => { timers.forEach(clearTimeout); timers.length = 0; };
  }, []);

  const [cabinet, setCabinet] = useState<CabinetInfo>(DEFAULT_CABINET);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [lcbft, setLcbft] = useState<LcbftConfig>(DEFAULT_LCBFT);

  useDocumentTitle("Parametres");

  // Snapshot of last saved values for dirty tracking
  const [savedCabinetSnapshot, setSavedCabinetSnapshot] = useState<CabinetInfo>(DEFAULT_CABINET);
  const [savedScoringSnapshot, setSavedScoringSnapshot] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [savedLcbftSnapshot, setSavedLcbftSnapshot] = useState<LcbftConfig>(DEFAULT_LCBFT);

  // Validation errors
  const [cabinetErrors, setCabinetErrors] = useState<ValidationErrors>({});
  const [scoringErrors, setScoringErrors] = useState<ValidationErrors>({});
  const [lcbftErrors, setLcbftErrors] = useState<ValidationErrors>({});

  // Last saved timestamps
  const [lastSavedCabinet, setLastSavedCabinet] = useState<string | null>(null);
  const [lastSavedScoring, setLastSavedScoring] = useState<string | null>(null);
  const [lastSavedLcbft, setLastSavedLcbft] = useState<string | null>(null);

  // Active tab for keyboard shortcut + unsaved warning
  const [activeTab, setActiveTab] = useState("cabinet");
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Cabinet section collapse states
  const [identiteOpen, setIdentiteOpen] = useState(true);
  const [coordonneesOpen, setCoordonneesOpen] = useState(true);
  const [apparenceOpen, setApparenceOpen] = useState(true);
  // Cabinet sync state
  const [cabinetSynced, setCabinetSynced] = useState<boolean | null>(null); // null = unknown, true = synced, false = pending
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [wasAutoPopulated, setWasAutoPopulated] = useState(false);

  // Dirty state helpers
  const dirtyCabinet = useMemo(() => JSON.stringify(cabinet) !== JSON.stringify(savedCabinetSnapshot), [cabinet, savedCabinetSnapshot]);
  const dirtyScoring = useMemo(() => JSON.stringify(scoring) !== JSON.stringify(savedScoringSnapshot), [scoring, savedScoringSnapshot]);
  const dirtyLcbft = useMemo(() => JSON.stringify(lcbft) !== JSON.stringify(savedLcbftSnapshot), [lcbft, savedLcbftSnapshot]);

  /* --- load --- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) return;
        setUserId(user.id);

        // Fetch cabinet_id from profile for RLS compliance
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("cabinet_id")
          .eq("id", user.id)
          .maybeSingle();
        const userCabinetId = profileRow?.cabinet_id || null;
        if (!cancelled) setCabinetId(userCabinetId);

        const { data, error } = await supabase
          .from("parametres")
          .select("*")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          logger.error("Settings", "Error loading parametres:", error);
          toast.error("Erreur lors du chargement des parametres");
          return;
        }

        let hasCabinetInfo = false;

        if (data) {
          for (const row of data) {
            if (row.cle === "cabinet_info" && row.valeur) {
              hasCabinetInfo = true;
              const merged = { ...DEFAULT_CABINET, ...(row.valeur as Partial<CabinetInfo>) };
              setCabinet(merged);
              setSavedCabinetSnapshot(merged);
              if (row.updated_at) setLastSavedCabinet(row.updated_at);
            }
            if (row.cle === "scoring_config" && row.valeur) {
              const merged = { ...DEFAULT_SCORING, ...(row.valeur as Partial<ScoringConfig>) };
              setScoring(merged);
              setSavedScoringSnapshot(merged);
              if (row.updated_at) setLastSavedScoring(row.updated_at);
            }
            if (row.cle === "lcbft_config" && row.valeur) {
              const merged = { ...DEFAULT_LCBFT, ...(row.valeur as Partial<LcbftConfig>) };
              setLcbft(merged);
              setSavedLcbftSnapshot(merged);
              if (row.updated_at) setLastSavedLcbft(row.updated_at);
            }
          }
        }

        // Auto-populate cabinet info from profile + cabinets table if never saved
        if (!hasCabinetInfo) {
          const [profileRes, cabRes] = await Promise.all([
            supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
            supabase.from("cabinets").select("nom, ville, siret, numero_oec, email, telephone, couleur_primaire").eq("id", userCabinetId).maybeSingle(),
          ]);
          if (cancelled) return;

          const autoFilled: CabinetInfo = { ...DEFAULT_CABINET };
          if (profileRes.data) {
            autoFilled.associe_principal = profileRes.data.full_name || "";
            if (!autoFilled.email) autoFilled.email = profileRes.data.email || "";
          }
          if (cabRes.data) {
            autoFilled.nom = cabRes.data.nom || autoFilled.nom;
            autoFilled.ville = cabRes.data.ville || autoFilled.ville;
            autoFilled.siret = cabRes.data.siret || autoFilled.siret;
            autoFilled.numeroOEC = cabRes.data.numero_oec || autoFilled.numeroOEC;
            if (cabRes.data.email) autoFilled.email = cabRes.data.email;
            autoFilled.telephone = cabRes.data.telephone || autoFilled.telephone;
            if (cabRes.data.couleur_primaire) autoFilled.couleurPrimaire = cabRes.data.couleur_primaire;
          }

          setCabinet(autoFilled);
          setSavedCabinetSnapshot(autoFilled);
          setWasAutoPopulated(true);

          // Auto-save so it persists
          await supabase.from("parametres").upsert(
            { user_id: user.id, cabinet_id: userCabinetId, cle: "cabinet_info", valeur: autoFilled as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
            { onConflict: "user_id,cle" }
          );
        }
      } catch (err) {
        logger.error("Settings", "Error loading parametres:", err);
        toast.error("Erreur lors du chargement des parametres");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* --- save helpers --- */
  const saveCabinet = useCallback(async () => {
    if (!userId) return;
    const errors = validateCabinet(cabinet);
    setCabinetErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }
    setSavingCabinet(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("parametres").upsert(
        { user_id: userId, cabinet_id: cabinetId, cle: "cabinet_info", valeur: cabinet as unknown as Record<string, unknown>, updated_at: now },
        { onConflict: "user_id,cle" }
      );
      if (error) {
        toast.error(error.message || "Erreur lors de la sauvegarde");
        logger.error("Settings", "Erreur sauvegarde cabinet:", error);
      } else {
        setSavedCabinetSnapshot({ ...cabinet });
        setLastSavedCabinet(now);
        setSavedCabinet(true);
        const t = setTimeout(() => { setSavedCabinet(false); savedTimersRef.current = savedTimersRef.current.filter(x => x !== t); }, 1500);
        savedTimersRef.current.push(t);
        toast.success("Informations cabinet enregistrees");

        // Sync to cabinets table (principal cabinet)
        try {
          const { data: cabRow } = await supabase.from("cabinets").select("id").eq("id", cabinetId).maybeSingle();
          if (cabRow?.id) {
            const { error: syncErr } = await supabase.from("cabinets").update({
              nom: cabinet.nom,
              ville: cabinet.ville,
              siret: cabinet.siret,
              numero_oec: cabinet.numeroOEC,
              email: cabinet.email,
              telephone: cabinet.telephone,
              couleur_primaire: cabinet.couleurPrimaire,
              // Extended fields (ignored if columns don't exist yet)
              ...(cabinet.croec ? { croec: cabinet.croec } : {}),
              ...(cabinet.site_web ? { site_web: cabinet.site_web } : {}),
            }).eq("id", cabRow.id);
            if (syncErr) {
              logger.error("Settings", "Erreur sync cabinets:", syncErr);
              setCabinetSynced(false);
            } else {
              setCabinetSynced(true);
            }
          }
        } catch (syncErr) {
          logger.error("Settings", "Erreur sync cabinets:", syncErr);
          setCabinetSynced(false);
        }
      }
    } catch (err) {
      logger.error("Settings", "Erreur sauvegarde cabinet:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingCabinet(false);
    }
  }, [userId, cabinetId, cabinet]);

  const saveScoring = useCallback(async () => {
    if (!userId) return;
    const errors = validateScoring(scoring);
    setScoringErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }
    setSavingScoring(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("parametres").upsert(
        { user_id: userId, cabinet_id: cabinetId, cle: "scoring_config", valeur: scoring as unknown as Record<string, unknown>, updated_at: now },
        { onConflict: "user_id,cle" }
      );
      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        logger.error("Settings", "Erreur sauvegarde scoring", error);
      } else {
        setSavedScoringSnapshot({ ...scoring });
        setLastSavedScoring(now);
        setSavedScoring(true);
        const t = setTimeout(() => { setSavedScoring(false); savedTimersRef.current = savedTimersRef.current.filter(x => x !== t); }, 1500);
        savedTimersRef.current.push(t);
        clearScoringCache();
        // Auto-recalculate all client scores with new parameters
        if (cabinetId) {
          const recalcResult = await recalculateAllCabinetScores(cabinetId);
          if (recalcResult.success) {
            toast.success(`Configuration scoring enregistree — ${recalcResult.updated_count} dossier(s) recalcule(s)`);
          } else {
            toast.success("Configuration scoring enregistree");
            toast.warning("Le recalcul automatique des scores n'est pas disponible. Utilisez le bouton 'Recalculer' ci-dessous.");
          }
        } else {
          toast.success("Configuration scoring enregistree");
        }
      }
    } catch (err) {
      logger.error("Settings", "Erreur sauvegarde scoring:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingScoring(false);
    }
  }, [userId, cabinetId, scoring]);

  const saveLcbft = useCallback(async () => {
    if (!userId) return;
    const errors = validateLcbft(lcbft);
    setLcbftErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }
    setSavingLcbft(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("parametres").upsert(
        { user_id: userId, cabinet_id: cabinetId, cle: "lcbft_config", valeur: lcbft as unknown as Record<string, unknown>, updated_at: now },
        { onConflict: "user_id,cle" }
      );
      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        logger.error("Settings", "Erreur sauvegarde LCB-FT", error);
      } else {
        setSavedLcbftSnapshot({ ...lcbft });
        setLastSavedLcbft(now);
        setSavedLcbft(true);
        const t = setTimeout(() => { setSavedLcbft(false); savedTimersRef.current = savedTimersRef.current.filter(x => x !== t); }, 1500);
        savedTimersRef.current.push(t);
        toast.success("Configuration LCB-FT enregistree");
      }
    } catch (err) {
      logger.error("Settings", "Erreur sauvegarde LCB-FT:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingLcbft(false);
    }
  }, [userId, cabinetId, lcbft]);

  /* --- update helpers --- */
  function updateCabinet<K extends keyof CabinetInfo>(key: K, value: CabinetInfo[K]) {
    setCabinet((prev) => ({ ...prev, [key]: value }));
    // Clear error for field on change
    if (cabinetErrors[key]) setCabinetErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }
  function updateScoring<K extends keyof ScoringConfig>(key: K, value: ScoringConfig[K]) {
    setScoring((prev) => ({ ...prev, [key]: value }));
    if (scoringErrors[key]) setScoringErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }
  function updateLcbft<K extends keyof LcbftConfig>(key: K, value: LcbftConfig[K]) {
    setLcbft((prev) => ({ ...prev, [key]: value }));
    if (lcbftErrors[key]) setLcbftErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  /* --- reset to defaults --- */
  function resetCabinet() {
    setCabinet({ ...savedCabinetSnapshot });
    setCabinetErrors({});
  }
  function resetScoring() {
    setScoring({ ...savedScoringSnapshot });
    setScoringErrors({});
  }
  function resetLcbft() {
    setLcbft({ ...savedLcbftSnapshot });
    setLcbftErrors({});
  }

  /* --- warn before leaving with unsaved changes --- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyCabinet || dirtyScoring || dirtyLcbft) {
        e.preventDefault();
        e.returnValue = "Les modifications non sauvegardees seront perdues";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyCabinet, dirtyScoring, dirtyLcbft]);

  /* --- keyboard shortcut Ctrl+S --- */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const tab = activeTabRef.current;
        if (tab === "cabinet") saveCabinet();
        else if (tab === "scoring") saveScoring();
        else if (tab === "lcbft") saveLcbft();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveCabinet, saveScoring, saveLcbft]);

  /* --- tab change with unsaved changes warning --- */
  function handleTabChange(newTab: string) {
    const currentDirty =
      (activeTab === "cabinet" && dirtyCabinet) ||
      (activeTab === "scoring" && dirtyScoring) ||
      (activeTab === "lcbft" && dirtyLcbft);
    if (currentDirty) {
      toast.warning("Modifications non enregistrees. Sauvegardez avant de changer d'onglet.");
      return;
    }
    setActiveTab(newTab);
  }

  /* --- loading state --- */
  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-80 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-10 w-72 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
        <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-6">
          <div className="space-y-3">
            <div className="h-5 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <div className="h-10 w-32 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Parametres</h1>
        <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">Configuration du cabinet, scoring de risque et conformite LCB-FT.</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <TabsTrigger value="cabinet" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2 relative">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Cabinet</span>
            {dirtyCabinet && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2 relative">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Scoring</span>
            {dirtyScoring && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="lcbft" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2 relative">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">LCB-FT</span>
            {dirtyLcbft && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="referentiels" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Referentiels</span>
          </TabsTrigger>
          <TabsTrigger value="gestion-cabinet" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Gestion Cabinet</span>
          </TabsTrigger>
          <TabsTrigger value="abonnement" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Abonnement</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== CABINET TAB ===== */}
        <TabsContent value="cabinet">
          <div className="space-y-4">
            {/* Dirty warning banner */}
            {dirtyCabinet && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Modifications non enregistrees. Pensez a sauvegarder vos changements.
              </div>
            )}

            {/* Main card with gradient header */}
            <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
              {/* Gradient header */}
              <div className="px-6 py-5 bg-gradient-to-r from-gray-50 dark:from-white/[0.04] to-gray-50/50 dark:to-white/[0.01] border-b border-gray-200 dark:border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar circle */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg"
                      style={{ backgroundColor: cabinet.couleurPrimaire }}
                    >
                      {getInitials(cabinet.nom)}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {cabinet.nom || "Mon cabinet"}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {wasAutoPopulated && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/20">
                            Pre-rempli depuis l'inscription
                          </Badge>
                        )}
                        {cabinetSynced === true && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/15 text-green-400 border-green-500/20 gap-1">
                            <Check className="w-3 h-3" /> Synchronise
                          </Badge>
                        )}
                        {cabinetSynced === false && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/20 gap-1">
                            <AlertTriangle className="w-3 h-3" /> Sync en attente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {lastSavedCabinet && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {relativeTime(lastSavedCabinet)}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-400">
                    <span>Completion du profil</span>
                    <span className="font-medium">{computeCabinetCompletion(cabinet)}%</span>
                  </div>
                  <Progress value={computeCabinetCompletion(cabinet)} className="h-1.5" />
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* ---- Section 1: Identite ---- */}
                <Collapsible open={identiteOpen} onOpenChange={setIdentiteOpen}>
                  <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1 h-6 rounded-full bg-blue-500" />
                          <Building2 className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Identite</span>
                        </div>
                        {identiteOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-3 border-l-2 border-blue-500/30 ml-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Nom */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-nom" className="text-xs flex items-center gap-1">
                              Nom du cabinet <span className="text-red-400">*</span>
                              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="text-red-400 cursor-help">*</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Champ obligatoire</TooltipContent></Tooltip></TooltipProvider>
                            </Label>
                            <div className="relative">
                              <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-nom"
                                value={cabinet.nom}
                                onChange={(e) => updateCabinet("nom", e.target.value)}
                                placeholder="Cabinet Dupont & Associes"
                                maxLength={100}
                                className={`pl-8 transition-colors ${cabinetErrors.nom ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : cabinet.nom.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                            <div className="flex justify-between">
                              {cabinetErrors.nom ? <p className="text-[10px] text-red-400">{cabinetErrors.nom}</p> : <span />}
                              <span className="text-[10px] text-slate-600">{cabinet.nom.length}/100</span>
                            </div>
                          </div>

                          {/* Associe principal */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-associe" className="text-xs">Associe principal</Label>
                            <div className="relative">
                              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-associe"
                                value={cabinet.associe_principal}
                                onChange={(e) => updateCabinet("associe_principal", e.target.value)}
                                placeholder="Jean Dupont"
                                maxLength={80}
                                className={`pl-8 transition-colors ${cabinet.associe_principal.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                            <div className="flex justify-end">
                              <span className="text-[10px] text-slate-600">{cabinet.associe_principal.length}/80</span>
                            </div>
                          </div>

                          {/* SIRET */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-siret" className="text-xs flex items-center gap-1">
                              SIRET
                              <InfoTip text="Le SIRET doit contenir exactement 14 chiffres. Les espaces sont ignores." />
                            </Label>
                            <div className="relative">
                              <Fingerprint className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-siret"
                                value={formatSiretInput(cabinet.siret)}
                                onChange={(e) => updateCabinet("siret", e.target.value.replace(/\D/g, "").slice(0, 14))}
                                placeholder="123 456 789 00012"
                                className={`pl-8 font-mono transition-colors ${cabinetErrors.siret ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : cabinet.siret.replace(/\s/g, "").length === 14 ? "border-green-500/40" : ""}`}
                              />
                            </div>
                            {cabinetErrors.siret && <p className="text-[10px] text-red-400">{cabinetErrors.siret}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Numero OEC */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-oec" className="text-xs">Numero OEC</Label>
                            <div className="relative">
                              <Award className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-oec"
                                value={cabinet.numeroOEC}
                                onChange={(e) => updateCabinet("numeroOEC", e.target.value)}
                                placeholder="OEC-2024-XXXX"
                                className={`pl-8 transition-colors ${cabinet.numeroOEC.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>

                          {/* CROEC */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-croec" className="text-xs">CROEC d'inscription</Label>
                            <div className="relative">
                              <Award className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-croec"
                                value={cabinet.croec}
                                onChange={(e) => updateCabinet("croec", e.target.value)}
                                placeholder="CROEC Provence-Alpes-Cote d'Azur"
                                className={`pl-8 transition-colors ${cabinet.croec.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>

                          {/* TVA intracommunautaire */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-tva" className="text-xs">N° TVA intracommunautaire</Label>
                            <div className="relative">
                              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-tva"
                                value={cabinet.tva_intracommunautaire}
                                onChange={(e) => updateCabinet("tva_intracommunautaire", e.target.value)}
                                placeholder="FR12345678901"
                                className={`pl-8 font-mono transition-colors ${cabinet.tva_intracommunautaire.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Assureur RC Pro */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-assureur" className="text-xs">Assureur RC Professionnelle</Label>
                            <Input
                              id="cab-assureur"
                              value={cabinet.assureur_nom}
                              onChange={(e) => updateCabinet("assureur_nom", e.target.value)}
                              placeholder="MMA IARD"
                              className={`transition-colors ${cabinet.assureur_nom.trim() ? "border-green-500/40" : ""}`}
                            />
                          </div>
                          {/* Adresse assureur */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-assureur-adr" className="text-xs">Adresse assureur</Label>
                            <Input
                              id="cab-assureur-adr"
                              value={cabinet.assureur_adresse}
                              onChange={(e) => updateCabinet("assureur_adresse", e.target.value)}
                              placeholder="14 bd Marie et Alexandre OYON, 72030 Le Mans"
                              className={`transition-colors ${cabinet.assureur_adresse.trim() ? "border-green-500/40" : ""}`}
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* ---- Section 2: Coordonnees ---- */}
                <Collapsible open={coordonneesOpen} onOpenChange={setCoordonneesOpen}>
                  <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1 h-6 rounded-full bg-emerald-500" />
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Coordonnees</span>
                        </div>
                        {coordonneesOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-3 border-l-2 border-emerald-500/30 ml-4 space-y-4">
                        {/* Adresse */}
                        <div className="space-y-1.5">
                          <Label htmlFor="cab-adresse" className="text-xs">Adresse</Label>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <Input
                              id="cab-adresse"
                              value={cabinet.adresse}
                              onChange={(e) => updateCabinet("adresse", e.target.value)}
                              placeholder="12 rue de la Paix"
                              maxLength={120}
                              className={`pl-8 transition-colors ${cabinet.adresse.trim() ? "border-green-500/40" : ""}`}
                            />
                          </div>
                          <div className="flex justify-end">
                            <span className="text-[10px] text-slate-600">{cabinet.adresse.length}/120</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Code postal */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-cp" className="text-xs">Code postal</Label>
                            <div className="relative">
                              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-cp"
                                value={cabinet.cp}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                                  updateCabinet("cp", v);
                                }}
                                placeholder="75001"
                                maxLength={5}
                                inputMode="numeric"
                                className={`pl-8 font-mono transition-colors ${cabinet.cp.length === 5 ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>

                          {/* Ville */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-ville" className="text-xs">Ville</Label>
                            <div className="relative">
                              <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-ville"
                                value={cabinet.ville}
                                onChange={(e) => updateCabinet("ville", e.target.value)}
                                placeholder="Paris"
                                className={`pl-8 transition-colors ${cabinet.ville.trim() ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Email */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-email" className="text-xs">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-email"
                                type="email"
                                value={cabinet.email}
                                onChange={(e) => updateCabinet("email", e.target.value)}
                                placeholder="contact@cabinet.fr"
                                className={`pl-8 transition-colors ${cabinetErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : cabinet.email && validateEmail(cabinet.email) ? "border-green-500/40" : ""}`}
                              />
                            </div>
                            {cabinetErrors.email && <p className="text-[10px] text-red-400">{cabinetErrors.email}</p>}
                          </div>

                          {/* Telephone */}
                          <div className="space-y-1.5">
                            <Label htmlFor="cab-tel" className="text-xs">Telephone</Label>
                            <div className="relative">
                              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <Input
                                id="cab-tel"
                                value={formatPhoneInput(cabinet.telephone)}
                                onChange={(e) => updateCabinet("telephone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                                placeholder="01 23 45 67 89"
                                inputMode="tel"
                                className={`pl-8 font-mono transition-colors ${cabinet.telephone.replace(/\D/g, "").length === 10 ? "border-green-500/40" : ""}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Site web */}
                        <div className="space-y-1.5">
                          <Label htmlFor="cab-web" className="text-xs">Site web</Label>
                          <div className="relative">
                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <Input
                              id="cab-web"
                              value={cabinet.site_web}
                              onChange={(e) => updateCabinet("site_web", e.target.value)}
                              placeholder="www.cabinet-exemple.fr"
                              className={`pl-8 transition-colors ${cabinet.site_web.trim() ? "border-green-500/40" : ""}`}
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* ---- Section 3: Apparence ---- */}
                <Collapsible open={apparenceOpen} onOpenChange={setApparenceOpen}>
                  <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1 h-6 rounded-full bg-violet-500" />
                          <Palette className="w-4 h-4 text-violet-400" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Apparence</span>
                        </div>
                        {apparenceOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-3 border-l-2 border-violet-500/30 ml-4 space-y-5">
                        {/* Logo upload */}
                        <div className="space-y-2">
                          <Label className="text-xs">Logo du cabinet</Label>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Utilise dans les en-tetes de vos lettres de mission, PDF et DOCX. Format PNG ou JPG, max 500 Ko. Dimensions recommandees : 300x100 px.
                          </p>
                          <div className="flex items-center gap-4">
                            {cabinet.logo ? (
                              <>
                                <div className="w-48 h-16 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden bg-white p-2">
                                  <img src={cabinet.logo} alt="Logo cabinet" className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => (document.getElementById('cab-logo-input') as HTMLInputElement)?.click()}>
                                    Changer
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-red-400 hover:text-red-600" onClick={() => updateCabinet("logo", "")}>
                                    Supprimer
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div
                                className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/[0.08] flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                                onClick={() => (document.getElementById('cab-logo-input') as HTMLInputElement)?.click()}
                              >
                                <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">Cliquez pour selectionner votre logo</p>
                                <p className="text-[9px] text-slate-300 dark:text-slate-600">PNG ou JPG · Max 500 Ko</p>
                              </div>
                            )}
                            <input
                              id="cab-logo-input"
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 500 * 1024) { toast.error("Le fichier est trop volumineux (max 500 Ko)"); return; }
                                if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { toast.error("Format non supporte. Utilisez PNG ou JPG."); return; }
                                const reader = new FileReader();
                                reader.onload = () => updateCabinet("logo", reader.result as string);
                                reader.readAsDataURL(file);
                                e.target.value = '';
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Colors + Font */}
                          <div className="space-y-5">
                            {/* Couleur primaire */}
                            <div className="space-y-2">
                              <Label className="text-xs">Couleur primaire</Label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {COLOR_PRESETS.map((c) => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    title={c.label}
                                    onClick={() => updateCabinet("couleurPrimaire", c.value)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${cabinet.couleurPrimaire === c.value ? "border-blue-600 ring-2 ring-blue-600/30 dark:border-white dark:ring-white/30 scale-110" : "border-gray-300 dark:border-white/20"}`}
                                    style={{ backgroundColor: c.value }}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={cabinet.couleurPrimaire}
                                  onChange={(e) => updateCabinet("couleurPrimaire", e.target.value)}
                                  className="w-7 h-7 rounded-full border border-gray-300 dark:border-white/20 bg-transparent cursor-pointer"
                                  title="Couleur personnalisee"
                                />
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono ml-1">{cabinet.couleurPrimaire}</span>
                              </div>
                            </div>

                            {/* Couleur secondaire */}
                            <div className="space-y-2">
                              <Label className="text-xs">Couleur secondaire</Label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {COLOR_PRESETS.map((c) => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    title={c.label}
                                    onClick={() => updateCabinet("couleurSecondaire", c.value)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${cabinet.couleurSecondaire === c.value ? "border-blue-600 ring-2 ring-blue-600/30 dark:border-white dark:ring-white/30 scale-110" : "border-gray-300 dark:border-white/20"}`}
                                    style={{ backgroundColor: c.value }}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={cabinet.couleurSecondaire}
                                  onChange={(e) => updateCabinet("couleurSecondaire", e.target.value)}
                                  className="w-7 h-7 rounded-full border border-gray-300 dark:border-white/20 bg-transparent cursor-pointer"
                                  title="Couleur personnalisee"
                                />
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono ml-1">{cabinet.couleurSecondaire}</span>
                              </div>
                            </div>

                            {/* Police */}
                            <div className="space-y-2">
                              <Label className="text-xs">Police de caracteres</Label>
                              <Select value={cabinet.police} onValueChange={(v) => updateCabinet("police", v)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choisir une police" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FONT_OPTIONS.map((f) => (
                                    <SelectItem key={f} value={f}>
                                      <span style={{ fontFamily: f }}>{f}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Live preview */}
                          <div className="space-y-2">
                            <Label className="text-xs">Apercu en-tete</Label>
                            <div className="rounded-lg border border-white/10 bg-white overflow-hidden shadow-lg" style={{ fontFamily: cabinet.police }}>
                              {/* Colored header bar */}
                              <div className="h-2.5" style={{ background: `linear-gradient(to right, ${cabinet.couleurPrimaire}, ${cabinet.couleurSecondaire})` }} />
                              <div className="p-4 space-y-2">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                    style={{ backgroundColor: cabinet.couleurPrimaire }}
                                  >
                                    {getInitials(cabinet.nom)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{cabinet.nom || "Nom du cabinet"}</p>
                                    {cabinet.adresse && <p className="text-[10px] text-gray-500">{cabinet.adresse}</p>}
                                    <p className="text-[10px] text-gray-500">{[cabinet.cp, cabinet.ville].filter(Boolean).join(" ") || "Ville"}</p>
                                  </div>
                                </div>
                                <div className="border-t border-gray-100 pt-2 space-y-0.5">
                                  {cabinet.telephone && (
                                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" /> {formatPhoneInput(cabinet.telephone)}
                                    </p>
                                  )}
                                  {cabinet.email && (
                                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                                      <Mail className="w-2.5 h-2.5" /> {cabinet.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>

              {/* Sticky save bar */}
              <div className="sticky bottom-0 z-10 px-6 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/80 backdrop-blur-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showResetConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-400">Reinitialiser les valeurs ?</span>
                      <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { resetCabinet(); setShowResetConfirm(false); }}>
                        Confirmer
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowResetConfirm(false)}>
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)} aria-label="Reinitialiser les informations du cabinet" className="gap-2 text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 h-8">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reinitialiser
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {lastSavedCabinet && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                      {relativeTime(lastSavedCabinet)}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">Ctrl+S</span>
                  <Button
                    onClick={saveCabinet}
                    disabled={savingCabinet}
                    aria-label="Enregistrer les informations du cabinet"
                    className={`gap-2 transition-all duration-300 ${savedCabinet ? "bg-green-600 hover:bg-green-600" : ""}`}
                  >
                    {savingCabinet ? <Loader2 className="w-4 h-4 animate-spin" /> : savedCabinet ? <Check className="w-4 h-4 animate-in zoom-in duration-200" /> : <Save className="w-4 h-4" />}
                    {savedCabinet ? "Enregistre !" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== SCORING TAB ===== */}
        <TabsContent value="scoring">
          <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuration du scoring</h2>
              <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">Seuils de vigilance, malus de risque et frequences de revue.</p>
            </div>

            {/* Seuils */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Seuils de vigilance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-bas">Seuil SIMPLIFIEE (max)</Label>
                  <Input id="sc-bas" type="number" min={0} value={scoring.seuil_bas} onChange={(e) => updateScoring("seuil_bas", Number(e.target.value))} />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Score &le; ce seuil = vigilance SIMPLIFIEE</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-haut">Seuil RENFORCEE (min)</Label>
                  <Input id="sc-haut" type="number" min={0} value={scoring.seuil_haut} onChange={(e) => updateScoring("seuil_haut", Number(e.target.value))} />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Score &ge; ce seuil = vigilance RENFORCEE</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 dark:text-slate-400 text-xs">STANDARD (auto)</Label>
                  <p className="text-sm text-slate-700 dark:text-slate-300 pt-2">{scoring.seuil_bas + 1 <= scoring.seuil_haut - 1 ? `${scoring.seuil_bas + 1} \u2013 ${scoring.seuil_haut - 1}` : "Plage invalide"}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Plage calculee automatiquement</p>
                </div>
              </div>
            </div>

            {/* Malus */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Malus (points ajoutes au score)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-cash">Especes (cash)</Label>
                  <Input id="sc-cash" type="number" min={0} value={scoring.malus_cash} onChange={(e) => updateScoring("malus_cash", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-pression">Pression / urgence</Label>
                  <Input id="sc-pression" type="number" min={0} value={scoring.malus_pression} onChange={(e) => updateScoring("malus_pression", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-dist">Distanciel</Label>
                  <Input id="sc-dist" type="number" min={0} value={scoring.malus_distanciel} onChange={(e) => updateScoring("malus_distanciel", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-ppe">PPE</Label>
                  <Input id="sc-ppe" type="number" min={0} value={scoring.malus_ppe} onChange={(e) => updateScoring("malus_ppe", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-atyp">Atypique</Label>
                  <Input id="sc-atyp" type="number" min={0} value={scoring.malus_atypique} onChange={(e) => updateScoring("malus_atypique", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Frequences de revue */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Frequences de revue (mois)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-std">Revue STANDARD</Label>
                  <Input id="sc-rev-std" type="number" min={1} value={scoring.revue_standard_mois} onChange={(e) => updateScoring("revue_standard_mois", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-renf">Revue RENFORCEE</Label>
                  <Input id="sc-rev-renf" type="number" min={1} value={scoring.revue_renforcee_mois} onChange={(e) => updateScoring("revue_renforcee_mois", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-simp">Revue SIMPLIFIEE</Label>
                  <Input id="sc-rev-simp" type="number" min={1} value={scoring.revue_simplifiee_mois} onChange={(e) => updateScoring("revue_simplifiee_mois", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Warning: unsaved changes */}
            {dirtyScoring && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">Les modifications ne seront appliquees aux dossiers existants qu'apres sauvegarde</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!cabinetId) { toast.error("Cabinet non identifie"); return; }
                  setRecalculating(true);
                  const result = await recalculateAllCabinetScores(cabinetId);
                  setRecalculating(false);
                  if (result.success) {
                    toast.success(`${result.updated_count} dossier(s) recalcule(s) avec les parametres actuels`);
                  } else {
                    toast.error("Erreur lors du recalcul des scores. La fonction RPC n'est peut-etre pas encore deployee.");
                  }
                }}
                disabled={recalculating || !cabinetId}
                className="gap-2"
              >
                {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Recalculer tous les scores
              </Button>
              <Button onClick={saveScoring} disabled={savingScoring} aria-label="Enregistrer la configuration du scoring" className="gap-2">
                {savingScoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ===== LCB-FT TAB ===== */}
        <TabsContent value="lcbft">
          <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuration LCB-FT</h2>
              <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">Referent, formations et listes de pays a risque.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="lcb-ref">Referent LCB-FT</Label>
                <Input id="lcb-ref" value={lcbft.referent_lcb} onChange={(e) => updateLcbft("referent_lcb", e.target.value)} placeholder="Nom du referent" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcb-sup">Suppleant LCB-FT</Label>
                <Input id="lcb-sup" value={lcbft.suppleant_lcb} onChange={(e) => updateLcbft("suppleant_lcb", e.target.value)} placeholder="Nom du suppleant" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="lcb-formation">Date derniere formation</Label>
                <Input id="lcb-formation" type="date" value={lcbft.date_derniere_formation} onChange={(e) => updateLcbft("date_derniere_formation", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcb-signature">Date signature manuel</Label>
                <Input id="lcb-signature" type="date" value={lcbft.date_signature_manuel} onChange={(e) => updateLcbft("date_signature_manuel", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcb-version">Version du manuel</Label>
                <Input id="lcb-version" value={lcbft.version_manuel} onChange={(e) => updateLcbft("version_manuel", e.target.value)} placeholder="v2.1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lcb-risque">Pays a risque (GAFI / UE)</Label>
              <Textarea
                id="lcb-risque"
                value={lcbft.pays_risque.join(", ")}
                onChange={(e) =>
                  updateLcbft(
                    "pays_risque",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                rows={3}
                className="font-mono text-xs"
                placeholder="AFGHANISTAN, IRAN, COREE DU NORD..."
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Noms des pays separes par des virgules.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lcb-grey">Pays greylist</Label>
              <Textarea
                id="lcb-grey"
                value={lcbft.pays_greylist.join(", ")}
                onChange={(e) =>
                  updateLcbft(
                    "pays_greylist",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                rows={3}
                className="font-mono text-xs"
                placeholder="TURQUIE, EMIRATS ARABES UNIS..."
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Pays sous surveillance renforcee (liste grise GAFI).</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveLcbft} disabled={savingLcbft} aria-label="Enregistrer la configuration LCB-FT" className="gap-2">
                {savingLcbft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ===== REFERENTIELS TAB (nested sub-tabs) ===== */}
        <TabsContent value="referentiels">
          <RefSubTabs />
        </TabsContent>

        {/* ===== GESTION CABINET TAB (nested sub-tabs) ===== */}
        <TabsContent value="gestion-cabinet">
          <CabinetSubTabs />
        </TabsContent>

        {/* ===== ABONNEMENT TAB ===== */}
        <TabsContent value="abonnement">
          <Suspense
            fallback={
              <div className="glass-card border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-3">
                <div className="h-5 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-8 w-full bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
              </div>
            }
          >
            <SubscriptionSettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
