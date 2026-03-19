import { CheckCircle, XCircle, Send } from "lucide-react";
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

const REQUIRED_DOCS: Record<VigilanceLevel, string[]> = {
  allegee: ["kbis", "cni_dirigeant"],
  normale: [
    "kbis",
    "cni_dirigeant",
    "justificatif_domicile",
    "rib",
    "statuts",
    "attestation_vigilance",
    "liste_beneficiaires_effectifs",
  ],
  renforcee: [
    "kbis",
    "cni_dirigeant",
    "justificatif_domicile",
    "rib",
    "statuts",
    "attestation_vigilance",
    "liste_beneficiaires_effectifs",
    "declaration_source_fonds",
    "justificatif_patrimoine",
  ],
};

const DOC_LABELS: Record<string, string> = {
  kbis: "Extrait KBis",
  cni_dirigeant: "Pièce d'identité dirigeant",
  justificatif_domicile: "Justificatif de domicile",
  rib: "RIB",
  statuts: "Statuts à jour",
  attestation_vigilance: "Attestation de vigilance",
  liste_beneficiaires_effectifs: "Liste des bénéficiaires effectifs",
  declaration_source_fonds: "Déclaration source des fonds",
  justificatif_patrimoine: "Justificatif de patrimoine",
};

const VIGILANCE_BADGE: Record<VigilanceLevel, { label: string; className: string }> = {
  allegee: { label: "Allégée", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  normale: { label: "Normale", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" },
  renforcee: { label: "Renforcée", className: "bg-red-500/15 text-red-500 border-red-500/20" },
};

export default function KycChecklist({
  vigilanceLevel,
  existingCategories,
  onRequestDocument,
}: KycChecklistProps) {
  const requiredDocs = REQUIRED_DOCS[vigilanceLevel];
  const existingLower = existingCategories.map((c) => c.toLowerCase());
  const presentCount = requiredDocs.filter((cat) => existingLower.includes(cat)).length;
  const isComplete = presentCount === requiredDocs.length;
  const progressValue = requiredDocs.length > 0 ? Math.round((presentCount / requiredDocs.length) * 100) : 0;
  const badgeConfig = VIGILANCE_BADGE[vigilanceLevel];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Checklist KYC</h3>
        <Badge variant="outline" className={badgeConfig.className}>
          Vigilance {badgeConfig.label}
        </Badge>
      </div>

      {/* Document lines */}
      <div className="space-y-1 animate-stagger-in">
        {requiredDocs.map((cat) => {
          const isPresent = existingLower.includes(cat);
          return (
            <div
              key={cat}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isPresent ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                  onClick={() => onRequestDocument(cat)}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Demander
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{presentCount}/{requiredDocs.length} documents fournis</span>
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
    </div>
  );
}
