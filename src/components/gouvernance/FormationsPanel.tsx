import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap, Plus, AlertTriangle, Clock, Users, Calendar,
  Filter, Search, Upload,
} from "lucide-react";
import { toast } from "sonner";

interface Formation {
  id: string;
  collaborateur: string;
  date: string;
  organisme: string;
  duree_heures: number;
  theme: string;
  attestation_url: string;
  quiz_score: string;
  notes: string;
}

function isFormationExpired(dateStr: string) {
  if (!dateStr) return true;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return true;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24) > 365;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const EMPTY_FORMATION = {
  collaborateur: "", date: "", organisme: "", duree_heures: 0,
  theme: "", attestation_url: "", quiz_score: "", notes: "",
};

const FORMATIONS_STORAGE_KEY = "lcb-formations-panel";

function loadFormations(): Formation[] {
  try {
    const stored = localStorage.getItem(FORMATIONS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

export default function FormationsPanel() {
  const { collaborateurs } = useAppState();
  const [formations, setFormations] = useState<Formation[]>(loadFormations);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFormation, setNewFormation] = useState({ ...EMPTY_FORMATION });
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterCollab, setFilterCollab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const currentYear = new Date().getFullYear();

  // Persist formations to localStorage
  useEffect(() => {
    try { localStorage.setItem(FORMATIONS_STORAGE_KEY, JSON.stringify(formations)); } catch { /* storage full */ }
  }, [formations]);

  // Build formations from collaborateur data + local state
  const allFormations = useMemo(() => {
    const fromCollabs: Formation[] = collaborateurs
      .filter(c => c.derniereFormation)
      .map(c => ({
        id: `collab-${c.id || c.nom}`,
        collaborateur: c.nom,
        date: c.derniereFormation,
        organisme: "",
        duree_heures: 0,
        theme: "Formation LCB-FT",
        attestation_url: "",
        quiz_score: "",
        notes: "",
      }));
    return [...formations, ...fromCollabs];
  }, [collaborateurs, formations]);

  const filteredFormations = useMemo(() => {
    let result = allFormations;
    if (filterYear !== "all") {
      result = result.filter(f => f.date && new Date(f.date).getFullYear().toString() === filterYear);
    }
    if (filterCollab !== "all") {
      result = result.filter(f => f.collaborateur === filterCollab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.collaborateur.toLowerCase().includes(q) ||
        f.theme.toLowerCase().includes(q) ||
        f.organisme.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [allFormations, filterYear, filterCollab, search]);

  // KPIs
  const kpis = useMemo(() => {
    const thisYearFormations = allFormations.filter(f => f.date && new Date(f.date).getFullYear() === currentYear);
    const formedCollabs = new Set(thisYearFormations.map(f => f.collaborateur));
    const totalCollabs = collaborateurs.length;
    const formedCount = Math.min(formedCollabs.size, totalCollabs);
    const totalHeures = thisYearFormations.reduce((sum, f) => sum + (f.duree_heures || 0), 0);

    const expiredCollabs = collaborateurs.filter(c => isFormationExpired(c.derniereFormation));

    // Next planned formation (future dates)
    const futureFormations = allFormations.filter(f => f.date && new Date(f.date) > new Date());
    const nextFormation = futureFormations.sort((a, b) => a.date.localeCompare(b.date))[0];

    return { formedCount, totalCollabs, totalHeures, expiredCollabs, nextFormation };
  }, [allFormations, collaborateurs, currentYear]);

  const handleAddFormation = useCallback(() => {
    if (!newFormation.collaborateur || !newFormation.date) {
      toast.error("Collaborateur et date sont requis");
      return;
    }
    const formation: Formation = {
      ...newFormation,
      id: `f-${Date.now()}`,
      duree_heures: Number(newFormation.duree_heures) || 0,
    };
    setFormations(prev => [formation, ...prev]);
    setNewFormation({ ...EMPTY_FORMATION });
    setShowAddDialog(false);
    toast.success("Formation ajoutee avec succes");
  }, [newFormation]);

  const progressPct = kpis.totalCollabs > 0 ? Math.round((kpis.formedCount / kpis.totalCollabs) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">Collaborateurs formes</span>
            </div>
            <p className="text-2xl font-bold">{kpis.formedCount}/{kpis.totalCollabs}</p>
            <Progress value={progressPct} className="mt-2 h-2" />
            <p className="text-xs text-slate-500 mt-1">{progressPct}% formes cette annee</p>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-slate-400">Prochaine formation</span>
            </div>
            <p className="text-lg font-semibold">
              {kpis.nextFormation ? formatDate(kpis.nextFormation.date) : "Aucune planifiee"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-400">Heures totales</span>
            </div>
            <p className="text-2xl font-bold">{kpis.totalHeures}h</p>
            <p className="text-xs text-slate-500 mt-1">de formation cette annee</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerte formations expirees */}
      {kpis.expiredCollabs.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-400">
                  {kpis.expiredCollabs.length} collaborateur(s) sans formation valide (&lt; 12 mois)
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {kpis.expiredCollabs.map(c => (
                    <Badge key={c.id || c.nom} className="bg-amber-500/15 text-amber-400 text-xs">
                      {c.nom}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => setShowAddDialog(true)}>
                  <Calendar className="w-3.5 h-3.5" /> Planifier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres + Tableau */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-400" />
            Registre des formations
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Ajouter une formation
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Rechercher une formation"
              />
            </div>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[130px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Annee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCollab} onValueChange={setFilterCollab}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Collaborateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {collaborateurs.map(c => (
                  <SelectItem key={c.id || c.nom} value={c.nom}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          <div className="rounded-md border border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Organisme</TableHead>
                  <TableHead>Duree</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Attestation</TableHead>
                  <TableHead>Quiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFormations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucune formation enregistree</p>
                      {(search || filterYear !== "all" || filterCollab !== "all") && (
                        <p className="text-xs mt-1">Essayez de modifier vos filtres de recherche</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFormations.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.collaborateur}</TableCell>
                      <TableCell>{formatDate(f.date)}</TableCell>
                      <TableCell className="text-slate-400">{f.organisme || "---"}</TableCell>
                      <TableCell>{f.duree_heures ? `${f.duree_heures}h` : "---"}</TableCell>
                      <TableCell>{f.theme || "---"}</TableCell>
                      <TableCell>
                        {f.attestation_url ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 text-xs">Oui</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.quiz_score ? (
                          <Badge className="bg-blue-500/15 text-blue-400 text-xs">{f.quiz_score}</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">---</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Ajout */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              Ajouter une formation
            </DialogTitle>
            <DialogDescription>
              Enregistrez une formation suivie par un collaborateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Collaborateur *</Label>
              <Select value={newFormation.collaborateur} onValueChange={v => setNewFormation(p => ({ ...p, collaborateur: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {collaborateurs.map(c => (
                    <SelectItem key={c.id || c.nom} value={c.nom}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Date *</Label>
                <Input type="date" value={newFormation.date} onChange={e => setNewFormation(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Duree (heures)</Label>
                <Input type="number" min="0" value={newFormation.duree_heures || ""} onChange={e => setNewFormation(p => ({ ...p, duree_heures: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Organisme</Label>
              <Input value={newFormation.organisme} onChange={e => setNewFormation(p => ({ ...p, organisme: e.target.value }))} placeholder="Ex: CNCC, CSOEC..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Theme</Label>
              <Input value={newFormation.theme} onChange={e => setNewFormation(p => ({ ...p, theme: e.target.value }))} placeholder="Ex: LCB-FT, KYC, Gel des avoirs..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Score quiz</Label>
              <Input value={newFormation.quiz_score} onChange={e => setNewFormation(p => ({ ...p, quiz_score: e.target.value }))} placeholder="Ex: 18/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Notes</Label>
              <Textarea value={newFormation.notes} onChange={e => setNewFormation(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
              <Button onClick={handleAddFormation} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
