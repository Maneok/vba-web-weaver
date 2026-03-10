import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { searchPappers, type PappersResult, type SearchMode } from "@/lib/pappersService";
import { Search, Building2, User, Hash, Loader2, Download, CheckCircle2 } from "lucide-react";

interface Props {
  onSelect: (result: PappersResult) => void;
}

export default function PappersSearch({ onSelect }: Props) {
  const [mode, setMode] = useState<SearchMode>("siren");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PappersResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSiren, setSelectedSiren] = useState<string | null>(null);
  const [downloadingDocs, setDownloadingDocs] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handleSearchRef = useRef<() => void>(() => {});

  // Cleanup pending timer and abort on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const placeholder: Record<SearchMode, string> = {
    siren: "Ex: 412 345 678",
    nom: "Ex: BOULANGERIE MARTIN",
    dirigeant: "Ex: MARTIN Jean-Pierre",
  };

  const icons: Record<SearchMode, typeof Hash> = {
    siren: Hash,
    nom: Building2,
    dirigeant: User,
  };

  handleSearchRef.current = () => handleSearchInner();
  const handleSearch = () => handleSearchRef.current();
  const handleSearchInner = async () => {
    if (!query.trim()) return;
    // Abort previous in-flight search
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setResults([]);
    setSelectedSiren(null);

    try {
      const res = await searchPappers(mode, query.trim(), false, controller.signal);

      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.results.length === 0) {
        setError("Aucun resultat trouve pour cette recherche.");
        return;
      }

      setResults(res.results);

      if (res.results.length === 1) {
        handleSelect(res.results[0]);
      }
    } catch {
      if (controller.signal.aborted) return;
      setError("Erreur de connexion. Veuillez reessayer.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleSelect = (result: PappersResult) => {
    setSelectedSiren(result.siren);
    onSelect(result);
  };

  const handleDownloadDocs = async (result: PappersResult) => {
    if (!result?.siren) {
      setError("SIREN manquant, impossible de telecharger les documents.");
      return;
    }
    setDownloadingDocs(true);
    setError("");
    try {
      const res = await searchPappers("siren", result.siren.replace(/\s/g, ""), true);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.results?.length > 0 && res.results[0].document_urls) {
        onSelect({ ...result, document_urls: res.results[0].document_urls });
      } else {
        setError("Aucun document disponible pour cette entreprise.");
      }
    } catch {
      setError("Erreur lors du telechargement des documents. Veuillez reessayer.");
    } finally {
      setDownloadingDocs(false);
    }
  };

  const ModeIcon = icons[mode];

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">
          Auto-KYC Pappers
        </h3>
        <Badge variant="outline" className="text-[10px]">API</Badge>
      </div>

      <div className="flex gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="siren">
              <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> SIREN</span>
            </SelectItem>
            <SelectItem value="nom">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Nom societe</span>
            </SelectItem>
            <SelectItem value="dirigeant">
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> Dirigeant</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1 relative">
          <ModeIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              if (val.trim()) {
                searchTimerRef.current = setTimeout(() => handleSearch(), 500);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                handleSearch();
              }
            }}
            placeholder={placeholder[mode]}
            aria-label="Rechercher une entreprise via Pappers"
            className="pl-8"
          />
        </div>

        <Button onClick={() => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); handleSearch(); }} disabled={loading || !query.trim()} size="default">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1">Rechercher</span>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {results.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {results.length} resultats trouves - selectionnez une entreprise :
          </Label>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <button
                key={r.siren || i}
                onClick={() => handleSelect(r)}
                className={`w-full text-left p-2 rounded-md border text-sm transition-colors hover:bg-accent ${
                  selectedSiren === r.siren
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{r.raison_sociale}</span>
                    <span className="text-muted-foreground ml-2">({r.siren})</span>
                  </div>
                  {selectedSiren === r.siren && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.forme_juridique_raw} - {r.ville} - APE: {r.ape}
                  {r.dirigeant && ` - ${r.dirigeant}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {results.length === 1 && selectedSiren && (
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            <strong>{results[0].raison_sociale}</strong> ({results[0].siren}) - Champs pre-remplis
          </span>
        </div>
      )}

      {selectedSiren && results.length > 0 && (
        <div className="flex items-center gap-2">
          {results.find(r => r.siren === selectedSiren)?.documents_disponibles?.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const r = results.find(r => r.siren === selectedSiren);
                if (r) handleDownloadDocs(r);
              }}
              disabled={downloadingDocs}
            >
              {downloadingDocs ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              Telecharger documents ({
                results.find(r => r.siren === selectedSiren)?.documents_disponibles?.length ?? 0
              })
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
