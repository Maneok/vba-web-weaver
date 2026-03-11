import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Building2, UserPlus } from "lucide-react";

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  cabinet_name: string;
  expires_at: string;
  status: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collaborateur",
  STAGIAIRE: "Stagiaire",
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Load invitation info
  useEffect(() => {
    if (!token) {
      setError("Lien d'invitation invalide.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchInvitation() {
      const { data, error: fetchErr } = await supabase
        .from("invitations")
        .select("id, email, role, status, expires_at, cabinet_id, cabinets(nom)")
        .eq("token", token!)
        .maybeSingle();

      if (cancelled) return;

      if (fetchErr || !data) {
        setError("Invitation introuvable ou lien invalide.");
        setLoading(false);
        return;
      }

      if (data.status !== "pending") {
        setError("Cette invitation a deja ete utilisee ou revoquee.");
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Cette invitation a expire.");
        setLoading(false);
        return;
      }

      const cabinets = data.cabinets as Record<string, unknown> | null;
      const cabinetName = (cabinets && typeof cabinets.nom === "string") ? cabinets.nom : "Cabinet inconnu";

      setInvitation({
        id: data.id,
        email: data.email,
        role: data.role,
        cabinet_name: cabinetName,
        expires_at: data.expires_at,
        status: data.status,
      });
      setLoading(false);
    }

    fetchInvitation();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAccept() {
    if (!user) {
      // Redirect to auth with return URL
      const returnUrl = `/invite/${token}`;
      navigate(`/auth?email=${encodeURIComponent(invitation?.email || "")}&redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (!invitation || !token) return;

    setAccepting(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("accept_invitation", {
      p_token: token,
      p_user_id: user.id,
    });

    if (rpcErr) {
      setError(rpcErr.message || "Erreur lors de l'acceptation de l'invitation.");
      setAccepting(false);
      return;
    }

    setAccepted(true);
    setAccepting(false);

    // Redirect to dashboard after short delay
    setTimeout(() => navigate("/", { replace: true }), 2000);
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-blue-600" />
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
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Retour a la connexion
              </Button>
            </div>
          ) : accepted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-green-700">
                Vous avez rejoint <strong>{invitation?.cabinet_name}</strong>. Redirection en cours...
              </p>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cabinet</p>
                    <p className="font-medium">{invitation.cabinet_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role propose</p>
                    <p className="font-medium">{ROLE_LABELS[invitation.role] || invitation.role}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Invitation envoyee a <strong>{invitation.email}</strong>
              </p>

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
