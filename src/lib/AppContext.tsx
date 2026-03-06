import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Client, Collaborateur, AlerteRegistre, LogEntry, CockpitAlert } from "@/lib/types";
import { loadClients, loadCollaborateurs, loadAlertes, loadLogs, loadParamData, calculateKycCompleteness } from "@/lib/dataLoader";
import type { ParamData } from "@/lib/dataLoader";

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

interface AppState {
  clients: Client[];
  collaborateurs: Collaborateur[];
  alertes: AlerteRegistre[];
  logs: LogEntry[];
  params: ParamData;
  cockpitAlerts: CockpitAlert[];
  unreadAlertCount: number;
  addClient: (client: Client) => void;
  updateClient: (ref: string, updates: Partial<Client>) => void;
  deleteClient: (ref: string) => void;
  addLog: (log: LogEntry) => void;
  addAlerte: (alerte: AlerteRegistre) => void;
  updateAlerte: (index: number, updates: Partial<AlerteRegistre>) => void;
  setCollaborateurs: (collabs: Collaborateur[]) => void;
  setParams: (params: ParamData) => void;
  dismissAlert: (index: number) => void;
}

const AppContext = createContext<AppState | null>(null);

function enrichClients(clients: Client[]): Client[] {
  return clients.map(c => ({
    ...c,
    kycCompleteness: calculateKycCompleteness(c),
    scoreHistory: c.scoreHistory?.length ? c.scoreHistory : [{
      date: c.dateCreationLigne || c.dateDerniereRevue || new Date().toISOString().split("T")[0],
      scoreGlobal: c.scoreGlobal,
      nivVigilance: c.nivVigilance,
      motif: "Score initial",
      details: {
        scoreActivite: c.scoreActivite,
        scorePays: c.scorePays,
        scoreMission: c.scoreMission,
        scoreMaturite: c.scoreMaturite,
        scoreStructure: c.scoreStructure,
        malus: c.malus,
      },
    }],
  }));
}

function generateCockpitAlerts(clients: Client[], collaborateurs: Collaborateur[]): CockpitAlert[] {
  const alerts: CockpitAlert[] = [];
  const now = new Date();

  clients.forEach(c => {
    if (c.etatPilotage === "RETARD") {
      alerts.push({ type: "retard", severity: "critical", message: `Révision en retard — butoir: ${c.dateButoir}`, clientRef: c.ref, clientName: c.raisonSociale });
    }
    if (c.dateExpCni) {
      const exp = new Date(c.dateExpCni);
      if (exp < now) {
        alerts.push({ type: "cni_expire", severity: "critical", message: `CNI expirée depuis le ${c.dateExpCni}`, clientRef: c.ref, clientName: c.raisonSociale });
      } else {
        const days = (exp.getTime() - now.getTime()) / 86400000;
        if (days < 90) alerts.push({ type: "cni_expire", severity: "warning", message: `CNI expire dans ${Math.round(days)}j (${c.dateExpCni})`, clientRef: c.ref, clientName: c.raisonSociale });
      }
    }
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI" || c.atypique === "OUI")) {
      alerts.push({ type: "incoherence", severity: "critical", message: `Vigilance Simplifiée + facteurs de risque actifs`, clientRef: c.ref, clientName: c.raisonSociale });
    }
    const kyc = c.kycCompleteness ?? 0;
    if (kyc < 70) {
      alerts.push({ type: "kyc_incomplet", severity: kyc < 50 ? "critical" : "warning", message: `KYC incomplet: ${kyc}%`, clientRef: c.ref, clientName: c.raisonSociale });
    }
    if ((c.ref || c.honoraires > 0) && !c.raisonSociale) {
      alerts.push({ type: "fantome", severity: "warning", message: `Ligne fantôme détectée`, clientRef: c.ref });
    }
  });

  collaborateurs.forEach(col => {
    if (col.statutFormation.includes("FORMER") || col.statutFormation.includes("JAMAIS")) {
      alerts.push({ type: "formation", severity: "warning", message: `${col.nom} — ${col.statutFormation}` });
    }
  });

  return alerts;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(() => enrichClients(loadClients()));
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>(loadCollaborateurs);
  const [alertes, setAlertes] = useState<AlerteRegistre[]>(loadAlertes);
  const [logs, setLogs] = useState<LogEntry[]>(loadLogs);
  const [params, setParams] = useState<ParamData>(loadParamData);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());

  const cockpitAlerts = useMemo(() => generateCockpitAlerts(clients, collaborateurs), [clients, collaborateurs]);
  const unreadAlertCount = useMemo(() => cockpitAlerts.filter((_, i) => !dismissedAlerts.has(i)).length, [cockpitAlerts, dismissedAlerts]);

  const addClient = useCallback((client: Client) => {
    const enriched = { ...client, kycCompleteness: calculateKycCompleteness(client) };
    setClients(prev => [...prev, enriched]);
    setLogs(prev => [{ horodatage: timestamp(), utilisateur: "Utilisateur", refClient: client.ref, typeAction: "CRÉATION", details: `Nouveau dossier créé: ${client.raisonSociale}` }, ...prev]);
  }, []);

  const updateClient = useCallback((ref: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => {
      if (c.ref !== ref) return c;
      const updated = { ...c, ...updates };
      updated.kycCompleteness = calculateKycCompleteness(updated);
      if (updates.scoreGlobal !== undefined && updates.scoreGlobal !== c.scoreGlobal) {
        updated.scoreHistory = [...(c.scoreHistory || []), {
          date: new Date().toISOString().split("T")[0],
          scoreGlobal: updates.scoreGlobal,
          nivVigilance: updates.nivVigilance || c.nivVigilance,
          motif: "Modification manuelle",
          details: { scoreActivite: updates.scoreActivite ?? c.scoreActivite, scorePays: updates.scorePays ?? c.scorePays, scoreMission: updates.scoreMission ?? c.scoreMission, scoreMaturite: updates.scoreMaturite ?? c.scoreMaturite, scoreStructure: updates.scoreStructure ?? c.scoreStructure, malus: updates.malus ?? c.malus },
        }];
      }
      return updated;
    }));
    setLogs(prev => [{ horodatage: timestamp(), utilisateur: "Utilisateur", refClient: ref, typeAction: "REVUE/MAJ", details: `Mise à jour du dossier` }, ...prev]);
  }, []);

  const deleteClient = useCallback((ref: string) => {
    setClients(prev => prev.filter(c => c.ref !== ref));
    setLogs(prev => [{ horodatage: timestamp(), utilisateur: "Utilisateur", refClient: ref, typeAction: "SUPPRESSION", details: `Dossier supprimé` }, ...prev]);
  }, []);

  const addLog = useCallback((log: LogEntry) => { setLogs(prev => [log, ...prev]); }, []);
  const addAlerte = useCallback((alerte: AlerteRegistre) => { setAlertes(prev => [...prev, alerte]); }, []);
  const updateAlerte = useCallback((index: number, updates: Partial<AlerteRegistre>) => { setAlertes(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a)); }, []);
  const dismissAlert = useCallback((index: number) => { setDismissedAlerts(prev => new Set([...prev, index])); }, []);

  return (
    <AppContext.Provider value={{
      clients, collaborateurs, alertes, logs, params,
      cockpitAlerts, unreadAlertCount,
      addClient, updateClient, deleteClient,
      addLog, addAlerte, updateAlerte,
      setCollaborateurs, setParams, dismissAlert,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
