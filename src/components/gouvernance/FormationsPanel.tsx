import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDateFr } from "@/lib/dateUtils";
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
  Filter, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Formation {
  id: string;
  collaborateur_id: string | null;
  collaborateur_nom: string;
  date_formation: string;
  organisme: string | null;
  duree_heures: number | null;
  theme: string | null;
  type: string | null;
  attestation_url: string | null;
  quiz_score: number | null;
  quiz_date: string | null;
  notes: string | null;
}

const THEMES = [
  "Cadre legal LCB-FT",
  "Indicateurs de soupcon",
  "Procedures internes",
  "Utilisation GRIMY",
  "Declaration TRACFIN",
  "Autre",
] as const;

const TYPES = [
  "Presentiel",
  "E-learning",
  "Webinaire",
  "Autoformation",
] as const;

function isFormationExpired(dateStr: string) {
  if (!dateStr) return true;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return true;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24) > 365;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  return formatDateFr(dateStr, "short");
}

const EMPTY_FORM = {
  collaborateur_id: "",
  date_formation: "",
  organisme: "",
  duree_heures: 0,
  theme: "",
  type: "",
  quiz_score: "",
  quiz_date: "",
  notes: "",
};

export default function FormationsPanel() {
  const { collaborateurs } = useAppState();
  const { profile } = useAuth();
  const cabinetId = profile?.cabinet_id;

  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterCollab, setFilterCollab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const currentYear = new Date().getFullYear();

  // Load formations from Supabase
  useEffect(() => {
    if (!cabinetId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("formations")
        .select("*")
        .eq("cabinet_id", cabinetId)
        .order("date_formation", { ascending: false });
      if (!cancelled) {
        if (error) {
          logger.error("FormationsPanel", "Failed to load formations", error);
        } else {
          setFormations(data || []);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cabinetId]);

  const filteredFormations = useMemo(() => {
    let result = formations;
    if (filterYear !== "all") {
      result = result.filter(f => f.date_formation && new Date(f.date_formation).getFullYear().toString() === filterYear);
    }
    if (filterCollab !== "all") {
      result = result.filter(f => f.collaborateur_id === filterCollab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.collaborateur_nom.toLowerCase().includes(q) ||
        (f.theme || "").toLowerCase().includes(q) ||
        (f.organisme || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [formations, filterYear, filterCollab, search]);

  // KPIs
  const kpis = useMemo(() => {
    const thisYearFormations = formations.filter(f => f.date_formation && new Date(f.date_formation).getFullYear() === currentYear);
    const formedCollabIds = new Set(thisYearFormations.map(f => f.collaborateur_id).filter(Boolean));
    const formedCollabNames = new Set(thisYearFormations.map(f => f.collaborateur_nom));
    const totalCollabs = collaborateurs.length;
    // Count formed: match by id or name
    const formedCount = collaborateurs.filter(c =>
      (c.id && formedCollabIds.has(c.id)) || formedCollabNames.has(c.nom)
    ).length;
    const totalHeures = thisYearFormations.reduce((sum, f) => sum + (f.duree_heures || 0), 0);

    // Expired: no formation in last 12 months
    const recentCollabIds = new Set<string>();
    const recentCollabNames = new Set<string>();
    formations.forEach(f => {
      if (!isFormationExpired(f.date_formation)) {
        if (f.collaborateur_id) recentCollabIds.add(f.collaborateur_id);
        recentCollabNames.add(f.collaborateur_nom);
      }
    });
    const expiredCollabs = collaborateurs.filter(c =>
      !(c.id && recentCollabIds.has(c.id)) && !recentCollabNames.has(c.nom)
    );

    const futureFormations = formations.filter(f => f.date_formation && new Date(f.date_formation) > new Date());
    const nextFormation = futureFormations.sort((a, b) => a.date_formation.localeCompare(b.date_formation))[0];

    return { formedCount, totalCollabs, totalHeures, expiredCollabs, nextFormation };
  }, [formations, collaborateurs, currentYear]);

  const handleAdd = useCallback(async () => {
    if (!form.collaborateur_id || !form.date_formation) {
      toast.error("Collaborateur et date sont requis");
      return;
    }
    if (!cabinetId) { toast.error("Cabinet non identifie"); return; }

    const collab = collaborateurs.find(c => c.id === form.collaborateur_id);
    setSaving(true);
    const { data, error } = await supabase.from("formations").insert({
      cabinet_id: cabinetId,
      collaborateur_id: form.collaborateur_id,
      collaborateur_nom: collab?.nom || "",
      date_formation: form.date_formation,
      organisme: form.organisme || null,
      duree_heures: form.duree_heures || null,
      theme: form.theme || null,
      type: form.type || null,
      quiz_score: form.quiz_score ? Number(form.quiz_score) : null,
      quiz_date: form.quiz_date || null,
      notes: form.notes || null,
    }).select().single();
    setSaving(false);

    if (error) {
      logger.error("FormationsPanel", "Failed to insert formation", error);
      toast.error("Erreur lors de l'ajout");
      return;
    }
    setFormations(prev => [data, ...prev]);
    setForm({ ...EMPTY_FORM });
    setShowAddDialog(false);
    toast.success("Formation ajoutee");
  }, [form, cabinetId, collaborateurs]);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }
    setFormations(prev => prev.filter(f => f.id !== id));
    toast.success("Formation supprimee");
  }, []);

  const progressPct = kpis.totalCollabs > 0 ? Math.round((kpis.formedCount / kpis.totalCollabs) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Collaborateurs formes</span>
            </div>
            <p className="text-2xl font-bold">{kpis.formedCount}/{kpis.totalCollabs}</p>
            <Progress value={progressPct} className="mt-2 h-2" />
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{progressPct}% formes cette annee</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Prochaine formation</span>
            </div>
            <p className="text-lg font-semibold">
              {kpis.nextFormation ? formatDate(kpis.nextFormation.date_formation) : "Aucune planifiee"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Heures totales</span>
            </div>
            <p className="text-2xl font-bold">{kpis.totalHeures}h</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">de formation cette annee</p>
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
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {kpis.expiredCollabs.length} collaborateur(s) sans formation valide (&lt; 12 mois)
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {kpis.expiredCollabs.map(c => (
                    <Badge key={c.id || c.nom} className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs">
                      {c.nom}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => setShowAddDialog(true)}>
                  <Calendar className="w-3.5 h-3.5" /> Planifier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres + Tableau */}
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
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
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
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
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500" />
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
                  <SelectItem key={c.id || c.nom} value={c.id || c.nom}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          <div className="rounded-md border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Organisme</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duree</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Attestation</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFormations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucune formation enregistree</p>
                      {(search || filterYear !== "all" || filterCollab !== "all") && (
                        <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFormations.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.collaborateur_nom}</TableCell>
                      <TableCell>{formatDate(f.date_formation)}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">{f.organisme || "---"}</TableCell>
                      <TableCell>{f.theme || "---"}</TableCell>
                      <TableCell>
                        {f.type ? (
                          <Badge variant="outline" className="text-xs">{f.type}</Badge>
                        ) : "---"}
                      </TableCell>
                      <TableCell>{f.duree_heures ? `${f.duree_heures}h` : "---"}</TableCell>
                      <TableCell>
                        {f.quiz_score != null ? (
                          <Badge className={`text-xs ${f.quiz_score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                            {f.quiz_score}/100
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.attestation_url ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs">Oui</Badge>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
              <Label className="text-xs text-slate-600 dark:text-slate-400">Collaborateur *</Label>
              <Select value={form.collaborateur_id} onValueChange={v => setForm(p => ({ ...p, collaborateur_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {collaborateurs.map(c => (
                    <SelectItem key={c.id || c.nom} value={c.id || c.nom}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Date *</Label>
                <Input type="date" value={form.date_formation} onChange={e => setForm(p => ({ ...p, date_formation: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Duree (heures)</Label>
                <Input type="number" min="0" value={form.duree_heures || ""} onChange={e => setForm(p => ({ ...p, duree_heures: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Organisme</Label>
              <Input value={form.organisme} onChange={e => setForm(p => ({ ...p, organisme: e.target.value }))} placeholder="Ex: CNCC, CSOEC..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Theme</Label>
                <Select value={form.theme} onValueChange={v => setForm(p => ({ ...p, theme: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                  <SelectContent>
                    {THEMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Score quiz (0-100)</Label>
                <Input type="number" min="0" max="100" value={form.quiz_score} onChange={e => setForm(p => ({ ...p, quiz_score: e.target.value }))} placeholder="Optionnel" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Date quiz</Label>
                <Input type="date" value={form.quiz_date} onChange={e => setForm(p => ({ ...p, quiz_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
              <Button onClick={handleAdd} disabled={saving} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {saving ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
