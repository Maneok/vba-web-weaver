import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, Plus, Shield, FileText, ExternalLink,
  Phone, User, ChevronRight, ChevronLeft, Info, Archive,
} from "lucide-react";
import { toast } from "sonner";

interface DeclarationSoupcon {
  id: string;
  dateDetection: string;
  client: string;
  motif: string;
  decision: "DECLARE" | "CLASSE" | "EN_ANALYSE";
  justification: string;
  refTracfin: string;
  statut: "EN_COURS" | "TRANSMISE" | "CLASSEE";
  elementsSuspects: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const DECISION_COLORS = {
  DECLARE: "bg-red-500/15 text-red-400",
  CLASSE: "bg-slate-500/15 text-slate-400",
  EN_ANALYSE: "bg-amber-500/15 text-amber-400",
};

const DECISION_LABELS = {
  DECLARE: "Declare",
  CLASSE: "Classe sans suite",
  EN_ANALYSE: "En analyse",
};

const STATUT_COLORS = {
  EN_COURS: "bg-amber-500/15 text-amber-400",
  TRANSMISE: "bg-emerald-500/15 text-emerald-400",
  CLASSEE: "bg-slate-500/15 text-slate-400",
};

const DS_STORAGE_KEY = "lcb-declarations-soupcon";

function loadDeclarations(): DeclarationSoupcon[] {
  try {
    const stored = localStorage.getItem(DS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

export default function DeclarationsSoupcon() {
  const { collaborateurs, clients } = useAppState();
  const [declarations, setDeclarations] = useState<DeclarationSoupcon[]>(loadDeclarations);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newDs, setNewDs] = useState({
    client: "", elementsSuspects: "", motif: "",
    decision: "EN_ANALYSE" as const, justification: "", refTracfin: "",
  });

  // Persist declarations to localStorage
  useEffect(() => {
    try { localStorage.setItem(DS_STORAGE_KEY, JSON.stringify(declarations)); } catch { /* storage full */ }
  }, [declarations]);

  // Registre des abstentions (classes sans suite)
  const abstentions = useMemo(() =>
    declarations.filter(d => d.decision === "CLASSE"),
    [declarations]
  );

  const declarees = useMemo(() =>
    declarations.filter(d => d.decision === "DECLARE"),
    [declarations]
  );

  // Referent LCB info
  const referentLcb = useMemo(() =>
    collaborateurs.find(c => c.referentLcb),
    [collaborateurs]
  );

  const handleWizardFinish = useCallback(() => {
    if (!newDs.client) {
      toast.error("Selectionnez un client");
      return;
    }
    const ds: DeclarationSoupcon = {
      id: `ds-${Date.now()}`,
      dateDetection: new Date().toISOString().split("T")[0],
      client: newDs.client,
      motif: newDs.motif,
      decision: newDs.decision,
      justification: newDs.justification,
      refTracfin: newDs.refTracfin,
      statut: newDs.decision === "DECLARE" ? "EN_COURS" : "CLASSEE",
      elementsSuspects: newDs.elementsSuspects,
    };
    setDeclarations(prev => [ds, ...prev]);
    setNewDs({ client: "", elementsSuspects: "", motif: "", decision: "EN_ANALYSE", justification: "", refTracfin: "" });
    setWizardStep(1);
    setShowWizard(false);
    toast.success(newDs.decision === "DECLARE"
      ? "Declaration de soupcon enregistree"
      : "Analyse classee sans suite"
    );
  }, [newDs]);

  const openWizard = () => {
    setWizardStep(1);
    setNewDs({ client: "", elementsSuspects: "", motif: "", decision: "EN_ANALYSE", justification: "", refTracfin: "" });
    setShowWizard(true);
  };

  return (
    <div className="space-y-6">
      {/* Registre des declarations */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Registre des declarations de soupcon
          </CardTitle>
          <Button size="sm" onClick={openWizard} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nouvelle analyse
          </Button>
        </CardHeader>
        <CardContent>
          {declarations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucune declaration de soupcon enregistree.</p>
              <p className="text-xs mt-1 max-w-md mx-auto">
                C'est normal si vous n'avez pas detecte de situation suspecte.
                En cas de doute, utilisez le bouton "Nouvelle analyse" pour documenter votre reflexion.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date detection</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Ref. TRACFIN</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {declarations.map(ds => (
                    <TableRow key={ds.id}>
                      <TableCell className="text-sm">{formatDate(ds.dateDetection)}</TableCell>
                      <TableCell className="text-sm font-medium">{ds.client}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{ds.motif || "---"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${DECISION_COLORS[ds.decision]}`}>
                          {DECISION_LABELS[ds.decision]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{ds.refTracfin || "---"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUT_COLORS[ds.statut]}`}>
                          {ds.statut === "EN_COURS" ? "En cours" : ds.statut === "TRANSMISE" ? "Transmise" : "Classee"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Procedure de declaration */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            Procedure de declaration de soupcon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { step: "1", title: "Ne pas alerter le client", desc: "Le secret de la declaration est absolu. Ne jamais informer le client de vos soupcons." },
                { step: "2", title: "Rassembler les elements", desc: "Documenter tous les elements factuels qui motivent le soupcon." },
                { step: "3", title: "Informer le referent LCB", desc: "Le referent LCB-FT analyse la situation et prend la decision." },
                { step: "4", title: "Declarer sur ERMES", desc: "Effectuer la declaration sur la plateforme ERMES de TRACFIN." },
              ].map(item => (
                <div key={item.step} className="p-3 rounded-md bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </div>
                    <span className="text-sm font-medium">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href="https://www.ermes.finances.gouv.fr" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> Plateforme ERMES
                </a>
              </Button>
              {referentLcb && (
                <div className="flex items-center gap-2 text-sm text-slate-400 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                  <User className="w-3.5 h-3.5" />
                  Correspondant TRACFIN : <strong className="text-slate-300">{referentLcb.nom}</strong>
                  {referentLcb.email && (
                    <span className="text-xs">({referentLcb.email})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registre des abstentions */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-400" />
            Registre des abstentions
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Situations analysees mais classees sans declaration — chaque abstention est documentee avec sa justification
          </p>
        </CardHeader>
        <CardContent>
          {abstentions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucune abstention enregistree</p>
          ) : (
            <div className="space-y-2">
              {abstentions.map(a => (
                <div key={a.id} className="p-3 rounded-md bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{a.client}</span>
                      <span className="text-xs text-slate-500">{formatDate(a.dateDetection)}</span>
                    </div>
                    <Badge className="bg-slate-500/15 text-slate-400 text-xs">Classe sans suite</Badge>
                  </div>
                  {a.motif && <p className="text-xs text-slate-400 mt-1">Motif : {a.motif}</p>}
                  {a.justification && <p className="text-xs text-slate-500 mt-1">Justification : {a.justification}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard 3 etapes */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Nouvelle analyse — Etape {wizardStep}/3
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Selectionnez le client concerne"}
              {wizardStep === 2 && "Decrivez les elements suspects"}
              {wizardStep === 3 && "Prenez votre decision"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="flex gap-1 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= wizardStep ? "bg-blue-500" : "bg-slate-700"}`} />
            ))}
          </div>

          {/* Step 1 : Client */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Client concerne *</Label>
                <Select value={newDs.client} onValueChange={v => setNewDs(p => ({ ...p, client: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner un client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.ref} value={`${c.raisonSociale} (${c.ref})`}>
                        {c.raisonSociale} ({c.ref})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Motif de l'analyse</Label>
                <Input value={newDs.motif} onChange={e => setNewDs(p => ({ ...p, motif: e.target.value }))} placeholder="Ex: Operation atypique, comportement suspect..." />
              </div>
            </div>
          )}

          {/* Step 2 : Elements suspects */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Elements suspects *</Label>
                <Textarea
                  value={newDs.elementsSuspects}
                  onChange={e => setNewDs(p => ({ ...p, elementsSuspects: e.target.value }))}
                  rows={6}
                  placeholder="Decrivez les elements factuels qui motivent cette analyse...&#10;&#10;Ex:&#10;- Mouvement de tresorerie inhabituel de XX EUR&#10;- Incoherence entre l'activite declaree et les flux&#10;- Changement brutal de comportement"
                />
              </div>
            </div>
          )}

          {/* Step 3 : Decision */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Decision *</Label>
                <Select value={newDs.decision} onValueChange={v => setNewDs(p => ({ ...p, decision: v as DeclarationSoupcon["decision"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DECLARE">Declarer a TRACFIN</SelectItem>
                    <SelectItem value="CLASSE">Classer sans suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newDs.decision === "DECLARE" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Reference TRACFIN (si connue)</Label>
                  <Input value={newDs.refTracfin} onChange={e => setNewDs(p => ({ ...p, refTracfin: e.target.value }))} placeholder="Numero de declaration" />
                </div>
              )}
              {newDs.decision === "CLASSE" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Justification du classement *</Label>
                  <Textarea
                    value={newDs.justification}
                    onChange={e => setNewDs(p => ({ ...p, justification: e.target.value }))}
                    rows={4}
                    placeholder="Expliquez pourquoi vous avez decide de ne pas declarer..."
                  />
                </div>
              )}
              {newDs.decision === "DECLARE" && (
                <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                  <strong>Rappel :</strong> La declaration doit etre effectuee sur la plateforme ERMES.
                  Ne communiquez jamais au client l'existence de cette declaration.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => wizardStep > 1 ? setWizardStep(s => s - 1) : setShowWizard(false)} className="gap-1.5">
              <ChevronLeft className="w-3.5 h-3.5" />
              {wizardStep === 1 ? "Annuler" : "Precedent"}
            </Button>
            {wizardStep < 3 ? (
              <Button onClick={() => setWizardStep(s => s + 1)} className="gap-1.5">
                Suivant <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button onClick={handleWizardFinish} className="gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Valider
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
