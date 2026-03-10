import { useState, useEffect } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
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

  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";

  const [tab, setTab] = useState<"login" | "register">(prefillEmail ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useDocumentTitle("Connexion");

  // Login state
  const [loginEmail, setLoginEmail] = useState(prefillEmail);
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState(prefillEmail);
  const [regPassword, setRegPassword] = useState("");
  const [regCabinet, setRegCabinet] = useState("");

  // Sanitize redirect parameter to prevent open redirect attacks
  function sanitizeRedirect(url: string | null): string {
    if (!url) return "/";
    // Only allow relative paths starting with a single "/"
    // Block protocol-relative URLs ("//"), absolute URLs, and javascript: URIs
    if (
      !url.startsWith("/") ||
      url.startsWith("//") ||
      url.toLowerCase().startsWith("/\\") ||
      url.includes(":") ||
      url.includes("@")
    ) {
      return "/";
    }
    return url;
  }

  // Auto-redirect when session is detected (after login or if already logged in)
  useEffect(() => {
    if (!authLoading && session) {
      const redirect = sanitizeRedirect(searchParams.get("redirect"));
      navigate(redirect, { replace: true });
    }
  }, [session, authLoading, navigate, searchParams]);

  // Avoid importing supabase directly — use the AuthContext methods
  const { signInWithEmail, signInWithGoogle, signUp: authSignUp } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

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

    // Password strength validation
    if (regPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await authSignUp(regEmail, regPassword, regName, regCabinet || undefined);
      // If email confirmation is disabled, session will be detected by AuthContext
      // and the useEffect above will redirect. Otherwise show confirmation message.
      setMessage("Compte cree ! Verifiez votre email pour confirmer votre inscription.");
      setTab("login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  // Show a spinner while checking initial auth state (with 6s max)
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    if (!authLoading) { setAuthTimedOut(false); return; }
    const t = setTimeout(() => setAuthTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [authLoading]);

  if (authLoading && !authTimedOut) {
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
          <p className="text-sm text-slate-400">Conformité LAB pour professionnels assujettis</p>
        </div>

        <Card className="border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-100">Bienvenue</CardTitle>
            <CardDescription className="text-slate-400">
              Connectez-vous ou creez votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div id="auth-error" role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
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
                <form onSubmit={handleLogin} className="space-y-4" noValidate aria-label="Formulaire de connexion" aria-describedby={error ? "auth-error" : undefined}>
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
                      aria-label="Adresse email de connexion"
                      aria-describedby={error ? "auth-error" : undefined}
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
                      aria-label="Mot de passe"
                      aria-describedby={error ? "auth-error" : undefined}
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4" noValidate aria-label="Formulaire d'inscription" aria-describedby={error ? "auth-error" : undefined}>
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
                      placeholder="Min. 8 caracteres"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="bg-white/[0.04] border-white/[0.08] text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-cabinet" className="text-slate-300">Nom de la structure</Label>
                    <Input
                      id="reg-cabinet"
                      type="text"
                      placeholder="Cabinet / Etude / Agence..."
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

            {/* Google OAuth separator + button */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.08]" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white/[0.03] px-3 text-slate-500">ou</span></div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
              disabled={googleLoading || loading}
              onClick={async () => {
                setGoogleLoading(true);
                setError(null);
                try { await signInWithGoogle(); } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Erreur Google OAuth";
                  setError(translateError(msg));
                } finally { setGoogleLoading(false); }
              }}
            >
              {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              )}
              Continuer avec Google
            </Button>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-xs text-slate-500">
            Plateforme securisee — Donnees chiffrees — Conformite LCB-FT
          </p>
          <Link to="/landing" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            &larr; Retour a l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
