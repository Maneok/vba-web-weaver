import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, FileText, ClipboardList,
  FileSearch, Copy, Check, ChevronDown, ChevronUp, Download, Upload,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────

export interface DocInput {
  type?: string;
  label?: string;
  source?: string;
  url?: string;
  storageUrl?: string;
  storedInSupabase?: boolean;
  // GED mode: direct file_path in bucket
  file_path?: string;
  category?: string;
  id?: string;
}

interface ExtractedDoc {
  label: string;
  label_suggere?: string;
  type_detecte: string;
  type_original?: string;
  qualite: "complet" | "partiel" | "illisible";
  donnees: Record<string, string>;
  donnees_extraites?: Record<string, string>;
  commentaire?: string;
  remarque?: string;
  doc_id?: string;
}

interface Incoherence {
  niveau: "critique" | "attention" | "info";
  message: string;
}

export interface AnalysisResult {
  documents: ExtractedDoc[];
  incoherences: Incoherence[];
  informations_manquantes: string[];
  resume: string;
  resume_documentaire?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

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

// Required doc types for completeness score (#41)
const REQUIRED_TYPES = ["kbis", "extrait_kbis", "cni", "rib"];

function computeCompletenessScore(docs: ExtractedDoc[]): number {
  if (docs.length === 0) return 0;
  const qualiteScore: Record<string, number> = { complet: 100, partiel: 50, illisible: 0 };
  let found = 0;
  let total = 0;
  for (const reqType of REQUIRED_TYPES) {
    const doc = docs.find((d) => {
      const t = (d.type_detecte || "").toLowerCase();
      return t.includes(reqType);
    });
    if (doc) {
      found += qualiteScore[doc.qualite] ?? 50;
    }
    total += 100;
  }
  return total > 0 ? Math.round(found / total * 100) : 0;
}

function getCacheKey(siren: string) {
  return `ged-analysis-${siren}`;
}

function getCachedResult(siren: string): AnalysisResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey(siren));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Expire after 1 hour
    if (Date.now() - ts > 3600_000) {
      localStorage.removeItem(getCacheKey(siren));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedResult(siren: string, data: AnalysisResult) {
  try {
    localStorage.setItem(getCacheKey(siren), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full */ }
}

// ── Component ────────────────────────────────────────────────────────

export default function DocumentAnalysis({
  siren,
  raisonSociale,
  documents,
  autoAnalyze = false,
  mode = "screening",
  onReclassify,
}: {
  siren: string;
  raisonSociale: string;
  documents: DocInput[];
  /** Auto-launch analysis on mount (#6) */
  autoAnalyze?: boolean;
  /** "screening" = step 6 docs with storageUrl, "ged" = GED docs with file_path */
  mode?: "screening" | "ged";
  /** Callback when user clicks "Appliquer le reclassement" (#2) */
  onReclassify?: (docId: string, newCategory: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(() => getCachedResult(siren));
  const autoLaunched = useRef(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const eligibleDocs =
    mode === "ged"
      ? documents.filter((d) => d.file_path)
      : documents.filter((d) => d.storedInSupabase);

  // Auto-analyze on mount (#6)
  useEffect(() => {
    if (autoAnalyze && !autoLaunched.current && eligibleDocs.length > 0 && !result) {
      autoLaunched.current = true;
      handleAnalyse();
    }
  }, [autoAnalyze, eligibleDocs.length]);

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

      const docsPayload =
        mode === "ged"
          ? eligibleDocs.map((d) => ({
              type: d.category || d.type,
              label: d.label || (d as any).name,
              source: d.source || "ged",
              storagePath: d.file_path,
              doc_id: d.id,
            }))
          : eligibleDocs.map((d) => ({
              type: d.type,
              label: d.label,
              source: d.source,
              storagePath: extractStoragePath(d.storageUrl || d.url || ""),
            }));

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
            documents: docsPayload,
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }

      const json: AnalysisResult = await res.json();
      setResult(json);
      setCachedResult(siren, json);

      // Store analysis summary in document description (#3, #9)
      if (mode === "ged") {
        for (const analyzed of json.documents) {
          const docId = analyzed.doc_id;
          if (docId) {
            const summary = JSON.stringify({
              type_detecte: analyzed.type_detecte,
              qualite: analyzed.qualite,
              donnees: analyzed.donnees || analyzed.donnees_extraites,
            });
            await supabase
              .from("documents")
              .update({ description: summary })
              .eq("id", docId);
          }
        }
      }

      const incCount = json.incoherences?.length || 0;
      toast.success(
        `${json.documents?.length || 0} documents analyses${incCount > 0 ? ` — ${incCount} incoherence${incCount > 1 ? "s" : ""} detectee${incCount > 1 ? "s" : ""}` : ""}`
      );
    } catch (err: any) {
      console.error("analyse-docs error:", err);
      toast.error(err.message || "Erreur lors de l'analyse documentaire");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(doc: ExtractedDoc, idx: number) {
    const data = doc.donnees || doc.donnees_extraites || {};
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function handleExportCsv() {
    if (!result) return;
    const headers = ["Type", "Label", "Qualite", "Dirigeant", "Capital", "SIREN", "Date"];
    const rows = result.documents.map((d) => {
      const data = d.donnees || d.donnees_extraites || {};
      return [
        d.type_detecte,
        d.label_suggere || d.label,
        d.qualite,
        data["Dirigeant"] || data["dirigeant"] || "",
        data["Capital"] || data["capital"] || "",
        data["SIREN"] || data["siren"] || "",
        data["Date"] || data["date"] || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analyse_${siren}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exporte");
  }

  // ── Loading skeleton (#31) ──

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
          <span>L'IA analyse vos documents...</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
            {eligibleDocs.length} document{eligibleDocs.length > 1 ? "s" : ""}
          </span>
        </div>
        {eligibleDocs.map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] p-4 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-white/[0.06]" />
              <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 rounded bg-gray-100 dark:bg-white/[0.04]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── No result — trigger button (#40 empty state) ──

  if (!result) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-3 flex-wrap">
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
          {/* #7 cost indicator */}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">~0.02€/analyse</span>
        </div>
        {eligibleDocs.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <Upload className="w-3.5 h-3.5" />
            <span>Aucun document stocke — lancez d'abord la collecte documentaire</span>
          </div>
        )}
      </div>
    );
  }

  // ── Result display ──

  const completeness = computeCompletenessScore(result.documents);
  const resumeText = result.resume_documentaire || result.resume;

  // #42 — alert if no dirigeant found
  const hasDirigeant = result.documents.some((d) => {
    const data = d.donnees || d.donnees_extraites || {};
    return Object.keys(data).some((k) => k.toLowerCase().includes("dirigeant"));
  });

  // #43 — alert if SIREN mismatch
  const sirenMismatch = result.documents.some((d) => {
    const data = d.donnees || d.donnees_extraites || {};
    const docSiren = (data["SIREN"] || data["siren"] || "").replace(/\s/g, "");
    return docSiren && docSiren !== siren.replace(/\s/g, "");
  });

  return (
    <div className="space-y-3 mt-4">
      {/* Header + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Analyse IA
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">~0.02€</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* #48 CSV export */}
          <Button variant="ghost" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs text-slate-400 hover:text-emerald-400">
            <Download className="w-3 h-3" />
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAnalyse} className="gap-1.5 text-xs text-slate-400 hover:text-violet-400">
            <RefreshCw className="w-3 h-3" />
            Relancer
          </Button>
        </div>
      </div>

      {/* #41 Completeness score */}
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">Completude documentaire</span>
          <span className={`font-semibold ${completeness >= 75 ? "text-emerald-500" : completeness >= 50 ? "text-amber-500" : "text-red-500"}`}>
            {completeness}%
          </span>
        </div>
        <Progress value={completeness} className="h-1.5" />
        {/* #46 CNOEC reminder */}
        {completeness < 100 && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Art. L561-5 CMF — documents obligatoires manquants
          </p>
        )}
      </div>

      {/* #42 #43 Critical alerts */}
      {!hasDirigeant && result.documents.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Dirigeant non identifie dans les documents fournis</span>
        </div>
      )}
      {sirenMismatch && (
        <div className="flex items-start gap-2 text-[11px] rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>SIREN incoherent detecte dans un document (ne correspond pas a {siren})</span>
        </div>
      )}

      {/* Per-document cards (#32 stagger-in, #33 collapsible, #35 responsive, #38 copy) */}
      {result.documents.map((doc, i) => {
        const q = QUALITE_CONFIG[doc.qualite] || QUALITE_CONFIG.partiel;
        const data = doc.donnees || doc.donnees_extraites || {};
        const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
        const isExpanded = expandedCards.has(i);
        const showCollapse = entries.length > 6;
        const visibleEntries = showCollapse && !isExpanded ? entries.slice(0, 4) : entries;
        const displayLabel = doc.label_suggere || doc.label;
        const reclassNeeded = doc.type_detecte && doc.type_original && doc.type_detecte !== doc.type_original;

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
                  {displayLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* #2 reclassify badge */}
                {reclassNeeded && (
                  <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/20 border">
                    Reclasse: {doc.type_detecte}
                  </Badge>
                )}
                <Badge className={`text-[10px] border ${q.cls}`}>{q.label}</Badge>
                {/* #38 copy button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(doc, i)}
                    >
                      {copiedIdx === i ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copier les donnees extraites</TooltipContent>
                </Tooltip>
              </div>
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

            {/* #2 reclassify button */}
            {reclassNeeded && onReclassify && doc.doc_id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-blue-400 hover:text-blue-500 h-6 px-2"
                onClick={() => onReclassify(doc.doc_id!, doc.type_detecte.toLowerCase().replace(/\s+/g, "_"))}
              >
                Appliquer le reclassement
              </Button>
            )}

            {/* Extracted data grid (#35 responsive) */}
            {visibleEntries.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {visibleEntries.map(([key, val]) => (
                  <div key={key} className="flex gap-1.5">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">{key} :</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* #33 Collapsible for >6 fields */}
            {showCollapse && (
              <button
                className="text-[10px] text-violet-400 hover:text-violet-500 flex items-center gap-1"
                onClick={() => {
                  const s = new Set(expandedCards);
                  isExpanded ? s.delete(i) : s.add(i);
                  setExpandedCards(s);
                }}
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {isExpanded ? "Voir moins" : `Voir ${entries.length - 4} champs de plus`}
              </button>
            )}

            {/* Comment / remarque */}
            {(doc.commentaire || doc.remarque) && (
              <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                "{doc.commentaire || doc.remarque}"
              </p>
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
      {resumeText && (
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Resume documentaire
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            "{resumeText}"
          </p>
        </div>
      )}
    </div>
  );
}
