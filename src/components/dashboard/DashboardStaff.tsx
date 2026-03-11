import { useMemo } from "react";
import { Users2, GraduationCap, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Collaborateur } from "@/lib/types";

interface DashboardStaffProps {
  collaborateurs: Collaborateur[];
  isLoading: boolean;
}

function getTrainingStatus(derniereFormation: string | undefined): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (!derniereFormation) {
    return { label: "Expirée", color: "text-red-700", bgColor: "bg-red-100" };
  }

  const formationDate = new Date(derniereFormation);
  if (isNaN(formationDate.getTime())) {
    return { label: "Expirée", color: "text-red-700", bgColor: "bg-red-100" };
  }

  const now = new Date();
  const diffMs = now.getTime() - formationDate.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);

  if (diffMonths < 12) {
    return { label: "À jour", color: "text-green-700", bgColor: "bg-green-100" };
  }
  if (diffMonths < 15) {
    return { label: "Bientôt", color: "text-orange-700", bgColor: "bg-orange-100" };
  }
  return { label: "Expirée", color: "text-red-700", bgColor: "bg-red-100" };
}

const MAX_VISIBLE = 6;

export default function DashboardStaff({ collaborateurs, isLoading }: DashboardStaffProps) {
  const stats = useMemo(() => {
    const total = collaborateurs.length;
    let formes = 0;
    let aFormer = 0;

    for (const col of collaborateurs) {
      const status = getTrainingStatus(col.derniereFormation);
      if (status.label === "À jour") {
        formes++;
      } else {
        aFormer++;
      }
    }

    return { total, formes, aFormer };
  }, [collaborateurs]);

  const referent = useMemo(
    () => collaborateurs.find((col) => col.referentLcb === true),
    [collaborateurs]
  );

  const visibleCollaborateurs = collaborateurs.slice(0, MAX_VISIBLE);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5" aria-busy="true" aria-label="Chargement de l'équipe">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-4 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-20 rounded bg-muted animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (collaborateurs.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5" aria-label="Équipe et formations">
        <div className="flex items-center gap-2 mb-4">
          <Users2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Équipe & formations</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun collaborateur enregistré
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5" aria-label="Équipe et formations">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm">Équipe & formations</h3>
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users2 className="h-3.5 w-3.5" />
          {stats.total} collaborateur{stats.total > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap className="h-3.5 w-3.5 text-green-600" />
          {stats.formes} formé{stats.formes > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          {stats.aFormer} à former
        </span>
      </div>

      {/* Référent LCB-FT highlight */}
      {referent && (
        <div className="flex items-center gap-2 mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-800 dark:text-blue-300">
            <span className="font-medium">Référent LCB-FT :</span> {referent.nom}
          </span>
        </div>
      )}

      {/* Collaborateur list */}
      <ul role="list" className="space-y-2" aria-label="Liste des collaborateurs">
        {visibleCollaborateurs.map((col, index) => {
          const training = getTrainingStatus(col.derniereFormation);
          return (
            <li
              key={col.id ?? index}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
              aria-label={`${col.nom}, ${col.fonction}`}
            >
              {/* Avatar placeholder */}
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                {col.nom
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{col.nom}</span>
                  {col.referentLcb && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Référent
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{col.fonction}</span>
                  {col.niveauCompetence && (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate">{col.niveauCompetence}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Training badge */}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${training.bgColor} ${training.color} shrink-0`}
                aria-label={`Formation : ${training.label}`}
              >
                {training.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Overflow indicator */}
      {collaborateurs.length > MAX_VISIBLE && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          + {collaborateurs.length - MAX_VISIBLE} autre{collaborateurs.length - MAX_VISIBLE > 1 ? "s" : ""} collaborateur{collaborateurs.length - MAX_VISIBLE > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
