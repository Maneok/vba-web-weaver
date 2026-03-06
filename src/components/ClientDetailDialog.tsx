import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/types";
import { ExternalLink, User, Building, MapPin, Phone, Mail, Calendar, AlertTriangle, FileDown, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFicheAcceptation, generateLettreMission, generateRapportControle } from "@/lib/generateFichePdf";
import RadarScoreChart, { ScoreHistoryChart } from "@/components/RadarScoreChart";
import DocumentManager from "@/components/DocumentManager";
import KycBadge from "@/components/KycBadge";
import { useAppState } from "@/lib/AppContext";
import { calculateRiskScore } from "@/lib/riskEngine";

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
  const { updateClient } = useAppState();
  const [simMode, setSimMode] = useState(false);
  const [simOverrides, setSimOverrides] = useState({
    ppe: client.ppe === "OUI",
    paysRisque: client.paysRisque === "OUI",
    atypique: client.atypique === "OUI",
    distanciel: client.distanciel === "OUI",
    cash: client.cash === "OUI",
    pression: client.pression === "OUI",
  });

  const simRisk = simMode ? calculateRiskScore({
    ape: client.ape,
    paysRisque: simOverrides.paysRisque,
    mission: client.mission,
    dateCreation: client.dateCreation,
    dateReprise: client.dateReprise,
    effectif: client.effectif,
    forme: client.forme,
    ppe: simOverrides.ppe,
    atypique: simOverrides.atypique,
    distanciel: simOverrides.distanciel,
    cash: simOverrides.cash,
    pression: simOverrides.pression,
  }) : null;

  const maluses = [
    client.ppe === "OUI" && "PPE",
    client.atypique === "OUI" && "Montage atypique",
    client.paysRisque === "OUI" && "Pays à risque",
    client.cash === "OUI" && "Espèces",
    client.pression === "OUI" && "Pression client",
    client.distanciel === "OUI" && "Distanciel",
  ].filter(Boolean);

  const handleDocumentsChange = (docs: any[]) => {
    updateClient(client.ref, { documents: docs });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg flex items-center gap-3">
                {client.raisonSociale}
                <KycBadge completeness={client.kycCompleteness ?? 0} size="sm" />
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {client.ref} · SIREN {client.siren}
                {client.gelAvoirs === "CLEAN" && <span className="ml-2 text-green-600">DG Trésor: CLEAN</span>}
                {client.gelAvoirs === "FLAGGED" && <span className="ml-2 text-red-600">DG Trésor: SIGNALÉ</span>}
              </p>
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

        <Tabs defaultValue="identite">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="identite">Identité</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* IDENTITÉ */}
          <TabsContent value="identite" className="space-y-4">
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

            {client.be && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Bénéficiaires Effectifs</h3>
                <p className="text-sm">{client.be}</p>
              </div>
            )}

            {client.ppeDetails && (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                PPE: {client.ppeDetails}
              </div>
            )}
          </TabsContent>

          {/* SCORING */}
          <TabsContent value="scoring" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Radar des 6 axes</h3>
                <RadarScoreChart
                  scores={{
                    scoreActivite: client.scoreActivite,
                    scorePays: client.scorePays,
                    scoreMission: client.scoreMission,
                    scoreMaturite: client.scoreMaturite,
                    scoreStructure: client.scoreStructure,
                    malus: client.malus,
                  }}
                  compareScores={simRisk ? {
                    scoreActivite: simRisk.scoreActivite,
                    scorePays: simRisk.scorePays,
                    scoreMission: simRisk.scoreMission,
                    scoreMaturite: simRisk.scoreMaturite,
                    scoreStructure: simRisk.scoreStructure,
                    malus: simRisk.malus,
                  } : undefined}
                  height={250}
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Activité", score: client.scoreActivite },
                    { label: "Pays", score: client.scorePays },
                    { label: "Mission", score: client.scoreMission },
                    { label: "Maturité", score: client.scoreMaturite },
                    { label: "Structure", score: client.scoreStructure },
                    { label: "Malus", score: client.malus },
                  ].map(item => (
                    <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                      <p className="text-lg font-bold font-mono">{item.score}</p>
                    </div>
                  ))}
                </div>

                {/* Simulation */}
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={simMode} onCheckedChange={setSimMode} />
                    <Label className="text-xs font-bold">Mode Simulation</Label>
                  </div>
                  {simMode && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(["ppe", "paysRisque", "atypique", "cash", "distanciel", "pression"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <Switch
                              checked={simOverrides[key]}
                              onCheckedChange={v => setSimOverrides(p => ({ ...p, [key]: v }))}
                            />
                            <span>{key}</span>
                          </div>
                        ))}
                      </div>
                      {simRisk && (
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <span className="text-sm">Actuel: <strong>{client.scoreGlobal}</strong></span>
                          <span className="text-muted-foreground">→</span>
                          <span className={`text-sm font-bold ${simRisk.scoreGlobal > client.scoreGlobal ? "text-red-600" : "text-green-600"}`}>
                            Simulé: {simRisk.scoreGlobal} ({simRisk.nivVigilance})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* DOCUMENTS (GED) */}
          <TabsContent value="documents">
            <DocumentManager
              documents={client.documents || []}
              onDocumentsChange={handleDocumentsChange}
              clientRef={client.ref}
            />
          </TabsContent>

          {/* HISTORIQUE */}
          <TabsContent value="historique">
            <ScoreHistoryChart history={client.scoreHistory || []} />
          </TabsContent>

          {/* ACTIONS */}
          <TabsContent value="actions" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2 justify-start" onClick={() => generateFicheAcceptation(client)}>
                <FileDown className="w-4 h-4" />
                Fiche LCB-FT (PDF)
              </Button>
              <Button variant="outline" className="gap-2 justify-start" onClick={() => generateLettreMission(client)}>
                <FileText className="w-4 h-4" />
                Lettre de Mission (PDF)
              </Button>
              <Button variant="outline" className="gap-2 justify-start" onClick={() => generateRapportControle(client)}>
                <FileText className="w-4 h-4" />
                Rapport de Contrôle (PDF)
              </Button>
              <a
                href={`https://www.pappers.fr/recherche?q=${encodeURIComponent(client.siren.replace(/\s/g, ""))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline border rounded-md px-4 py-2"
              >
                <ExternalLink className="w-4 h-4" />
                Consulter sur Pappers
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
