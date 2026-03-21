import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Building2, UserPlus, Mail, Shield, Clock } from "lucide-react";
import { toast } from "sonner";

interface InvitationInfo {
  email: string;
  role: string;
  cabinet_name: string;
  invited_by: string;
  expires_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collaborateur",
  STAGIAIRE: "Stagiaire",
};

function formatDateFr(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Validate invitation token via RPC (bypasses RLS)
  useEffect(() => {
    if (!token) {
      setError("Lien d'invitation invalide.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function validateToken() {
      const { data, error: rpcError } = await supabase.rpc("validate_invitation_token", {
        p_token: token!,
      });

      if (cancelled) return;

      if (rpcError) {
        console.error("RPC validate_invitation_token error:", rpcError);
        setError("Erreur de validation du lien d'invitation.");
        setLoading(false);
        return;
      }

      if (!data || !data.valid) {
        setError(data?.error || "Invitation introuvable ou lien invalide.");
        setLoading(false);
        return;
      }

      setInvitation({
        email: data.email,
        role: data.role,
        cabinet_name: data.cabinet_name,
        invited_by: data.invited_by || "",
        expires_at: data.expires_at,
      });
      setLoading(false);
    }

    validateToken();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAccept() {
    if (!user) {
      // Redirect to auth with return URL + pre-fill email
      const returnUrl = `/invite/${token}`;
      navigate(`/auth?email=${encodeURIComponent(invitation?.email || "")}&redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (!invitation || !token) return;

    setAccepting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });

    if (rpcError) {
      toast.error(rpcError.message || "Erreur lors de l'acceptation de l'invitation.");
      setError(rpcError.message || "Erreur lors de l'acceptation.");
      setAccepting(false);
      return;
    }

    if (data && !data.success) {
      toast.error(data.error || "Impossible d'accepter l'invitation.");
      setError(data.error || "Impossible d'accepter l'invitation.");
      setAccepting(false);
      return;
    }

    toast.success(data?.message || "Bienvenue dans le cabinet !");
    setAccepted(true);
    setAccepting(false);

    // Redirect to dashboard after short delay
    setTimeout(() => navigate("/", { replace: true }), 1500);
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-xl">Invitation a rejoindre un cabinet</CardTitle>
          <CardDescription>
            {error
              ? "Un probleme est survenu"
              : accepted
                ? "Invitation acceptee !"
                : "Vous avez ete invite a collaborer"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Retour a la connexion
              </Button>
            </div>
          ) : accepted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">
                Vous avez rejoint <strong>{invitation?.cabinet_name}</strong>. Redirection en cours...
              </p>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              <div className="rounded-lg border bg-slate-50 dark:bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cabinet</p>
                    <p className="font-medium">{invitation.cabinet_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role propose</p>
                    <p className="font-medium">{ROLE_LABELS[invitation.role] || invitation.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Adresse email</p>
                    <p className="font-medium">{invitation.email}</p>
                  </div>
                </div>
                {invitation.invited_by && (
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Invite par</p>
                      <p className="font-medium">{invitation.invited_by}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expire le</p>
                    <p className="font-medium text-sm">{formatDateFr(invitation.expires_at)}</p>
                  </div>
                </div>
              </div>

              {!user ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={handleAccept}>
                    Se connecter pour accepter
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Vous devez etre connecte pour accepter l'invitation
                  </p>
                </div>
              ) : (
                <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                  {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Accepter l'invitation
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
