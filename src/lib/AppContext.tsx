import React, { createContext, useContext, useState, useCallback } from "react";
import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "@/lib/types";
import { SAMPLE_CLIENTS, SAMPLE_COLLABORATEURS, SAMPLE_ALERTES, SAMPLE_LOGS } from "@/lib/sampleData";

interface AppState {
  clients: Client[];
  collaborateurs: Collaborateur[];
  alertes: AlerteRegistre[];
  logs: LogEntry[];
  addClient: (client: Client) => void;
  updateClient: (ref: string, updates: Partial<Client>) => void;
  addLog: (log: LogEntry) => void;
  addAlerte: (alerte: AlerteRegistre) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(SAMPLE_CLIENTS);
  const [collaborateurs] = useState<Collaborateur[]>(SAMPLE_COLLABORATEURS);
  const [alertes, setAlertes] = useState<AlerteRegistre[]>(SAMPLE_ALERTES);
  const [logs, setLogs] = useState<LogEntry[]>(SAMPLE_LOGS);

  const addClient = useCallback((client: Client) => {
    setClients(prev => [...prev, client]);
    setLogs(prev => [{
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: client.ref,
      typeAction: "CREATION",
      details: `Nouveau dossier cree: ${client.raisonSociale}`,
    }, ...prev]);
  }, []);

  const updateClient = useCallback((ref: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.ref === ref ? { ...c, ...updates } : c));
    setLogs(prev => [{
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: ref,
      typeAction: "REVUE/MAJ",
      details: `Mise a jour du dossier`,
    }, ...prev]);
  }, []);

  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev]);
  }, []);

  const addAlerte = useCallback((alerte: AlerteRegistre) => {
    setAlertes(prev => [...prev, alerte]);
  }, []);

  return (
    <AppContext.Provider value={{ clients, collaborateurs, alertes, logs, addClient, updateClient, addLog, addAlerte }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
