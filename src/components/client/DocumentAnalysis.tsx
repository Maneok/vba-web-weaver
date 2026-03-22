import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, AlertTriangle, FileText, ClipboardList, FileSearch } from "lucide-react";
import { toast } from "sonner";

interface DocInput {
  type?: string;
  label?: string;
  source?: string;
  url?: string;
  storageUrl?: string;
  storedInSupabase?: boolean;
}

interface ExtractedDoc {
  label: string;
  type_detecte: string;
  type_original?: string;
  qualite: "complet" | "partiel" | "illisible";
  donnees: Record<string, string>;
  commentaire?: string;
}

interface Incoherence {
  niveau: "critique" | "attention" | "info";
  message: string;
}

interface AnalysisResult {
  documents: ExtractedDoc[];
  incoherences: Incoherence[];
  informations_manquantes: string[];
  resume: string;
}

function extractStoragePath(url: string): string {
  const match = url.match(/kyc-documents\/(.+?)(?:\?|$)/);
  return match ? match[1] : url;
}

const QUALITE_CONFIG: Record<string, { label: string; cls: string }> = {
  complet: { label: "Complet", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  partiel: { label: "Partiel", cls: "bg-amber-500/15 text-amber-500 border-amber-500/20" },
  illisible: { label: "Illisible", cls: "bg-red-500/15 text-red-500 border-red-500/20" },
};

const NIVEAU_CONFIG: Record<string, { cls: string; dot: string }> = {
  critique: { cls: "bg-red-500/10 border-red-500/20 text-red-400", dot: "bg-red-400" },
  attention: { cls: "bg-amber-500/10 border-amber-500/20 text-amber-400", dot: "bg-amber-400" },
  info: { cls: "bg-blue-500/10 border-blue-500/20 text-blue-400", dot: "bg-blue-400" },
};

export default function DocumentAnalysis({
  siren,
  raisonSociale,
  documents,
}: {
  siren: string;
  raisonSociale: string;
  documents: DocInput[];
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const eligibleDocs = documents.filter((d) => d.storedInSupabase);

  async function handleAnalyse() {
    if (eligibleDocs.length === 0) {
      toast.warning("Aucun document stocke a analyser");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyse-docs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            siren,
            raison_sociale: raisonSociale,
            documents: eligibleDocs.map((d) => ({
              type: d.type,
              label: d.label,
              source: d.source,
              storagePath: extractStoragePath(d.storageUrl || d.url || ""),
            })),
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }

      const json = await res.json();
      setResult(json);
      toast.success("Analyse documentaire terminee");
    } catch (err: any) {
      console.error("analyse-docs error:", err);
      toast.error(err.message || "Erreur lors de l'analyse documentaire");
    } finally {
      setLoading(false);
    }
  }

  // Skeleton cards while loading
  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
          <span>L'IA analyse vos documents...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] p-4 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-white/[0.06]" />
              <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 rounded bg-gray-100 dark:bg-white/[0.04]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No result yet — show trigger button
  if (!result) {
    return (
      <div className="mt-4">
        <Button
          variant="outline"
          onClick={handleAnalyse}
          disabled={eligibleDocs.length === 0}
          className="gap-2 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all duration-200"
        >
          <Sparkles className="w-4 h-4" />
          Analyser les documents avec l'IA
          {eligibleDocs.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1 bg-violet-500/15 text-violet-500 border-0">
              {eligibleDocs.length} doc{eligibleDocs.length > 1 ? "s" : ""}
            </Badge>
          )}
        </Button>
        {eligibleDocs.length === 0 && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
            Aucun document stocke — lancez d'abord la collecte documentaire
          </p>
        )}
      </div>
    );
  }

  // Result display
  return (
    <div className="space-y-3 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Analyse IA
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAnalyse}
          className="gap-1.5 text-xs text-slate-400 hover:text-violet-400"
        >
          <RefreshCw className="w-3 h-3" />
          Relancer
        </Button>
      </div>

      {/* Per-document cards */}
      {result.documents.map((doc, i) => {
        const q = QUALITE_CONFIG[doc.qualite] || QUALITE_CONFIG.partiel;
        const entries = Object.entries(doc.donnees || {});
        return (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm p-4 space-y-2.5 animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Doc header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {doc.label}
                </span>
              </div>
              <Badge className={`text-[10px] shrink-0 border ${q.cls}`}>{q.label}</Badge>
            </div>

            {/* Type detected vs original */}
            {doc.type_detecte && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Type detecte : <span className="font-medium text-slate-600 dark:text-slate-300">{doc.type_detecte}</span>
                {doc.type_original && doc.type_original !== doc.type_detecte && (
                  <span className="text-slate-400 dark:text-slate-500 ml-1">
                    (etait : "{doc.type_original}")
                  </span>
                )}
              </p>
            )}

            {/* Extracted data grid */}
            {entries.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {entries.map(([key, val]) => (
                  <div key={key} className="flex gap-1.5">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">{key} :</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Comment for illisible/partial */}
            {doc.commentaire && (
              <p className="text-[11px] italic text-slate-400 dark:text-slate-500">"{doc.commentaire}"</p>
            )}
          </div>
        );
      })}

      {/* Incoherences */}
      {result.incoherences.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Incoherences detectees ({result.incoherences.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {result.incoherences.map((inc, i) => {
              const cfg = NIVEAU_CONFIG[inc.niveau] || NIVEAU_CONFIG.attention;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-[11px] rounded-lg border px-3 py-2 ${cfg.cls}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
                  <span>{inc.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing information */}
      {result.informations_manquantes.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Informations manquantes
            </span>
          </div>
          <ul className="space-y-1">
            {result.informations_manquantes.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-slate-300 dark:text-slate-600 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {result.resume && (
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Resume documentaire
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            "{result.resume}"
          </p>
        </div>
      )}
    </div>
  );
}
