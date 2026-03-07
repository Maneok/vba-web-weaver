import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Separator } from "@/components/ui/separator";
import type { Client } from "@/lib/types";
import { ExternalLink, User, Building, MapPin, Phone, Mail, Calendar, AlertTriangle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";

interface Props {
  client: Client;
  open: boolean;
  onClose: () => void;
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ClientDetailDialog({ client, open, onClose }: Props) {
  const maluses = [
    client.ppe === "OUI" && "⛔ PPE",
    client.atypique === "OUI" && "⛔ Montage atypique",
    client.paysRisque === "OUI" && "⛔ Pays à risque",
    client.cash === "OUI" && "💰 Espèces",
    client.pression === "OUI" && "⚠️ Pression client",
    client.distanciel === "OUI" && "🌐 Distanciel",
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{client.raisonSociale}</DialogTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">{client.ref} · SIREN {client.siren}</p>
            </div>
            <div className="flex gap-2 items-center">
              <ScoreGauge score={client.scoreGlobal} />
              <VigilanceBadge level={client.nivVigilance} />
            </div>
          </div>
        </DialogHeader>

        {/* Alertes / Malus */}
        {maluses.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex flex-wrap gap-2">
            {maluses.map((m, i) => (
              <span key={i} className="text-xs font-medium bg-destructive/10 px-2 py-1 rounded">{m}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Identité</h3>
            <InfoRow label="Dirigeant" value={client.dirigeant} icon={User} />
            <InfoRow label="Forme juridique" value={client.forme} icon={Building} />
            <InfoRow label="Activité" value={`${client.domaine} (${client.ape})`} />
            <InfoRow label="Adresse" value={`${client.adresse}, ${client.cp} ${client.ville}`} icon={MapPin} />
            <InfoRow label="Téléphone" value={client.tel} icon={Phone} />
            <InfoRow label="Email" value={client.mail} icon={Mail} />
            <InfoRow label="Capital" value={`${client.capital.toLocaleString()} €`} />
            <InfoRow label="Effectif" value={client.effectif} />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Mission & Suivi</h3>
            <InfoRow label="Mission" value={client.mission} />
            <InfoRow label="Comptable" value={client.comptable} />
            <InfoRow label="Associé" value={client.associe} />
            <InfoRow label="Superviseur" value={client.superviseur} />
            <InfoRow label="Honoraires" value={`${client.honoraires.toLocaleString()} €`} />
            <InfoRow label="Fréquence" value={client.frequence} />
            <InfoRow label="Date reprise" value={client.dateReprise} icon={Calendar} />
            <InfoRow label="IBAN" value={client.iban} />
          </div>
        </div>

        <Separator />

        {/* Scoring breakdown */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Décomposition du Score</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Activité", score: client.scoreActivite },
              { label: "Pays", score: client.scorePays },
              { label: "Mission", score: client.scoreMission },
              { label: "Maturité", score: client.scoreMaturite },
              { label: "Structure", score: client.scoreStructure },
            ].map(item => (
              <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                <p className="text-lg font-bold font-mono">{item.score}</p>
              </div>
            ))}
          </div>
          {client.malus > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="font-medium">Malus total : +{client.malus} points</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Pilotage */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Dernière revue</p>
            <p className="text-sm font-medium">{client.dateDerniereRevue}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Date butoir</p>
            <p className="text-sm font-medium">{client.dateButoir}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Pilotage</p>
            <PilotageBadge status={client.etatPilotage} />
          </div>
        </div>

        {/* Bénéficiaires effectifs */}
        {client.be && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Bénéficiaires Effectifs</h3>
            <p className="text-sm">{client.be}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => generateFicheAcceptation(client)}
          >
            <FileDown className="w-4 h-4" />
            Télécharger la fiche LCB-FT (PDF)
          </Button>
          <a
            href={`https://www.pappers.fr/recherche?q=${client.siren.replace(/\s/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Consulter sur Pappers
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
