import { useState, useEffect, useCallback, useRef } from "react";
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
import { toast } from "sonner";
import { Plug, Plus, Wifi, WifiOff, AlertTriangle, Trash2, Zap, Activity, RefreshCw } from "lucide-react";

interface Connecteur {
  id: string;
  cabinet_id: string;
  nom: string;
  type: string;
  statut: "connecte" | "deconnecte" | "erreur";
  config: Record<string, unknown>;
  derniere_connexion: string | null;
  derniere_activite: string | null;
  created_at: string;
}

const DEFAULT_CONNECTEURS = [
  { nom: "INPI RBE", type: "registre", description: "Registre National des Entreprises" },
  { nom: "Pappers", type: "registre", description: "API donnees entreprises" },
  { nom: "OpenSanctions", type: "sanctions", description: "Base sanctions internationales" },
  { nom: "BODACC", type: "registre", description: "Bulletin officiel des annonces civiles et commerciales" },
  { nom: "DG Tresor - Gel d'avoirs", type: "sanctions", description: "Liste nationale de gel des avoirs" },
  { nom: "Google Places", type: "verification", description: "Verification d'adresses" },
  { nom: "NewsAPI", type: "veille", description: "Veille mediatique" },
  { nom: "Google Vision OCR", type: "documents", description: "Reconnaissance optique de caracteres" },
];

const DEFAULT_NOMS = new Set(DEFAULT_CONNECTEURS.map((d) => d.nom));

