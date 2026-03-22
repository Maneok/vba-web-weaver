import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plug, Plus, Wifi, WifiOff, AlertTriangle, Trash2, Zap, Activity, RefreshCw, XCircle } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface Connecteur {
  id: string;
  cabinet_id: string;
  nom: string;
  type: string;
  statut: ConnecteurStatut;
  config: Record<string, unknown>;
  derniere_connexion: string | null;
  derniere_activite: string | null;
  created_at: string;
}

type ConnecteurStatut = "connecte" | "deconnecte" | "erreur" | "degrade";

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_CONNECTEURS = [
  { nom: "INPI RBE", type: "registre", description: "Registre National des Entreprises" },
  { nom: "Annuaire Entreprises", type: "registre", description: "API entreprise data.gouv.fr (gratuit)" },
  { nom: "Pappers", type: "registre", description: "API données entreprises (enrichissement)" },
  { nom: "OpenSanctions", type: "sanctions", description: "Base sanctions internationales" },
  { nom: "BODACC", type: "registre", description: "Bulletin officiel des annonces civiles et commerciales" },
  { nom: "DG Tresor - Gel d'avoirs", type: "sanctions", description: "Liste nationale de gel des avoirs" },
  { nom: "Google Places", type: "verification", description: "Vérification d'adresses et géolocalisation" },
  { nom: "NewsAPI", type: "veille", description: "Veille médiatique automatisée" },
  { nom: "Google Vision OCR", type: "documents", description: "Reconnaissance optique de caractères (CNI, RIB, Kbis)" },
];

const DEFAULT_NOMS = new Set(DEFAULT_CONNECTEURS.map((d) => d.nom));

