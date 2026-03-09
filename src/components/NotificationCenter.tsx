import { useState, useEffect, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Bell, AlertTriangle, Clock, UserPlus, X } from "lucide-react";
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
}

export default function NotificationCenter() {
  const { clients, alertes } = useAppState();
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
      });
    }

    return notifs;
  }, [clients, alertes]);

  const visible = notifications.filter(n => !dismissed.has(n.id));

  useEffect(() => {
    sessionStorage.setItem("dismissed_notifs", JSON.stringify([...dismissed]));
  }, [dismissed]);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const iconMap = {
    warning: <Clock className="h-4 w-4 text-amber-400" />,
    info: <UserPlus className="h-4 w-4 text-blue-400" />,
    alert: <AlertTriangle className="h-4 w-4 text-red-400" />,
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4 text-slate-400" />
          {visible.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {visible.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-slate-900 border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Aucune notification
            </div>
          ) : (
            visible.map(n => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] group">
                <div className="mt-0.5 shrink-0">{iconMap[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
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
