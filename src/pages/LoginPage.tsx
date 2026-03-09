import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Eye, EyeOff, Loader2, Mail, Lock, Check, X, KeyRound } from "lucide-react";
import { toast } from "sonner";

const REMEMBERED_EMAIL_KEY = "lcb_remembered_email";
const REMEMBER_ME_KEY = "lcb_remember_me";

function translateSupabaseError(message: string): string {
  const translations: Record<string, string> = {
    "Invalid login credentials": "Identifiants incorrects. Verifiez votre email et mot de passe.",
    "Email not confirmed": "Votre email n'a pas encore ete confirme. Verifiez votre boite de reception.",
    "User already registered": "Un compte existe deja avec cette adresse email.",
    "Password should be at least 6 characters": "Le mot de passe doit contenir au moins 6 caracteres.",
    "Signup requires a valid password": "Veuillez entrer un mot de passe valide.",
    "Unable to validate email address: invalid format": "Le format de l'adresse email est invalide.",
    "Email rate limit exceeded": "Trop de tentatives. Veuillez patienter quelques minutes.",
    "For security purposes, you can only request this once every 60 seconds": "Pour des raisons de securite, veuillez patienter 60 secondes avant de reessayer.",
    "Auth session missing!": "Session expiree. Veuillez vous reconnecter.",
    "New password should be different from the old password.": "Le nouveau mot de passe doit etre different de l'ancien.",
  };
  for (const [en, fr] of Object.entries(translations)) {
    if (message.includes(en)) return fr;
  }
  return message;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: "Faible", color: "bg-red-500" };
  if (score <= 4) return { score: 2, label: "Moyen", color: "bg-amber-500" };
  return { score: 3, label: "Fort", color: "bg-emerald-500" };
}

