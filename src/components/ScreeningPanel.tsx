import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Newspaper, MapPin, Shield, FileText, Users, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScreeningState } from "@/lib/kycService";

type Status = string;

function normalizeStatus(s: string | null): string | null {
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "OK" || upper === "AUCUN_ARTICLE") return "OK";
  if (upper === "ATTENTION" || upper === "INDISPONIBLE") return "ATTENTION";
  if (upper === "ALERTE") return "ALERTE";
  if (upper === "UNAVAILABLE" || upper === "ERREUR" || upper === "ERROR") return "ERREUR";
  return upper;
}

function StatusIcon({ status, loading }: { status: Status | null; loading: boolean }) {
  if (loading) return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  const norm = normalizeStatus(status);
  if (!norm) return <div className="w-4 h-4 rounded-full bg-white/[0.06]" />;
  if (norm === "OK") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (norm === "ATTENTION") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (norm === "ALERTE") return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertTriangle className="w-4 h-4 text-slate-500" />;
}

function StatusBadge({ status, loading }: { status: Status | null; loading: boolean }) {
  if (loading) return <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[10px]">Verification...</Badge>;
  const norm = normalizeStatus(status);
  if (!norm) return <Badge className="bg-white/[0.06] text-slate-500 border-0 text-[10px]">En attente</Badge>;
  const colors: Record<string, string> = {
    OK: "bg-emerald-500/15 text-emerald-400",
    ATTENTION: "bg-amber-500/15 text-amber-400",
    ALERTE: "bg-red-500/15 text-red-400",
    ERREUR: "bg-slate-500/15 text-slate-500",
  };
  const labels: Record<string, string> = {
    OK: "Aucun match",
    ATTENTION: "Attention",
    ALERTE: "ALERTE",
    ERREUR: "Service indisponible",
  };
  return <Badge className={`${colors[norm] ?? "bg-slate-500/15 text-slate-500"} border-0 text-[10px]`}>{labels[norm] ?? norm}</Badge>;
}

interface Props {
  screening: ScreeningState;
  compact?: boolean;
}

export default function ScreeningPanel({ screening, compact }: Props) {
  const rows: Array<{
    key: keyof ScreeningState;
    icon: React.ReactNode;
    label: string;
    status: Status | null;
    loading: boolean;
    detail?: string;
    alertes?: string[];
  }> = [
    {
      key: "enterprise",
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      label: "Annuaire Entreprises",
      status: screening.enterprise.data ? "OK" : screening.enterprise.error ? "ERREUR" : null,
      loading: screening.enterprise.loading,
      detail: screening.enterprise.data ? `${screening.enterprise.data.length} resultat(s)` : undefined,
    },
    {
      key: "sanctions",
      icon: <Shield className="w-4 h-4 text-red-400" />,
      label: "Sanctions / PPE (OpenSanctions)",
      status: (screening.sanctions.data?.status as Status) ?? null,
      loading: screening.sanctions.loading,
      detail: screening.sanctions.data ? `${screening.sanctions.data.checked} personne(s) verifiee(s)` : undefined,
      alertes: screening.sanctions.data?.matches.map(m => m.details),
    },
    {
      key: "bodacc",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      label: "BODACC (procedures collectives)",
      status: (screening.bodacc.data?.status as Status) ?? null,
      loading: screening.bodacc.loading,
      detail: screening.bodacc.data ? `${screening.bodacc.data.annonces.length} annonce(s)` : undefined,
      alertes: screening.bodacc.data?.alertes,
    },
    {
      key: "google",
      icon: <MapPin className="w-4 h-4 text-emerald-400" />,
      label: "Google Places (existence physique)",
      status: (screening.google.data?.status as Status) ?? null,
      loading: screening.google.loading,
      detail: screening.google.data?.place
        ? `${screening.google.data.place.name} — ${screening.google.data.place.rating ?? "N/A"}/5 (${screening.google.data.place.totalRatings} avis)`
        : undefined,
      alertes: screening.google.data?.alertes,
    },
    {
      key: "news",
      icon: <Newspaper className="w-4 h-4 text-purple-400" />,
      label: "Revue de presse (Google Search)",
      status: (screening.news.data?.status as Status) ?? null,
      loading: screening.news.loading,
      detail: screening.news.data ? `${screening.news.data.articles.length} article(s)` : undefined,
      alertes: screening.news.data?.alertes,
    },
  ];

  if (!compact) {
    rows.push({
      key: "network",
      icon: <Users className="w-4 h-4 text-cyan-400" />,
      label: "Reseau dirigeants",
      status: (screening.network.data?.status as Status) ?? null,
      loading: screening.network.loading,
      detail: screening.network.data ? `${screening.network.data.totalCompanies} societe(s), ${screening.network.data.totalPersons} personne(s)` : undefined,
      alertes: screening.network.data?.alertes.map(a => a.message),
    });
    rows.push({
      key: "inpi",
      icon: <Archive className="w-4 h-4 text-indigo-400" />,
      label: "Documents INPI (RNE)",
      status: (screening.inpi.data?.status as Status) ?? null,
      loading: screening.inpi.loading,
      detail: screening.inpi.data ? `${screening.inpi.data.totalDocuments} document(s), ${screening.inpi.data.storedCount} stocke(s)` : undefined,
    });
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300">Screening automatique</h3>
        {(screening.enterprise.loading || screening.sanctions.loading || screening.bodacc.loading || screening.google.loading || screening.news.loading || screening.inpi.loading) && (
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin ml-auto" />
        )}
      </div>

      <div className="divide-y divide-white/[0.04]">
        {rows.map(row => (
          <div key={row.key} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon status={row.status} loading={row.loading} />
                <div className="flex items-center gap-2">
                  {row.icon}
                  <span className="text-sm text-slate-200">{row.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {row.detail && !row.loading && (
                  <span className="text-[10px] text-slate-500">{row.detail}</span>
                )}
                <StatusBadge status={row.status} loading={row.loading} />
              </div>
            </div>

            {/* Alertes */}
            {row.alertes && row.alertes.length > 0 && (
              <div className="mt-2 ml-7 space-y-1">
                {row.alertes.slice(0, 3).map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-red-300">{alert}</span>
                  </div>
                ))}
                {row.alertes.length > 3 && (
                  <span className="text-[10px] text-slate-500 ml-5">+ {row.alertes.length - 3} autre(s) alerte(s)</span>
                )}
              </div>
            )}

            {/* Google Places details */}
            {row.key === "google" && screening.google.data?.place && !row.loading && (
              <div className="mt-2 ml-7 flex items-center gap-3 text-xs text-slate-400">
                <span>{screening.google.data.place.businessStatus === "OPERATIONAL" ? "Ouvert" : screening.google.data.place.businessStatus}</span>
                {screening.google.data.place.website && (
                  <a href={screening.google.data.place.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                    Site web <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {screening.google.data.mapsUrl && (
                  <a href={screening.google.data.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                    Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
