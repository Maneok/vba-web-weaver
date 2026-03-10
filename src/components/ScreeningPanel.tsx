import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Newspaper, MapPin, Shield, FileText, Users, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScreeningState } from "@/lib/kycService";

type Status = string;

function normalizeStatus(s: string | null): string | null {
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "OK" || upper === "AUCUN_ARTICLE") return "OK";
  if (upper === "ATTENTION" || upper === "INDISPONIBLE") return "ATTENTION";
  if (upper === "ALERTE") return "ALERTE";
  if (upper === "PARTIAL") return "ATTENTION";
  // P5-26: Also normalize "PARTIAL" and "AUCUN_RESULTAT" edge function statuses
  if (upper === "UNAVAILABLE" || upper === "ERREUR" || upper === "ERROR" || upper === "SERVICE INDISPONIBLE") return "ERREUR";
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

// Per-key contextual badge labels
const OK_LABELS: Record<string, string> = {
  enterprise: "Donnees recuperees",
  sanctions: "Aucune alerte sanctions",
  bodacc: "Aucune procedure collective",
  google: "Presence confirmee",
  localisation: "Localisation confirmee",
  news: "Pas d'article negatif",
  network: "Reseau normal",
  documents: "Documents recuperes",
  inpi: "Donnees recuperees",
  inpi_docs: "PDFs recuperes",
};

const ATTENTION_LABELS: Record<string, string> = {
  enterprise: "Donnees partielles",
  sanctions: "Alerte a verifier",
  bodacc: "Annonces detectees",
  google: "Non reference Google Maps",
  localisation: "Non reference",
  news: "Articles a verifier",
  network: "Mandats multiples",
  documents: "Documents partiels",
  inpi: "Donnees partielles",
  inpi_docs: "Liens seulement",
};

function StatusBadge({ status, loading, tooltip, rowKey }: { status: Status | null; loading: boolean; tooltip?: string; rowKey?: string }) {
  const badge = (() => {
    if (loading) return <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[10px]">Verification...</Badge>;
    const norm = normalizeStatus(status);
    if (!norm) return <Badge className="bg-white/[0.06] text-slate-500 border-0 text-[10px]">En attente</Badge>;
    const colors: Record<string, string> = {
      OK: "bg-emerald-500/15 text-emerald-400",
      ATTENTION: "bg-amber-500/15 text-amber-400",
      ALERTE: "bg-red-500/15 text-red-400",
      ERREUR: "bg-slate-500/15 text-slate-500",
    };
    const label = norm === "OK"
      ? (rowKey ? OK_LABELS[rowKey] ?? "OK" : "OK")
      : norm === "ATTENTION"
        ? (rowKey ? ATTENTION_LABELS[rowKey] ?? "Attention" : "Attention")
        : norm === "ALERTE"
          ? "ALERTE"
          : norm === "ERREUR"
            ? "Service indisponible"
            : norm;
    return <Badge className={`${colors[norm] ?? "bg-slate-500/15 text-slate-500"} border-0 text-[10px]`}>{label}</Badge>;
  })();

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-[280px] text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}

interface Props {
  screening: ScreeningState;
  compact?: boolean;
}

const TOOLTIPS: Record<string, string> = {
  enterprise: "Recherche INPI (source officielle) + enrichissement Pappers + Annuaire Entreprises",
  sanctions: "Verification des listes de sanctions internationales et PPE via OpenSanctions (art. L.561-10 CMF)",
  bodacc: "Recherche d'annonces BODACC : procedures collectives, liquidations, redressements",
  localisation: "Verification de l'existence physique du siege via Google Places API",
  inpi_docs: "Recuperation automatique des documents officiels (INPI actes/bilans + Pappers KBIS/RBE)",
  google: "Verification de l'existence physique du siege via Google Places API",
  news: "Revue de presse automatique via Google Custom Search — detection d'articles negatifs",
  network: "Analyse du reseau de societes des dirigeants — detection de mandats multiples et creations recentes",
  documents: "Recuperation automatique des documents officiels (INPI actes/bilans + Pappers KBIS/RBE)",
  inpi: "Donnees detaillees INPI : objet social, financiers, historique des modifications",
};

