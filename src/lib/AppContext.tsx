import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type MutableRefObject } from "react";
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
  addClient: (client: Client) => Promise<void>;
  updateClient: (ref: string, updates: Partial<Client>) => void;
  deleteClient: (ref: string) => void;
  addLog: (log: LogEntry) => void;
  addAlerte: (alerte: AlerteRegistre) => void;
  updateAlerte: (id: string, updates: Partial<AlerteRegistre>) => void;
  deleteAlerte: (id: string) => void;
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
  // Track in-flight updates per client ref to prevent race conditions
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

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
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[AppContext] Echec du chargement depuis Supabase, basculement sur les donnees locales:", message);
      toast.error("Impossible de charger les donnees depuis le serveur. Mode hors-ligne active.");
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
    try {
      const dbClients = await clientsService.getAll();
      setClients(dbClients.map((r: Record<string, unknown>) => mapDbClient(r)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[AppContext] Echec du rafraichissement des clients:", message);
      toast.error("Erreur lors du rafraichissement de la liste des clients.");
    }
  }, [isOnline]);

  const refreshAll = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const addClient = useCallback(async (client: Client) => {
    // Optimistic update
    setClients(prev => [client, ...prev]);

    // Persist to Supabase (with rollback on failure)
    if (isOnline) {
      const dbRow = mapClientToDb(client);
      try {
        const result = await clientsService.create(dbRow);
        if (!result) {
          logger.error("AppContext", "Failed to persist client to Supabase");
          setClients(prev => prev.filter(c => c.ref !== client.ref));
          throw new Error("Echec de la sauvegarde en base de donnees");
        }
        logsService.add("CREATION", `Nouveau dossier cree: ${client.raisonSociale}`, client.ref, "clients").catch(err => logger.error("AppContext", "Audit log failed:", err));
      } catch (err) {
        logger.error("AppContext", "Create client exception:", err);
        setClients(prev => prev.filter(c => c.ref !== client.ref));
        throw err instanceof Error ? err : new Error("Erreur lors de la sauvegarde du client");
      }
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
    // Prevent race condition: reject concurrent updates for the same client
    if (pendingUpdatesRef.current.has(ref)) {
      toast.info("Sauvegarde en cours, veuillez patienter...");
      return;
    }

    setClients(prev => {
      const snapshot = prev.find(c => c.ref === ref);
      const next = prev.map(c => c.ref === ref ? { ...c, ...updates } : c);

      // Persist to Supabase (with rollback on failure)
      if (isOnline && snapshot) {
        pendingUpdatesRef.current.add(ref);
        const dbUpdates = mapClientToDb(updates);
        clientsService.updateByRef(ref, dbUpdates).then((result) => {
          if (!result) {
            logger.error("AppContext", "Failed to update client in Supabase");
            setClients(p => p.map(c => c.ref === ref ? snapshot : c));
            toast.error("Erreur lors de la mise a jour du client");
            return;
          }
          logsService.add("REVUE/MAJ", `Mise a jour du dossier ${ref}`, ref, "clients").catch(err => logger.error("AppContext", "Audit log failed:", err));
        }).catch((err) => {
          logger.error("AppContext", "Update client exception:", err);
          setClients(p => p.map(c => c.ref === ref ? snapshot : c));
          toast.error("Erreur lors de la mise a jour du client");
        }).finally(() => {
          pendingUpdatesRef.current.delete(ref);
        });
      }

      return next;
    });

    setLogs(prev => [{
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "Utilisateur",
      refClient: ref,
      typeAction: "REVUE/MAJ",
      details: `Mise a jour du dossier`,
    }, ...prev]);
  }, [isOnline]);

  const deleteClient = useCallback((ref: string) => {
    setClients(prev => {
      const removedClient = prev.find(c => c.ref === ref);
      if (!removedClient) return prev;

      const next = prev.filter(c => c.ref !== ref);

      if (isOnline) {
        const clientName = removedClient.raisonSociale;
        clientsService.deleteByRef(ref).then(() => {
          logsService.add("SUPPRESSION", `Dossier supprime: ${clientName}`, ref, "clients").catch(err => logger.error("AppContext", "Audit log failed:", err));
        }).catch((err) => {
          logger.error("AppContext", "Failed to delete client:", err);
          setClients(p => [removedClient, ...p]);
          toast.error("Erreur lors de la suppression du client");
        });
      }

      return next;
    });
  }, [isOnline]);

  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev]);

    if (isOnline) {
      logsService.add(log.typeAction, log.details, log.refClient, "").catch(err => logger.error("AppContext", "Audit log failed:", err));
    }
  }, [isOnline]);

  const addAlerte = useCallback((alerte: AlerteRegistre) => {
    // Use a stable temp ID for rollback — object reference equality fails after re-renders
    const tempId = alerte.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const alerteWithId = alerte.id ? alerte : { ...alerte, id: tempId };
    setAlertes(prev => [alerteWithId, ...prev]);

    if (isOnline) {
      const dbRow = mapAlerteToDb(alerte);
      registreService.create(dbRow).then((result) => {
        if (!result) {
          logger.error("AppContext", "Failed to persist alerte to Supabase");
          setAlertes(prev => prev.filter(a => a.id !== tempId));
          toast.error("Erreur lors de la sauvegarde de l'alerte");
          return;
        }
        // Replace temp ID with real DB id
        if (result.id) {
          setAlertes(prev => prev.map(a => a.id === tempId ? { ...a, id: String(result.id) } : a));
        }
      }).catch((err) => {
        logger.error("AppContext", "Create alerte exception:", err);
        setAlertes(prev => prev.filter(a => a.id !== tempId));
        toast.error("Erreur lors de la sauvegarde de l'alerte");
      });
      logsService.add("ALERTE", `Nouvelle alerte: ${alerte.categorie} - ${alerte.clientConcerne}`, "", "alertes_registre").catch(err => logger.error("AppContext", "Audit log failed:", err));
    }
  }, [isOnline]);

  const updateAlerte = useCallback((id: string, updates: Partial<AlerteRegistre>) => {
    setAlertes(prev => {
      const snapshot = prev.find(a => a.id === id);
      if (!snapshot) return prev;
      const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);

      if (isOnline) {
        const dbUpdates = mapAlerteToDb(updates);
        registreService.update(id, dbUpdates).then((result) => {
          if (!result) {
            logger.error("AppContext", "Failed to update alerte in Supabase");
            setAlertes(p => p.map(a => a.id === id ? snapshot : a));
            toast.error("Erreur lors de la mise a jour de l'alerte");
          }
        }).catch((err) => {
          logger.error("AppContext", "Update alerte exception:", err);
          setAlertes(p => p.map(a => a.id === id ? snapshot : a));
          toast.error("Erreur lors de la mise a jour de l'alerte");
        });
      }

      return next;
    });
  }, [isOnline]);

  const deleteAlerte = useCallback((id: string) => {
    setAlertes(prev => {
      const removed = prev.find(a => a.id === id);
      if (!removed) return prev;
      const next = prev.filter(a => a.id !== id);

      if (isOnline) {
        supabase.from("alertes_registre").delete().eq("id", id).then(({ error }) => {
          if (error) {
            logger.error("AppContext", "Failed to delete alerte from Supabase:", error);
            setAlertes(p => [removed, ...p]);
            toast.error("Erreur lors de la suppression de l'alerte");
          }
        });
        logsService.add("SUPPRESSION", `Alerte supprimee: ${removed.categorie} - ${removed.clientConcerne}`, "", "alertes_registre").catch(err => logger.error("AppContext", "Audit log failed:", err));
      }

      return next;
    });
  }, [isOnline]);

  const contextValue = useMemo<AppState>(() => ({
    clients, collaborateurs, alertes, logs,
    isLoading, isOnline,
    addClient, updateClient, deleteClient, addLog, addAlerte, updateAlerte, deleteAlerte,
    refreshClients, refreshAll,
  }), [clients, collaborateurs, alertes, logs, isLoading, isOnline, addClient, updateClient, deleteClient, addLog, addAlerte, updateAlerte, deleteAlerte, refreshClients, refreshAll]);

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
