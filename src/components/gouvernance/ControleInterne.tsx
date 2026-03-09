import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import {
  nonConformitesService, controlesPlanifiesService, croecService,
  type NonConformiteRecord, type ControlePlanifie, type ControleCROECRecord,
} from "@/lib/gouvernanceService";
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
  ClipboardCheck, Plus, Calendar, AlertTriangle,
  Shuffle, Clock, FileText, Search, Filter, Loader2,
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

const GRAVITE_COLORS: Record<string, string> = {
  MINEURE: "bg-amber-500/15 text-amber-400",
  MAJEURE: "bg-orange-500/15 text-orange-400",
  CRITIQUE: "bg-red-500/15 text-red-400",
};

const STATUT_NC_COLORS: Record<string, string> = {
  OUVERTE: "bg-red-500/15 text-red-400",
  EN_COURS: "bg-amber-500/15 text-amber-400",
  RESOLUE: "bg-emerald-500/15 text-emerald-400",
};

const RESULTAT_COLORS: Record<string, string> = {
  CONFORME: "bg-emerald-500/15 text-emerald-400",
  AVEC_RESERVES: "bg-amber-500/15 text-amber-400",
  NON_CONFORME: "bg-red-500/15 text-red-400",
};

const RESULTAT_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  AVEC_RESERVES: "Avec reserves",
  NON_CONFORME: "Non conforme",
};

/**
 * Weighted random selection of clients for internal control.
 * Uses Fisher-Yates-based weighted sampling to avoid infinite loops.
 */
export function tirageAleatoire(
  clients: Array<{ ref: string; raisonSociale: string; scoreGlobal: number }>,
  count: number
): string[] {
  if (clients.length === 0) return [];
  const n = Math.min(count, clients.length);
  const pool = clients.map(c => ({
    label: `${c.raisonSociale} (${c.ref})`,
    weight: Math.max(1, c.scoreGlobal || 1),
  }));
  const selected: string[] = [];

  for (let i = 0; i < n; i++) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    if (totalWeight <= 0) break;
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) {
        idx = j;
        break;
      }
    }
    selected.push(pool[idx].label);
    pool.splice(idx, 1);
  }
  return selected;
}

