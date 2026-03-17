import { useState, useEffect, useCallback, useRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logAudit } from "@/lib/auth/auditTrail";
import type { UserProfile, UserRole } from "@/lib/auth/types";
import { ROLE_LABELS } from "@/lib/auth/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Shield, UserCheck, UserX, Users, Copy } from "lucide-react";

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-primary text-primary-foreground",
  SUPERVISEUR: "bg-[hsl(var(--risk-medium))] text-black",
  COLLABORATEUR: "bg-[hsl(var(--chart-5))] text-white",
  STAGIAIRE: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("COLLABORATEUR");
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UserProfile | null>(null);
  const isAdmin = profile?.role === "ADMIN";

  useDocumentTitle("Gestion Utilisateurs");

  const loadUsers = useCallback(async () => {
    if (!profile?.cabinet_id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("cabinet_id", profile.cabinet_id)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Erreur lors du chargement des utilisateurs");
        return;
      }
      if (Array.isArray(data)) setUsers(data as UserProfile[]);
    } catch {
      toast.error("Impossible de charger les utilisateurs");
    }
  }, [profile?.cabinet_id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Store invite reload timer for cleanup
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    };
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validate email format before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inviteEmail.trim() || !emailRegex.test(inviteEmail.trim())) {
      toast.error("Veuillez saisir une adresse email valide (ex: jean@cabinet.fr)");
      return;
    }

    setInviting(true);

    try {
      // Invite user — signUp with email confirmation so they set their own password
      const { error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: crypto.randomUUID() + "Aa1!",
        options: {
          data: {
            full_name: inviteName,
            cabinet_id: profile.cabinet_id,
            role: inviteRole,
          },
          emailRedirectTo: `${window.location.origin}/auth?invited=true`,
        },
      });

      if (error) throw error;

      await logAudit({
        action: "INVITATION_UTILISATEUR",
        table_name: "profiles",
        new_data: { email: inviteEmail, role: inviteRole, full_name: inviteName },
      });

      toast.success(`Invitation envoyee a ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("COLLABORATEUR");

      // Reload after trigger creates profile (with exponential backoff)
      const tryReload = (attempt: number) => {
        inviteTimerRef.current = setTimeout(async () => {
          await loadUsers();
          // If user not found yet and we haven't exceeded retries, try again
          if (attempt < 3) tryReload(attempt + 1);
        }, 2000 * Math.pow(2, attempt));
      };
      tryReload(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'invitation";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) { toast.error("Acces refuse"); return; }
    setUpdating(true);
    try {
      const user = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        toast.error("Erreur lors de la mise a jour du role");
        return;
      }

      await logAudit({
        action: "CHANGEMENT_ROLE",
        table_name: "profiles",
        record_id: userId,
        old_data: { role: user?.role },
        new_data: { role: newRole },
      });

      toast.success("Role mis a jour");
      await loadUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la mise a jour du role";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const requestToggleUser = (userId: string) => {
    if (!isAdmin) { toast.error("Acces refuse"); return; }
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (user.id === profile?.id) {
      toast.error("Vous ne pouvez pas desactiver votre propre compte");
      return;
    }
    setToggleTarget(user);
  };

  const confirmToggleUser = async () => {
    if (!toggleTarget) return;
    const user = toggleTarget;
    const newStatus = !user.is_active;
    setToggleTarget(null);

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", user.id);

    if (error) {
      toast.error("Erreur lors de la mise a jour");
      return;
    }

    await logAudit({
      action: newStatus ? "ACTIVATION_UTILISATEUR" : "DESACTIVATION_UTILISATEUR",
      table_name: "profiles",
      record_id: user.id,
      old_data: { is_active: user.is_active },
      new_data: { is_active: newStatus },
    });

    toast.success(newStatus ? "Utilisateur active" : "Utilisateur desactive");
    await loadUsers();
  };

  const adminCount = users.filter((u) => u.role === "ADMIN" && u.is_active).length;
  const activeCount = users.filter((u) => u.is_active).length;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-destructive">Acces refuse</p>
          <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent gerer les utilisateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" /> Gestion des Utilisateurs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez les acces et les roles de votre cabinet
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" /> Inviter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un utilisateur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jean@cabinet.fr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={inviting}>
                {inviting ? "Envoi..." : "Envoyer l'invitation"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-[hsl(var(--status-valid))]" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Copy className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold truncate text-xs">{profile?.cabinet_id?.slice(0, 8)}...</p>
                <p className="text-xs text-muted-foreground">Cabinet ID</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead scope="col">Utilisateur</TableHead>
              <TableHead scope="col">Email</TableHead>
              <TableHead scope="col">Role</TableHead>
              <TableHead scope="col">Statut</TableHead>
              <TableHead scope="col">Inscrit le</TableHead>
              <TableHead scope="col" className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur. Invitez votre premier collaborateur.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-sm">
                  <button
                    className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                    onClick={() => {
                      navigator.clipboard.writeText(u.email).then(
                        () => toast.success(`Email copie : ${u.email}`),
                        () => toast.error("Impossible de copier l'email")
                      );
                    }}
                    title="Copier l'email"
                    aria-label={`Copier l'email de ${u.full_name || u.email}`}
                  >
                    {u.email}
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </TableCell>
                <TableCell>
                  {u.id === profile?.id ? (
                    <Badge className={ROLE_COLORS[u.role]}>{u.role}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateUserRole(u.id, v as UserRole)}
                      disabled={updating}
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <Badge className={ROLE_COLORS[u.role]}>{u.role}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "default" : "destructive"}>
                    {u.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(u.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  {u.id !== profile?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestToggleUser(u.id)}
                      aria-label={u.is_active ? `Desactiver ${u.full_name || u.email}` : `Activer ${u.full_name || u.email}`}
                    >
                      {u.is_active ? (
                        <UserX className="w-4 h-4 text-destructive" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-[hsl(var(--status-valid))]" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Role descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Description des roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">ADMIN (Associe signataire)</p>
              <p className="text-muted-foreground">Acces total : lecture, ecriture, suppression, gestion des utilisateurs</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">SUPERVISEUR</p>
              <p className="text-muted-foreground">Lecture et ecriture sur tous les dossiers, pas de suppression</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">COLLABORATEUR</p>
              <p className="text-muted-foreground">Lecture + saisie uniquement sur les clients assignes</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">STAGIAIRE</p>
              <p className="text-muted-foreground">Lecture seule sur l'ensemble des donnees</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation activation/desactivation */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{toggleTarget?.is_active ? "Desactiver" : "Activer"} l'utilisateur</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment {toggleTarget?.is_active ? "desactiver" : "activer"} <strong>{toggleTarget?.full_name || toggleTarget?.email}</strong> ?
              {toggleTarget?.is_active && " L'utilisateur ne pourra plus se connecter."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Annuler</Button>
            <Button variant={toggleTarget?.is_active ? "destructive" : "default"} onClick={confirmToggleUser}>
              {toggleTarget?.is_active ? "Desactiver" : "Activer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
