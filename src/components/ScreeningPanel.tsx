import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Newspaper, MapPin, Shield, FileText, Users, Eye, Building2, BookOpen, ChevronDown, LayoutList, List, Snowflake, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ScreeningState } from "@/lib/kycService";

type Status = string;

function normalizeStatus(s: string | null): string | null {
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "OK" || upper === "AUCUN_ARTICLE") return "OK";
  if (upper === "ATTENTION" || upper === "INDISPONIBLE") return "ATTENTION";
  if (upper === "ALERTE") return "ALERTE";
  if (upper === "PARTIAL") return "ATTENTION";
  if (upper === "AUCUN_RESULTAT") return "OK";
  if (upper === "UNAVAILABLE" || upper === "ERREUR" || upper === "ERROR" || upper === "SERVICE INDISPONIBLE") return "ERREUR";
  return "ERREUR";
}

function StatusIcon({ status, loading }: { status: Status | null; loading: boolean }) {
  if (loading) return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  const norm = normalizeStatus(status);
  if (!norm) return <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-white/[0.06]" />;
  if (norm === "OK") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (norm === "ATTENTION") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (norm === "ALERTE") return <XCircle className="w-4 h-4 text-red-400 animate-pulse" />;
  return <AlertTriangle className="w-4 h-4 text-slate-400 dark:text-slate-500" />;
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
  gelAvoirs: "Aucune correspondance",
  beneficiaires: "BE identifies",
};

const ATTENTION_LABELS: Record<string, string> = {
  enterprise: "Donnees partielles",
  sanctions: "Alerte a verifier",
  bodacc: "Annonces detectees",
  google: "Adresse verifiee via BAN",
  localisation: "Adresse verifiee via BAN",
  news: "Articles a verifier",
  network: "Mandats multiples",
  documents: "Documents partiels",
  inpi: "Donnees partielles",
  inpi_docs: "Disponible en ligne",
  gelAvoirs: "Correspondance(s) trouvee(s)",
  beneficiaires: "Aucun BE declare",
};

