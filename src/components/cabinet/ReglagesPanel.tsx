import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings2, Eye, CheckSquare, RefreshCcw, FileWarning, Globe } from "lucide-react";

interface Reglages {
  id: string;
  cabinet_id: string;
  restreindre_visibilite_affectations: boolean;
  restreindre_visibilite_cabinet: boolean;
  restreindre_validation_responsables: boolean;
  limiter_exports_auteur: boolean;
  limiter_notifications_affectes: boolean;
  bloquer_demandes_validation_incompletes: boolean;
  bloquer_validations_incompletes: boolean;
  generation_auto_maintiens: boolean;
  documents_expires_manquants: boolean;
  mises_a_jour_externes: boolean;
  delai_suspension_jours: number;
}

interface ToggleConfig {
  key: keyof Reglages;
  label: string;
  description: string;
}

const SECTIONS: { title: string; icon: React.ReactNode; toggles: ToggleConfig[] }[] = [
  {
    title: "Affectations & Visibilite",
    icon: <Eye className="h-4 w-4 text-blue-400" />,
    toggles: [
      { key: "restreindre_visibilite_affectations", label: "Restreindre la visibilite aux affectations", description: "Les collaborateurs ne voient que les dossiers qui leur sont affectes" },
      { key: "restreindre_visibilite_cabinet", label: "Restreindre la visibilite au cabinet", description: "Les collaborateurs ne voient que les dossiers de leur cabinet (en multi-cabinet)" },
      { key: "restreindre_validation_responsables", label: "Restreindre la validation aux responsables", description: "Seuls les responsables de dossier peuvent valider les fiches" },
      { key: "limiter_exports_auteur", label: "Limiter les exports a l'auteur", description: "Seul l'auteur d'un document peut l'exporter" },
    ],
  },
  {
    title: "Demandes de validation",
    icon: <CheckSquare className="h-4 w-4 text-emerald-400" />,
    toggles: [
      { key: "bloquer_demandes_validation_incompletes", label: "Bloquer les demandes de validation incompletes", description: "Empeche l'envoi d'une demande de validation si tous les champs obligatoires ne sont pas remplis" },
      { key: "bloquer_validations_incompletes", label: "Bloquer les validations incompletes", description: "Empeche la validation si les documents requis ne sont pas tous presents" },
      { key: "limiter_notifications_affectes", label: "Limiter les notifications aux collaborateurs affectes", description: "Seuls les collaborateurs affectes a un dossier recoivent les notifications" },
    ],
  },
  {
    title: "Maintiens de mission",
    icon: <RefreshCcw className="h-4 w-4 text-amber-400" />,
    toggles: [
      { key: "generation_auto_maintiens", label: "Generation automatique des maintiens", description: "Genere automatiquement les lettres de maintien a echeance" },
    ],
  },
  {
    title: "Donnees importantes",
    icon: <FileWarning className="h-4 w-4 text-red-400" />,
    toggles: [
      { key: "documents_expires_manquants", label: "Alertes documents expires ou manquants", description: "Envoie des alertes quand des documents KYC arrivent a expiration ou sont manquants" },
    ],
  },
  {
    title: "Mises a jour externes",
    icon: <Globe className="h-4 w-4 text-purple-400" />,
    toggles: [
      { key: "mises_a_jour_externes", label: "Mises a jour automatiques via APIs", description: "Actualise automatiquement les donnees via INPI, Pappers, sanctions et autres connecteurs" },
    ],
  },
];

export default function ReglagesPanel() {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReglages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_reglages")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      setReglages(data as Reglages);
    } catch {
      toast.error("Erreur lors du chargement des reglages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReglages(); }, [loadReglages]);

  const updateToggle = async (key: keyof Reglages, value: boolean) => {
    if (!reglages) return;
    const prev = reglages[key];
    setReglages({ ...reglages, [key]: value });

    const { error } = await supabase
      .from("cabinet_reglages")
      .update({ [key]: value })
      .eq("id", reglages.id);

    if (error) {
      setReglages({ ...reglages, [key]: prev });
      toast.error("Erreur lors de la mise a jour");
      return;
    }
    toast.success("Reglage mis a jour");
  };

  const updateDelai = async (value: number) => {
    if (!reglages) return;
    setReglages({ ...reglages, delai_suspension_jours: value });

    const { error } = await supabase
      .from("cabinet_reglages")
      .update({ delai_suspension_jours: value })
      .eq("id", reglages.id);

    if (error) {
      toast.error("Erreur lors de la mise a jour");
      return;
    }
    toast.success("Delai mis a jour");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!reglages) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aucun reglage configure pour ce cabinet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-blue-400" /> Reglages du cabinet
        </h2>
        <p className="text-sm text-slate-400">Configurez le comportement de votre cabinet. Les modifications sont appliquees immediatement.</p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
            {section.icon} {section.title}
          </h3>
          <div className="space-y-1">
            {section.toggles.map((toggle) => (
              <div
                key={toggle.key}
                className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.04]"
              >
                <div className="space-y-0.5 flex-1 mr-4">
                  <Label className="text-sm font-medium text-slate-200 cursor-pointer">{toggle.label}</Label>
                  <p className="text-xs text-slate-500">{toggle.description}</p>
                </div>
                <Switch
                  checked={reglages[toggle.key] as boolean}
                  onCheckedChange={(checked) => updateToggle(toggle.key, checked)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Delai suspension */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Suspension</h3>
        <div className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-white/[0.02] transition-colors">
          <div className="space-y-0.5 flex-1 mr-4">
            <Label className="text-sm font-medium text-slate-200">Delai de suspension automatique</Label>
            <p className="text-xs text-slate-500">Nombre de jours d'inactivite avant suspension automatique d'un dossier</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={30}
              max={365}
              value={reglages.delai_suspension_jours}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 30 && v <= 365) updateDelai(v);
              }}
              className="w-20 bg-white/[0.03] border-white/[0.08] text-center"
            />
            <span className="text-sm text-slate-500">jours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
