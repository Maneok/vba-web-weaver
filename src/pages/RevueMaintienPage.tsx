import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getRevues,
  getRevueStats,
  generatePendingRevues,
  updateRevue,
  REVUE_TYPE_LABELS,
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
  CheckCircle2,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_PILLS = [
  { value: "tous", label: "Toutes" },
  { value: "a_faire", label: "À faire" },
  { value: "en_cours", label: "En cours" },
  { value: "completee", label: "Complétées" },
  { value: "reportee", label: "Reportées" },
];

const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  completee: "Complétée",
  reportee: "Reportée",
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

const PAGE_SIZE = 20;

export default function RevueMaintienPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const cabinetId = profile?.cabinet_id;

  const [revues, setRevues] = useState<RevueMaintien[]>([]);
  const [stats, setStats] = useState<RevueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filters
  const [filterStatus, setFilterStatus] = useState("tous");
  const [filterType, setFilterType] = useState("tous");
  const [filterRisk, setFilterRisk] = useState("tous");
  const [search, setSearch] = useState("");

  // Dialog revue
  const [selectedRevue, setSelectedRevue] = useState<RevueMaintien | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Dialog reporter
  const [reporterRevueItem, setReporterRevueItem] = useState<RevueMaintien | null>(null);
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
      setVisibleCount(PAGE_SIZE);
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
      toast.success(`${count} revue(s) générée(s)`);
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  const handleReporter = async () => {
    if (!reporterRevueItem || !reporterDate) return;
    setReporterLoading(true);
    try {
      await updateRevue(reporterRevueItem.id, {
        status: 'reportee',
        date_echeance: reporterDate,
        observations: reporterMotif ? `[Report] ${reporterMotif}` : reporterRevueItem.observations,
      });
      toast.success("Revue reportée");
      setReporterRevueItem(null);
      setReporterDate("");
      setReporterMotif("");
      loadData();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || err));
    } finally {
      setReporterLoading(false);
    }
  };

  // Sort: en retard first, then by score descending, then by date_echeance asc
  const sortedRevues = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return [...revues].sort((a, b) => {
      const aRetard = a.status === 'a_faire' && a.date_echeance < today ? 1 : 0;
      const bRetard = b.status === 'a_faire' && b.date_echeance < today ? 1 : 0;
      if (bRetard !== aRetard) return bRetard - aRetard;
      const aScore = a.score_risque_avant ?? a.client_score ?? 0;
      const bScore = b.score_risque_avant ?? b.client_score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.date_echeance.localeCompare(b.date_echeance);
    });
  }, [revues]);

  const visibleRevues = useMemo(() => sortedRevues.slice(0, visibleCount), [sortedRevues, visibleCount]);
  const hasMore = visibleCount < sortedRevues.length;

  const handleExportCsv = () => {
    const headers = ["Client", "Ref", "Score", "Vigilance", "Type", "Échéance", "Statut"];
    const rows = sortedRevues.map((r) => {
      const score = r.score_risque_avant ?? r.client_score ?? 0;
      const typeLabel = REVUE_TYPE_LABELS[r.type]?.label || r.type;
      return [
        r.client_nom || "—",
        r.client_ref || "—",
        String(score),
        r.vigilance_avant || r.client_vigilance || "—",
        typeLabel,
        r.date_echeance,
        STATUS_LABELS[r.status] || r.status,
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revues_maintien_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const getRowClassName = (revue: RevueMaintien) => {
    const today = new Date().toISOString().split('T')[0];
    const score = revue.score_risque_avant ?? revue.client_score ?? 0;
    if (revue.status === 'completee') return "opacity-60";
    if (revue.status === 'a_faire' && revue.date_echeance < today) return "border-l-2 border-l-red-500 bg-red-500/[0.03]";
    if (score >= 70) return "border-l-2 border-l-red-400";
    if (score >= 50) return "border-l-2 border-l-orange-400";
    return "";
  };

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={sortedRevues.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Générer les revues à faire
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="À faire"
            value={stats.total_a_faire}
            icon={ClipboardCheck}
            color={stats.total_a_faire > 0 ? "text-amber-500" : "text-muted-foreground"}
            bgColor={stats.total_a_faire > 0 ? "bg-amber-500/10" : "bg-muted/50"}
          />
          <KpiCard
            label="Risque élevé"
            value={stats.risque_eleve}
            icon={ShieldAlert}
            color={stats.risque_eleve > 0 ? "text-red-500" : "text-muted-foreground"}
            bgColor={stats.risque_eleve > 0 ? "bg-red-500/10" : "bg-muted/50"}
          />
          <KpiCard
            label="KYC expirés"
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
        {/* Status pill buttons */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Statut</Label>
          <div className="flex gap-1">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setFilterStatus(pill.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  filterStatus === pill.value
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/40 font-medium"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="annuelle">Annuelle</SelectItem>
              <SelectItem value="risque_eleve">Risque élevé</SelectItem>
              <SelectItem value="kyc_expiration">KYC expiré</SelectItem>
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
              <SelectItem value="eleve">Élevé (&ge;70)</SelectItem>
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
              placeholder="Nom ou référence..."
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
              <TableHead>Échéance</TableHead>
              <TableHead>Assigné à</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sortedRevues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <span>Aucune revue à faire. Cliquez sur « Générer les revues » pour vérifier.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleRevues.map((revue) => {
                const score = revue.score_risque_avant ?? revue.client_score ?? 0;
                return (
                  <TableRow key={revue.id} className={getRowClassName(revue)}>
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
                      <Badge variant="secondary" className="text-xs">{REVUE_TYPE_LABELS[revue.type]?.label || revue.type}</Badge>
                    </TableCell>
                    <TableCell><EcheanceBadge date={revue.date_echeance} status={revue.status} /></TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{revue.assigne_a || "—"}</span>
                    </TableCell>
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
                              onClick={() => setReporterRevueItem(revue)}
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
        {/* Pagination */}
        {hasMore && !loading && (
          <div className="flex justify-center py-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Voir plus ({sortedRevues.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>

      {/* Revue Dialog */}
      <RevueDialog
        revue={selectedRevue}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCompleted={loadData}
      />

      {/* Reporter Dialog */}
      <Dialog open={!!reporterRevueItem} onOpenChange={(v) => { if (!v) setReporterRevueItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reporter la revue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reporter-date">Nouvelle date d'échéance</Label>
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
            <Button variant="outline" onClick={() => setReporterRevueItem(null)}>Annuler</Button>
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
