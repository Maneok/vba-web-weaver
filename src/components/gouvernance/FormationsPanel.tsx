import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { formationsService, type FormationRecord } from "@/lib/gouvernanceService";
import { logsService } from "@/lib/supabaseService";
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
  Filter, Search, Loader2, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export function isFormationExpired(dateStr: string): boolean {
  if (!dateStr) return true;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return true;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24) > 365;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const EMPTY_FORMATION = {
  collaborateur: "", date: "", organisme: "", duree_heures: 0,
  theme: "", attestation_url: "", quiz_score: "", notes: "",
};

export default function FormationsPanel() {
  const { collaborateurs } = useAppState();
  const [formations, setFormations] = useState<FormationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFormation, setNewFormation] = useState({ ...EMPTY_FORMATION });
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterCollab, setFilterCollab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadFormations();
  }, []);

  const loadFormations = async () => {
    try {
      const data = await formationsService.getAll();
      setFormations(data);
    } catch (err) {
      logger.error("FormationsPanel", "loadFormations error:", err);
    } finally {
      setLoading(false);
    }
  };

  const allFormations = useMemo(() => {
    const storedCollabNames = new Set(formations.map(f => f.collaborateur));
    const fromCollabs: FormationRecord[] = collaborateurs
      .filter(c => c.derniereFormation && !storedCollabNames.has(c.nom))
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

  const kpis = useMemo(() => {
    const thisYearFormations = allFormations.filter(f => f.date && new Date(f.date).getFullYear() === currentYear);
    const formedCollabs = new Set(thisYearFormations.map(f => f.collaborateur));
    const totalCollabs = collaborateurs.length;
    const formedCount = Math.min(formedCollabs.size, totalCollabs);
    const totalHeures = thisYearFormations.reduce((sum, f) => sum + (f.duree_heures || 0), 0);
    const expiredCollabs = collaborateurs.filter(c => isFormationExpired(c.derniereFormation));
    const futureFormations = allFormations.filter(f => f.date && new Date(f.date) > new Date());
    const nextFormation = futureFormations.sort((a, b) => a.date.localeCompare(b.date))[0];
    return { formedCount, totalCollabs, totalHeures, expiredCollabs, nextFormation };
  }, [allFormations, collaborateurs, currentYear]);

  const handleAddFormation = useCallback(async () => {
    if (!newFormation.collaborateur || !newFormation.date) {
      toast.error("Collaborateur et date sont requis");
      return;
    }
    if (newFormation.duree_heures < 0) {
      toast.error("La duree ne peut pas etre negative");
      return;
    }
    setSaving(true);
    try {
      const record: Omit<FormationRecord, "id"> & { id?: string } = {
        ...newFormation,
        duree_heures: Math.max(0, Number(newFormation.duree_heures) || 0),
      };
      const created = await formationsService.create(record);
      if (created) {
        setFormations(prev => [created, ...prev]);
        toast.success("Formation ajoutee avec succes");
        logsService.add("ADD_FORMATION", `Formation ajoutee pour ${newFormation.collaborateur}`, undefined, "formations").catch(() => {});
      } else {
        toast.error("Erreur lors de l'ajout");
      }
      setNewFormation({ ...EMPTY_FORMATION });
      setShowAddDialog(false);
    } catch (err) {
      logger.error("FormationsPanel", "handleAddFormation error:", err);
      toast.error("Erreur lors de l'ajout de la formation");
    } finally {
      setSaving(false);
    }
  }, [newFormation]);

  const handleDeleteFormation = useCallback(async (id: string) => {
    if (id.startsWith("collab-")) return;
    try {
      await formationsService.delete(id);
      setFormations(prev => prev.filter(f => f.id !== id));
      toast.success("Formation supprimee");
    } catch (err) {
      logger.error("FormationsPanel", "handleDeleteFormation error:", err);
      toast.error("Erreur lors de la suppression");
    }
  }, []);

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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau */}
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
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredFormations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Aucune formation enregistree
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
                      <TableCell>
                        {!f.id.startsWith("collab-") && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                            onClick={() => handleDeleteFormation(f.id)} aria-label="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
            <DialogDescription>Enregistrez une formation suivie par un collaborateur</DialogDescription>
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
                <Input type="number" min="0" max="200" value={newFormation.duree_heures || ""} onChange={e => setNewFormation(p => ({ ...p, duree_heures: Math.max(0, Number(e.target.value) || 0) }))} />
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
              <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleAddFormation} className="gap-1.5" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
