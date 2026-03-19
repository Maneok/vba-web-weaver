import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Client, AlerteRegistre } from "@/lib/types";
import { formatDateFr } from "@/lib/dateUtils";

interface DrillDownSheetProps {
  open: boolean;
  onClose: () => void;
  type: "clients" | "alertes" | "revues" | null;
  clients: Client[];
  alertes: AlerteRegistre[];
}

function vigilanceColor(niv: string) {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  return "bg-red-500/15 text-red-500 border-red-500/30";
}

export function DrillDownSheet({ open, onClose, type, clients, alertes }: DrillDownSheetProps) {
  const navigate = useNavigate();

  const title = type === "clients" ? "Clients actifs"
    : type === "alertes" ? "Alertes en cours"
    : type === "revues" ? "Revues echues"
    : "";

  const now = new Date();

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {type === "clients" && (
            clients
              .filter(c => c.statut === "ACTIF" || c.etat === "VALIDE" || c.etat === "EN COURS")
              .slice(0, 20)
              .map((c) => (
                <button
                  key={c.ref}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => { onClose(); navigate(`/client/${c.ref}`); }}
                >
                  <div>
                    <p className="text-sm font-medium">{c.raisonSociale}</p>
                    <p className="text-xs text-muted-foreground">{c.ref} &mdash; {c.forme}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{c.scoreGlobal}</span>
                    <Badge variant="outline" className={`text-[10px] ${vigilanceColor(c.nivVigilance)}`}>
                      {c.nivVigilance}
                    </Badge>
                  </div>
                </button>
              ))
          )}

          {type === "alertes" && (
            alertes
              .filter(a => {
                const s = (a.statut || "").toUpperCase();
                return !s.includes("CLOS") && !s.includes("FERME") && !s.includes("RESOLU");
              })
              .slice(0, 20)
              .map((a, i) => (
                <button
                  key={a.id || i}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => { onClose(); navigate("/registre"); }}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.clientConcerne}</p>
                    <p className="text-xs text-muted-foreground">{a.categorie}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.details?.slice(0, 80)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-500 border-orange-500/30 shrink-0">
                    {a.statut}
                  </Badge>
                </button>
              ))
          )}

          {type === "revues" && (
            clients
              .filter(c => {
                if (!c.dateButoir) return false;
                try { return new Date(c.dateButoir) < now; } catch { return false; }
              })
              .slice(0, 20)
              .map((c) => {
                const butoir = new Date(c.dateButoir);
                const daysOverdue = isNaN(butoir.getTime()) ? 0 : Math.ceil((now.getTime() - butoir.getTime()) / (1000 * 60 * 60 * 24));
                const fmtDate = isNaN(butoir.getTime()) ? c.dateButoir : formatDateFr(butoir);
                return (
                  <button
                    key={c.ref}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    onClick={() => { onClose(); navigate(`/client/${c.ref}`); }}
                  >
                    <div>
                      <p className="text-sm font-medium">{c.raisonSociale || c.ref}</p>
                      <p className="text-xs text-muted-foreground">
                        Echeance : {fmtDate}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">
                      {daysOverdue}j de retard
                    </Badge>
                  </button>
                );
              })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
