import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Client } from "@/lib/types";

interface ConditionalAlertsProps {
  client: Client | null;
  missions: { sociale: boolean; juridique: boolean; fiscal: boolean };
  /** Called once per alert to prevent repeats */
  shownAlerts: Set<string>;
  onAlertShown: (key: string) => void;
}

/**
 * Fires toast suggestions based on client data and mission configuration.
 * A) Conditional logic: suggestions, incompatibility warnings, vigilance banners.
 */
export function useConditionalAlerts({
  client,
  missions,
  shownAlerts,
  onAlertShown,
}: ConditionalAlertsProps) {
  const prevClientRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;
    // Only trigger alerts once per client change
    if (prevClientRef.current === client.ref) return;
    prevClientRef.current = client.ref;

    // Delay toasts so they don't stack on mount
    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 500;

    function showOnce(key: string, fn: () => void) {
      if (shownAlerts.has(key)) return;
      timers.push(setTimeout(fn, delay));
      delay += 800;
      onAlertShown(key);
    }

    // 1. Effectif > 0 and social mission not enabled
    const hasEmployees = client.effectif && !/^0\b|^0 |AUCUN|NEANT|0 SALAR/i.test(client.effectif.trim()) && client.effectif.trim() !== "0";
    if (hasEmployees && !missions.sociale) {
      showOnce(`social_suggest_${client.ref}`, () => {
        toast.info(
          `Ce client a ${client.effectif} salarie(s). Souhaitez-vous ajouter la mission sociale ?`,
          { duration: 8000 }
        );
      });
    }

    // 2. SCI without juridique mission
    const isSCI = (client.forme || "").toUpperCase().includes("SCI");
    if (isSCI && !missions.juridique) {
      showOnce(`sci_juridique_${client.ref}`, () => {
        toast.info(
          "90% des SCI necessitent l'AG annuelle. Pensez a ajouter la mission juridique.",
          { duration: 8000 }
        );
      });
    }

    // 3. Score > 60 (vigilance renforcee)
    if (client.scoreGlobal > 60) {
      showOnce(`vigilance_renforcee_${client.ref}`, () => {
        toast.warning(
          "Client a vigilance renforcee — envisagez un complement d'honoraires.",
          { duration: 10000 }
        );
      });
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [client, missions, shownAlerts, onAlertShown]);
}

/**
 * Check for incompatible mission combinations.
 * Returns an error message if tenue AND surveillance are both selected.
 */
export function checkMissionIncompatibility(client: Client | null): string | null {
  if (!client) return null;
  const mission = (client.mission || "").toUpperCase();
  // This checks if the client's main mission is "TENUE COMPTABLE" and also has "REVISION / SURVEILLANCE"
  // In practice, this would be checked against the selected missions in the wizard
  if (mission.includes("TENUE") && mission.includes("REVISION")) {
    return "Missions incompatibles : Tenue comptable et Revision/Surveillance ne peuvent pas etre selectionnees simultanement.";
  }
  return null;
}

/**
 * Vigilance banner component for renforcee clients
 */
export function VigilanceBanner({ client }: { client: Client | null }) {
  if (!client || client.scoreGlobal <= 60) return null;

  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 flex items-center gap-2">
      <span className="text-orange-400 text-sm font-medium">
        Client a vigilance renforcee (score : {client.scoreGlobal}/100) — envisagez un complement d'honoraires
      </span>
    </div>
  );
}
