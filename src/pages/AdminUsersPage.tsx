import { useState, useEffect, useCallback } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      if (data) setUsers(data as UserProfile[]);
    } catch (err) {
      console.error("[Admin] loadUsers error:", err);
      toast.error("Erreur lors du chargement des utilisateurs");
    }
  }, [profile?.cabinet_id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setInviting(true);

    try {
      // Create user via Supabase Auth admin (client-side invite)
      const { error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: crypto.randomUUID().slice(0, 16) + "A1!", // Temporary password
        options: {
          data: {
            full_name: inviteName,
            cabinet_id: profile.cabinet_id,
            role: inviteRole,
          },
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

      // Reload after trigger creates profile
      setTimeout(loadUsers, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'invitation";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    const user = users.find((u) => u.id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error("Erreur lors de la mise a jour");
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
    loadUsers();
  };

  const toggleUserActive = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user || user.id === profile?.id) return;

    const newStatus = !user.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", userId);

    if (error) {
      toast.error("Erreur lors de la mise a jour");
      return;
    }

    await logAudit({
      action: newStatus ? "ACTIVATION_UTILISATEUR" : "DESACTIVATION_UTILISATEUR",
      table_name: "profiles",
      record_id: userId,
      old_data: { is_active: user.is_active },
      new_data: { is_active: newStatus },
    });

    toast.success(newStatus ? "Utilisateur active" : "Utilisateur desactive");
    loadUsers();
  };

  const adminCount = users.filter((u) => u.role === "ADMIN" && u.is_active).length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="p-6 space-y-6">
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
              <TableHead>Utilisateur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  {u.id === profile?.id ? (
                    <Badge className={ROLE_COLORS[u.role]}>{u.role}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateUserRole(u.id, v as UserRole)}
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
                      onClick={() => toggleUserActive(u.id)}
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
    </div>
  );
}