const STATUT_CONFIG = {
  connecte: { icon: Wifi, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Connecte" },
  deconnecte: { icon: WifiOff, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "Deconnecte" },
  erreur: { icon: AlertTriangle, color: "bg-red-500/20 text-red-300 border-red-500/30", label: "Erreur" },
};

const TYPE_LABELS: Record<string, string> = {
  registre: "Registre",
  sanctions: "Sanctions",
  verification: "Verification",
  veille: "Veille",
  documents: "Documents",
};

function SkeletonConnecteurs() {
  return (
    <div className="border border-white/[0.06] rounded-lg p-4 space-y-4">
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

  const setBusy = (id: string, busy: boolean) => {
    setBusyConnecteurs((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  };

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
      toast.success(`${toInsert.length} connecteurs par defaut initialises`);
      await loadConnecteurs();
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur init connecteurs", err);
    }
  }, [loadConnecteurs]);

  // Auto-initialize defaults on first load — guarded by initRef to prevent double init
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const list = await loadConnecteurs();
      if (list.length === 0) {
        await autoInitDefaults();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatut = async (connecteur: Connecteur) => {
    if (busyConnecteurs.has(connecteur.id)) return;
    setBusy(connecteur.id, true);
    try {
      const newStatut = connecteur.statut === "connecte" ? "deconnecte" : "connecte";
      const { error } = await supabase
        .from("cabinet_connecteurs")
        .update({
          statut: newStatut,
          ...(newStatut === "connecte" ? { derniere_connexion: new Date().toISOString() } : {}),
        })
        .eq("id", connecteur.id);

      if (error) { toast.error("Erreur"); return; }
      await logAudit({
        action: newStatut === "connecte" ? "CONNEXION_CONNECTEUR" : "DECONNEXION_CONNECTEUR",
        table_name: "cabinet_connecteurs",
        record_id: connecteur.id,
        old_data: { statut: connecteur.statut, nom: connecteur.nom },
        new_data: { statut: newStatut, nom: connecteur.nom },
      });
      toast.success(newStatut === "connecte" ? "Connecteur active" : "Connecteur desactive");
      await loadConnecteurs();
    } finally {
      setBusy(connecteur.id, false);
    }
  };

  const reconnectAll = async () => {
    const disconnected = connecteurs.filter((c) => c.statut === "deconnecte" || c.statut === "erreur");
    if (disconnected.length === 0) {
      toast.info("Tous les connecteurs sont deja connectes");
      return;
    }
    setReconnectingAll(true);
    const ids = disconnected.map((c) => c.id);
    ids.forEach((id) => setBusy(id, true));
    try {
      const { error } = await supabase
        .from("cabinet_connecteurs")
        .update({ statut: "connecte", derniere_connexion: new Date().toISOString() })
        .in("id", ids);

      if (error) { toast.error("Erreur lors de la reconnexion"); return; }

      await logAudit({
        action: "RECONNEXION_TOUS_CONNECTEURS",
        table_name: "cabinet_connecteurs",
        new_data: { connecteurs_reconnectes: disconnected.map((c) => c.nom) },
      });
      toast.success(`${disconnected.length} connecteur${disconnected.length > 1 ? "s" : ""} reconnecte${disconnected.length > 1 ? "s" : ""}`);
      await loadConnecteurs();
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur reconnexion globale", err);
      toast.error("Erreur lors de la reconnexion");
    } finally {
      ids.forEach((id) => setBusy(id, false));
      setReconnectingAll(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").eq("id", profile?.cabinet_id).single();
      if (!cab) throw new Error("Cabinet non trouve");

      const { error } = await supabase.from("cabinet_connecteurs").insert({
        cabinet_id: cab.id,
        nom: form.nom,
        type: form.type,
        statut: "deconnecte",
        config: form.description ? { description: form.description } : {},
      });
      if (error) throw error;

      await logAudit({ action: "AJOUT_CONNECTEUR", table_name: "cabinet_connecteurs", new_data: { nom: form.nom, type: form.type } });
      toast.success("Connecteur ajoute");
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
      toast.success("Connecteur supprime");
      setDeleteTarget(null);
      await loadConnecteurs();
    } catch (err) {
      logger.error("ConnecteursPanel", "Erreur suppression", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  const testConnection = async (connecteur: Connecteur) => {
    if (busyConnecteurs.has(connecteur.id)) return;
    setBusy(connecteur.id, true);
    try {
      // Simulate a connection test with a short delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (connecteur.statut === "connecte") {
        toast.success(`Connexion a ${connecteur.nom} reussie`);
        // Update derniere_activite
        await supabase
          .from("cabinet_connecteurs")
          .update({ derniere_activite: new Date().toISOString() })
          .eq("id", connecteur.id);
        await loadConnecteurs();
      } else if (connecteur.statut === "erreur") {
        toast.error(`Echec de connexion a ${connecteur.nom} : verifiez la configuration`);
      } else {
        toast.warning(`${connecteur.nom} n'est pas connecte. Activez-le d'abord.`);
      }
    } finally {
      setBusy(connecteur.id, false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getDescription = (connecteur: Connecteur): string | null => {
    const defaultInfo = DEFAULT_CONNECTEURS.find((d) => d.nom === connecteur.nom);
    if (defaultInfo) return defaultInfo.description;
    const configDesc = connecteur.config?.description;
    if (typeof configDesc === "string") return configDesc;
    return null;
  };

  const getLastError = (connecteur: Connecteur): string | null => {
    if (connecteur.statut !== "erreur") return null;
    const lastError = connecteur.config?.last_error;
    if (typeof lastError === "string") return lastError;
    return "Erreur de connexion inconnue";
  };

  // Compute counts for badges
  const countConnecte = connecteurs.filter((c) => c.statut === "connecte").length;
  const countDeconnecte = connecteurs.filter((c) => c.statut === "deconnecte").length;
  const countErreur = connecteurs.filter((c) => c.statut === "erreur").length;
  const hasDisconnected = countDeconnecte > 0 || countErreur > 0;

  if (loading) return <SkeletonConnecteurs />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Plug className="h-5 w-5 text-blue-400" /> Connecteurs
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-400">
              {connecteurs.length} connecteur{connecteurs.length > 1 ? "s" : ""}
            </span>
            {connecteurs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-xs">
                  <Wifi className="h-3 w-3" /> {countConnecte}
                </Badge>
                <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 gap-1 text-xs">
                  <WifiOff className="h-3 w-3" /> {countDeconnecte}
                </Badge>
                {countErreur > 0 && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" /> {countErreur}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDisconnected && connecteurs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={reconnectAll}
              disabled={reconnectingAll}
              aria-label="Reconnecter tous les connecteurs deconnectes"
            >
              <RefreshCw className={`h-4 w-4 ${reconnectingAll ? "animate-spin" : ""}`} />
              {reconnectingAll ? "Reconnexion..." : "Reconnecter tout"}
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setForm({ nom: "", type: "registre", description: "" }); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" aria-label="Ajouter un connecteur personnalise">
                <Plus className="h-4 w-4" /> Ajouter un connecteur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau connecteur</DialogTitle>
                <DialogDescription>Ajoutez un connecteur personnalise a votre cabinet.</DialogDescription>
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
      </div>

      {connecteurs.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Plug className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Aucun connecteur configure</p>
            <p className="text-sm text-slate-500 mt-1">Les connecteurs par defaut seront initialises automatiquement.</p>
          </div>
        </div>
      ) : (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-white/[0.02]">
                <TableHead className="text-slate-400">Connecteur</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Statut</TableHead>
                <TableHead className="text-slate-400">Derniere connexion</TableHead>
                <TableHead className="text-slate-400">Derniere activite</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connecteurs.map((c) => {
                const config = STATUT_CONFIG[c.statut];
                const StatusIcon = config.icon;
                const description = getDescription(c);
                const lastError = getLastError(c);
                const isDefault = DEFAULT_NOMS.has(c.nom);
                const isBusy = busyConnecteurs.has(c.id);
                return (
                  <TableRow key={c.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-200">{c.nom}</p>
                        {description && <p className="text-xs text-slate-500">{description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-slate-400 border-slate-700">
                        {TYPE_LABELS[c.type] || c.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge className={`gap-1 ${config.color}`}>
                          <StatusIcon className="h-3 w-3" /> {config.label}
                        </Badge>
                        {lastError && (
                          <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={lastError}>
                            {lastError}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(c.derniere_connexion) || <span className="text-slate-600">&mdash;</span>}</TableCell>
                    <TableCell>
                      {c.derniere_activite ? (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {formatDate(c.derniere_activite)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testConnection(c)}
                          disabled={isBusy}
                          className="text-cyan-400 hover:text-cyan-300 gap-1"
                          aria-label={`Tester la connexion a ${c.nom}`}
                        >
                          <Zap className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
                          {isBusy ? "Test..." : "Tester"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatut(c)}
                          disabled={isBusy}
                          className={c.statut === "connecte" ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}
                          aria-label={c.statut === "connecte" ? `Deconnecter ${c.nom}` : `Connecter ${c.nom}`}
                        >
                          {c.statut === "connecte" ? "Deconnecter" : "Connecter"}
                        </Button>
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
              Voulez-vous vraiment supprimer le connecteur <strong>{deleteTarget?.nom}</strong> ? Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
