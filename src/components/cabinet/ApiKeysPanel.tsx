import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";

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

const AVAILABLE_PERMISSIONS = [
  { value: "read:clients", label: "Lecture clients" },
  { value: "write:clients", label: "Ecriture clients" },
  { value: "read:documents", label: "Lecture documents" },
  { value: "write:documents", label: "Ecriture documents" },
  { value: "read:alertes", label: "Lecture alertes" },
  { value: "screening", label: "Screening sanctions/PEP" },
  { value: "export", label: "Export donnees" },
];

const EXPIRATION_OPTIONS = [
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "1 an" },
  { value: "never", label: "Jamais" },
];

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({ nom: "", permissions: [] as string[], expiration: "90" });
  const [creating, setCreating] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cabinet_api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setKeys((data || []) as ApiKey[]);
    } catch {
      toast.error("Erreur lors du chargement des cles API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "grm_";
    for (let i = 0; i < 48; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  const hashKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setCreating(true);
    try {
      const { data: cab } = await supabase.from("cabinets").select("id").limit(1).single();
      if (!cab) throw new Error("Cabinet non trouve");

      const rawKey = generateKey();
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

      setNewKeyValue(rawKey);
      setShowKey(true);
      setForm({ nom: "", permissions: [], expiration: "90" });
      await loadKeys();
    } catch {
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
    toast.success("Cle API revoquee");
    setRevokeTarget(null);
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
    if (!d) return "—";
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-400" /> Cles API
          </h2>
          <p className="text-sm text-slate-400">Gerez les cles d'acces a l'API GRIMY.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewKeyValue(null); setShowKey(false); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Generer une cle API
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{newKeyValue ? "Cle API generee" : "Nouvelle cle API"}</DialogTitle>
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
                    value={showKey ? newKeyValue : "•".repeat(40)}
                    className="font-mono text-xs bg-white/[0.03] border-white/[0.08]"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={() => { setCreateOpen(false); setNewKeyValue(null); }}>
                  J'ai copie la cle
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nom de la cle</Label>
                  <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Integration comptabilite" required />
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
                  <Label>Expiration</Label>
                  <Select value={form.expiration} onValueChange={(v) => setForm({ ...form, expiration: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

      {keys.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucune cle API generee.</p>
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
              {keys.map((k) => {
                const expired = isExpired(k.expires_at);
                return (
                  <TableRow key={k.id} className={`border-white/[0.06] hover:bg-white/[0.02] ${!k.is_active ? "opacity-50" : ""}`}>
                    <TableCell className="font-medium text-slate-200">{k.nom}</TableCell>
                    <TableCell>
                      <code className="text-xs text-slate-400 bg-white/[0.03] px-2 py-1 rounded font-mono">
                        {k.key_prefix}••••••••
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.permissions.length === 0 ? (
                          <span className="text-xs text-slate-500">Aucune</span>
                        ) : (
                          k.permissions.slice(0, 3).map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px] text-slate-400 border-slate-700">{p}</Badge>
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
                    <TableCell className="text-xs text-slate-400">{formatDate(k.last_used_at)}</TableCell>
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
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => setRevokeTarget(k)}>
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
    </div>
  );
}
