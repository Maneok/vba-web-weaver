import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getRevues,
  getRevueStats,
  generatePendingRevues,
  updateRevue,
  type RevueMaintien,
  type RevueStats,
  type RevueFilters,
} from "@/lib/revueMaintien";
import RevueDialog from "@/components/revue/RevueDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  Search,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Calendar,
  Eye,
  CalendarClock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  annuelle: "Annuelle",
  risque_eleve: "Risque eleve",
  kyc_expiration: "KYC expire",
  changement_situation: "Changement situation",
  controle_qualite: "Controle qualite",
};

const STATUS_LABELS: Record<string, string> = {
  a_faire: "A faire",
  en_cours: "En cours",
  completee: "Completee",
  reportee: "Reportee",
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-red-500/15 text-red-600 border-red-500/30"
    : score >= 50 ? "bg-orange-500/15 text-orange-600 border-orange-500/30"
    : "bg-green-500/15 text-green-600 border-green-500/30";
  return <Badge variant="outline" className={color}>{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    a_faire: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    en_cours: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    completee: "bg-green-500/15 text-green-600 border-green-500/30",
    reportee: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  };
  return <Badge variant="outline" className={styles[status] || ""}>{STATUS_LABELS[status] || status}</Badge>;
}

function EcheanceBadge({ date, status }: { date: string; status: string }) {
  if (status === 'completee') return <span className="text-sm text-muted-foreground">{date}</span>;
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(date);
  const diff = (d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  const color = diff < 0 ? "text-red-600 font-semibold" : diff < 7 ? "text-orange-600 font-medium" : "text-muted-foreground";
  return <span className={`text-sm ${color}`}>{date}{diff < 0 ? " (en retard)" : ""}</span>;
}

export default function RevueMaintienPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const cabinetId = profile?.cabinet_id;

  const [revues, setRevues] = useState<RevueMaintien[]>([]);
  const [stats, setStats] = useState<RevueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("tous");
  const [filterType, setFilterType] = useState("tous");
  const [filterRisk, setFilterRisk] = useState("tous");
  const [search, setSearch] = useState("");

  // Dialog revue
  const [selectedRevue, setSelectedRevue] = useState<RevueMaintien | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Dialog reporter
  const [reporterRevue, setReporterRevue] = useState<RevueMaintien | null>(null);
  const [reporterDate, setReporterDate] = useState("");
  const [reporterMotif, setReporterMotif] = useState("");
  const [reporterLoading, setReporterLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!cabinetId) return;
    setLoading(true);
    try {
      const filters: RevueFilters = {
        status: filterStatus,
        type: filterType,
        riskLevel: filterRisk,
        search,
      };
      const [revuesData, statsData] = await Promise.all([
        getRevues(cabinetId, filters),
        getRevueStats(cabinetId),
      ]);
      setRevues(revuesData);
      setStats(statsData);
    } catch (err: any) {
      toast.error("Erreur de chargement : " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [cabinetId, filterStatus, filterType, filterRisk, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!cabinetId) return;
    setGenerating(true);
    try {
      const count = await generatePendingRevues(cabinetId);
      toast.success(`${count} revue(s) generee(s)`);
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  const handleReporter = async () => {
    if (!reporterRevue || !reporterDate) return;
    setReporterLoading(true);
    try {
      await updateRevue(reporterRevue.id, {
        status: 'reportee',
        date_echeance: reporterDate,
        observations: reporterMotif ? `[Report] ${reporterMotif}` : reporterRevue.observations,
      });
      toast.success("Revue reportee");
      setReporterRevue(null);
      setReporterDate("");
      setReporterMotif("");
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setReporterLoading(false);
    }
  };

  // Sort: en retard first, then by score descending
  const sortedRevues = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return [...revues].sort((a, b) => {
      const aRetard = a.status === 'a_faire' && a.date_echeance < today ? 1 : 0;
      const bRetard = b.status === 'a_faire' && b.date_echeance < today ? 1 : 0;
      if (bRetard !== aRetard) return bRetard - aRetard;
      const aScore = a.score_risque_avant ?? a.client_score ?? 0;
      const bScore = b.score_risque_avant ?? b.client_score ?? 0;
      return bScore - aScore;
    });
  }, [revues]);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revue & Maintien de mission</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des diligences de vigilance et maintien des relations d'affaires
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Generer les revues a faire
        </Button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="A faire"
            value={stats.total_a_faire}
            icon={ClipboardCheck}
            color={stats.total_a_faire > 0 ? "text-amber-500" : "text-muted-foreground"}
            bgColor={stats.total_a_faire > 0 ? "bg-amber-500/10" : "bg-muted/50"}
          />
          <KpiCard
            label="Risque eleve"
            value={stats.risque_eleve}
            icon={ShieldAlert}
            color={stats.risque_eleve > 0 ? "text-red-500" : "text-muted-foreground"}
            bgColor={stats.risque_eleve > 0 ? "bg-red-500/10" : "bg-muted/50"}
          />
          <KpiCard
            label="KYC expires"
            value={stats.kyc_expires}
            icon={AlertTriangle}
            color={stats.kyc_expires > 0 ? "text-red-500" : "text-muted-foreground"}
            bgColor={stats.kyc_expires > 0 ? "bg-red-500/10" : "bg-muted/50"}
          />
          <KpiCard
            label="En retard"
            value={stats.en_retard}
            icon={Clock}
            color={stats.en_retard > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}
            bgColor={stats.en_retard > 0 ? "bg-red-600/10" : "bg-muted/50"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Statut</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="a_faire">A faire</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="completee">Completees</SelectItem>
              <SelectItem value="reportee">Reportees</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="annuelle">Annuelle</SelectItem>
              <SelectItem value="risque_eleve">Risque eleve</SelectItem>
              <SelectItem value="kyc_expiration">KYC expire</SelectItem>
              <SelectItem value="changement_situation">Changement situation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Niveau de risque</Label>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="eleve">Eleve (&ge;70)</SelectItem>
              <SelectItem value="moyen">Moyen (50-69)</SelectItem>
              <SelectItem value="faible">Faible (&lt;50)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Recherche client</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nom ou reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="w-[80px]">Score</TableHead>
              <TableHead>Vigilance</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Echeance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedRevues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Aucune revue trouvee
                </TableCell>
              </TableRow>
            ) : (
              sortedRevues.map((revue) => {
                const score = revue.score_risque_avant ?? revue.client_score ?? 0;
                return (
                  <TableRow key={revue.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{revue.client_nom || "—"}</span>
                        <span className="block text-xs text-muted-foreground">{revue.client_ref}</span>
                      </div>
                    </TableCell>
                    <TableCell><ScoreBadge score={score} /></TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{revue.vigilance_avant || revue.client_vigilance || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{TYPE_LABELS[revue.type] || revue.type}</Badge>
                    </TableCell>
                    <TableCell><EcheanceBadge date={revue.date_echeance} status={revue.status} /></TableCell>
                    <TableCell><StatusBadge status={revue.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {(revue.status === 'a_faire' || revue.status === 'en_cours') && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              onClick={() => { setSelectedRevue(revue); setDialogOpen(true); }}
                            >
                              <ClipboardCheck className="h-3 w-3 mr-1" /> Revue
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setReporterRevue(revue)}
                            >
                              <CalendarClock className="h-3 w-3 mr-1" /> Reporter
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/client/${revue.client_ref}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Dossier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Revue Dialog */}
      <RevueDialog
        revue={selectedRevue}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCompleted={loadData}
      />

      {/* Reporter Dialog */}
      <Dialog open={!!reporterRevue} onOpenChange={(v) => { if (!v) setReporterRevue(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reporter la revue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reporter-date">Nouvelle date d'echeance</Label>
              <Input
                id="reporter-date"
                type="date"
                value={reporterDate}
                onChange={(e) => setReporterDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporter-motif">Motif du report</Label>
              <Textarea
                id="reporter-motif"
                value={reporterMotif}
                onChange={(e) => setReporterMotif(e.target.value)}
                placeholder="Indiquer le motif du report..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReporterRevue(null)}>Annuler</Button>
            <Button onClick={handleReporter} disabled={!reporterDate || reporterLoading}>
              {reporterLoading ? "En cours..." : "Confirmer le report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bgColor }: {
  label: string;
  value: number;
  icon: typeof ClipboardCheck;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}
