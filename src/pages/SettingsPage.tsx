import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Target, ShieldCheck, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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

/* ---------- component ---------- */

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCabinet, setSavingCabinet] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);
  const [savingLcbft, setSavingLcbft] = useState(false);

  const [cabinet, setCabinet] = useState<CabinetInfo>(DEFAULT_CABINET);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [lcbft, setLcbft] = useState<LcbftConfig>(DEFAULT_LCBFT);

  /* --- load --- */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from("parametres")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        logger.error("Settings", "Error loading parametres:", error);
        toast.error("Erreur lors du chargement des parametres");
        setLoading(false);
        return;
      }

      if (data) {
        for (const row of data) {
          if (row.cle === "cabinet_info" && row.valeur) {
            setCabinet((prev) => ({ ...prev, ...(row.valeur as Partial<CabinetInfo>) }));
          }
          if (row.cle === "scoring_config" && row.valeur) {
            setScoring((prev) => ({ ...prev, ...(row.valeur as Partial<ScoringConfig>) }));
          }
          if (row.cle === "lcbft_config" && row.valeur) {
            setLcbft((prev) => ({ ...prev, ...(row.valeur as Partial<LcbftConfig>) }));
          }
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  /* --- save helpers --- */
  async function saveCabinet() {
    if (!userId) return;
    setSavingCabinet(true);
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "cabinet_info", valeur: cabinet as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "user_id,cle" }
    );
    setSavingCabinet(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde cabinet", error);
    } else {
      toast.success("Informations cabinet enregistrees");
    }
  }

  async function saveScoring() {
    if (!userId) return;
    setSavingScoring(true);
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "scoring_config", valeur: scoring as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "user_id,cle" }
    );
    setSavingScoring(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde scoring", error);
    } else {
      toast.success("Configuration scoring enregistree");
    }
  }

  async function saveLcbft() {
    if (!userId) return;
    setSavingLcbft(true);
    const { error } = await supabase.from("parametres").upsert(
      { user_id: userId, cle: "lcbft_config", valeur: lcbft as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "user_id,cle" }
    );
    setSavingLcbft(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      logger.error("Settings", "Erreur sauvegarde LCB-FT", error);
    } else {
      toast.success("Configuration LCB-FT enregistree");
    }
  }

  /* --- update helpers --- */
  function updateCabinet<K extends keyof CabinetInfo>(key: K, value: CabinetInfo[K]) {
    setCabinet((prev) => ({ ...prev, [key]: value }));
  }
  function updateScoring<K extends keyof ScoringConfig>(key: K, value: ScoringConfig[K]) {
    setScoring((prev) => ({ ...prev, [key]: value }));
  }
  function updateLcbft<K extends keyof LcbftConfig>(key: K, value: LcbftConfig[K]) {
    setLcbft((prev) => ({ ...prev, [key]: value }));
  }

  /* --- loading state --- */
  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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
      <Tabs defaultValue="cabinet" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="cabinet" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2">
            <Building2 className="w-4 h-4" />
            Cabinet
          </TabsTrigger>
          <TabsTrigger value="scoring" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2">
            <Target className="w-4 h-4" />
            Scoring
          </TabsTrigger>
          <TabsTrigger value="lcbft" className="data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2">
            <ShieldCheck className="w-4 h-4" />
            LCB-FT
          </TabsTrigger>
        </TabsList>

        {/* ===== CABINET TAB ===== */}
        <TabsContent value="cabinet">
          <div className="glass-card border border-white/10 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Informations du cabinet</h2>
              <p className="text-sm text-slate-400 mt-1">Coordonnees et identite du cabinet comptable.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-nom">Nom du cabinet</Label>
                <Input id="cab-nom" value={cabinet.nom} onChange={(e) => updateCabinet("nom", e.target.value)} placeholder="Cabinet Dupont & Associes" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-associe">Associe principal</Label>
                <Input id="cab-associe" value={cabinet.associe_principal} onChange={(e) => updateCabinet("associe_principal", e.target.value)} placeholder="Jean Dupont" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cab-adresse">Adresse</Label>
              <Input id="cab-adresse" value={cabinet.adresse} onChange={(e) => updateCabinet("adresse", e.target.value)} placeholder="12 rue de la Paix" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-cp">Code postal</Label>
                <Input id="cab-cp" value={cabinet.cp} onChange={(e) => updateCabinet("cp", e.target.value)} placeholder="75001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-ville">Ville</Label>
                <Input id="cab-ville" value={cabinet.ville} onChange={(e) => updateCabinet("ville", e.target.value)} placeholder="Paris" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-siret">SIRET</Label>
                <Input id="cab-siret" value={cabinet.siret} onChange={(e) => updateCabinet("siret", e.target.value)} placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-oec">Numero OEC</Label>
                <Input id="cab-oec" value={cabinet.numeroOEC} onChange={(e) => updateCabinet("numeroOEC", e.target.value)} placeholder="OEC-2024-XXXX" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cab-email">Email</Label>
                <Input id="cab-email" type="email" value={cabinet.email} onChange={(e) => updateCabinet("email", e.target.value)} placeholder="contact@cabinet.fr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cab-tel">Telephone</Label>
                <Input id="cab-tel" value={cabinet.telephone} onChange={(e) => updateCabinet("telephone", e.target.value)} placeholder="01 23 45 67 89" />
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
                <span className="text-sm text-slate-400 font-mono">{cabinet.couleurPrimaire}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveCabinet} disabled={savingCabinet} className="gap-2">
                {savingCabinet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
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
                  <p className="text-sm text-slate-300 pt-2">{scoring.seuil_bas + 1} &ndash; {scoring.seuil_haut - 1}</p>
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
      </Tabs>
    </div>
  );
}