export default function ControleInterne() {
  const { collaborateurs, clients } = useAppState();

  const [nonConformites, setNonConformites] = useState<NonConformiteRecord[]>([]);
  const [controlesPrevus, setControlesPrevus] = useState<ControlePlanifie[]>([]);
  const [controlesCROEC, setControlesCROEC] = useState<ControleCROECRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNcDialog, setShowNcDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showCroecDialog, setShowCroecDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ncFilter, setNcFilter] = useState<string>("all");
  const [ncSearch, setNcSearch] = useState("");

  const [newNc, setNewNc] = useState({
    source: "", client: "", description: "", gravite: "MINEURE" as NonConformiteRecord["gravite"],
    action_corrective: "", responsable: "", echeance: "",
  });
  const [newControle, setNewControle] = useState({ date: "", controleur: "", nbDossiers: 3 });
  const [newCroec, setNewCroec] = useState({
    date: "", type: "Controle qualite", resultat: "CONFORME" as ControleCROECRecord["resultat"], notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ncs, ctrls, croecs] = await Promise.all([
        nonConformitesService.getAll(),
        controlesPlanifiesService.getAll(),
        croecService.getAll(),
      ]);
      setNonConformites(ncs);
      setControlesPrevus(ctrls);
      setControlesCROEC(croecs);
    } catch (err) {
      logger.error("ControleInterne", "loadData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const ouvertes = nonConformites.filter(nc => nc.statut === "OUVERTE").length;
    const trimestre = new Date();
    trimestre.setMonth(trimestre.getMonth() - 3);
    const resoluesTrimestre = nonConformites.filter(nc =>
      nc.statut === "RESOLUE" && nc.date && new Date(nc.date) >= trimestre
    ).length;
    return { ouvertes, resoluesTrimestre };
  }, [nonConformites]);

  const filteredNcs = useMemo(() => {
    let result = nonConformites;
    if (ncFilter !== "all") result = result.filter(nc => nc.statut === ncFilter);
    if (ncSearch) {
      const q = ncSearch.toLowerCase();
      result = result.filter(nc =>
        nc.client.toLowerCase().includes(q) || nc.description.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [nonConformites, ncFilter, ncSearch]);

  const handleTirageAleatoire = useCallback(async () => {
    if (clients.length === 0) {
      toast.error("Aucun client disponible");
      return;
    }
    const selected = tirageAleatoire(clients, newControle.nbDossiers);
    if (selected.length === 0) {
      toast.error("Impossible de selectionner des dossiers");
      return;
    }
    setSaving(true);
    try {
      const ctrl: Omit<ControlePlanifie, "id"> & { id?: string } = {
        date: newControle.date || new Date().toISOString().split("T")[0],
        controleur: newControle.controleur,
        dossiers: selected,
        statut: "PLANIFIE",
      };
      const created = await controlesPlanifiesService.create(ctrl);
      if (created) {
        setControlesPrevus(prev => [created, ...prev]);
        toast.success(`Controle planifie avec ${selected.length} dossier(s)`);
        logsService.add("PLAN_CONTROLE", `Controle planifie: ${selected.length} dossiers`, undefined, "controles_planifies").catch(() => {});
      }
      setShowPlanDialog(false);
      setNewControle({ date: "", controleur: "", nbDossiers: 3 });
    } catch (err) {
      logger.error("ControleInterne", "handleTirageAleatoire error:", err);
      toast.error("Erreur lors de la planification");
    } finally {
      setSaving(false);
    }
  }, [clients, newControle]);

  const handleAddNc = useCallback(async () => {
    if (!newNc.description) {
      toast.error("La description est requise");
      return;
    }
    setSaving(true);
    try {
      const nc: Omit<NonConformiteRecord, "id"> & { id?: string } = {
        ...newNc,
        date: new Date().toISOString().split("T")[0],
        statut: "OUVERTE",
      };
      const created = await nonConformitesService.create(nc);
      if (created) {
        setNonConformites(prev => [created, ...prev]);
        toast.success("Non-conformite enregistree");
        logsService.add("ADD_NC", `Non-conformite: ${newNc.description.slice(0, 50)}`, undefined, "non_conformites").catch(() => {});
      }
      setNewNc({ source: "", client: "", description: "", gravite: "MINEURE", action_corrective: "", responsable: "", echeance: "" });
      setShowNcDialog(false);
    } catch (err) {
      logger.error("ControleInterne", "handleAddNc error:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }, [newNc]);

  const handleNcStatutChange = useCallback(async (id: string, statut: NonConformiteRecord["statut"]) => {
    try {
      await nonConformitesService.update(id, { statut });
      setNonConformites(prev => prev.map(nc => nc.id === id ? { ...nc, statut } : nc));
    } catch (err) {
      logger.error("ControleInterne", "handleNcStatutChange error:", err);
      toast.error("Erreur lors de la mise a jour");
    }
  }, []);

  const handleAddCroec = useCallback(async () => {
    if (!newCroec.date) {
      toast.error("La date est requise");
      return;
    }
    setSaving(true);
    try {
      const c: Omit<ControleCROECRecord, "id"> & { id?: string } = {
        ...newCroec,
        rapport_url: "",
      };
      const created = await croecService.create(c);
      if (created) {
        setControlesCROEC(prev => [created, ...prev]);
        toast.success("Controle CROEC enregistre");
        logsService.add("ADD_CROEC", `Controle CROEC du ${newCroec.date}`, undefined, "controles_croec").catch(() => {});
      }
      setNewCroec({ date: "", type: "Controle qualite", resultat: "CONFORME", notes: "" });
      setShowCroecDialog(false);
    } catch (err) {
      logger.error("ControleInterne", "handleAddCroec error:", err);
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  }, [newCroec]);

  // Estimate next CROEC based on last one
  const nextCroecEstimate = useMemo(() => {
    if (controlesCROEC.length === 0) return null;
    const sorted = [...controlesCROEC].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const lastDate = new Date(sorted[0].date);
    if (isNaN(lastDate.getTime())) return null;
    lastDate.setFullYear(lastDate.getFullYear() + 3);
    return lastDate.getFullYear().toString();
  }, [controlesCROEC]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Planification */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Planification des controles
          </CardTitle>
          <Button size="sm" onClick={() => setShowPlanDialog(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Planifier un controle
          </Button>
        </CardHeader>
        <CardContent>
          {controlesPrevus.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun controle planifie</p>
            </div>
          ) : (
            <div className="space-y-3">
              {controlesPrevus.map(ctrl => (
                <div key={ctrl.id} className="p-3 rounded-md bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium">{formatDate(ctrl.date)}</span>
                      <Badge className={`text-xs ${
                        ctrl.statut === "TERMINE" ? "bg-emerald-500/15 text-emerald-400" :
                        ctrl.statut === "EN_COURS" ? "bg-amber-500/15 text-amber-400" :
                        "bg-blue-500/15 text-blue-400"
                      }`}>
                        {ctrl.statut === "EN_COURS" ? "En cours" : ctrl.statut === "TERMINE" ? "Termine" : "Planifie"}
                      </Badge>
                    </div>
                    {ctrl.controleur && <span className="text-xs text-slate-500">Controleur : {ctrl.controleur}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(ctrl.dossiers || []).map((d, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Non-conformites */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Non-conformites
            </CardTitle>
            <div className="flex gap-4 mt-1.5">
              <span className="text-xs text-slate-500">{kpis.ouvertes} ouverte(s)</span>
              <span className="text-xs text-slate-500">{kpis.resoluesTrimestre} resolue(s) ce trimestre</span>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowNcDialog(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nouvelle non-conformite
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
              <Input placeholder="Rechercher..." value={ncSearch} onChange={e => setNcSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={ncFilter} onValueChange={setNcFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="OUVERTE">Ouverte</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="RESOLUE">Resolue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-white/[0.06] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Gravite</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Echeance</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNcs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Aucune non-conformite enregistree
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNcs.map(nc => (
                    <TableRow key={nc.id}>
                      <TableCell className="text-sm">{formatDate(nc.date)}</TableCell>
                      <TableCell className="text-sm text-slate-400">{nc.source || "---"}</TableCell>
                      <TableCell className="text-sm font-medium">{nc.client || "---"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{nc.description}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${GRAVITE_COLORS[nc.gravite] || ""}`}>{nc.gravite}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{nc.responsable || "---"}</TableCell>
                      <TableCell className="text-sm">{formatDate(nc.echeance)}</TableCell>
                      <TableCell>
                        <Select value={nc.statut} onValueChange={(v) => handleNcStatutChange(nc.id, v as NonConformiteRecord["statut"])}>
                          <SelectTrigger className="h-7 w-[120px]">
                            <Badge className={`text-xs ${STATUT_NC_COLORS[nc.statut] || ""}`}>
                              {nc.statut === "EN_COURS" ? "En cours" : nc.statut === "RESOLUE" ? "Resolue" : "Ouverte"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OUVERTE">Ouverte</SelectItem>
                            <SelectItem value="EN_COURS">En cours</SelectItem>
                            <SelectItem value="RESOLUE">Resolue</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CROEC */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Historique controles CROEC
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowCroecDialog(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Ajouter un controle passe
          </Button>
        </CardHeader>
        <CardContent>
          {controlesCROEC.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Aucun controle CROEC enregistre</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
              <div className="space-y-3 pl-8">
                {[...controlesCROEC].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(c => (
                  <div key={c.id} className="relative p-3 rounded-md bg-white/[0.02] border border-white/[0.04]">
                    <div className={`absolute -left-5 top-4 w-2.5 h-2.5 rounded-full ${
                      c.resultat === "CONFORME" ? "bg-emerald-400" :
                      c.resultat === "AVEC_RESERVES" ? "bg-amber-400" : "bg-red-400"
                    }`} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatDate(c.date)}</span>
                        <span className="text-xs text-slate-500">{c.type}</span>
                      </div>
                      <Badge className={`text-xs ${RESULTAT_COLORS[c.resultat] || ""}`}>
                        {RESULTAT_LABELS[c.resultat] || c.resultat}
                      </Badge>
                    </div>
                    {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {nextCroecEstimate && (
            <div className="mt-4 p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Clock className="w-4 h-4" />
                Prochain controle estime : {nextCroecEstimate}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Planifier */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400" /> Planifier un controle</DialogTitle>
            <DialogDescription>Selectionnez les parametres du controle interne</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Date du controle</Label>
              <Input type="date" value={newControle.date} onChange={e => setNewControle(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Controleur</Label>
              <Select value={newControle.controleur} onValueChange={v => setNewControle(p => ({ ...p, controleur: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {collaborateurs.map(c => (
                    <SelectItem key={c.id || c.nom} value={c.nom}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Nombre de dossiers</Label>
              <Input type="number" min="1" max="20" value={newControle.nbDossiers} onChange={e => setNewControle(p => ({ ...p, nbDossiers: Math.max(1, Math.min(20, Number(e.target.value) || 3)) }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPlanDialog(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleTirageAleatoire} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
                Tirage aleatoire
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog NC */}
      <Dialog open={showNcDialog} onOpenChange={setShowNcDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-400" /> Nouvelle non-conformite</DialogTitle>
            <DialogDescription>Enregistrez une non-conformite detectee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Source</Label>
                <Input value={newNc.source} onChange={e => setNewNc(p => ({ ...p, source: e.target.value }))} placeholder="Ex: Controle interne" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Client</Label>
                <Input value={newNc.client} onChange={e => setNewNc(p => ({ ...p, client: e.target.value }))} placeholder="Nom du client" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Description *</Label>
              <Textarea value={newNc.description} onChange={e => setNewNc(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Gravite</Label>
                <Select value={newNc.gravite} onValueChange={v => setNewNc(p => ({ ...p, gravite: v as NonConformiteRecord["gravite"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINEURE">Mineure</SelectItem>
                    <SelectItem value="MAJEURE">Majeure</SelectItem>
                    <SelectItem value="CRITIQUE">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Echeance</Label>
                <Input type="date" value={newNc.echeance} onChange={e => setNewNc(p => ({ ...p, echeance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Action corrective</Label>
              <Textarea value={newNc.action_corrective} onChange={e => setNewNc(p => ({ ...p, action_corrective: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Responsable</Label>
              <Select value={newNc.responsable} onValueChange={v => setNewNc(p => ({ ...p, responsable: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {collaborateurs.map(c => (
                    <SelectItem key={c.id || c.nom} value={c.nom}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNcDialog(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleAddNc} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog CROEC */}
      <Dialog open={showCroecDialog} onOpenChange={setShowCroecDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-purple-400" /> Ajouter un controle CROEC</DialogTitle>
            <DialogDescription>Enregistrez un controle passe du CROEC</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Date *</Label>
              <Input type="date" value={newCroec.date} onChange={e => setNewCroec(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Type</Label>
              <Input value={newCroec.type} onChange={e => setNewCroec(p => ({ ...p, type: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Resultat</Label>
              <Select value={newCroec.resultat} onValueChange={v => setNewCroec(p => ({ ...p, resultat: v as ControleCROECRecord["resultat"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFORME">Conforme</SelectItem>
                  <SelectItem value="AVEC_RESERVES">Avec reserves</SelectItem>
                  <SelectItem value="NON_CONFORME">Non conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Notes</Label>
              <Textarea value={newCroec.notes} onChange={e => setNewCroec(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCroecDialog(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleAddCroec} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
