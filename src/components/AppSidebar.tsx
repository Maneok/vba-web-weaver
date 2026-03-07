import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";

  const location = useLocation();
  const { alertes, clients } = useAppState();

  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS").length;
  const retardCount = clients.filter(c => c.etatPilotage === "RETARD").length;

  const badges: Record<string, number> = {
    "/": retardCount,
    "/registre": alertesEnCours,
  };


  return (

  );
}
