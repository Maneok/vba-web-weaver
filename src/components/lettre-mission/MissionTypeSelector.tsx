import { MISSION_TYPES, MISSION_CATEGORIES, getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import type { MissionTypeConfig } from "@/lib/lettreMissionTypes";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, Scale, Shield, Briefcase, CheckCircle2, XCircle } from "lucide-react";

interface MissionTypeSelectorProps {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  showSummary?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  assurance_comptes: Shield,
  autres_assurance: Scale,
  sans_assurance: FileText,
  activites: Briefcase,
};

export default function MissionTypeSelector({
  value,
  onValueChange,
  disabled,
  showSummary = true,
}: MissionTypeSelectorProps) {
  const selected = value ? getMissionTypeConfig(value) : null;

  return (
    <div className="space-y-3">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder="Type de mission" />
        </SelectTrigger>
        <SelectContent className="max-h-[350px]">
          {MISSION_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] || FileText;
            return (
              <SelectGroup key={cat.category}>
                <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-2 py-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </SelectLabel>
                {cat.missions.map((mId) => {
                  const config = MISSION_TYPES[mId as keyof typeof MISSION_TYPES];
                  if (!config) return null;
                  return (
                    <SelectItem key={mId} value={mId} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{config.shortLabel}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] px-1.5 py-0 shrink-0 font-mono"
                        >
                          {config.normeRef}
                        </Badge>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      {showSummary && selected && (
        <Card className="p-3 space-y-2 bg-muted/30 border-muted">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">
                {selected.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.description}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 text-xs font-mono"
            >
              {selected.normeRef}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {selected.formeRapport}
            </Badge>
            {selected.honorairesSuccesAutorises ? (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Honoraires de succès autorisés
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">
                <XCircle className="h-3 w-3 mr-1" />
                Honoraires de succès interdits
              </Badge>
            )}
          </div>
          {selected.specificVariables.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {selected.specificVariables.length} variable(s) spécifique(s) à renseigner
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
