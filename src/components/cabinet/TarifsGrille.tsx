import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Loader2, Check, Euro } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & defaults
// ---------------------------------------------------------------------------

interface TarifsDefaut {
  taux_ec: number;
  taux_collaborateur: number;
  prix_bulletin: number;
  prix_fin_contrat: number;
  prix_coffre_fort: number;
  prix_contrat_simple: number;
  prix_entree_salarie: number;
  prix_attestation_maladie: number;
  prix_bordereaux: number;
  prix_sylae: number;
  honoraires_juridique_defaut: number;
  forfait_constitution_defaut: number;
}

const DEFAULTS: TarifsDefaut = {
  taux_ec: 200,
  taux_collaborateur: 100,
  prix_bulletin: 32,
  prix_fin_contrat: 30,
  prix_coffre_fort: 5,
  prix_contrat_simple: 100,
  prix_entree_salarie: 30,
  prix_attestation_maladie: 30,
  prix_bordereaux: 25,
  prix_sylae: 15,
  honoraires_juridique_defaut: 300,
  forfait_constitution_defaut: 500,
};

interface TarifRow {
  key: keyof TarifsDefaut;
  label: string;
  unit: string;
}

const SECTIONS: { title: string; rows: TarifRow[] }[] = [
  {
    title: "Honoraires généraux",
    rows: [
      { key: "taux_ec", label: "Taux horaire expert-comptable", unit: "€ HT / heure" },
      { key: "taux_collaborateur", label: "Taux horaire collaborateur", unit: "€ HT / heure" },
    ],
  },
  {
    title: "Mission sociale",
    rows: [
      { key: "prix_bulletin", label: "Bulletin de paie", unit: "€ HT / bulletin" },
      { key: "prix_fin_contrat", label: "Solde de tout compte", unit: "€ HT / fin de contrat" },
      { key: "prix_coffre_fort", label: "Coffre-fort numérique", unit: "€ HT / salarié / mois" },
      { key: "prix_contrat_simple", label: "Contrat de travail simple", unit: "€ HT / contrat" },
      { key: "prix_entree_salarie", label: "Entrée salarié (DPAE, etc.)", unit: "€ HT / entrée" },
      { key: "prix_attestation_maladie", label: "Attestation maladie", unit: "€ HT / attestation" },
      { key: "prix_bordereaux", label: "Bordereaux de charges", unit: "€ HT / bordereau" },
      { key: "prix_sylae", label: "Télétransmission SYLAE", unit: "€ HT / mois" },
    ],
  },
  {
    title: "Autres défauts",
    rows: [
      { key: "honoraires_juridique_defaut", label: "Honoraires juridiques annuels", unit: "€ HT / an" },
      { key: "forfait_constitution_defaut", label: "Forfait constitution société", unit: "€ HT" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  cabinetId: string | null;
}

export default function TarifsGrille({ cabinetId }: Props) {
  const [tarifs, setTarifs] = useState<TarifsDefaut>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ---- Load ----
  useEffect(() => {
    if (!cabinetId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("cabinets")
          .select("tarifs_defaut")
          .eq("id", cabinetId)
          .single();
        if (error) throw error;
        if (data?.tarifs_defaut) {
          setTarifs({ ...DEFAULTS, ...(data.tarifs_defaut as Partial<TarifsDefaut>) });
        }
      } catch (err) {
        logger.error("Failed to load tarifs", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [cabinetId]);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!cabinetId) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("cabinets")
        .update({ tarifs_defaut: tarifs } as any)
        .eq("id", cabinetId);
      if (error) throw error;
      setSaved(true);
      toast.success("Grille tarifaire enregistrée");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      logger.error("Failed to save tarifs", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [cabinetId, tarifs]);

  // ---- Update field ----
  const updateTarif = useCallback((key: keyof TarifsDefaut, val: string) => {
    const num = parseFloat(val);
    setTarifs(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  }, []);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card className="border-gray-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Euro className="w-4 h-4" />
          Grille tarifaire par défaut
        </CardTitle>
        <CardDescription>
          Ces tarifs sont utilisés comme valeurs par défaut lors de la création d'une lettre de mission. Ils restent modifiables au cas par cas pour chaque client.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {section.title}
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2 font-medium w-[45%]">Prestation</th>
                    <th className="text-left px-4 py-2 font-medium w-[25%]">Tarif</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[30%]">Unité</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">{row.label}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={tarifs[row.key]}
                          onChange={e => updateTarif(row.key, e.target.value)}
                          className="h-8 w-28"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? "Enregistré" : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
