import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Shield, AlertTriangle } from "lucide-react";
import type { Collaborateur } from "@/lib/types";

function getInitials(nom: string) {
  return nom
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isFormationExpired(dateStr: string) {
  if (!dateStr) return true;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return true;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24) > 365;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

interface OrgCardProps {
  collab: Collaborateur;
  roleLabel: string;
  accent?: string;
}

function OrgCard({ collab, roleLabel, accent = "border-slate-700" }: OrgCardProps) {
  const expired = isFormationExpired(collab.derniereFormation);
  return (
    <div className={`relative bg-white/[0.03] border ${accent} rounded-lg p-3 min-w-[180px] max-w-[220px]`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
          {getInitials(collab.nom)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{collab.nom}</p>
          <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <GraduationCap className="w-3 h-3 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500">Formation :</span>
        {expired ? (
          <Badge className="bg-red-500/15 text-red-400 text-[10px] px-1.5 py-0 gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> Expiree
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] px-1.5 py-0">
            A jour
          </Badge>
        )}
      </div>
      {collab.derniereFormation && (
        <p className="text-[10px] text-slate-600 mt-1 ml-4">
          {formatDate(collab.derniereFormation)}
        </p>
      )}
    </div>
  );
}

export default function OrganigrammeLCB() {
  const { collaborateurs } = useAppState();

  const { associes, referentLcb, correspondantTracfin, superviseurs, collabsEtStagiaires } = useMemo(() => {
    const associes = collaborateurs.filter(c => c.fonction === "ASSOCIE SIGNATAIRE");
    const referentLcb = collaborateurs.find(c => c.referentLcb);
    // The suppleant field can reference the TRACFIN correspondent
    const correspondantTracfin = collaborateurs.find(c =>
      (c.suppleant && c.suppleant.toLowerCase().includes("tracfin")) ||
      (c.fonction && c.fonction.toLowerCase().includes("tracfin"))
    );
    const superviseurs = collaborateurs.filter(c => c.fonction === "SUPERVISEUR");
    const collabsEtStagiaires = collaborateurs.filter(c =>
      ["COLLABORATEUR", "STAGIAIRE", "ALTERNANT", "SECRETAIRE"].includes(c.fonction) && !c.referentLcb
    );
    return { associes, referentLcb, correspondantTracfin, superviseurs, collabsEtStagiaires };
  }, [collaborateurs]);

  if (collaborateurs.length === 0) {
    return (
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-8 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun collaborateur enregistre.</p>
          <p className="text-xs mt-1">Ajoutez des collaborateurs dans l'annuaire pour construire l'organigramme.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Organigramme du dispositif LCB-FT
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex flex-col items-center gap-0 min-w-[500px]">
          {/* Niveau 1 : Associes signataires */}
          {associes.length > 0 && (
            <>
              <div className="flex gap-4 justify-center flex-wrap">
                {associes.map(a => (
                  <OrgCard key={a.id || a.nom} collab={a} roleLabel="Associe signataire" accent="border-purple-500/40" />
                ))}
              </div>
              <div className="w-px h-6 bg-slate-700" />
            </>
          )}

          {/* Niveau 2 : Referent LCB + Correspondant TRACFIN */}
          <div className="flex gap-6 justify-center flex-wrap">
            {referentLcb && (
              <div className="flex flex-col items-center">
                <OrgCard collab={referentLcb} roleLabel="Referent LCB-FT" accent="border-blue-500/40" />
              </div>
            )}
            {correspondantTracfin && correspondantTracfin !== referentLcb && (
              <div className="flex flex-col items-center">
                <OrgCard collab={correspondantTracfin} roleLabel="Correspondant TRACFIN" accent="border-amber-500/40" />
              </div>
            )}
          </div>

          {/* Ligne de connexion */}
          {(superviseurs.length > 0 || collabsEtStagiaires.length > 0) && (
            <div className="w-px h-6 bg-slate-700" />
          )}

          {/* Niveau 3 : Superviseurs */}
          {superviseurs.length > 0 && (
            <>
              <div className="relative flex gap-4 justify-center flex-wrap">
                {/* Ligne horizontale */}
                {superviseurs.length > 1 && (
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-700" />
                )}
                {superviseurs.map(s => (
                  <OrgCard key={s.id || s.nom} collab={s} roleLabel="Superviseur" accent="border-emerald-500/40" />
                ))}
              </div>
              {collabsEtStagiaires.length > 0 && <div className="w-px h-6 bg-slate-700" />}
            </>
          )}

          {/* Niveau 4 : Collaborateurs + Stagiaires */}
          {collabsEtStagiaires.length > 0 && (
            <div className="flex gap-3 justify-center flex-wrap">
              {collabsEtStagiaires.map(c => (
                <OrgCard key={c.id || c.nom} collab={c} roleLabel={c.fonction} accent="border-slate-700" />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
