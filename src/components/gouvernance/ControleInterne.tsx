import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { formatDateFr } from "@/lib/dateUtils";
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
  ClipboardCheck, Plus, Calendar, AlertTriangle, CheckCircle2,
  Shuffle, Clock, FileText, ChevronRight, Search, Filter,
} from "lucide-react";
import { toast } from "sonner";

interface NonConformite {
  id: string;
  date: string;
  source: string;
  client: string;
  description: string;
  gravite: "MINEURE" | "MAJEURE" | "CRITIQUE";
  actionCorrective: string;
  responsable: string;
  echeance: string;
  statut: "OUVERTE" | "EN_COURS" | "RESOLUE";
}

interface ControleCROEC {
  id: string;
  date: string;
  type: string;
  resultat: "CONFORME" | "AVEC_RESERVES" | "NON_CONFORME";
  rapportUrl: string;
  notes: string;
}

interface ControlePrevu {
  id: string;
  date: string;
  controleur: string;
  dossiers: string[];
  statut: "PLANIFIE" | "EN_COURS" | "TERMINE";
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  return formatDateFr(dateStr, "short");
}

const GRAVITE_COLORS = {
  MINEURE: "bg-amber-500/15 text-amber-400",
  MAJEURE: "bg-orange-500/15 text-orange-400",
  CRITIQUE: "bg-red-500/15 text-red-400",
};

const STATUT_COLORS = {
  OUVERTE: "bg-red-500/15 text-red-400",
  EN_COURS: "bg-amber-500/15 text-amber-400",
  RESOLUE: "bg-emerald-500/15 text-emerald-400",
};

const RESULTAT_COLORS = {
  CONFORME: "bg-emerald-500/15 text-emerald-400",
  AVEC_RESERVES: "bg-amber-500/15 text-amber-400",
  NON_CONFORME: "bg-red-500/15 text-red-400",
};

const RESULTAT_LABELS = {
  CONFORME: "Conforme",
  AVEC_RESERVES: "Avec reserves",
  NON_CONFORME: "Non conforme",
};

const CI_NC_KEY = "lcb-controle-interne-nc";
const CI_PREVUS_KEY = "lcb-controle-interne-prevus";
const CI_CROEC_KEY = "lcb-controle-interne-croec";

function loadStorage<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return fallback;
}

