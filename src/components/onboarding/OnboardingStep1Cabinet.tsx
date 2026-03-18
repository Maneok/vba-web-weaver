import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Building2, Loader2, Check } from "lucide-react";
import { searchPappers } from "@/lib/pappersService";
import { useDebounce } from "@/hooks/useDebounce";

export interface CabinetData {
  siret: string;
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  formeJuridique: string;
}

interface Step1Props {
  data: CabinetData;
  onChange: (data: CabinetData) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingStep1Cabinet({ data, onChange, onNext, onSkip }: Step1Props) {
  const [siretInput, setSiretInput] = useState(data.siret);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(false);
  const [error, setError] = useState("");
  const debouncedSiret = useDebounce(siretInput.replace(/\s/g, ""), 500);

  // Auto-search when SIRET has 9+ digits (SIREN) or 14 digits (SIRET)
  const doSearch = useCallback(async (query: string) => {
    if (query.length < 9 || !/^\d{9,14}$/.test(query)) return;

    setSearching(true);
    setError("");
    setFound(false);

    try {
      const siren = query.slice(0, 9);
      const result = await searchPappers("siren", siren);

      if (result.results && result.results.length > 0) {
        const r = result.results[0];
        onChange({
          siret: siretInput,
          nom: r.raison_sociale || "",
          adresse: r.adresse || "",
          cp: r.code_postal || "",
          ville: r.ville || "",
          formeJuridique: r.forme_juridique || "",
        });
        setFound(true);
      } else {
        setError(result.error || "Aucun resultat trouve pour ce numero.");
      }
    } catch {
      setError("Erreur lors de la recherche. Vous pouvez saisir manuellement.");
    } finally {
      setSearching(false);
    }
  }, [siretInput, onChange]);

  useEffect(() => {
    if (debouncedSiret.length >= 9) {
      doSearch(debouncedSiret);
    }
  }, [debouncedSiret, doSearch]);

  const canContinue = data.nom.trim().length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-semibold">Votre cabinet</h2>
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">
          Entrez votre SIRET pour remplir automatiquement les informations
        </p>
      </div>

      {/* SIRET field */}
      <div className="space-y-2">
        <Label htmlFor="siret" className="text-sm text-slate-700 dark:text-slate-300">
          SIRET / SIREN
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <Input
            id="siret"
            value={siretInput}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d\s]/g, "");
              setSiretInput(v);
              setFound(false);
              setError("");
            }}
            placeholder="Ex : 123 456 789 00012"
            className="pl-10 pr-10 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
          )}
          {found && !searching && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          )}
        </div>
        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>

      {/* Auto-filled fields (appear with animation) */}
      {(found || data.nom) && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {searching ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-50/80 dark:bg-white/[0.04] rounded-md animate-pulse" />
              <div className="h-10 bg-gray-50/80 dark:bg-white/[0.04] rounded-md animate-pulse" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="nom" className="text-sm text-slate-700 dark:text-slate-300">
                  Nom du cabinet
                </Label>
                <Input
                  id="nom"
                  value={data.nom}
                  onChange={(e) => onChange({ ...data, nom: e.target.value })}
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adresse" className="text-sm text-slate-700 dark:text-slate-300">
                  Adresse du siege
                </Label>
                <Input
                  id="adresse"
                  value={[data.adresse, data.cp, data.ville].filter(Boolean).join(", ")}
                  onChange={(e) => onChange({ ...data, adresse: e.target.value, cp: "", ville: "" })}
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
                />
              </div>

              {data.formeJuridique && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Forme juridique : {data.formeJuridique}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* If no SIRET, allow manual entry */}
      {!found && !searching && siretInput.replace(/\s/g, "").length < 9 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom-manual" className="text-sm text-slate-700 dark:text-slate-300">
              Ou saisissez le nom du cabinet
            </Label>
            <Input
              id="nom-manual"
              value={data.nom}
              onChange={(e) => onChange({ ...data, nom: e.target.value })}
              placeholder="Ex : Cabinet Dupont & Associes"
              className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] focus:border-blue-500/50"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onSkip}
          className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
        >
          Passer cette etape
        </button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="px-6"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
