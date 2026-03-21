import { useState, useMemo, useCallback } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ClauseLibrary from "./ClauseLibrary";
import type { Clause } from "./ClauseLibrary";
import {
  FileText, CheckCircle2, XCircle, Info, ChevronDown, AlertTriangle,
  ShieldCheck, BookOpen, ArrowUp, ArrowDown, Pencil, Check, X,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

interface ClauseItem {
  id: string;
  title: string;
  content: string;
  obligatoire: boolean;
  enabled: boolean;
}

export default function LMStep6Clauses({ data, onChange }: Props) {
  const [showCgv, setShowCgv] = useState(false);
  const [clauseLibraryOpen, setClauseLibraryOpen] = useState(false);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  // Build clause items from data state
  const clauseItems = useMemo<ClauseItem[]>(() => {
    const items: ClauseItem[] = [
      { id: "lcbft", title: "LCB-FT", content: "Obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (art. L.561-1 et suivants CMF)", obligatoire: true, enabled: data.clause_lcbft },
      { id: "travail_dissimule", title: "Travail dissimulé", content: "Attestation relative au travail dissimulé (art. L.8222-1 Code du Travail)", obligatoire: true, enabled: data.clause_travail_dissimule },
      { id: "rgpd", title: "RGPD", content: "Protection des données personnelles (Règlement UE 2016/679)", obligatoire: false, enabled: data.clause_rgpd },
      { id: "conciliation_croec", title: "Conciliation CROEC", content: "Clause de conciliation auprès du Conseil Régional de l'Ordre des Experts-Comptables", obligatoire: false, enabled: data.clause_conciliation_croec ?? true },
    ];

    // Add custom clauses from supplementaires text (parsed as items)
    const supplementaires = data.clauses_supplementaires?.trim();
    if (supplementaires) {
      // Split by double newline to find separate clauses
      const parts = supplementaires.split(/\n{2,}/).filter(Boolean);
      parts.forEach((part, i) => {
        const firstLine = part.split('\n')[0].trim();
        items.push({
          id: `custom-${i}`,
          title: firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine,
          content: part,
          obligatoire: false,
          enabled: true,
        });
      });
    }

    return items;
  }, [data.clause_lcbft, data.clause_travail_dissimule, data.clause_rgpd, data.clause_conciliation_croec, data.clauses_supplementaires]);

  // CNOEC compliance summary
  const cnoecSummary = useMemo(() => {
    const required = clauseItems.filter(c => c.obligatoire);
    const enabledRequired = required.filter(c => c.enabled);
    return {
      total: required.length,
      enabled: enabledRequired.length,
      valid: enabledRequired.length === required.length,
    };
  }, [clauseItems]);

  const handleToggleClause = useCallback((id: string, value: boolean) => {
    switch (id) {
      case "rgpd": onChange({ clause_rgpd: value }); break;
      case "conciliation_croec": onChange({ clause_conciliation_croec: value }); break;
      // obligatoire clauses can't be toggled off
    }
  }, [onChange]);

  const handleStartEdit = (clause: ClauseItem) => {
    setEditingClauseId(clause.id);
    setEditContent(clause.content);
  };

  const handleSaveEdit = (clause: ClauseItem) => {
    if (clause.id.startsWith("custom-")) {
      // Rebuild supplementaires
      const parts = (data.clauses_supplementaires || "").split(/\n{2,}/).filter(Boolean);
      const idx = parseInt(clause.id.replace("custom-", ""), 10);
      if (idx >= 0 && idx < parts.length) {
        parts[idx] = editContent;
        onChange({ clauses_supplementaires: parts.join("\n\n") });
      }
    }
    setEditingClauseId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingClauseId(null);
    setEditContent("");
  };

  const handleAddFromLibrary = (clause: Clause) => {
    const existing = data.clauses_supplementaires?.trim() || "";
    const newClause = `${clause.title}\n${clause.content}`;
    const updated = existing ? `${existing}\n\n${newClause}` : newClause;
    onChange({ clauses_supplementaires: updated });
  };

  // Move custom clause up/down
  const handleMoveClause = (customIdx: number, direction: 'up' | 'down') => {
    const parts = (data.clauses_supplementaires || "").split(/\n{2,}/).filter(Boolean);
    const targetIdx = direction === 'up' ? customIdx - 1 : customIdx + 1;
    if (targetIdx < 0 || targetIdx >= parts.length) return;
    [parts[customIdx], parts[targetIdx]] = [parts[targetIdx], parts[customIdx]];
    onChange({ clauses_supplementaires: parts.join("\n\n") });
  };

  const customClauseParts = (data.clauses_supplementaires || "").split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* CNOEC compliance indicator */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
        cnoecSummary.valid
          ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.04] border-emerald-200/60 dark:border-emerald-500/10'
          : 'bg-orange-50/50 dark:bg-orange-500/[0.04] border-orange-200/60 dark:border-orange-500/10'
      }`}>
        {cnoecSummary.valid ? (
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${
            cnoecSummary.valid ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'
          }`}>
            {cnoecSummary.valid ? 'Conformité CNOEC validée' : 'Clauses obligatoires manquantes'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {cnoecSummary.enabled}/{cnoecSummary.total} clauses obligatoires activées
          </p>
        </div>
      </div>

      {/* Mission description info */}
      <div className="wizard-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Cadre de la mission — {mtConfig.shortLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">{mtConfig.normeRef}</Badge>
          <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400 dark:text-slate-400">{mtConfig.formeRapport}</Badge>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed line-clamp-3">{mtConfig.missionText.split('\n')[0]}</p>
      </div>

      {/* Honoraires de succes badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06]">
        {mtConfig.honorairesSuccesAutorises ? (
          <Badge className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Honoraires de succès autorisés
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 gap-1">
            <XCircle className="w-3 h-3" /> Honoraires de succès interdits (art. 24 ord. 1945)
          </Badge>
        )}
      </div>

      {/* Clauses obligatoires */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Clauses obligatoires</p>
        {clauseItems.filter(c => c.obligatoire).map((clause) => (
          <div key={clause.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-800 dark:text-slate-200">{clause.title}</span>
                <Badge className="text-[7px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/20">Requis</Badge>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{clause.content}</p>
            </div>
            <Switch checked={clause.enabled} disabled />
          </div>
        ))}
      </div>

      {/* Clauses optionnelles */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Clauses optionnelles</p>

        {clauseItems.filter(c => !c.obligatoire && !c.id.startsWith("custom-")).map((clause) => (
          <div key={clause.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-800 dark:text-slate-200">{clause.title}</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{clause.content}</p>
            </div>
            <Switch
              checked={clause.enabled}
              onCheckedChange={(v) => handleToggleClause(clause.id, v)}
            />
          </div>
        ))}
      </div>

      {/* Nature et limites */}
      {mtConfig.natureLimiteText && (
        <div className="wizard-card p-3 space-y-1.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nature et limites de la mission</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed line-clamp-3">{mtConfig.natureLimiteText.split('\n')[0]}</p>
        </div>
      )}

      {/* Clauses supplémentaires (custom, with reorder & inline edit) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">Clauses supplémentaires</Label>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setClauseLibraryOpen(true)}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Bibliothèque
          </Button>
        </div>

        {customClauseParts.length > 0 && (
          <div className="space-y-2">
            {customClauseParts.map((part, idx) => {
              const clauseId = `custom-${idx}`;
              const firstLine = part.split('\n')[0].trim();
              const isEditing = editingClauseId === clauseId;

              return (
                <div
                  key={clauseId}
                  className="p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine}
                      </p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="wizard-input min-h-[80px] text-[11px]"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => handleSaveEdit({ id: clauseId, title: firstLine, content: part, obligatoire: false, enabled: true })}
                            >
                              <Check className="w-3 h-3" /> Enregistrer
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-3 h-3" /> Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                          {part.split('\n').slice(1).join(' ').trim() || part}
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveClause(idx, 'up')}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveClause(idx, 'down')}
                          disabled={idx === customClauseParts.length - 1}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleStartEdit({ id: clauseId, title: firstLine, content: part, obligatoire: false, enabled: true })}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fallback textarea for direct input */}
        <Textarea
          value={data.clauses_supplementaires}
          onChange={(e) => onChange({ clauses_supplementaires: e.target.value })}
          className="wizard-input min-h-[80px]"
          placeholder="Ajoutez des clauses depuis la bibliothèque ou saisissez-les directement ici..."
        />
      </div>

      {/* CGV compact */}
      <div className="wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCgv(!showCgv)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:hover:bg-white/[0.02] transition-colors"
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Conditions Générales d'Intervention</p>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showCgv ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${showCgv ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">
            <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed pt-3">
              Les conditions générales d'intervention du cabinet seront jointes automatiquement en annexe de la lettre de mission.
              Elles couvrent les responsabilités respectives, les conditions de résiliation, les dispositions relatives au secret professionnel
              et les obligations de chaque partie.
            </p>
            {mtConfig.cgvSpecificClauses.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clauses spécifiques ({mtConfig.shortLabel})</p>
                {mtConfig.cgvSpecificClauses.map((clause, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/[0.04] border border-amber-200/60 dark:border-amber-500/10">
                    <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 dark:text-amber-300/80">{clause}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clause Library Sheet */}
      <ClauseLibrary
        open={clauseLibraryOpen}
        onOpenChange={setClauseLibraryOpen}
        onAddClause={handleAddFromLibrary}
      />
    </div>
  );
}
