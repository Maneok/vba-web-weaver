import { useState } from "react";
import { CheckCircle, XCircle, Send, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type VigilanceLevel = "allegee" | "normale" | "renforcee";

interface KycChecklistProps {
  siren: string;
  vigilanceLevel: VigilanceLevel;
  existingCategories: string[];
  onRequestDocument: (category: string) => void;
}

// 4 documents OBLIGATOIRES pour tous les niveaux de vigilance
const REQUIRED_DOCS_BASE = ["kbis", "extrait_kbis", "cni_dirigeant", "rib"];

// Documents complémentaires recommandés selon le niveau de vigilance
const OPTIONAL_DOCS: Record<VigilanceLevel, string[]> = {
  allegee: [],
  normale: [
    "statuts",
    "justificatif_domicile",
    "attestation_vigilance",
    "liste_beneficiaires_effectifs",
  ],
  renforcee: [
    "statuts",
    "justificatif_domicile",
    "attestation_vigilance",
    "liste_beneficiaires_effectifs",
    "declaration_source_fonds",
    "justificatif_patrimoine",
  ],
};

const DOC_LABELS: Record<string, string> = {
  kbis: "KBis",
  extrait_kbis: "Extrait KBis",
  cni_dirigeant: "Piece d'identite dirigeant",
  rib: "RIB",
  statuts: "Statuts a jour",
  justificatif_domicile: "Justificatif de domicile",
  attestation_vigilance: "Attestation de vigilance",
  liste_beneficiaires_effectifs: "Liste des beneficiaires effectifs",
  declaration_source_fonds: "Declaration source des fonds",
  justificatif_patrimoine: "Justificatif de patrimoine",
};

const DOC_EMOJIS: Record<string, string> = {
  kbis: "\u{1F4CB}",
  extrait_kbis: "\u{1F4C4}",
  cni_dirigeant: "\u{1FAAA}",
  rib: "\u{1F3E6}",
  statuts: "\u{1F4D1}",
  attestation_vigilance: "\u{1F6E1}\uFE0F",
  liste_beneficiaires_effectifs: "\u{1F465}",
  declaration_source_fonds: "\u{1F4B0}",
  justificatif_patrimoine: "\u{1F3E0}",
  justificatif_domicile: "\u{1F4EE}",
};

const VIGILANCE_BADGE: Record<VigilanceLevel, { label: string; className: string }> = {
  allegee: { label: "Allégée", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  normale: { label: "Normale", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" },
  renforcee: { label: "Renforcée", className: "bg-red-500/15 text-red-500 border-red-500/20" },
};

function DocLine({
  cat,
  isPresent,
  onRequest,
}: {
  cat: string;
  isPresent: boolean;
  onRequest: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        {isPresent ? (
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        )}
        {DOC_EMOJIS[cat] && (
          <span className="text-base shrink-0" role="img">{DOC_EMOJIS[cat]}</span>
        )}
        <span
          className={`text-sm truncate ${
            isPresent ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {DOC_LABELS[cat] ?? cat}
        </span>
      </div>
      {!isPresent && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary shrink-0"
          onClick={onRequest}
        >
          <Send className="w-3 h-3 mr-1" />
          Demander
        </Button>
      )}
    </div>
  );
}

export default function KycChecklist({
  vigilanceLevel,
  existingCategories,
  onRequestDocument,
}: KycChecklistProps) {
  const [optionalOpen, setOptionalOpen] = useState(false);

  const existingLower = existingCategories.map((c) => c.toLowerCase());
  const requiredPresent = REQUIRED_DOCS_BASE.filter((cat) => existingLower.includes(cat)).length;
  const isComplete = requiredPresent === REQUIRED_DOCS_BASE.length;
  const progressValue = Math.round((requiredPresent / REQUIRED_DOCS_BASE.length) * 100);
  const badgeConfig = VIGILANCE_BADGE[vigilanceLevel];

  const optionalDocs = OPTIONAL_DOCS[vigilanceLevel];
  const optionalPresent = optionalDocs.filter((cat) => existingLower.includes(cat)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Checklist KYC</h3>
        <Badge variant="outline" className={badgeConfig.className}>
          Vigilance {badgeConfig.label}
        </Badge>
      </div>

      {/* Documents obligatoires */}
      <div className="space-y-1 animate-stagger-in">
        <p className="text-xs font-medium text-muted-foreground px-3 pb-1">
          Documents obligatoires ({requiredPresent}/{REQUIRED_DOCS_BASE.length})
        </p>
        {REQUIRED_DOCS_BASE.map((cat) => (
          <DocLine
            key={cat}
            cat={cat}
            isPresent={existingLower.includes(cat)}
            onRequest={() => onRequestDocument(cat)}
          />
        ))}
      </div>

      {/* Progress bar (obligatoires uniquement) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{requiredPresent}/{REQUIRED_DOCS_BASE.length} documents obligatoires</span>
          <span>{progressValue}%</span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      {/* Complete banner */}
      {isComplete && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Dossier KYC complet
          </span>
        </div>
      )}

      {/* Documents complémentaires (collapsible) */}
      {optionalDocs.length > 0 && (
        <div className="border-t pt-3">
          <button
            onClick={() => setOptionalOpen(!optionalOpen)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full px-3 py-1"
          >
            {optionalOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Documents complémentaires ({optionalPresent}/{optionalDocs.length})
          </button>
          {optionalOpen && (
            <div className="space-y-1 mt-1 animate-stagger-in">
              {optionalDocs.map((cat) => (
                <DocLine
                  key={cat}
                  cat={cat}
                  isPresent={existingLower.includes(cat)}
                  onRequest={() => onRequestDocument(cat)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
