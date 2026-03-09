import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { declarationsService, type DeclarationSoupconRecord } from "@/lib/gouvernanceService";
import { logsService } from "@/lib/supabaseService";
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
  AlertTriangle, Plus, Shield, ExternalLink,
  User, ChevronRight, ChevronLeft, Info, Archive, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

function formatDate(dateStr: string): string {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const DECISION_COLORS: Record<string, string> = {
  DECLARE: "bg-red-500/15 text-red-400",
  CLASSE: "bg-slate-500/15 text-slate-400",
  EN_ANALYSE: "bg-amber-500/15 text-amber-400",
};

const DECISION_LABELS: Record<string, string> = {
  DECLARE: "Declare",
  CLASSE: "Classe sans suite",
  EN_ANALYSE: "En analyse",
};

const STATUT_COLORS: Record<string, string> = {
  EN_COURS: "bg-amber-500/15 text-amber-400",
  TRANSMISE: "bg-emerald-500/15 text-emerald-400",
  CLASSEE: "bg-slate-500/15 text-slate-400",
};

export default function DeclarationsSoupcon() {
  const { collaborateurs, clients } = useAppState();
  const [declarations, setDeclarations] = useState<DeclarationSoupconRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newDs, setNewDs] = useState({
    client: "", elements_suspects: "", motif: "",
    decision: "EN_ANALYSE" as DeclarationSoupconRecord["decision"],
    justification: "", ref_tracfin: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await declarationsService.getAll();
      setDeclarations(data);
    } catch (err) {
      logger.error("DeclarationsSoupcon", "loadData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const abstentions = useMemo(() => declarations.filter(d => d.decision === "CLASSE"), [declarations]);

  const referentLcb = useMemo(() => collaborateurs.find(c => c.referentLcb), [collaborateurs]);

  const handleWizardFinish = useCallback(async () => {
    if (!newDs.client) {
      toast.error("Selectionnez un client");
      return;
    }
    if (newDs.decision === "CLASSE" && !newDs.justification) {
      toast.error("La justification est requise pour classer sans suite");
      return;
    }
    if (!newDs.elements_suspects) {
      toast.error("Decrivez les elements suspects");
      return;
    }
    setSaving(true);
    try {
      const ds: Omit<DeclarationSoupconRecord, "id"> & { id?: string } = {
        date_detection: new Date().toISOString().split("T")[0],
        client: newDs.client,
        motif: newDs.motif,
        decision: newDs.decision,
        justification: newDs.justification,
        ref_tracfin: newDs.ref_tracfin,
        statut: newDs.decision === "DECLARE" ? "EN_COURS" : "CLASSEE",
        elements_suspects: newDs.elements_suspects,
      };
      const created = await declarationsService.create(ds);
      if (created) {
        setDeclarations(prev => [created, ...prev]);
        const action = newDs.decision === "DECLARE" ? "DECLARATION_TRACFIN" : "ABSTENTION_DS";
        logsService.add(action, `${action} pour ${newDs.client}: ${newDs.motif}`, undefined, "declarations_soupcon").catch(() => {});
        toast.success(newDs.decision === "DECLARE"
          ? "Declaration de soupcon enregistree"
          : "Analyse classee sans suite"
        );
      }
      setNewDs({ client: "", elements_suspects: "", motif: "", decision: "EN_ANALYSE", justification: "", ref_tracfin: "" });
      setWizardStep(1);
      setShowWizard(false);
    } catch (err) {
      logger.error("DeclarationsSoupcon", "handleWizardFinish error:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }, [newDs]);

  const openWizard = () => {
    setWizardStep(1);
    setNewDs({ client: "", elements_suspects: "", motif: "", decision: "EN_ANALYSE", justification: "", ref_tracfin: "" });
    setShowWizard(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Registre */}
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
                      <TableCell className="text-sm">{formatDate(ds.date_detection)}</TableCell>
                      <TableCell className="text-sm font-medium">{ds.client}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{ds.motif || "---"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${DECISION_COLORS[ds.decision] || ""}`}>
                          {DECISION_LABELS[ds.decision] || ds.decision}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{ds.ref_tracfin || "---"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUT_COLORS[ds.statut] || ""}`}>
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

      {/* Procedure */}
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
                { step: "1", title: "Ne pas alerter le client", desc: "Le secret de la declaration est absolu." },
                { step: "2", title: "Rassembler les elements", desc: "Documenter tous les elements factuels." },
                { step: "3", title: "Informer le referent LCB", desc: "Le referent analyse et prend la decision." },
                { step: "4", title: "Declarer sur ERMES", desc: "Effectuer la declaration sur ERMES." },
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
                  {referentLcb.email && <span className="text-xs">({referentLcb.email})</span>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abstentions */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-400" />
            Registre des abstentions
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Situations analysees mais classees sans declaration
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
                      <span className="text-xs text-slate-500">{formatDate(a.date_detection)}</span>
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

      {/* Wizard */}
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
          <div className="flex gap-1 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= wizardStep ? "bg-blue-500" : "bg-slate-700"}`} />
            ))}
          </div>

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
                <Input value={newDs.motif} onChange={e => setNewDs(p => ({ ...p, motif: e.target.value }))} placeholder="Ex: Operation atypique..." />
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Elements suspects *</Label>
                <Textarea value={newDs.elements_suspects} onChange={e => setNewDs(p => ({ ...p, elements_suspects: e.target.value }))} rows={6}
                  placeholder="Decrivez les elements factuels..." />
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Decision *</Label>
                <Select value={newDs.decision} onValueChange={v => setNewDs(p => ({ ...p, decision: v as DeclarationSoupconRecord["decision"] }))}>
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
                  <Input value={newDs.ref_tracfin} onChange={e => setNewDs(p => ({ ...p, ref_tracfin: e.target.value }))} />
                </div>
              )}
              {newDs.decision === "CLASSE" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Justification du classement *</Label>
                  <Textarea value={newDs.justification} onChange={e => setNewDs(p => ({ ...p, justification: e.target.value }))} rows={4}
                    placeholder="Expliquez pourquoi vous avez decide de ne pas declarer..." />
                </div>
              )}
              {newDs.decision === "DECLARE" && (
                <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                  <strong>Rappel :</strong> La declaration doit etre effectuee sur ERMES. Ne communiquez jamais au client l'existence de cette declaration.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => wizardStep > 1 ? setWizardStep(s => s - 1) : setShowWizard(false)} className="gap-1.5" disabled={saving}>
              <ChevronLeft className="w-3.5 h-3.5" />
              {wizardStep === 1 ? "Annuler" : "Precedent"}
            </Button>
            {wizardStep < 3 ? (
              <Button onClick={() => {
                if (wizardStep === 1 && !newDs.client) { toast.error("Selectionnez un client"); return; }
                if (wizardStep === 2 && !newDs.elements_suspects) { toast.error("Decrivez les elements suspects"); return; }
                setWizardStep(s => s + 1);
              }} className="gap-1.5">
                Suivant <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button onClick={handleWizardFinish} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                Valider
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