export default function ScreeningPanel({ screening, compact }: Props) {
  // FIX 3: Simplified screening — 5 lines max
  // Merge enterprise + INPI data status
  const enterpriseOk = !!(screening.enterprise.data || screening.inpi.data?.companyData);
  const enterpriseLoading = screening.enterprise.loading || screening.inpi.loading;
  const enterpriseError = !enterpriseOk && (screening.enterprise.error || screening.inpi.error);

  // Merge INPI docs status
  const inpiDocsStored = (screening.inpi.data?.storedCount ?? 0) + (screening.documents.data?.autoRecovered ?? 0);
  const inpiDocsTotal = (screening.inpi.data?.totalDocuments ?? 0) + (screening.documents.data?.total ?? 0);
  const inpiDocsLoading = screening.inpi.loading || screening.documents.loading;
  const inpiDocsStatus = inpiDocsStored > 0 ? "OK" : inpiDocsTotal > 0 ? "ATTENTION" : (screening.inpi.data || screening.documents.data) ? "ATTENTION" : null;

  const rows: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    status: Status | null;
    loading: boolean;
    detail?: string;
    alertes?: string[];
    timeMs?: number;
  }> = [
    {
      key: "enterprise",
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      label: "Donnees entreprise",
      status: enterpriseOk ? "OK" : enterpriseError ? "ERREUR" : null,
      loading: enterpriseLoading,
      detail: enterpriseOk
        ? `INPI${screening.enterprise.data ? " + Annuaire" : ""}`
        : undefined,
      timeMs: screening.enterprise.timeMs,
    },
    {
      key: "sanctions",
      icon: <Shield className="w-4 h-4 text-red-400" />,
      label: "Sanctions / PPE",
      status: (screening.sanctions.data?.status as Status) ?? (screening.sanctions.error ? "ERREUR" : null),
      loading: screening.sanctions.loading,
      detail: screening.sanctions.data ? `${screening.sanctions.data.checked} personne(s) verifiee(s)` : undefined,
      alertes: screening.sanctions.data?.matches.map(m => m.details),
      timeMs: screening.sanctions.timeMs,
    },
    {
      key: "inpi_docs",
      icon: <Archive className="w-4 h-4 text-indigo-400" />,
      label: "Documents INPI",
      status: inpiDocsLoading ? null : inpiDocsStatus,
      loading: inpiDocsLoading,
      detail: inpiDocsStored > 0
        ? `${inpiDocsStored} PDF(s) recupere(s)`
        : inpiDocsTotal > 0
          ? `${inpiDocsTotal} document(s) — liens seulement`
          : (screening.inpi.data || screening.documents.data) ? "Aucun document" : undefined,
      timeMs: screening.inpi.timeMs,
    },
    {
      key: "bodacc",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      label: "Procedures collectives",
      status: (screening.bodacc.data?.status as Status) ?? (screening.bodacc.error ? "ERREUR" : null),
      loading: screening.bodacc.loading,
      detail: screening.bodacc.data
        ? screening.bodacc.data.annonces.length > 0
          ? `${screening.bodacc.data.annonces.length} annonce(s)`
          : "Aucune procedure collective"
        : undefined,
      alertes: screening.bodacc.data?.alertes,
      timeMs: screening.bodacc.timeMs,
    },
    {
      key: "localisation",
      icon: <MapPin className="w-4 h-4 text-emerald-400" />,
      label: "Localisation",
      status: (screening.google.data?.status as Status) ?? (screening.google.error ? "ERREUR" : null),
      loading: screening.google.loading,
      detail: screening.google.data?.place
        ? `${screening.google.data.place.name} — ${screening.google.data.place.rating ?? "N/A"}/5`
        : screening.google.data
          ? "Non reference sur Google Maps"
          : undefined,
      alertes: screening.google.data?.alertes,
      timeMs: screening.google.timeMs,
    },
    // P6-45: Add news and network rows
    {
      key: "news",
      icon: <Newspaper className="w-4 h-4 text-cyan-400" />,
      label: "Revue de presse",
      status: (screening.news.data?.status as Status) ?? (screening.news.error ? "ERREUR" : null),
      loading: screening.news.loading,
      detail: screening.news.data
        ? screening.news.data.articles?.length > 0
          ? `${screening.news.data.articles.length} article(s)`
          : "Aucun article"
        : undefined,
      alertes: screening.news.data?.alertes,
      timeMs: screening.news.timeMs,
    },
    {
      key: "network",
      icon: <Users className="w-4 h-4 text-orange-400" />,
      label: "Reseau dirigeants",
      status: (screening.network.data?.status as Status) ?? (screening.network.error ? "ERREUR" : null),
      loading: screening.network.loading,
      detail: screening.network.data
        ? `${screening.network.data.totalCompanies ?? 0} societe(s), ${screening.network.data.totalPersons ?? 0} personne(s)`
        : undefined,
      alertes: screening.network.data?.alertes?.map((a: unknown) => (a as { message: string }).message),
      timeMs: screening.network.timeMs,
    },
  ];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300">Screening automatique</h3>
        {(screening.enterprise.loading || screening.sanctions.loading || screening.bodacc.loading || screening.google.loading || screening.news.loading || screening.network.loading || screening.inpi.loading || screening.documents.loading) && (
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
                {row.timeMs != null && !row.loading && (
                  <span className="text-[8px] text-slate-700 font-mono">{(row.timeMs / 1000).toFixed(1)}s</span>
                )}
                {row.detail && !row.loading && (
                  <span className="text-[10px] text-slate-500">{row.detail}</span>
                )}
                <StatusBadge status={row.status} loading={row.loading} tooltip={TOOLTIPS[row.key]} rowKey={row.key} />
              </div>
            </div>

            {/* Alertes */}
            {row.alertes && row.alertes.length > 0 && (
              <div className="mt-2 ml-7 space-y-1">
                {row.alertes.slice(0, 3).map((alert, i) => (
                  <div key={`${row.key}-alert-${i}`} className="flex items-start gap-2 text-xs">
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
            {row.key === "localisation" && screening.google.data?.place && !row.loading && (
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
