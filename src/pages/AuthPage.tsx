import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Shield } from "lucide-react";

// Translate common Supabase auth errors to French
function translateError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email ou mot de passe incorrect.",
    "Email not confirmed": "Veuillez confirmer votre email avant de vous connecter.",
    "User already registered": "Un compte avec cet email existe deja.",
    "Password should be at least 6 characters": "Le mot de passe doit contenir au moins 6 caracteres.",
    "Signup requires a valid password": "Veuillez saisir un mot de passe valide.",
    "Unable to validate email address: invalid format": "Format d'email invalide.",
    "Email rate limit exceeded": "Trop de tentatives. Reessayez dans quelques minutes.",
    "For security purposes, you can only request this after 60 seconds.": "Pour des raisons de securite, veuillez patienter 60 secondes.",
  };
  for (const [en, fr] of Object.entries(map)) {
    if (msg.includes(en)) return fr;
  }
  return msg;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCabinet, setRegCabinet] = useState("");

  // Auto-redirect when session is detected (after login or if already logged in)
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/", { replace: true });
    }
  }, [session, authLoading, navigate]);

  // Avoid importing supabase directly — use the AuthContext methods
  const { signInWithEmail, signUp: authSignUp } = useAuth();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      // Don't navigate here — the useEffect above will redirect
      // once AuthContext picks up the session change
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            full_name: regName,
            cabinet_name: regCabinet,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (authData.session) {
        // Email confirmation disabled — the useEffect will redirect
      } else if (authData.user) {
        // Email confirmation required
        setMessage("Compte cree ! Verifiez votre email pour confirmer votre inscription.");
        setTab("login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  // Show a spinner while checking initial auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GRIMY</h1>
          <p className="text-sm text-slate-400">Plateforme LCB-FT pour cabinets comptables</p>
        </div>

        <Card className="border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-100">Bienvenue</CardTitle>
            <CardDescription className="text-slate-400">
              Connectez-vous ou creez votre compte cabinet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {message}
              </div>
            )}

            <Tabs value={tab} onValueChange={(v) => { setTab(v as "login" | "register"); setError(null); }}>
              <TabsList className="w-full mb-6 bg-white/[0.04]">
                <TabsTrigger value="login" className="flex-1">Connexion</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-slate-300">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-300">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-slate-300">Nom complet</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      autoComplete="name"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-slate-300">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-slate-300">Mot de passe</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Min. 6 caracteres"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-cabinet" className="text-slate-300">Nom du cabinet</Label>
                    <Input
                      id="reg-cabinet"
                      type="text"
                      placeholder="Cabinet Dupont & Associes"
                      value={regCabinet}
                      onChange={(e) => setRegCabinet(e.target.value)}
                      required
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Creer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Plateforme securisee — Donnees chiffrees — Conformite LCB-FT
        </p>
      </div>
    </div>
  );
}
