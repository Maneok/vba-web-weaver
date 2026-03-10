import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { toast } from "sonner";
import { Building2, Target, ShieldCheck, CreditCard, Save, Loader2, RotateCcw, Info, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const SubscriptionSettings = lazy(() => import("@/components/settings/SubscriptionSettings"));

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
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ---------- InfoTip ---------- */

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help inline ml-1.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------- component ---------- */

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCabinet, setSavingCabinet] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);
  const [savingLcbft, setSavingLcbft] = useState(false);
  const [savedCabinet, setSavedCabinet] = useState(false);
  const [savedScoring, setSavedScoring] = useState(false);
  const [savedLcbft, setSavedLcbft] = useState(false);
  const savedTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { savedTimersRef.current.forEach(clearTimeout); };
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

        if (data) {
          for (const row of data) {
            if (row.cle === "cabinet_info" && row.valeur) {
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
    const now = new Date().toISOString();
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "cabinet_info", valeur: cabinet as unknown as Record<string, unknown>, updated_at: now },
      { onConflict: "user_id,cle" }
    );
    setSavingCabinet(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde cabinet", error);
    } else {
      setSavedCabinetSnapshot({ ...cabinet });
      setLastSavedCabinet(now);
      setSavedCabinet(true);
      const t = setTimeout(() => setSavedCabinet(false), 1500);
      savedTimersRef.current.push(t);
      toast.success("Informations cabinet enregistrees");
    }
  }, [userId, cabinet]);

  const saveScoring = useCallback(async () => {
    if (!userId) return;
    const errors = validateScoring(scoring);
    setScoringErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }
    setSavingScoring(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "scoring_config", valeur: scoring as unknown as Record<string, unknown>, updated_at: now },
      { onConflict: "user_id,cle" }
    );
    setSavingScoring(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde scoring", error);
    } else {
      setSavedScoringSnapshot({ ...scoring });
      setLastSavedScoring(now);
      setSavedScoring(true);
      const t = setTimeout(() => setSavedScoring(false), 1500);
      savedTimersRef.current.push(t);
      toast.success("Configuration scoring enregistree");
    }
  }, [userId, scoring]);

  const saveLcbft = useCallback(async () => {
    if (!userId) return;
    const errors = validateLcbft(lcbft);
    setLcbftErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Veuillez corriger les erreurs avant de sauvegarder");
      return;
    }
    setSavingLcbft(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "lcbft_config", valeur: lcbft as unknown as Record<string, unknown>, updated_at: now },
      { onConflict: "user_id,cle" }
    );
    setSavingLcbft(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde LCB-FT", error);
    } else {
      setSavedLcbftSnapshot({ ...lcbft });
      setLastSavedLcbft(now);
      setSavedLcbft(true);
      const t = setTimeout(() => setSavedLcbft(false), 1500);
      savedTimersRef.current.push(t);
      toast.success("Configuration LCB-FT enregistree");
    }
  }, [userId, lcbft]);

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
          <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-80 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-10 w-72 bg-white/5 rounded animate-pulse" />
        <div className="glass-card border border-white/10 rounded-xl p-6 space-y-6">
          <div className="space-y-3">
            <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                <div className="h-10 w-full bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Parametres</h1>
        <p className="text-sm text-slate-400 mt-1">Configuration du cabinet, scoring de risque et conformite LCB-FT.</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="cabinet" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2 relative">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Cabinet</span>
            {dirtyCabinet && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2 relative">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Scoring</span>
            {dirtyScoring && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="lcbft" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2 relative">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">LCB-FT</span>
            {dirtyLcbft && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="abonnement" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Abonnement</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== CABINET TAB ===== */}
        <TabsContent value="cabinet">
          <div className="glass-card border border-white/10 rounded-xl p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center">
                  Informations du cabinet
                  <InfoTip text="Ces informations apparaissent sur vos documents officiels et rapports de conformite LCB-FT." />
                </h2>
                <p className="text-sm text-slate-400 mt-1">Coordonnees et identite du cabinet comptable.</p>
              </div>
              {lastSavedCabinet && (
                <span className="text-xs text-slate-500 whitespace-nowrap">Sauvegarde : {formatTimestamp(lastSavedCabinet)}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-nom">Nom du cabinet <span className="text-red-400">*</span></Label>
                <Input id="cab-nom" value={cabinet.nom} onChange={(e) => updateCabinet("nom", e.target.value)} placeholder="Cabinet Dupont & Associes" className={`focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${cabinetErrors.nom ? "border-red-500" : ""}`} />
                {cabinetErrors.nom && <p className="text-xs text-red-400">{cabinetErrors.nom}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-associe">Associe principal</Label>
                <Input id="cab-associe" value={cabinet.associe_principal} onChange={(e) => updateCabinet("associe_principal", e.target.value)} placeholder="Jean Dupont" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cab-adresse">Adresse</Label>
              <Input id="cab-adresse" value={cabinet.adresse} onChange={(e) => updateCabinet("adresse", e.target.value)} placeholder="12 rue de la Paix" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-cp">Code postal</Label>
                <Input id="cab-cp" value={cabinet.cp} onChange={(e) => updateCabinet("cp", e.target.value)} placeholder="75001" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-ville">Ville</Label>
                <Input id="cab-ville" value={cabinet.ville} onChange={(e) => updateCabinet("ville", e.target.value)} placeholder="Paris" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-siret">SIRET <InfoTip text="Le SIRET doit contenir exactement 14 chiffres. Les espaces sont ignores." /></Label>
                <Input id="cab-siret" value={cabinet.siret} onChange={(e) => updateCabinet("siret", e.target.value)} placeholder="123 456 789 00012" className={`focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${cabinetErrors.siret ? "border-red-500" : ""}`} />
                {cabinetErrors.siret && <p className="text-xs text-red-400">{cabinetErrors.siret}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-oec">Numero OEC</Label>
                <Input id="cab-oec" value={cabinet.numeroOEC} onChange={(e) => updateCabinet("numeroOEC", e.target.value)} placeholder="OEC-2024-XXXX" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-email">Email</Label>
                <Input id="cab-email" type="email" value={cabinet.email} onChange={(e) => updateCabinet("email", e.target.value)} placeholder="contact@cabinet.fr" className={`focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${cabinetErrors.email ? "border-red-500" : ""}`} />
                {cabinetErrors.email && <p className="text-xs text-red-400">{cabinetErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-tel">Telephone</Label>
                <Input id="cab-tel" value={cabinet.telephone} onChange={(e) => updateCabinet("telephone", e.target.value)} placeholder="01 23 45 67 89" className="focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cab-couleur">Couleur primaire</Label>
              <div className="flex items-center gap-3">
                <input
                  id="cab-couleur"
                  type="color"
                  value={cabinet.couleurPrimaire}
                  onChange={(e) => updateCabinet("couleurPrimaire", e.target.value)}
                  className="w-10 h-10 rounded border border-white/10 bg-transparent cursor-pointer"
                />
                <div className="w-8 h-8 rounded-md border border-white/10" style={{ backgroundColor: cabinet.couleurPrimaire }} />
                <span className="text-sm text-slate-400 font-mono">{cabinet.couleurPrimaire}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={resetCabinet} className="gap-2 text-slate-400 hover:text-slate-200">
                <RotateCcw className="w-3.5 h-3.5" />
                Reinitialiser
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 hidden sm:inline">Ctrl+S pour sauvegarder</span>
                <Button
                  onClick={saveCabinet}
                  disabled={savingCabinet}
                  className={`gap-2 transition-colors duration-300 ${savedCabinet ? "bg-green-600 hover:bg-green-600" : ""}`}
                >
                  {savingCabinet ? <Loader2 className="w-4 h-4 animate-spin" /> : savedCabinet ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savedCabinet ? "Enregistre !" : "Enregistrer"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== SCORING TAB ===== */}
        <TabsContent value="scoring">
          <div className="glass-card border border-white/10 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Configuration du scoring</h2>
              <p className="text-sm text-slate-400 mt-1">Seuils de vigilance, malus de risque et frequences de revue.</p>
            </div>

            {/* Seuils */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Seuils de vigilance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-bas">Seuil SIMPLIFIEE (max)</Label>
                  <Input id="sc-bas" type="number" value={scoring.seuil_bas} onChange={(e) => updateScoring("seuil_bas", Number(e.target.value))} />
                  <p className="text-[11px] text-slate-500">Score &le; ce seuil = vigilance SIMPLIFIEE</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-haut">Seuil RENFORCEE (min)</Label>
                  <Input id="sc-haut" type="number" value={scoring.seuil_haut} onChange={(e) => updateScoring("seuil_haut", Number(e.target.value))} />
                  <p className="text-[11px] text-slate-500">Score &ge; ce seuil = vigilance RENFORCEE</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">STANDARD (auto)</Label>
                  <p className="text-sm text-slate-300 pt-2">{scoring.seuil_bas + 1 <= scoring.seuil_haut - 1 ? `${scoring.seuil_bas + 1} \u2013 ${scoring.seuil_haut - 1}` : "Plage invalide"}</p>
                  <p className="text-[11px] text-slate-500">Plage calculee automatiquement</p>
                </div>
              </div>
            </div>

            {/* Malus */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Malus (points ajoutes au score)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-cash">Especes (cash)</Label>
                  <Input id="sc-cash" type="number" value={scoring.malus_cash} onChange={(e) => updateScoring("malus_cash", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-pression">Pression / urgence</Label>
                  <Input id="sc-pression" type="number" value={scoring.malus_pression} onChange={(e) => updateScoring("malus_pression", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-dist">Distanciel</Label>
                  <Input id="sc-dist" type="number" value={scoring.malus_distanciel} onChange={(e) => updateScoring("malus_distanciel", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-ppe">PPE</Label>
                  <Input id="sc-ppe" type="number" value={scoring.malus_ppe} onChange={(e) => updateScoring("malus_ppe", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-atyp">Atypique</Label>
                  <Input id="sc-atyp" type="number" value={scoring.malus_atypique} onChange={(e) => updateScoring("malus_atypique", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Frequences de revue */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Frequences de revue (mois)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-std">Revue STANDARD</Label>
                  <Input id="sc-rev-std" type="number" value={scoring.revue_standard_mois} onChange={(e) => updateScoring("revue_standard_mois", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-renf">Revue RENFORCEE</Label>
                  <Input id="sc-rev-renf" type="number" value={scoring.revue_renforcee_mois} onChange={(e) => updateScoring("revue_renforcee_mois", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-rev-simp">Revue SIMPLIFIEE</Label>
                  <Input id="sc-rev-simp" type="number" value={scoring.revue_simplifiee_mois} onChange={(e) => updateScoring("revue_simplifiee_mois", Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveScoring} disabled={savingScoring} className="gap-2">
                {savingScoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ===== LCB-FT TAB ===== */}
        <TabsContent value="lcbft">
          <div className="glass-card border border-white/10 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Configuration LCB-FT</h2>
              <p className="text-sm text-slate-400 mt-1">Referent, formations et listes de pays a risque.</p>
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
              <p className="text-[11px] text-slate-500">Noms des pays separes par des virgules.</p>
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
              <p className="text-[11px] text-slate-500">Pays sous surveillance renforcee (liste grise GAFI).</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveLcbft} disabled={savingLcbft} className="gap-2">
                {savingLcbft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ===== ABONNEMENT TAB ===== */}
        <TabsContent value="abonnement">
          <Suspense
            fallback={
              <div className="glass-card border border-white/10 rounded-xl p-6 space-y-3">
                <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
                <div className="h-8 w-full bg-white/5 rounded animate-pulse" />
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
