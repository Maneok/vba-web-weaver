import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "@/lib/types";
import { O90_CLIENTS, O90_COLLABORATEURS, O90_ALERTES, O90_LOGS } from "@/lib/dataLoader";
import { clientsService, collaborateursService, registreService, logsService } from "@/lib/supabaseService";
import { mapDbClient, mapClientToDb, mapDbCollaborateur, mapDbAlerte, mapAlerteToDb, mapDbLog } from "@/lib/dbMappers";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface AppState {
  clients: Client[];
  collaborateurs: Collaborateur[];
  alertes: AlerteRegistre[];
  logs: LogEntry[];
  isLoading: boolean;
  isOnline: boolean; // true = connected to Supabase
  addClient: (client: Client) => void;
  updateClient: (ref: string, updates: Partial<Client>) => void;
  deleteClient: (ref: string) => void;
  addLog: (log: LogEntry) => void;
  addAlerte: (alerte: AlerteRegistre) => void;
  refreshClients: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [alertes, setAlertes] = useState<AlerteRegistre[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const initialized = useRef(false);
  // Ref to avoid stale closure in updateClient/deleteClient callbacks
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  // Load data from Supabase or fallback to JSON
  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No auth session: use local JSON data
        setClients(O90_CLIENTS);
        setCollaborateurs(O90_COLLABORATEURS);
        setAlertes(O90_ALERTES);
        setLogs(O90_LOGS);
        setIsOnline(false);
        setIsLoading(false);
        return;
      }

      // Authenticated: load from Supabase
      const [dbClients, dbCollabs, dbAlertes, dbLogs] = await Promise.all([
        clientsService.getAll(),
        collaborateursService.getAll(),
        registreService.getAll(),
        logsService.getAll(),
      ]);

      // Authenticated: always use Supabase data (even if 0 rows — new cabinet)
      setIsOnline(true);
      setClients(dbClients.map((r: Record<string, unknown>) => mapDbClient(r)));
      setCollaborateurs(dbCollabs.map((r: Record<string, unknown>) => mapDbCollaborateur(r)));
      setAlertes(dbAlertes.map((r: Record<string, unknown>) => mapDbAlerte(r)));
      setLogs(dbLogs.map((r: Record<string, unknown>) => mapDbLog(r)));
    } catch (err: unknown) {
      logger.error("[AppContext] Failed to load from Supabase, using local data:", err);
      setClients(O90_CLIENTS);
      setCollaborateurs(O90_COLLABORATEURS);
      setAlertes(O90_ALERTES);
      setLogs(O90_LOGS);
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Re-load on meaningful auth events (not TOKEN_REFRESHED which fires frequently)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        loadData();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  const refreshClients = useCallback(async () => {
    if (!isOnline) return;
    const dbClients = await clientsService.getAll();
    setClients(dbClients.map((r: Record<string, unknown>) => mapDbClient(r)));
  }, [isOnline]);

  const refreshAll = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const addClient = useCallback((client: Client) => {
    // Optimistic update
    setClients(prev => [client, ...prev]);

    // Persist to Supabase in background (with rollback on failure)
    if (isOnline) {
      const dbRow = mapClientToDb(client);
      clientsService.create(dbRow).then((result) => {
        if (!result) {
          logger.error("AppContext", "Failed to persist client to Supabase");
          setClients(prev => prev.filter(c => c.ref !== client.ref));
          toast.error("Erreur lors de la sauvegarde du client");
          return;
        }
        logsService.add("CREATION", `Nouveau dossier cree: ${client.raisonSociale}`, client.ref, "clients");
      }).catch((err) => {
        logger.error("AppContext", "Create client exception:", err);
        setClients(prev => prev.filter(c => c.ref !== client.ref));
        toast.error("Erreur lors de la sauvegarde du client");
      });
    }

    // Local log entry
    setLogs(prev => [{
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: client.ref,
      typeAction: "CREATION",
      details: `Nouveau dossier cree: ${client.raisonSociale}`,
    }, ...prev]);
  }, [isOnline]);

  const updateClient = useCallback((ref: string, updates: Partial<Client>) => {
    // Capture snapshot inside updater to avoid stale closure
    let snapshot: Client | undefined;
    setClients(prev => {
      snapshot = prev.find(c => c.ref === ref);
      return prev.map(c => c.ref === ref ? { ...c, ...updates } : c);
    });

    // Persist to Supabase (with rollback on failure)
    if (isOnline) {
      const dbUpdates = mapClientToDb(updates);
      clientsService.updateByRef(ref, dbUpdates).then((result) => {
        if (!result) {
          logger.error("AppContext", "Failed to update client in Supabase");
          if (snapshot) setClients(prev => prev.map(c => c.ref === ref ? snapshot! : c));
          toast.error("Erreur lors de la mise a jour du client");
          return;
        }
        logsService.add("REVUE/MAJ", `Mise a jour du dossier ${ref}`, ref, "clients");
      }).catch((err) => {
        logger.error("AppContext", "Update client exception:", err);
        if (snapshot) setClients(prev => prev.map(c => c.ref === ref ? snapshot! : c));
        toast.error("Erreur lors de la mise a jour du client");
      });
    }

    setLogs(prev => [{
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: ref,
      typeAction: "REVUE/MAJ",
      details: `Mise a jour du dossier`,
    }, ...prev]);
  }, [isOnline]);

  const deleteClient = useCallback((ref: string) => {
    let removedClient: Client | undefined;
    setClients(prev => {
      removedClient = prev.find(c => c.ref === ref);
      return prev.filter(c => c.ref !== ref);
    });

    if (isOnline && removedClient) {
      const clientName = removedClient.raisonSociale;
      clientsService.deleteByRef(ref).then(() => {
        logsService.add("SUPPRESSION", `Dossier supprime: ${clientName}`, ref, "clients");
      }).catch((err) => {
        logger.error("AppContext", "Failed to delete client:", err);
        if (removedClient) setClients(prev => [removedClient!, ...prev]);
        toast.error("Erreur lors de la suppression du client");
      });
    }
  }, [isOnline]);

  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev]);

    if (isOnline) {
      logsService.add(log.typeAction, log.details, log.refClient, "");
    }
  }, [isOnline]);

  const addAlerte = useCallback((alerte: AlerteRegistre) => {
    setAlertes(prev => [alerte, ...prev]);

    if (isOnline) {
      const dbRow = mapAlerteToDb(alerte);
      registreService.create(dbRow).catch((err) => {
        logger.error("AppContext", "Create alerte exception:", err);
        setAlertes(prev => prev.filter(a => a !== alerte));
        toast.error("Erreur lors de la sauvegarde de l'alerte");
      });
      logsService.add("ALERTE", `Nouvelle alerte: ${alerte.categorie} - ${alerte.clientConcerne}`, "", "alertes_registre");
    }
  }, [isOnline]);

  const contextValue = useMemo<AppState>(() => ({
    clients, collaborateurs, alertes, logs,
    isLoading, isOnline,
    addClient, updateClient, deleteClient, addLog, addAlerte,
    refreshClients, refreshAll,
  }), [clients, collaborateurs, alertes, logs, isLoading, isOnline, addClient, updateClient, deleteClient, addLog, addAlerte, refreshClients, refreshAll]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