export default function ControleInterne() {
  const { collaborateurs, clients } = useAppState();

  // Non-conformites
  const [nonConformites, setNonConformites] = useState<NonConformite[]>(() => loadStorage<NonConformite>(CI_NC_KEY, []));
  const [showNcDialog, setShowNcDialog] = useState(false);
  const [ncFilter, setNcFilter] = useState<string>("all");
  const [ncSearch, setNcSearch] = useState("");
  const [newNc, setNewNc] = useState({
    source: "", client: "", description: "", gravite: "MINEURE" as const,
    actionCorrective: "", responsable: "", echeance: "",
  });

  // Controles prevus
  const [controlesPrevus, setControlesPrevus] = useState<ControlePrevu[]>(() => loadStorage<ControlePrevu>(CI_PREVUS_KEY, []));
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [newControle, setNewControle] = useState({ date: "", controleur: "", nbDossiers: 3 });

  // Controles CROEC
  const [controlesCROEC, setControlesCROEC] = useState<ControleCROEC[]>(() => loadStorage<ControleCROEC>(CI_CROEC_KEY, []));
  const [showCroecDialog, setShowCroecDialog] = useState(false);
  const [newCroec, setNewCroec] = useState({
    date: "", type: "Controle qualite", resultat: "CONFORME" as const, notes: "",
  });

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem(CI_NC_KEY, JSON.stringify(nonConformites)); } catch { /* */ } }, [nonConformites]);
  useEffect(() => { try { localStorage.setItem(CI_PREVUS_KEY, JSON.stringify(controlesPrevus)); } catch { /* */ } }, [controlesPrevus]);
  useEffect(() => { try { localStorage.setItem(CI_CROEC_KEY, JSON.stringify(controlesCROEC)); } catch { /* */ } }, [controlesCROEC]);

  // KPIs
  const kpis = useMemo(() => {
    const ouvertes = nonConformites.filter(nc => nc.statut === "OUVERTE").length;
    const trimestre = new Date();
    trimestre.setMonth(trimestre.getMonth() - 3);
    const resoluesTrimestre = nonConformites.filter(nc =>
      nc.statut === "RESOLUE" && nc.date && new Date(nc.date) >= trimestre
    ).length;
    return { ouvertes, resoluesTrimestre };
  }, [nonConformites]);

  // Filtered NCs
  const filteredNcs = useMemo(() => {
    let result = nonConformites;
    if (ncFilter !== "all") {
      result = result.filter(nc => nc.statut === ncFilter);
    }
    if (ncSearch) {
      const q = ncSearch.toLowerCase();
      result = result.filter(nc =>
        nc.client.toLowerCase().includes(q) || nc.description.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [nonConformites, ncFilter, ncSearch]);

  // Tirage aleatoire
  const handleTirageAleatoire = useCallback(() => {
    if (clients.length === 0) {
      toast.error("Aucun client disponible");
      return;
    }
    const nb = newControle.nbDossiers;
    // Weighted by risk score
    const weighted = clients.map(c => ({
      ref: c.ref,
      nom: c.raisonSociale,
      weight: Math.max(1, c.scoreGlobal || 1),
    }));
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    const selected: string[] = [];
    const pool = [...weighted];
    for (let i = 0; i < Math.min(nb, pool.length); i++) {
      let rand = Math.random() * totalWeight;
      for (let j = 0; j < pool.length; j++) {
        rand -= pool[j].weight;
        if (rand <= 0) {
          selected.push(`${pool[j].nom} (${pool[j].ref})`);
          pool.splice(j, 1);
          break;
        }
      }
    }
    const controle: ControlePrevu = {
      id: `ctrl-${Date.now()}`,
      date: newControle.date || new Date().toISOString().split("T")[0],
      controleur: newControle.controleur,
      dossiers: selected,
      statut: "PLANIFIE",
    };
    setControlesPrevus(prev => [controle, ...prev]);
    setShowPlanDialog(false);
    toast.success(`Controle planifie avec ${selected.length} dossier(s)`);
  }, [clients, newControle]);

  const handleAddNc = useCallback(() => {
    if (!newNc.description) {
      toast.error("La description est requise");
      return;
    }
    const nc: NonConformite = {
      ...newNc,
      id: `nc-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      statut: "OUVERTE",
    };
    setNonConformites(prev => [nc, ...prev]);
    setNewNc({ source: "", client: "", description: "", gravite: "MINEURE", actionCorrective: "", responsable: "", echeance: "" });
    setShowNcDialog(false);
    toast.success("Non-conformite enregistree");
  }, [newNc]);

  const handleAddCroec = useCallback(() => {
    if (!newCroec.date) {
      toast.error("La date est requise");
      return;
    }
    const c: ControleCROEC = {
      ...newCroec,
      id: `croec-${Date.now()}`,
      rapportUrl: "",
    };
    setControlesCROEC(prev => [c, ...prev]);
    setNewCroec({ date: "", type: "Controle qualite", resultat: "CONFORME", notes: "" });
    setShowCroecDialog(false);
    toast.success("Controle CROEC enregistre");
  }, [newCroec]);

  const handleNcStatutChange = (id: string, statut: NonConformite["statut"]) => {
    setNonConformites(prev =>
      prev.map(nc => nc.id === id ? { ...nc, statut } : nc)
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Planification */}
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
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
            <div className="text-center py-6 text-slate-400 dark:text-slate-500">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun controle planifie</p>
              <p className="text-xs mt-1">Planifiez un controle avec tirage aleatoire des dossiers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {controlesPrevus.map(ctrl => (
                <div key={ctrl.id} className="p-3 rounded-md bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
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
                    {ctrl.controleur && <span className="text-xs text-slate-400 dark:text-slate-500">Controleur : {ctrl.controleur}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ctrl.dossiers.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Non-conformites */}
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Non-conformites
            </CardTitle>
            <div className="flex gap-4 mt-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">{kpis.ouvertes} ouverte(s)</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{kpis.resoluesTrimestre} resolue(s) ce trimestre</span>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowNcDialog(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nouvelle non-conformite
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Rechercher..." value={ncSearch} onChange={e => setNcSearch(e.target.value)} className="pl-9" aria-label="Rechercher une non-conformite" />
            </div>
            <Select value={ncFilter} onValueChange={setNcFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500" />
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
          <div className="rounded-md border border-gray-200 dark:border-white/[0.06] overflow-x-auto">
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
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 dark:text-slate-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucune non-conformite enregistree</p>
                      {(ncSearch || ncFilter !== "all") && (
                        <p className="text-xs mt-1">Essayez de modifier vos filtres de recherche</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNcs.map(nc => (
                    <TableRow key={nc.id}>
                      <TableCell className="text-sm">{formatDate(nc.date)}</TableCell>
                      <TableCell className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{nc.source || "---"}</TableCell>
                      <TableCell className="text-sm font-medium">{nc.client || "---"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{nc.description}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${GRAVITE_COLORS[nc.gravite]}`}>{nc.gravite}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">{nc.responsable || "---"}</TableCell>
                      <TableCell className="text-sm">{formatDate(nc.echeance)}</TableCell>
                      <TableCell>
                        <Select value={nc.statut} onValueChange={(v) => handleNcStatutChange(nc.id, v as NonConformite["statut"])}>
                          <SelectTrigger className="h-7 w-[120px]">
                            <Badge className={`text-xs ${STATUT_COLORS[nc.statut]}`}>
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

      {/* Historique controles CROEC */}
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
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
            <div className="text-center py-6 text-slate-400 dark:text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun controle CROEC enregistre</p>
              <p className="text-xs mt-1">Ajoutez un controle passe pour constituer l'historique</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
              <div className="space-y-3 pl-8">
                {controlesCROEC.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(c => (
                  <div key={c.id} className="relative p-3 rounded-md bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
                    <div className={`absolute -left-5 top-4 w-2.5 h-2.5 rounded-full ${
                      c.resultat === "CONFORME" ? "bg-emerald-400" :
                      c.resultat === "AVEC_RESERVES" ? "bg-amber-400" : "bg-red-400"
                    }`} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatDate(c.date)}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{c.type}</span>
                      </div>
                      <Badge className={`text-xs ${RESULTAT_COLORS[c.resultat]}`}>
                        {RESULTAT_LABELS[c.resultat]}
                      </Badge>
                    </div>
                    {c.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {controlesCROEC.length > 0 && (
            <div className="mt-4 p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Clock className="w-4 h-4" />
                Prochain controle estime : 2027
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Planifier controle */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Planifier un controle
            </DialogTitle>
            <DialogDescription>Selectionnez les parametres du controle interne</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Date du controle</Label>
              <Input type="date" value={newControle.date} onChange={e => setNewControle(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Controleur</Label>
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
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Nombre de dossiers</Label>
              <Input type="number" min="1" max="20" value={newControle.nbDossiers} onChange={e => setNewControle(p => ({ ...p, nbDossiers: Number(e.target.value) || 3 }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPlanDialog(false)}>Annuler</Button>
              <Button onClick={handleTirageAleatoire} className="gap-1.5">
                <Shuffle className="w-3.5 h-3.5" /> Tirage aleatoire
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Non-conformite */}
      <Dialog open={showNcDialog} onOpenChange={setShowNcDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Nouvelle non-conformite
            </DialogTitle>
            <DialogDescription>Enregistrez une non-conformite detectee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Source</Label>
                <Input value={newNc.source} onChange={e => setNewNc(p => ({ ...p, source: e.target.value }))} placeholder="Ex: Controle interne" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Client</Label>
                <Input value={newNc.client} onChange={e => setNewNc(p => ({ ...p, client: e.target.value }))} placeholder="Nom du client" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Description *</Label>
              <Textarea value={newNc.description} onChange={e => setNewNc(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Gravite</Label>
                <Select value={newNc.gravite} onValueChange={v => setNewNc(p => ({ ...p, gravite: v as NonConformite["gravite"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINEURE">Mineure</SelectItem>
                    <SelectItem value="MAJEURE">Majeure</SelectItem>
                    <SelectItem value="CRITIQUE">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Echeance</Label>
                <Input type="date" value={newNc.echeance} onChange={e => setNewNc(p => ({ ...p, echeance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Action corrective</Label>
              <Textarea value={newNc.actionCorrective} onChange={e => setNewNc(p => ({ ...p, actionCorrective: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Responsable</Label>
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
              <Button variant="outline" onClick={() => setShowNcDialog(false)}>Annuler</Button>
              <Button onClick={handleAddNc} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog CROEC */}
      <Dialog open={showCroecDialog} onOpenChange={setShowCroecDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Ajouter un controle CROEC
            </DialogTitle>
            <DialogDescription>Enregistrez un controle passe du CROEC</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Date *</Label>
              <Input type="date" value={newCroec.date} onChange={e => setNewCroec(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Type</Label>
              <Input value={newCroec.type} onChange={e => setNewCroec(p => ({ ...p, type: e.target.value }))} placeholder="Controle qualite" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Resultat</Label>
              <Select value={newCroec.resultat} onValueChange={v => setNewCroec(p => ({ ...p, resultat: v as ControleCROEC["resultat"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFORME">Conforme</SelectItem>
                  <SelectItem value="AVEC_RESERVES">Avec reserves</SelectItem>
                  <SelectItem value="NON_CONFORME">Non conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Notes</Label>
              <Textarea value={newCroec.notes} onChange={e => setNewCroec(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCroecDialog(false)}>Annuler</Button>
              <Button onClick={handleAddCroec} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