function StatusBadge({ status, loading, tooltip, rowKey }: { status: Status | null; loading: boolean; tooltip?: string; rowKey?: string }) {
  const badge = (() => {
    if (loading) return <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[10px] rounded-lg">Verification...</Badge>;
    const norm = normalizeStatus(status);
    if (!norm) return <Badge className="bg-gray-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 border-0 text-[10px] rounded-lg">En attente</Badge>;
    const colors: Record<string, string> = {
      OK: "bg-emerald-500/15 text-emerald-400",
      ATTENTION: "bg-amber-500/15 text-amber-400",
      ALERTE: "bg-red-500/15 text-red-400 animate-pulse",
      ERREUR: "bg-slate-500/15 text-slate-400 dark:text-slate-500 dark:text-slate-400",
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
    return <Badge className={`${colors[norm] ?? "bg-slate-500/15 text-slate-400 dark:text-slate-500 dark:text-slate-400"} border-0 text-[10px] rounded-lg`}>{label}</Badge>;
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

/** A6: Format relative date in French */
function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return dateStr.slice(0, 10);
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`;
    if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
    return dateStr.slice(0, 10);
  } catch {
    return dateStr?.slice(0, 10) ?? "—";
  }
}

interface Props {
  screening: ScreeningState;
  compact?: boolean;
  gelAvoirsAlert?: string[];
  beneficiairesCount?: { pp: number; pm: number };
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
  gelAvoirs: "Verification sur la liste nationale de gel des avoirs — DG Tresor (art. L.562-1 CMF)",
};

// A3: Section icons mapping
const SECTION_ICONS: Record<string, React.ReactNode> = {
  enterprise: <Building2 className="w-4 h-4 text-blue-400" />,
  sanctions: <Shield className="w-4 h-4 text-red-400" />,
  inpi_docs: <FileText className="w-4 h-4 text-indigo-400" />,
  bodacc: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  localisation: <MapPin className="w-4 h-4 text-emerald-400" />,
  news: <BookOpen className="w-4 h-4 text-cyan-400" />,
  network: <Users className="w-4 h-4 text-orange-400" />,
  gelAvoirs: <Snowflake className="w-4 h-4 text-sky-400" />,
};

export default function ScreeningPanel({ screening, compact, gelAvoirsAlert, beneficiairesCount }: Props) {
  const [isCompactView, setIsCompactView] = useState(compact ?? false);

  // Merge enterprise + INPI data status
  const enterpriseOk = !!(screening.enterprise.data || screening.inpi.data?.companyData);
  const enterpriseLoading = screening.enterprise.loading || screening.inpi.loading;
  const enterpriseError = !enterpriseOk && (screening.enterprise.error || screening.inpi.error);

  // Merge INPI docs status
  const inpiDocsStored = (screening.inpi.data?.storedCount ?? 0) + (screening.documents.data?.autoRecovered ?? 0);
  const inpiDocsTotal = (screening.inpi.data?.totalDocuments ?? 0) + (screening.documents.data?.total ?? 0);
  const inpiDocsLoading = screening.inpi.loading || screening.documents.loading;
  const inpiDocsError = !inpiDocsLoading && (screening.inpi.error || screening.documents.error);
  const inpiDocsStatus = inpiDocsStored > 0 ? "OK" : inpiDocsTotal > 0 ? "ATTENTION" : inpiDocsError ? "ERREUR" : (screening.inpi.data || screening.documents.data) ? "ATTENTION" : null;

  // A7: Gel des avoirs status
  const gelAvoirsStatus = gelAvoirsAlert === undefined ? null : gelAvoirsAlert.length === 0 ? "OK" : "ALERTE";

  const rows: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    status: Status | null;
    loading: boolean;
    detail?: string;
    alertes?: string[];
    errorMsg?: string | null;
    timeMs?: number;
  }> = [
    {
      key: "enterprise",
      icon: SECTION_ICONS.enterprise,
      label: "Donnees entreprise",
      status: enterpriseOk ? "OK" : enterpriseError ? "ERREUR" : null,
      loading: enterpriseLoading,
      detail: enterpriseOk
        ? `INPI${screening.enterprise.data ? " + Annuaire" : ""}`
        : undefined,
      errorMsg: enterpriseError ? String(screening.enterprise.error || screening.inpi.error || "Service indisponible") : null,
      timeMs: (screening.enterprise as any).timeMs ?? (screening.inpi as any).timeMs,
    },
    {
      key: "sanctions",
      icon: SECTION_ICONS.sanctions,
      label: "Sanctions / PPE",
      status: (screening.sanctions.data?.status as Status) ?? (screening.sanctions.error ? "ERREUR" : null),
      loading: screening.sanctions.loading,
      detail: screening.sanctions.data ? `${screening.sanctions.data.checked} personne(s) verifiee(s)` : undefined,
      alertes: screening.sanctions.data?.matches?.map(m => m.details).filter(Boolean),
      errorMsg: screening.sanctions.error,
      timeMs: (screening.sanctions as any).timeMs,
    },
    {
      key: "inpi_docs",
      icon: SECTION_ICONS.inpi_docs,
      label: "Documents INPI",
      status: inpiDocsLoading ? null : inpiDocsStatus,
      loading: inpiDocsLoading,
      detail: inpiDocsStored > 0
        ? `${inpiDocsStored} PDF(s) recupere(s)`
        : inpiDocsTotal > 0
          ? `${inpiDocsTotal} document(s) — disponible(s) en ligne`
          : (screening.inpi.data || screening.documents.data) ? "Aucun document" : undefined,
      timeMs: (screening.inpi as any).timeMs ?? (screening.documents as any).timeMs,
    },
    {
      key: "bodacc",
      icon: SECTION_ICONS.bodacc,
      label: "Procedures collectives",
      status: (screening.bodacc.data?.status as Status) ?? (screening.bodacc.error ? "ERREUR" : null),
      loading: screening.bodacc.loading,
      detail: screening.bodacc.data
        ? (screening.bodacc.data.annonces?.length ?? 0) > 0
          ? `${screening.bodacc.data.annonces.length} annonce(s)`
          : "Aucune procedure collective"
        : undefined,
      alertes: screening.bodacc.data?.alertes,
      errorMsg: screening.bodacc.error,
      timeMs: (screening.bodacc as any).timeMs,
    },
    {
      key: "localisation",
      icon: SECTION_ICONS.localisation,
      label: "Localisation",
      status: (screening.google.data?.status as Status) ?? (screening.google.error ? "ERREUR" : null),
      loading: screening.google.loading,
      detail: screening.google.data?.place
        ? `${screening.google.data.place.name} — ${screening.google.data.place.rating ?? "N/A"}/5`
        : screening.google.data
          ? "Non reference sur Google Maps"
          : undefined,
      alertes: screening.google.data?.alertes,
      errorMsg: screening.google.error,
      timeMs: (screening.google as any).timeMs,
    },
    {
      key: "news",
      icon: SECTION_ICONS.news,
      label: "Revue de presse",
      status: (screening.news.data?.status as Status) ?? (screening.news.error ? "ERREUR" : null),
      loading: screening.news.loading,
      detail: screening.news.data
        ? (screening.news.data.articles?.length ?? 0) > 0
          ? `${screening.news.data.articles.length} article(s)`
          : "Aucun article"
        : undefined,
      alertes: screening.news.data?.alertes,
      errorMsg: screening.news.error,
      timeMs: (screening.news as any).timeMs,
    },
    {
      key: "network",
      icon: SECTION_ICONS.network,
      label: "Reseau dirigeants",
      status: (screening.network.data?.status as Status) ?? (screening.network.error ? "ERREUR" : null),
      loading: screening.network.loading,
      detail: screening.network.data
        ? `${screening.network.data.totalCompanies ?? 0} societe(s), ${screening.network.data.totalPersons ?? 0} personne(s)`
        : undefined,
      alertes: screening.network.data?.alertes?.map((a: unknown) => typeof a === "object" && a !== null && "message" in a ? (a as { message: string }).message : String(a ?? "")).filter(Boolean),
      errorMsg: screening.network.error,
      timeMs: (screening.network as any).timeMs,
    },
    // Item 20: Beneficiaires effectifs
    ...(beneficiairesCount !== undefined ? [{
      key: "beneficiaires",
      icon: <UserCheck className="w-4 h-4 text-purple-400" />,
      label: "Beneficiaires effectifs",
      status: (beneficiairesCount.pp + beneficiairesCount.pm) > 0 ? "OK" as Status : "ATTENTION" as Status,
      loading: false,
      detail: `${beneficiairesCount.pp} PP${beneficiairesCount.pm > 0 ? ` + ${beneficiairesCount.pm} PM` : ""}`,
      errorMsg: null,
    }] : []),
    // A7: Gel des avoirs section
    ...(gelAvoirsAlert !== undefined ? [{
      key: "gelAvoirs",
      icon: SECTION_ICONS.gelAvoirs,
      label: "Gel des avoirs DG Tresor",
      status: gelAvoirsStatus,
      loading: false,
      detail: gelAvoirsAlert.length === 0 ? "Aucune correspondance" : `${gelAvoirsAlert.length} correspondance(s)`,
      alertes: gelAvoirsAlert.length > 0 ? gelAvoirsAlert : undefined,
      errorMsg: null,
    }] : []),
  ];

  const anyLoading = screening.enterprise.loading || screening.sanctions.loading || screening.bodacc.loading || screening.google.loading || screening.news.loading || screening.network.loading || screening.inpi.loading || screening.documents.loading;

  // A5: Summary stats
  const totalChecks = rows.length;
  const completedChecks = rows.filter(r => !r.loading && (normalizeStatus(r.status) !== null)).length;
  const alertCount = rows.filter(r => normalizeStatus(r.status) === "ALERTE").length;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden print:hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/[0.06] flex items-center gap-2" role="region" aria-label="Panneau de screening automatique">
        <Shield className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Screening automatique</h3>
        {anyLoading && (
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin ml-auto" />
        )}
        {/* A10: Compact/Detailed toggle */}
        <button
          onClick={() => setIsCompactView(v => !v)}
          className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded px-1.5 py-0.5"
          aria-label={isCompactView ? "Vue detaillee" : "Vue compacte"}
        >
          {isCompactView ? <LayoutList className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          {isCompactView ? "Detaille" : "Compact"}
        </button>
      </div>

      {/* A5: Summary bar */}
      {completedChecks > 0 && (
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">
              Screening {anyLoading ? "en cours" : "complete"} — <span className="font-mono tabular-nums">{completedChecks}/{totalChecks}</span> verifications
              {!anyLoading && completedChecks === totalChecks && (() => {
                const maxTime = Math.max(...rows.map(r => r.timeMs ?? 0));
                return maxTime > 0 ? <span className="text-slate-500 ml-1">en {(maxTime / 1000).toFixed(1)}s</span> : null;
              })()}
            </span>
            {alertCount > 0 ? (
              <span className="text-red-400 font-semibold">{alertCount} alerte(s) critique(s)</span>
            ) : completedChecks === totalChecks ? (
              <span className="text-emerald-400">0 alerte critique</span>
            ) : null}
          </div>
          <div className="w-full h-1 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${alertCount > 0 ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${(completedChecks / totalChecks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {rows.map(row => {
          const norm = normalizeStatus(row.status);
          // A8: Default open for alerts, closed for OK
          const defaultOpen = norm === "ALERTE" || norm === "ATTENTION";
          const hasDetails = !isCompactView && (
            (row.alertes && row.alertes.length > 0) ||
            row.errorMsg ||
            (row.key === "localisation" && screening.google.data?.place && !row.loading) ||
            (row.key === "bodacc" && screening.bodacc.data?.annonces && screening.bodacc.data.annonces.length > 0 && !row.loading) ||
            (row.key === "news" && screening.news.data?.articles && screening.news.data.articles.length > 0 && !row.loading) ||
            (row.key === "sanctions" && screening.sanctions.data?.matches && screening.sanctions.data.matches.length > 0 && !row.loading)
          );

          // A9: Skeleton loader for loading rows
          if (row.loading && !isCompactView) {
            return (
              <div key={row.key} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    <div className="flex items-center gap-2">
                      {row.icon}
                      <span className="text-sm text-slate-800 dark:text-slate-200">{row.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-4 bg-slate-700/50 animate-pulse rounded" />
                    <div className="w-24 h-5 bg-slate-700/50 animate-pulse rounded-lg" />
                  </div>
                </div>
              </div>
            );
          }

          // A10: Compact view — one line per check
          if (isCompactView) {
            return (
              <div key={row.key} className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <StatusIcon status={row.status} loading={row.loading} />
                  {row.icon}
                  <span className="text-xs text-slate-700 dark:text-slate-300">{row.label}</span>
                  {row.timeMs != null && !row.loading && <span className="text-[9px] text-slate-500 font-mono tabular-nums">{(row.timeMs / 1000).toFixed(1)}s</span>}
                </div>
                <StatusBadge status={row.status} loading={row.loading} tooltip={TOOLTIPS[row.key]} rowKey={row.key} />
              </div>
            );
          }

          // Full view with collapsible details
          return (
            <Collapsible key={row.key} defaultOpen={defaultOpen}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={row.status} loading={row.loading} />
                    <div className="flex items-center gap-2">
                      {row.icon}
                      <span className="text-sm text-slate-800 dark:text-slate-200">{row.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.timeMs != null && !row.loading && <span className="text-[9px] text-slate-500 font-mono tabular-nums">{(row.timeMs / 1000).toFixed(1)}s</span>}
                    {row.detail && !row.loading && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{row.detail}</span>
                    )}
                    <StatusBadge status={row.status} loading={row.loading} tooltip={TOOLTIPS[row.key]} rowKey={row.key} />
                    {hasDetails && (
                      <CollapsibleTrigger asChild>
                        <button className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded p-0.5" aria-label="Afficher les details">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>

                <CollapsibleContent>
                  {/* Error message */}
                  {row.errorMsg && !row.loading && (
                    <div className="mt-1.5 ml-7 flex items-center gap-1.5 text-[10px] text-red-400/70">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{row.errorMsg}</span>
                    </div>
                  )}

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
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-5">+ {row.alertes.length - 3} autre(s) alerte(s)</span>
                      )}
                    </div>
                  )}

                  {/* Google Places details */}
                  {row.key === "localisation" && screening.google.data?.place && !row.loading && (
                    <div className="mt-2 ml-7 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>{screening.google.data.place.businessStatus === "OPERATIONAL" ? "Ouvert" : screening.google.data.place.businessStatus}</span>
                      {screening.google.data.place.totalRatings > 0 && (
                        <span className="font-mono tabular-nums">{screening.google.data.place.totalRatings} avis</span>
                      )}
                      {screening.google.data.place.website && (
                        <a href={screening.google.data.place.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200">
                          Site web <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {screening.google.data.mapsUrl && (
                        <a href={screening.google.data.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200">
                          Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {screening.google.data.streetViewUrl && (
                        <a href={screening.google.data.streetViewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200">
                          <Eye className="w-3 h-3" /> Street View
                        </a>
                      )}
                    </div>
                  )}

                  {/* BODACC annonces details */}
                  {row.key === "bodacc" && screening.bodacc.data?.annonces && screening.bodacc.data.annonces.length > 0 && !row.loading && (
                    <div className="mt-2 ml-7 space-y-1">
                      {screening.bodacc.data.annonces.slice(0, 5).map((a: { date: string; type: string; description: string; tribunal: string; isProcedureCollective: boolean }, i: number) => (
                        <div key={`bodacc-${i}`} className="flex items-start gap-2 text-[11px]">
                          <span className="text-slate-300 dark:text-slate-600 shrink-0 font-mono tabular-nums">{a.date?.slice(0, 10) || "—"}</span>
                          <span className={a.isProcedureCollective ? "text-red-400" : "text-slate-400 dark:text-slate-500 dark:text-slate-400"}>{a.type}</span>
                          {a.tribunal && <span className="text-slate-300 dark:text-slate-600">({a.tribunal})</span>}
                        </div>
                      ))}
                      {screening.bodacc.data.annonces.length > 5 && (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">+ {screening.bodacc.data.annonces.length - 5} autre(s)</span>
                      )}
                    </div>
                  )}

                  {/* A6: News articles with improved display */}
                  {row.key === "news" && screening.news.data?.articles && screening.news.data.articles.length > 0 && !row.loading && (
                    <div className="mt-2 ml-7 space-y-2">
                      {screening.news.data.articles.slice(0, 4).map((a: { title: string; url: string; source: string; publishedAt: string; hasAlertKeyword: boolean }, i: number) => (
                        <div key={`news-${i}`} className="flex items-start gap-2 text-[11px]">
                          <Newspaper className={`w-3 h-3 mt-0.5 shrink-0 ${a.hasAlertKeyword ? "text-red-400" : "text-slate-300 dark:text-slate-600"}`} />
                          <div className="min-w-0 flex-1">
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className={`hover:underline line-clamp-1 font-medium ${a.hasAlertKeyword ? "text-red-300" : "text-blue-400"}`}>
                              {a.title?.length > 80 ? a.title.slice(0, 78) + "\u2026" : a.title}
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-300 dark:text-slate-600">{a.source}</span>
                              <span className="text-slate-700">&middot;</span>
                              <span className="text-slate-300 dark:text-slate-600">{formatRelativeDate(a.publishedAt)}</span>
                              {a.hasAlertKeyword && (
                                <Badge className="bg-red-500/15 text-red-400 border-0 text-[9px] rounded-lg px-1.5 py-0">Mot-cle negatif</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {screening.news.data.articles.length > 4 && (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">+ {screening.news.data.articles.length - 4} autre(s) article(s)</span>
                      )}
                    </div>
                  )}

                  {/* Sanctions match details */}
                  {row.key === "sanctions" && screening.sanctions.data?.matches && screening.sanctions.data.matches.length > 0 && !row.loading && (
                    <div className="mt-2 ml-7 space-y-1">
                      {screening.sanctions.data.matches.slice(0, 4).map((m: { person: string; score: number; datasets: string[]; isPPE: boolean; caption: string }, i: number) => (
                        <div key={`sanc-${i}`} className="flex items-start gap-2 text-[11px]">
                          <Shield className={`w-3 h-3 mt-0.5 shrink-0 ${m.isPPE ? "text-amber-400" : "text-red-400"}`} />
                          <div className="min-w-0">
                            <span className={m.isPPE ? "text-amber-300" : "text-red-300"}>{m.caption || m.person}</span>
                            <span className="text-slate-300 dark:text-slate-600 ml-1 font-mono tabular-nums">({Math.round(m.score * 100)}%{m.isPPE ? " — PPE" : ""})</span>
                            {m.datasets?.length > 0 && (
                              <span className="text-slate-300 dark:text-slate-600 ml-1">— {m.datasets.slice(0, 2).join(", ")}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
