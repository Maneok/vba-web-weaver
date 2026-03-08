import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { getDefaultTemplate } from "@/lib/lettreMissionEngine";
import type { CabinetConfig } from "@/types/lettreMission";
import LettreMissionPreview from "@/components/lettre-mission/LettreMissionPreview";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const DEFAULT_CABINET: CabinetConfig = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
  couleurPrimaire: "#1E3A5F",
  couleurSecondaire: "#3B82F6",
  police: "system-ui",
};

export default function LettreMissionPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();

  const client = useMemo(
    () => clients.find((c) => c.ref === ref),
    [clients, ref]
  );

  const template = useMemo(() => getDefaultTemplate(), []);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <p>Client introuvable (réf. {ref})</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-white/10 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/client/${client.ref}`)}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour fiche client
        </Button>
        <div className="text-sm text-slate-300">
          Lettre de mission — <span className="font-semibold text-white">{client.raisonSociale}</span>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-hidden">
        <LettreMissionPreview
          client={client}
          template={template}
          cabinetConfig={DEFAULT_CABINET}
        />
      </div>
    </div>
  );
}
