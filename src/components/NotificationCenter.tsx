import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { Bell, AlertTriangle, Clock, UserPlus, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: string;
  type: "warning" | "info" | "alert";
  title: string;
  message: string;
  timestamp: string;
  link?: string;
}

export default function NotificationCenter() {
  const { clients, alertes } = useAppState();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("dismissed_notifs");
      if (!stored) return new Set<string>();
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? new Set<string>(parsed) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Auto-generate notifications from app state
  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Clients en retard
    const retards = clients.filter(c => c.etatPilotage === "RETARD");
    if (retards.length > 0) {
      notifs.push({
        id: `retard-${retards.length}`,
        type: "warning",
        title: `${retards.length} client${retards.length > 1 ? "s" : ""} en retard`,
        message: retards.slice(0, 3).map(c => c.raisonSociale).join(", ") + (retards.length > 3 ? "..." : ""),
        timestamp: today,
        link: "/bdd?pilotage=RETARD",
      });
    }

    // Clients bientot a echeance
    const bientot = clients.filter(c => c.etatPilotage === "BIENTÔT");
    if (bientot.length > 0) {
      notifs.push({
        id: `bientot-${bientot.length}`,
        type: "info",
        title: `${bientot.length} client${bientot.length > 1 ? "s" : ""} bientot a echeance`,
        message: "Revue periodique a planifier prochainement",
        timestamp: today,
        link: "/bdd?pilotage=BIENT%C3%94T",
      });
    }

    // Alertes en cours
    const alertesEnCours = alertes.filter(a => a.statut === "EN COURS");
    if (alertesEnCours.length > 0) {
      notifs.push({
        id: `alertes-${alertesEnCours.length}`,
        type: "alert",
        title: `${alertesEnCours.length} alerte${alertesEnCours.length > 1 ? "s" : ""} en cours`,
        message: "Des investigations sont en attente de resolution",
        timestamp: today,
        link: "/registre",
      });
    }

    // KYC incomplets
    const kycIncomplete = clients.filter(c => {
      let s = 0;
      if (c.siren) s += 25;
      if (c.mail) s += 25;
      if (c.iban) s += 25;
      if (c.adresse) s += 25;
      return s < 75;
    });
    if (kycIncomplete.length > 0) {
      notifs.push({
        id: `kyc-${kycIncomplete.length}`,
        type: "info",
        title: `${kycIncomplete.length} dossier${kycIncomplete.length > 1 ? "s" : ""} KYC incomplet${kycIncomplete.length > 1 ? "s" : ""}`,
        message: "Des informations manquent pour la conformite",
        timestamp: today,
        link: "/bdd",
      });
    }

    return notifs;
  }, [clients, alertes]);

  const visible = notifications.filter(n => !dismissed.has(n.id));

  useEffect(() => {
    sessionStorage.setItem("dismissed_notifs", JSON.stringify([...dismissed]));
  }, [dismissed]);

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      visible.forEach(n => next.add(n.id));
      return next;
    });
  }, [visible]);

  const handleNotifClick = useCallback((n: Notification) => {
    if (n.link) navigate(n.link);
  }, [navigate]);

  const iconMap = {
    warning: <Clock className="h-4 w-4 text-amber-400" />,
    info: <UserPlus className="h-4 w-4 text-blue-400" />,
    alert: <AlertTriangle className="h-4 w-4 text-red-400" />,
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0" aria-label={`Notifications (${visible.length})`}>
          <Bell className="h-4 w-4 text-slate-400" />
          {visible.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-badge-pulse">
              {Math.min(visible.length, 9)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-slate-900 border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
          {visible.length > 1 && (
            <button
              onClick={dismissAll}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Tout marquer comme lu"
            >
              <CheckCheck className="h-3 w-3" /> Tout lire
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto" role="list">
          {visible.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune notification</p>
              <p className="text-xs text-slate-600 mt-1">Tout est a jour</p>
            </div>
          ) : (
            visible.map(n => (
              <div
                key={n.id}
                role="listitem"
                className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] group ${n.link ? "cursor-pointer" : ""}`}
                onClick={() => handleNotifClick(n)}
              >
                <div className="mt-0.5 shrink-0">{iconMap[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  {n.link && <p className="text-[10px] text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Cliquer pour voir</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  aria-label="Ignorer cette notification"
                >
                  <X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
