import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Search, Ban } from "lucide-react";

interface ApiKey {
  id: string;
  cabinet_id: string;
  nom: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_PERMISSIONS: { value: string; label: string }[] = [
  { value: "read:clients", label: "Lecture clients" },
  { value: "write:clients", label: "Ecriture clients" },
  { value: "read:documents", label: "Lecture documents" },
  { value: "write:documents", label: "Ecriture documents" },
  { value: "read:alertes", label: "Lecture alertes" },
  { value: "screening", label: "Screening sanctions/PEP" },
  { value: "export", label: "Export donnees" },
];

const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  AVAILABLE_PERMISSIONS.map((p) => [p.value, p.label])
);

const EXPIRATION_OPTIONS = [
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "1 an" },
  { value: "never", label: "Jamais" },
];

const NAME_PLACEHOLDERS = [
  "Integration comptabilite",
  "Webhook interne",
  "Application mobile",
  "Portail client",
  "Synchronisation CRM",
];

/**
 * Generate a cryptographically secure API key using crypto.getRandomValues
 */
function generateSecureKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = new Uint8Array(48);
  crypto.getRandomValues(randomBytes);
  let key = "grm_";
  for (let i = 0; i < 48; i++) {
    key += chars[randomBytes[i] % chars.length];
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function SkeletonKeys() {
  return (
    <div className="border border-white/[0.06] rounded-lg p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({ nom: "", permissions: [] as string[], expiration: "90" });
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadKeys = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setKeys((data || []) as ApiKey[]);
    } catch (err) {
      logger.error("ApiKeysPanel", "Erreur chargement cles", err);
      toast.error("Erreur lors du chargement des cles API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return keys;
    const q = searchQuery.toLowerCase();
    return keys.filter((k) =>
      k.nom.toLowerCase().includes(q) ||
      k.key_prefix.toLowerCase().includes(q) ||
      k.permissions.some((p) => (PERMISSION_LABELS[p] || p).toLowerCase().includes(q))
    );
  }, [keys, searchQuery]);

  const activeKeyCount = useMemo(() => keys.filter((k) => k.is_active).length, [keys]);

  const getPlaceholder = () => NAME_PLACEHOLDERS[Math.floor(Math.random() * NAME_PLACEHOLDERS.length)];

  const cleanDialogState = () => {
    setNewKeyValue(null);
    setShowKey(false);
    setForm({ nom: "", permissions: [], expiration: "90" });
    setCreating(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    if (form.permissions.length === 0) {
      toast.error("Selectionnez au moins une permission");
      return;
    }
    setCreating(true);
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) throw new Error("Cabinet non trouve");

      const rawKey = generateSecureKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 8);

      let expiresAt: string | null = null;
      if (form.expiration !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(form.expiration));
        expiresAt = d.toISOString();
      }

      const { error } = await supabase.from("cabinet_api_keys").insert({
        cabinet_id: cab.id,
        nom: form.nom,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: form.permissions,
        expires_at: expiresAt,
      });

      if (error) throw error;

      await logAudit({ action: "CREATION_CLE_API", table_name: "cabinet_api_keys", new_data: { nom: form.nom, permissions: form.permissions } });
      setNewKeyValue(rawKey);
      setShowKey(true);
      setForm({ nom: "", permissions: [], expiration: "90" });
      await loadKeys();
    } catch (err) {
      logger.error("ApiKeysPanel", "Erreur generation cle", err);
      toast.error("Erreur lors de la generation de la cle");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async () => {
    if (!revokeTarget) return;
    const { error } = await supabase
      .from("cabinet_api_keys")
      .update({ is_active: false })
      .eq("id", revokeTarget.id);
    if (error) { toast.error("Erreur lors de la revocation"); return; }
    await logAudit({ action: "REVOCATION_CLE_API", table_name: "cabinet_api_keys", record_id: revokeTarget.id });
    toast.success("Cle API revoquee");
    setRevokeTarget(null);
    await loadKeys();
  };

  const bulkRevoke = async () => {
    const activeIds = keys.filter((k) => k.is_active).map((k) => k.id);
    if (activeIds.length === 0) { toast.info("Aucune cle active a revoquer"); return; }

    const { error } = await supabase
      .from("cabinet_api_keys")
      .update({ is_active: false })
      .in("id", activeIds);
    if (error) { toast.error("Erreur lors de la revocation"); return; }

    await logAudit({ action: "REVOCATION_MASSE_CLES_API", table_name: "cabinet_api_keys", new_data: { count: activeIds.length } });
    toast.success(`${activeIds.length} cle(s) API revoquee(s)`);
    setBulkRevokeOpen(false);
    await loadKeys();
  };

  const copyKey = () => {
    if (!newKeyValue) return;
    navigator.clipboard.writeText(newKeyValue).then(
      () => toast.success("Cle copiee dans le presse-papier"),
      () => toast.error("Impossible de copier")
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const isExpired = (d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date();
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const getPermissionLabel = (raw: string): string => PERMISSION_LABELS[raw] || raw;

  if (loading) return <SkeletonKeys />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-400" /> Cles API
          </h2>
          <p className="text-sm text-slate-400">
            {keys.length} cle{keys.length > 1 ? "s" : ""} · {activeKeyCount} active{activeKeyCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeKeyCount > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkRevokeOpen(true)}
              className="gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10"
              aria-label="Revoquer toutes les cles actives"
            >
              <Ban className="h-4 w-4" /> Tout revoquer
            </Button>
          )}
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) cleanDialogState();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" aria-label="Generer une nouvelle cle API">
                <Plus className="h-4 w-4" /> Generer une cle API
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{newKeyValue ? "Cle API generee" : "Nouvelle cle API"}</DialogTitle>
                <DialogDescription>
                  {newKeyValue
                    ? "Conservez cette cle en lieu sur. Elle ne sera plus jamais affichee."
                    : "Configurez les permissions et la duree de validite de la cle."}
                </DialogDescription>
              </DialogHeader>

              {newKeyValue ? (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-300">
                        Copiez cette cle maintenant. Elle ne sera plus jamais affichee.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={showKey ? newKeyValue : "\u2022".repeat(40)}
                      className="font-mono text-xs bg-white/[0.03] border-white/[0.08]"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Masquer la cle" : "Afficher la cle"}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={copyKey} aria-label="Copier la cle">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button className="w-full" onClick={() => { setCreateOpen(false); cleanDialogState(); }}>
                    J'ai copie la cle
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="key-nom">Nom de la cle</Label>
                    <Input
                      id="key-nom"
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      placeholder={getPlaceholder()}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <label key={perm.value} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/[0.02] cursor-pointer">
                          <Checkbox
                            checked={form.permissions.includes(perm.value)}
                            onCheckedChange={() => togglePermission(perm.value)}
                          />
                          <span className="text-sm text-slate-300">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key-expiration">Expiration</Label>
                    <Select value={form.expiration} onValueChange={(v) => setForm({ ...form, expiration: v })}>
                      <SelectTrigger id="key-expiration"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPIRATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Generation..." : "Generer la cle"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search / Filter */}
      {keys.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou permission..."
            className="pl-9 bg-white/[0.03] border-white/[0.08]"
            aria-label="Rechercher une cle API"
          />
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Key className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Aucune cle API generee</p>
            <p className="text-sm text-slate-500 mt-1">Generez votre premiere cle pour acceder a l'API GRIMY.</p>
          </div>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p>Aucune cle ne correspond a votre recherche.</p>
        </div>
      ) : (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-white/[0.02]">
                <TableHead className="text-slate-400">Nom</TableHead>
                <TableHead className="text-slate-400">Cle</TableHead>
                <TableHead className="text-slate-400">Permissions</TableHead>
                <TableHead className="text-slate-400">Expire le</TableHead>
                <TableHead className="text-slate-400">Derniere utilisation</TableHead>
                <TableHead className="text-slate-400">Statut</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((k) => {
                const expired = isExpired(k.expires_at);
                return (
                  <TableRow key={k.id} className={`border-white/[0.06] hover:bg-white/[0.02] ${!k.is_active ? "opacity-50" : ""}`}>
                    <TableCell className="font-medium text-slate-200">{k.nom}</TableCell>
                    <TableCell>
                      <code className="text-xs text-slate-400 bg-white/[0.03] px-2 py-1 rounded font-mono">
                        {k.key_prefix}&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.permissions.length === 0 ? (
                          <span className="text-xs text-slate-500">Aucune</span>
                        ) : (
                          k.permissions.slice(0, 3).map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                              {getPermissionLabel(p)}
                            </Badge>
                          ))
                        )}
                        {k.permissions.length > 3 && (
                          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">+{k.permissions.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-xs ${expired ? "text-red-400" : "text-slate-400"}`}>
                      {k.expires_at ? formatDate(k.expires_at) : "Jamais"}
                      {expired && " (expiree)"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(k.last_used_at) || <span className="text-slate-600">&mdash;</span>}</TableCell>
                    <TableCell>
                      {!k.is_active ? (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Revoquee</Badge>
                      ) : expired ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Expiree</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => setRevokeTarget(k)}
                          aria-label={`Revoquer la cle ${k.nom}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Revoke confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoquer la cle API</DialogTitle>
            <DialogDescription>
              Voulez-vous revoquer la cle <strong>{revokeTarget?.nom}</strong> ({revokeTarget?.key_prefix}...) ? Les applications utilisant cette cle perdront immediatement l'acces.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={revokeKey}>Revoquer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk revoke confirmation */}
      <Dialog open={bulkRevokeOpen} onOpenChange={setBulkRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoquer toutes les cles actives</DialogTitle>
            <DialogDescription>
              Voulez-vous revoquer les <strong>{activeKeyCount}</strong> cle(s) API actives ? Toutes les applications utilisant ces cles perdront immediatement l'acces. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setBulkRevokeOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={bulkRevoke}>Tout revoquer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