export default function LoginPage() {
  const { session, loading, signInWithEmail, signInWithGoogle, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(() => {
    const remembered = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    return remembered ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) || "") : "";
  });
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) === "true");
  const [resetSending, setResetSending] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const emailRef = useRef<HTMLInputElement>(null);

  // Auto-focus email on mount
  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Live countdown timer for account lock
  useEffect(() => {
    if (lockedUntil <= Date.now()) {
      setLockCountdown(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockCountdown(0);
        clearInterval(interval);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  // Parallax effect for left panel stats
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
    });
  }, []);

  // Remember email in localStorage
  useEffect(() => {
    localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
    if (rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  }, [rememberMe, email]);

  const isLocked = lockCountdown > 0;

  const passwordChecks = [
    { label: "Au moins 8 caracteres", met: password.length >= 8 },
    { label: "Une lettre majuscule", met: /[A-Z]/.test(password) },
    { label: "Une lettre minuscule", met: /[a-z]/.test(password) },
    { label: "Un chiffre", met: /[0-9]/.test(password) },
  ];

  const strength = getPasswordStrength(password);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[hsl(220,30%,12%)] to-[hsl(220,40%,8%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-xl bg-[hsl(210,60%,60%)] animate-ping opacity-20" />
            <div className="relative w-14 h-14 rounded-xl bg-[hsl(210,60%,60%)] flex items-center justify-center animate-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="text-white/60 text-sm animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error(`Trop de tentatives. Reessayez dans ${lockCountdown}s.`);
      return;
    }
    if (mode === "signup") {
      if (password.length < 8) {
        toast.error("Le mot de passe doit contenir au moins 8 caracteres");
        return;
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        toast.error("Le mot de passe doit contenir majuscules, minuscules et chiffres");
        return;
      }
      if (!fullName.trim() || fullName.trim().length < 2) {
        toast.error("Veuillez entrer votre nom complet");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
        setFailedAttempts(0);
        toast.success("Connexion reussie");
      } else {
        await signUp(email, password, fullName.trim());
        toast.success("Compte cree ! Verifiez votre email pour confirmer.");
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Erreur de connexion";
      toast.error(translateSupabaseError(rawMessage));
      if (mode === "login") {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= 5) {
          const lockDuration = Math.min(60000 * Math.pow(2, Math.floor(attempts / 5) - 1), 300000);
          setLockedUntil(Date.now() + lockDuration);
          toast.error(`Compte temporairement verrouille (${lockDuration / 1000}s)`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !submitting && !isLocked) {
      const form = (e.target as HTMLElement).closest("form");
      if (form) form.requestSubmit();
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error("Veuillez entrer votre adresse email d'abord.");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de reinitialisation envoye. Verifiez votre boite de reception.");
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      toast.error(translateSupabaseError(rawMessage));
    } finally {
      setResetSending(false);
    }
  };

  const toggleMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Branding with gradient animation */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        style={{
          background: "linear-gradient(135deg, hsl(220,30%,15%), hsl(220,40%,8%), hsl(210,50%,12%))",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      >
        <style>{`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[hsl(210,60%,60%)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">MATRICE LCB-FT</h1>
            <p className="text-xs text-white/50">v1.0 - Memoire DEC 2026</p>
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Dispositif de vigilance<br />
            <span className="text-[hsl(210,60%,60%)]">anti-blanchiment</span>
          </h2>
          <p className="text-white/60 text-lg max-w-md">
            Plateforme de conformite LCB-FT pour les cabinets d'expertise comptable.
            Gestion des risques, pilotage des dossiers et tracabilite complete.
          </p>
          {/* Stats with parallax effect */}
          <div
            className="flex gap-8 pt-4 transition-transform duration-300 ease-out"
            style={{
              transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`,
            }}
          >
            <div>
              <p className="text-3xl font-bold text-[hsl(210,60%,60%)]">L.561</p>
              <p className="text-xs text-white/40">Code Monetaire</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[hsl(142,70%,40%)]">100%</p>
              <p className="text-xs text-white/40">Conformite</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[hsl(38,92%,50%)]">24/7</p>
              <p className="text-xs text-white/40">Tracabilite</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30 relative z-10">
          NPLAB 2025 - Conforme aux exigences du H3C et de l'Ordre des Experts-Comptables
        </p>

        {/* Decorative background orbs */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-10 w-48 h-48 bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">MATRICE LCB-FT</h1>
          </div>

          {/* Form header with animation */}
          <div
            className="text-center lg:text-left transition-all duration-300 ease-in-out"
            key={mode}
            style={{ animation: "fadeSlideIn 0.3s ease-out" }}
          >
            <style>{`
              @keyframes fadeSlideIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <h2 className="text-2xl font-bold">
              {mode === "login" ? "Connexion" : "Creer un compte"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Accedez a votre espace de conformite"
                : "Creez votre compte pour commencer"}
            </p>
          </div>

          {/* Lock countdown banner */}
          {isLocked && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>
                Compte verrouille. Reessayez dans{" "}
                <span className="font-mono font-bold">{lockCountdown}s</span>
              </span>
            </div>
          )}

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium transition-all duration-200 hover:shadow-md"
            onClick={() => signInWithGoogle()}
            disabled={submitting || isLocked}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Email/Password form */}
          <Card className="border-0 shadow-none">
            <CardContent className="p-0">
              <div
                className="transition-all duration-300 ease-in-out"
                key={`form-${mode}`}
                style={{ animation: "fadeSlideIn 0.3s ease-out" }}
              >
                <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={handleKeyDown}>
                  {mode === "signup" && (
                    <div className="space-y-2" style={{ animation: "fadeSlideIn 0.3s ease-out 0.05s both" }}>
                      <Label htmlFor="fullName">Nom complet</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Jean Dupont"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="h-11 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(210,60%,60%,0.15)] focus:border-[hsl(210,60%,60%)]"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        ref={emailRef}
                        id="email"
                        type="email"
                        placeholder="vous@cabinet.fr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 pl-10 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(210,60%,60%,0.15)] focus:border-[hsl(210,60%,60%)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Mot de passe</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          disabled={resetSending}
                          className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {resetSending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <KeyRound className="w-3 h-3" />
                          )}
                          Mot de passe oublie ?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="h-11 pr-10 transition-shadow duration-200 focus:shadow-[0_0_0_3px_hsl(210,60%,60%,0.15)] focus:border-[hsl(210,60%,60%)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password strength indicator (signup only) */}
                    {mode === "signup" && password.length > 0 && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex gap-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                              style={{ width: `${(strength.score / 3) * 100}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${
                            strength.score === 1 ? "text-red-500" :
                            strength.score === 2 ? "text-amber-500" : "text-emerald-500"
                          }`}>
                            {strength.label}
                          </span>
                        </div>

                        {/* Password requirements checklist */}
                        <div className="grid grid-cols-2 gap-1">
                          {passwordChecks.map((check) => (
                            <div
                              key={check.label}
                              className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                                check.met ? "text-emerald-500" : "text-muted-foreground"
                              }`}
                            >
                              {check.met ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              {check.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remember me checkbox (login only) */}
                  {mode === "login" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer font-normal">
                        Se souvenir de moi
                      </Label>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-primary/20"
                    disabled={submitting || isLocked}
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="relative w-4 h-4">
                          <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
                        </div>
                        {mode === "login" ? "Connexion..." : "Creation..."}
                      </div>
                    ) : (
                      <>{mode === "login" ? "Se connecter" : "Creer mon compte"}</>
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  onClick={() => toggleMode("signup")}
                  className="text-primary font-medium hover:underline transition-colors"
                >
                  Creer un compte
                </button>
              </>
            ) : (
              <>
                Deja un compte ?{" "}
                <button
                  onClick={() => toggleMode("login")}
                  className="text-primary font-medium hover:underline transition-colors"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>

          <p className="text-center text-[10px] text-muted-foreground/50">
            Session securisee - Timeout automatique apres 30 min d'inactivite
          </p>
        </div>
      </div>
    </div>
  );
}