const STATUT_CONFIG: Record<ConnecteurStatut, { icon: typeof Wifi; color: string; label: string }> = {
  connecte:   { icon: Wifi,          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Connecté" },
  degrade:    { icon: AlertTriangle,  color: "bg-amber-500/20 text-amber-400 border-amber-500/30",     label: "Dégradé" },
  erreur:     { icon: XCircle,        color: "bg-red-500/20 text-red-400 border-red-500/30",           label: "Erreur" },
  deconnecte: { icon: WifiOff,        color: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",     label: "Déconnecté" },
};

const TYPE_LABELS: Record<string, string> = {
  registre: "Registre",
  sanctions: "Sanctions",
  verification: "Vérification",
  veille: "Veille",
  documents: "Documents",
};

const STATUT_SORT_ORDER: Record<ConnecteurStatut, number> = {
  erreur: 0,
  degrade: 1,
  deconnecte: 2,
  connecte: 3,
};

// ─── API Test Map ───────────────────────────────────────────

const TEST_SIREN = "443061841"; // LVMH

const API_TEST_MAP: Record<string, {
  fn: string;
  payload: Record<string, unknown>;
  validate: (d: Record<string, unknown>) => { ok: boolean; degraded?: boolean; detail: string };
}> = {
  "INPI RBE": {
    fn: "enterprise-lookup",
    payload: { query: TEST_SIREN },
    validate: (d) => ({
      ok: d.status === "ok" && Array.isArray(d.results) && d.results.length > 0,
      detail: (Array.isArray(d.results) && d.results.length > 0 && (d.results as Record<string, unknown>[])[0]?.raison_sociale as string) || "Aucun résultat",
    }),
  },
  "BODACC": {
    fn: "bodacc-check",
    payload: { siren: TEST_SIREN },
    validate: (d) => ({
      ok: d.status === "ok",
      detail: `${(d.total as number) || 0} annonce(s)`,
    }),
  },
  "OpenSanctions": {
    fn: "sanctions-check",
    payload: { persons: [{ nom: "Test", prenom: "Utilisateur" }] },
    validate: (d) => ({
      ok: d.status === "ok",
      detail: `${(d.checked as number) || 0} personne(s) vérifiée(s)`,
    }),
  },
  "DG Tresor - Gel d'avoirs": {
    fn: "gel-avoirs-check",
    payload: { persons: [{ nom: "Test", prenom: "Utilisateur" }] },
    validate: (d) => ({
      ok: d.status === "ok",
      degraded: d.checked === false,
      detail: d.checked === false
        ? "Liste DG Trésor non téléchargée"
        : `${Array.isArray(d.matches) ? d.matches.length : 0} résultat(s)`,
    }),
  },
  "Google Places": {
    fn: "google-places-verify",
    payload: { raison_sociale: "LVMH", ville: "Paris" },
    validate: (d) => {
      const debug = d._debug as Record<string, unknown> | undefined;
      return {
        ok: d.status !== "error",
        degraded: !d.found && d.status === "ATTENTION",
        detail: d.found ? "Établissement trouvé" : debug?.gpsSource ? `GPS via ${debug.gpsSource}` : "Non trouvé",
      };
    },
  },
  "NewsAPI": {
    fn: "news-check",
    payload: { raison_sociale: "LVMH" },
    validate: (d) => ({
      ok: Array.isArray(d.articles) && d.articles.length > 0,
      detail: `${Array.isArray(d.articles) ? d.articles.length : 0} article(s)`,
    }),
  },
  "Pappers": {
    fn: "pappers-lookup",
    payload: { mode: "siren", query: TEST_SIREN },
    validate: (d) => ({
      ok: !d.error,
      degraded: d.source === "datagouv",
      detail: d.source === "datagouv"
        ? "Fallback data.gouv (clé Pappers absente)"
        : (Array.isArray(d.results) && d.results.length > 0 && (d.results as Record<string, unknown>[])[0]?.raison_sociale as string) || "OK",
    }),
  },
  "Google Vision OCR": {
    fn: "ocr-document",
    payload: { test: true },
    validate: (d) => ({
      ok: !d.error || d.error === "imageBase64 requis" || d.error === "Non autorise",
      degraded: d.error === "Non autorise",
      detail: d.error === "imageBase64 requis" ? "Service disponible"
        : d.error === "Non autorise" ? "Auth requise (normal en test)"
        : (d.error as string) || "OK",
    }),
  },
  "Annuaire Entreprises": {
    fn: "enterprise-lookup",
    payload: { query: TEST_SIREN },
    validate: (d) => ({
      ok: Array.isArray(d.sources) && d.sources.includes("AnnuaireEntreprises"),
      detail: Array.isArray(d.sources) && d.sources.includes("AnnuaireEntreprises")
        ? "API gouv disponible"
        : "Non joignable",
    }),
  },
};

// ─── Helpers ────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 0) return "À l'instant";
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Hier";
  if (diffD < 30) return `Il y a ${diffD} jours`;
  const diffM = Math.floor(diffD / 30);
  return `Il y a ${diffM} mois`;
}

function getLatencyBadge(ms: number | undefined | null): { label: string; color: string } | null {
  if (ms == null) return null;
  if (ms < 1000) return { label: `${ms}ms`, color: "bg-emerald-500/15 text-emerald-400" };
  if (ms <= 3000) return { label: `${(ms / 1000).toFixed(1)}s`, color: "bg-amber-500/15 text-amber-400" };
  return { label: `${(ms / 1000).toFixed(1)}s`, color: "bg-red-500/15 text-red-400" };
}

const AUTO_TEST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Skeleton ───────────────────────────────────────────────

function SkeletonConnecteurs() {
  return (
    <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function ConnecteursPanel() {
  const { profile } = useAuth();
  const [connecteurs, setConnecteurs] = useState<Connecteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Connecteur | null>(null);
  const [form, setForm] = useState({ nom: "", type: "registre", description: "" });
  const [saving, setSaving] = useState(false);
  const [busyConnecteurs, setBusyConnecteurs] = useState<Set<string>>(new Set());
  const [reconnectingAll, setReconnectingAll] = useState(false);
  const initRef = useRef(false);
  const lastAutoTestRef = useRef(0);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyConnecteurs((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  // ─── Load ───────────────────────────────────────────────

  const loadConnecteurs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_connecteurs")
        .select("*")
        .order("nom");
      if (error) throw error;
      setConnecteurs((data || []) as Connecteur[]);
      return (data || []) as Connecteur[];
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur chargement", err);
      toast.error("Erreur lors du chargement des connecteurs");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Real API Test ──────────────────────────────────────

  const testConnection = useCallback(async (connecteur: Connecteur, silent = false) => {
    const mapping = API_TEST_MAP[connecteur.nom];
    if (!mapping) {
      if (!silent) toast.warning(`Pas de test disponible pour ${connecteur.nom}`);
      return;
    }

    setBusy(connecteur.id, true);
    const start = performance.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new DOMException("Timeout après 15s", "AbortError")), 15000);
      });

      const invokePromise = supabase.functions.invoke(mapping.fn, {
        body: mapping.payload,
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      const latencyMs = Math.round(performance.now() - start);

      if (error) throw error;

      const result = mapping.validate((data || {}) as Record<string, unknown>);
      const newStatut: ConnecteurStatut = result.ok ? (result.degraded ? "degrade" : "connecte") : "erreur";

      await supabase
        .from("cabinet_connecteurs")
        .update({
          statut: newStatut,
          derniere_connexion: new Date().toISOString(),
          derniere_activite: new Date().toISOString(),
          config: {
            ...(connecteur.config || {}),
            last_latency_ms: latencyMs,
            last_test_at: new Date().toISOString(),
            last_test_result: result.detail,
            ...(newStatut === "erreur" ? { last_error: result.detail } : { last_error: null }),
          },
        })
        .eq("id", connecteur.id);

      if (!silent) {
        if (newStatut === "connecte") {
          toast.success(`${connecteur.nom} — ${result.detail} (${latencyMs}ms)`);
        } else if (newStatut === "degrade") {
          toast.warning(`${connecteur.nom} — ${result.detail} (${latencyMs}ms)`);
        } else {
          toast.error(`${connecteur.nom} — ${result.detail}`);
        }
      }

      await logAudit({
        action: "TEST_CONNECTEUR",
        table_name: "cabinet_connecteurs",
        record_id: connecteur.id,
        old_data: { statut: connecteur.statut, nom: connecteur.nom },
        new_data: { statut: newStatut, nom: connecteur.nom, latency_ms: latencyMs, result: result.detail },
      });

      await loadConnecteurs();
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const errorObj = err instanceof Error ? err : new Error(String(err));

      // Cas spécial : 401 sur OCR = service dispo mais auth requise
      const is401 = errorObj.message?.includes("401") || errorObj.message?.includes("Non autorise");
      if (is401) {
        const newStatut: ConnecteurStatut = "degrade";
        await supabase.from("cabinet_connecteurs").update({
          statut: newStatut,
          derniere_connexion: new Date().toISOString(),
          derniere_activite: new Date().toISOString(),
          config: { ...connecteur.config, last_latency_ms: latencyMs, last_test_at: new Date().toISOString(), last_test_result: "Auth requise (normal en test)", last_error: null },
        }).eq("id", connecteur.id);
        if (!silent) toast.warning(`${connecteur.nom} — Auth requise (normal en test)`);
        await loadConnecteurs();
        setBusy(connecteur.id, false);
        return;
      }

      const errorMsg = errorObj?.name === "AbortError" ? "Timeout après 15s" : (errorObj?.message || "Erreur réseau");

      await supabase
        .from("cabinet_connecteurs")
        .update({
          statut: "erreur" as ConnecteurStatut,
          config: {
            ...(connecteur.config || {}),
            last_error: errorMsg,
            last_test_at: new Date().toISOString(),
            last_latency_ms: latencyMs,
          },
        })
        .eq("id", connecteur.id);

      if (!silent) toast.error(`${connecteur.nom} — ${errorMsg}`);
      await loadConnecteurs();
    } finally {
      setBusy(connecteur.id, false);
    }
  }, [loadConnecteurs, setBusy]);

  // ─── Connect / Disconnect ──────────────────────────────

  const handleConnect = useCallback(async (connecteur: Connecteur) => {
    // "Connecter" = run a real test
    await testConnection(connecteur);
  }, [testConnection]);

  const handleDisconnect = useCallback(async (connecteur: Connecteur) => {
    if (busyConnecteurs.has(connecteur.id)) return;
    setBusy(connecteur.id, true);
    try {
      const { error } = await supabase
        .from("cabinet_connecteurs")
        .update({ statut: "deconnecte" as ConnecteurStatut })
        .eq("id", connecteur.id);
      if (error) { toast.error("Erreur"); return; }
      await logAudit({
        action: "DECONNEXION_CONNECTEUR",
        table_name: "cabinet_connecteurs",
        record_id: connecteur.id,
        old_data: { statut: connecteur.statut, nom: connecteur.nom },
        new_data: { statut: "deconnecte", nom: connecteur.nom },
      });
      toast.success(`${connecteur.nom} déconnecté`);
      await loadConnecteurs();
    } finally {
      setBusy(connecteur.id, false);
    }
  }, [busyConnecteurs, loadConnecteurs, setBusy]);

  // ─── Reconnect All ─────────────────────────────────────

  const reconnectAll = useCallback(async () => {
    setReconnectingAll(true);
    const allIds = connecteurs.map((c) => c.id);
    allIds.forEach((id) => setBusy(id, true));

    try {
      const results = await Promise.allSettled(
        connecteurs.map((c) => testConnection(c, true))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast.warning(`Vérification terminée — ${failed} erreur(s)`);
      } else {
        toast.success("Tous les connecteurs ont été vérifiés");
      }
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur vérification globale", err);
      toast.error("Erreur lors de la vérification");
    } finally {
      allIds.forEach((id) => setBusy(id, false));
      setReconnectingAll(false);
    }
  }, [connecteurs, testConnection, setBusy]);

  // ─── Auto-init ─────────────────────────────────────────

  const autoInitDefaults = useCallback(async () => {
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").eq("id", profile?.cabinet_id).single();
      if (!cab) return;

      const toInsert = DEFAULT_CONNECTEURS.map((d) => ({
        cabinet_id: cab.id,
        nom: d.nom,
        type: d.type,
        statut: "deconnecte" as const,
      }));

      const { error } = await supabase.from("cabinet_connecteurs").insert(toInsert);
      if (error) throw error;

      await logAudit({ action: "INITIALISATION_CONNECTEURS", table_name: "cabinet_connecteurs" });
      toast.success(`${toInsert.length} connecteurs par défaut initialisés`);
      const list = await loadConnecteurs();

      // Test all APIs in background after init
      if (list.length > 0) {
        Promise.allSettled(list.map((c) => testConnection(c, true))).catch(() => {});
      }
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur init connecteurs", err);
    }
  }, [loadConnecteurs, testConnection, profile?.cabinet_id]);

  // ─── Auto-test stale connecteurs ───────────────────────

  const autoTestStale = useCallback(async (list: Connecteur[]) => {
    const now = Date.now();
    if (now - lastAutoTestRef.current < AUTO_TEST_COOLDOWN_MS) return;
    lastAutoTestRef.current = now;

    const stale = list.filter((c) => {
      const lastTest = c.config?.last_test_at;
      if (!lastTest) return true;
      const ts = new Date(lastTest as string).getTime();
      return isNaN(ts) || now - ts > STALE_THRESHOLD_MS;
    });

    if (stale.length > 0) {
      Promise.allSettled(stale.map((c) => testConnection(c, true))).catch(() => {});
    }
  }, [testConnection]);

  // ─── Init Effect ───────────────────────────────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const list = await loadConnecteurs();
      if (list.length === 0) {
        await autoInitDefaults();
      } else {
        autoTestStale(list);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Add / Delete ─────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").eq("id", profile?.cabinet_id).single();
      if (!cab) throw new Error("Cabinet non trouvé");

      const { error } = await supabase.from("cabinet_connecteurs").insert({
        cabinet_id: cab.id,
        nom: form.nom,
        type: form.type,
        statut: "deconnecte",
        config: form.description ? { description: form.description } : {},
      });
      if (error) throw error;

      await logAudit({ action: "AJOUT_CONNECTEUR", table_name: "cabinet_connecteurs", new_data: { nom: form.nom, type: form.type } });
      toast.success("Connecteur ajouté");
      setAddOpen(false);
      setForm({ nom: "", type: "registre", description: "" });
      await loadConnecteurs();
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur ajout connecteur", err);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("cabinet_connecteurs").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({ action: "SUPPRESSION_CONNECTEUR", table_name: "cabinet_connecteurs", record_id: deleteTarget.id, old_data: { nom: deleteTarget.nom } });
      toast.success("Connecteur supprimé");
      setDeleteTarget(null);
      await loadConnecteurs();
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur suppression", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  // ─── Helpers ───────────────────────────────────────────

  const getDescription = (connecteur: Connecteur): string | null => {
    const defaultInfo = DEFAULT_CONNECTEURS.find((d) => d.nom === connecteur.nom);
    if (defaultInfo) return defaultInfo.description;
    const configDesc = connecteur.config?.description;
    if (typeof configDesc === "string") return configDesc;
    return null;
  };

  const getLastTestResult = (connecteur: Connecteur): string | null => {
    const r = connecteur.config?.last_test_result;
    return typeof r === "string" ? r : null;
  };

  const getLastError = (connecteur: Connecteur): string | null => {
    const e = connecteur.config?.last_error;
    return typeof e === "string" ? e : null;
  };

  const getLatency = (connecteur: Connecteur): number | null => {
    const l = connecteur.config?.last_latency_ms;
    return typeof l === "number" ? l : null;
  };

  // ─── Sorted connecteurs (problems first) ──────────────

  const sorted = useMemo(() => {
    return [...connecteurs].sort((a, b) => {
      const sa = STATUT_SORT_ORDER[a.statut] ?? 99;
      const sb = STATUT_SORT_ORDER[b.statut] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.nom.localeCompare(b.nom);
    });
  }, [connecteurs]);

  // ─── Health summary ───────────────────────────────────

  const health = useMemo(() => {
    const total = connecteurs.length;
    const countConnecte = connecteurs.filter((c) => c.statut === "connecte").length;
    const countDegrade = connecteurs.filter((c) => c.statut === "degrade").length;
    const countErreur = connecteurs.filter((c) => c.statut === "erreur").length;
    const countDeconnecte = connecteurs.filter((c) => c.statut === "deconnecte").length;
    const operational = countConnecte + countDegrade;
    const pct = total > 0 ? Math.round((operational / total) * 100) : 0;

    // Find most recent test timestamp
    let lastTestAt: string | null = null;
    for (const c of connecteurs) {
      const t = c.config?.last_test_at;
      if (typeof t === "string" && (!lastTestAt || t > lastTestAt)) {
        lastTestAt = t;
      }
    }

    return { total, countConnecte, countDegrade, countErreur, countDeconnecte, operational, pct, lastTestAt };
  }, [connecteurs]);

  const healthDotColor = health.pct > 80
    ? "bg-emerald-400"
    : health.pct >= 50
      ? "bg-amber-400"
      : "bg-red-400";

  // ─── Render ───────────────────────────────────────────

  if (loading) return <SkeletonConnecteurs />;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Plug className="h-5 w-5 text-blue-400" /> Connecteurs
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              {connecteurs.length} connecteur{connecteurs.length > 1 ? "s" : ""} configuré{connecteurs.length > 1 ? "s" : ""}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setForm({ nom: "", type: "registre", description: "" }); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" aria-label="Ajouter un connecteur personnalisé">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau connecteur</DialogTitle>
                <DialogDescription>Ajoutez un connecteur personnalisé à votre cabinet.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="conn-nom">Nom</Label>
                  <Input id="conn-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: API interne" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-type">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger id="conn-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-desc">Description</Label>
                  <Input id="conn-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description du connecteur" />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Ajout..." : "Ajouter"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Health summary */}
        {connecteurs.length > 0 && (
          <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4 bg-white dark:bg-white/[0.02]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${healthDotColor} shrink-0`} />
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{health.operational}/{health.total}</span> opérationnel{health.operational > 1 ? "s" : ""}
                  {health.countDegrade > 0 && (
                    <span className="text-amber-400 ml-2">· {health.countDegrade} dégradé{health.countDegrade > 1 ? "s" : ""}</span>
                  )}
                  {health.countErreur > 0 && (
                    <span className="text-red-400 ml-2">· {health.countErreur} erreur{health.countErreur > 1 ? "s" : ""}</span>
                  )}
                  {health.countDeconnecte > 0 && (
                    <span className="text-slate-600 dark:text-slate-400 ml-2">· {health.countDeconnecte} déconnecté{health.countDeconnecte > 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {health.lastTestAt && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Dernière vérification : {formatRelativeTime(health.lastTestAt)}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={reconnectAll}
                  disabled={reconnectingAll}
                  aria-label="Tout vérifier maintenant"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${reconnectingAll ? "animate-spin" : ""}`} />
                  {reconnectingAll ? "Vérification..." : "Tout vérifier"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {connecteurs.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Plug className="h-8 w-8 text-blue-400 animate-pulse" />
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300 font-medium">Aucun connecteur configuré</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Les connecteurs par défaut seront initialisés automatiquement.</p>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
                  <TableHead className="text-slate-400 dark:text-slate-500">Connecteur</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500">Type</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500">Statut</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500">Latence</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500">Dernière connexion</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500">Dernière activité</TableHead>
                  <TableHead className="text-slate-400 dark:text-slate-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => {
                  const config = STATUT_CONFIG[c.statut] || STATUT_CONFIG.deconnecte;
                  const StatusIcon = config.icon;
                  const description = getDescription(c);
                  const lastTestResult = getLastTestResult(c);
                  const lastError = getLastError(c);
                  const latency = getLatency(c);
                  const latencyBadge = getLatencyBadge(latency);
                  const isDefault = DEFAULT_NOMS.has(c.nom);
                  const isBusy = busyConnecteurs.has(c.id);
                  return (
                    <TableRow key={c.id} className="border-gray-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      {/* Connecteur name + description + last result */}
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{c.nom}</p>
                          {description && <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>}
                          {lastTestResult && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[250px]" title={lastTestResult}>
                              {lastTestResult}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {/* Type */}
                      <TableCell>
                        <Badge variant="outline" className="text-slate-400 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                          {TYPE_LABELS[c.type] || c.type}
                        </Badge>
                      </TableCell>
                      {/* Statut */}
                      <TableCell>
                        <div>
                          {lastError && c.statut === "erreur" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={`gap-1 ${config.color} ${isBusy ? "animate-pulse" : ""}`}>
                                  <StatusIcon className="h-3 w-3" /> {config.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{lastError}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge className={`gap-1 ${config.color} ${isBusy ? "animate-pulse" : ""}`}>
                              <StatusIcon className="h-3 w-3" /> {config.label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {/* Latence */}
                      <TableCell>
                        {latencyBadge ? (
                          <Badge className={`text-xs ${latencyBadge.color}`}>{latencyBadge.label}</Badge>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </TableCell>
                      {/* Dernière connexion */}
                      <TableCell className="text-xs text-slate-400 dark:text-slate-500">
                        {formatRelativeTime(c.derniere_connexion)}
                      </TableCell>
                      {/* Dernière activité */}
                      <TableCell>
                        {c.derniere_activite ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {formatRelativeTime(c.derniere_activite)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testConnection(c)}
                            disabled={isBusy}
                            className="text-cyan-400 hover:text-cyan-300 gap-1"
                            aria-label={`Tester la connexion à ${c.nom}`}
                          >
                            <Zap className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
                            {isBusy ? "Test..." : "Tester"}
                          </Button>
                          {c.statut === "connecte" || c.statut === "degrade" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(c)}
                              disabled={isBusy}
                              className="text-red-400 hover:text-red-300"
                              aria-label={`Déconnecter ${c.nom}`}
                            >
                              Déconnecter
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConnect(c)}
                              disabled={isBusy}
                              className="text-emerald-400 hover:text-emerald-300"
                              aria-label={`Connecter ${c.nom}`}
                            >
                              Connecter
                            </Button>
                          )}
                          {!isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              onClick={() => setDeleteTarget(c)}
                              aria-label={`Supprimer le connecteur ${c.nom}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer le connecteur</DialogTitle>
              <DialogDescription>
                Voulez-vous vraiment supprimer le connecteur <strong>{deleteTarget?.nom}</strong> ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
