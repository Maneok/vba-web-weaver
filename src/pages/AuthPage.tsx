import { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle, Loader2, Shield, Mail, Lock, User, Building2,
  Eye, EyeOff, Check, FileSearch, Scale, ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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
    "rate limit": "Trop de tentatives. Reessayez dans quelques minutes.",
    "User not found": "Email ou mot de passe incorrect.",
    "Invalid Refresh Token": "Session expiree, veuillez vous reconnecter.",
    "Refresh Token Not Found": "Session expiree, veuillez vous reconnecter.",
    "New password should be different from the old password": "Le nouveau mot de passe doit etre different de l'ancien.",
    "Auth session missing": "Session expiree, veuillez vous reconnecter.",
    "over_email_send_rate_limit": "Trop d'emails envoyes. Veuillez patienter quelques minutes.",
    "over_request_rate_limit": "Trop de requetes. Veuillez patienter quelques minutes.",
  };
  for (const [en, fr] of Object.entries(map)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return fr;
  }
  return msg;
}

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const NAME_RE = /^[\p{L}\s'-]{2,}$/u;

function getPasswordStrength(pw: string) {
  const rules = [
    { id: "length", label: "8 caracteres min.", ok: pw.length >= 8 },
    { id: "upper", label: "1 majuscule", ok: /[A-Z]/.test(pw) },
    { id: "digit", label: "1 chiffre", ok: /\d/.test(pw) },
    { id: "special", label: "1 caractere special", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = rules.filter(r => r.ok).length;
  const level = score <= 1 ? "faible" : score <= 3 ? "moyen" : "fort";
  const color = score <= 1 ? "bg-red-500" : score <= 3 ? "bg-orange-400" : "bg-emerald-500";
  return { rules, score, level, color };
}

// Sanitize redirect parameter to prevent open redirect attacks
function sanitizeRedirect(url: string | null): string {
  if (!url) return "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.toLowerCase().startsWith("/\\") || url.includes(":") || url.includes("@")) return "/";
  return url;
}

// ─────────────────────────────────────────────
// Input with icon component
// ─────────────────────────────────────────────

const IconInput = forwardRef<HTMLInputElement, {
  icon: React.ElementType;
  id: string;
  type?: string;
  error?: string;
  valid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type">>(
  function IconInput({ icon: Icon, id, type = "text", error: fieldError, valid, ...props }, ref) {
    return (
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-400 pointer-events-none" />
        <input
          ref={ref}
          id={id}
          type={type}
          {...props}
          className={`flex w-full rounded-md px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10 pr-10 bg-white dark:bg-white/[0.04] border transition-colors
            ${fieldError ? "border-red-400 focus-visible:ring-red-400/40" : valid ? "border-emerald-400 focus-visible:ring-emerald-400/40" : "border-gray-300 dark:border-white/[0.10]"}
            text-slate-900 dark:text-slate-100 placeholder:text-slate-400 h-11`}
        />
        {valid && !fieldError && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-in fade-in zoom-in duration-200" />
        )}
      </div>
    );
  }
);

// ─────────────────────────────────────────────
// Password input with toggle
// ─────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  error: fieldError,
  valid,
  ...props
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  valid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "value" | "onChange">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-400 pointer-events-none" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        {...props}
        className={`pl-10 pr-10 bg-white dark:bg-white/[0.04] border transition-colors
          ${fieldError ? "border-red-400 focus-visible:ring-red-400/40" : valid ? "border-emerald-400 focus-visible:ring-emerald-400/40" : "border-gray-300 dark:border-white/[0.10]"}
          text-slate-900 dark:text-slate-100 placeholder:text-slate-400 h-11`}
      />
      <button
        type="button"
        tabIndex={0}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        onClick={() => setShow(!show)}
        onKeyDown={e => { if (e.key === "Enter") setShow(!show); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signInWithEmail, signInWithGoogle, signUp: authSignUp, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const prefillEmail = searchParams.get("email") || "";
  const redirectParam = searchParams.get("redirect") || "";
  const isInvite = redirectParam.includes("/invite/");

  const [tab, setTab] = useState<"login" | "register">(prefillEmail && !isInvite ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Rate limiting
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Login state
  const [loginEmail, setLoginEmail] = useState(prefillEmail);
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Register state
  const [regPrenom, setRegPrenom] = useState("");
  const [regNom, setRegNom] = useState("");
  const [regEmail, setRegEmail] = useState(prefillEmail);
  const [regCabinet, setRegCabinet] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Touched state (show validation only after interaction)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  // Refs for auto-focus
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const regPrenomRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(tab === "login" ? "Connexion" : "Inscription");

  // Auto-redirect when session detected
  useEffect(() => {
    if (!authLoading && session) {
      const redirect = sanitizeRedirect(searchParams.get("redirect"));
      // Welcome toast
      const name = profile?.full_name?.split(" ")[0] || "";
      if (name) toast.success(`Bienvenue, ${name} !`);
      navigate(redirect, { replace: true });
    }
  }, [session, authLoading, navigate, searchParams, profile]);

  // Auto-focus on tab change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tab === "login") loginEmailRef.current?.focus();
      else regPrenomRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [tab]);

  // Lock countdown timer
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(0); return; }
    const tick = () => {
      const remain = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remain <= 0) { setLockedUntil(null); setLockCountdown(0); }
      else setLockCountdown(remain);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Clear error on tab change
  useEffect(() => { setError(null); setTouched({}); }, [tab]);

  // ── Validation ──
  const loginValid = EMAIL_RE.test(loginEmail) && loginPassword.length >= 6;

  const pwStrength = useMemo(() => getPasswordStrength(regPassword), [regPassword]);
  const regPrenomValid = NAME_RE.test(regPrenom.trim());
  const regNomValid = NAME_RE.test(regNom.trim());
  const regEmailValid = EMAIL_RE.test(regEmail);
  const regCabinetValid = regCabinet.trim().length >= 3;
  const regPwValid = pwStrength.score === 4;
  const regConfirmValid = regConfirm.length > 0 && regConfirm === regPassword;
  const registerValid = regPrenomValid && regNomValid && regEmailValid && regCabinetValid && regPwValid && regConfirmValid;

  // ── Handlers ──
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Trop de tentatives. Reessayez dans ${lockCountdown}s`);
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      setLoginAttempts(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(translateError(msg));
      setLoginAttempts(prev => {
        const next = prev + 1;
        if (next >= 3) {
          const lockDuration = next >= 5 ? 120000 : 60000;
          setLockedUntil(Date.now() + lockDuration);
          return next;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [loginEmail, loginPassword, lockedUntil, lockCountdown, signInWithEmail]);

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!registerValid) return;
    setLoading(true);
    try {
      const fullName = `${regPrenom.trim()} ${regNom.trim()}`;
      await authSignUp(regEmail, regPassword, fullName, regCabinet.trim());
      toast.success("Compte cree ! Verifiez votre email pour confirmer votre inscription.");
      setTab("login");
      setLoginEmail(regEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }, [regPrenom, regNom, regEmail, regPassword, regCabinet, registerValid, authSignUp]);

  const handleForgotPassword = useCallback(async () => {
    if (!EMAIL_RE.test(forgotEmail)) { setError("Format d'email invalide."); return; }
    setForgotLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (resetError) {
        // Log the actual error for debugging but don't reveal it to the user (prevents email enumeration)
        console.warn("[Auth] Password reset error:", resetError.message);
        // Rate limit errors should be shown to the user
        if (resetError.message.includes("rate limit") || resetError.message.includes("60 seconds")) {
          setError(translateError(resetError.message));
          return;
        }
      }
      toast.success("Si cet email existe, un lien de reinitialisation a ete envoye.");
      setShowForgot(false);
    } catch {
      // Network error — still show generic success to prevent enumeration
      toast.success("Si cet email existe, un lien de reinitialisation a ete envoye.");
      setShowForgot(false);
    } finally {
      setForgotLoading(false);
    }
  }, [forgotEmail]);

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    try { await signInWithGoogle(); } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur Google OAuth";
      setError(translateError(msg));
    } finally { setGoogleLoading(false); }
  }, [signInWithGoogle]);

  // ── Auth loading spinner ──
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    if (!authLoading) { setAuthTimedOut(false); return; }
    const t = setTimeout(() => setAuthTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [authLoading]);

  if (authLoading && !authTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen flex">
      {/* ════════ LEFT: FORM ════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white dark:bg-slate-950 relative">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">GRIMY</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Conformite LCB-FT pour professionnels assujettis</p>
          </div>

          {/* Invite banner */}
          {isInvite && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 p-3.5 text-sm text-blue-700 dark:text-blue-300 animate-in fade-in duration-300">
              <Mail className="w-4 h-4 shrink-0" />
              Connectez-vous pour accepter votre invitation
            </div>
          )}

          {/* Tabs */}
          <div className="flex mb-6 bg-gray-100 dark:bg-white/[0.06] rounded-xl p-1">
            {(["login", "register"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${tab === t
                    ? "bg-white dark:bg-white/[0.10] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
              >
                {t === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div id="auth-error" role="alert" aria-live="assertive" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300 animate-in fade-in shake-x duration-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ──────── LOGIN FORM ──────── */}
          {tab === "login" && !showForgot && (
            <form onSubmit={handleLogin} role="form" aria-label="Formulaire de connexion" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm text-slate-700 dark:text-slate-300">Email</Label>
                <IconInput
                  ref={loginEmailRef}
                  icon={Mail}
                  id="login-email"
                  type="email"
                  placeholder="votre@email.fr"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                  aria-label="Adresse email"
                  aria-describedby={error ? "auth-error" : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm text-slate-700 dark:text-slate-300">Mot de passe</Label>
                <PasswordInput
                  id="login-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-label="Mot de passe"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(loginEmail); setError(null); }}
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Mot de passe oublie ?
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={v => setRememberMe(!!v)}
                  aria-label="Se souvenir de moi"
                />
                <Label htmlFor="remember" className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">Se souvenir de moi</Label>
              </div>

              {/* Rate limit warning */}
              {lockCountdown > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Reessayez dans {lockCountdown}s
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 font-medium"
                disabled={loading || googleLoading || !loginValid || lockCountdown > 0}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion en cours...</> : "Se connecter"}
              </Button>

              {/* Google */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-white/[0.08]" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-slate-950 px-3 text-slate-400">ou</span></div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/[0.08]"
                disabled={googleLoading || loading}
                onClick={handleGoogle}
              >
                {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                )}
                Continuer avec Google
              </Button>

              {/* Switch link */}
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                Pas encore de compte ?{" "}
                <button type="button" onClick={() => setTab("register")} className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium transition-colors">
                  Inscrivez-vous
                </button>
              </p>
            </form>
          )}

          {/* ──────── FORGOT PASSWORD ──────── */}
          {tab === "login" && showForgot && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mot de passe oublie</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entrez votre email pour recevoir un lien de reinitialisation</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-sm text-slate-700 dark:text-slate-300">Email</Label>
                <IconInput
                  icon={Mail}
                  id="forgot-email"
                  type="email"
                  placeholder="votre@email.fr"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  aria-label="Email de reinitialisation"
                />
              </div>
              <Button
                onClick={handleForgotPassword}
                className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                disabled={forgotLoading || !EMAIL_RE.test(forgotEmail)}
              >
                {forgotLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours...</> : "Envoyer le lien"}
              </Button>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setError(null); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
              >
                &larr; Retour a la connexion
              </button>
            </div>
          )}

          {/* ──────── REGISTER FORM ──────── */}
          {tab === "register" && (
            <form onSubmit={handleRegister} role="form" aria-label="Formulaire d'inscription" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300" noValidate>
              {/* Prénom + Nom side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-prenom" className="text-sm text-slate-700 dark:text-slate-300">Prenom</Label>
                  <IconInput
                    ref={regPrenomRef}
                    icon={User}
                    id="reg-prenom"
                    placeholder="Jean"
                    value={regPrenom}
                    onChange={e => setRegPrenom(e.target.value)}
                    onBlur={() => markTouched("prenom")}
                    required
                    autoComplete="given-name"
                    aria-label="Prenom"
                    error={touched.prenom && !regPrenomValid ? "Min. 2 caracteres, pas de chiffres" : undefined}
                    valid={touched.prenom && regPrenomValid}
                  />
                  {touched.prenom && !regPrenomValid && (
                    <p className="text-[11px] text-red-500">Min. 2 caracteres, pas de chiffres</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-nom" className="text-sm text-slate-700 dark:text-slate-300">Nom</Label>
                  <IconInput
                    icon={User}
                    id="reg-nom"
                    placeholder="DUPONT"
                    value={regNom}
                    onChange={e => setRegNom(e.target.value)}
                    onBlur={() => markTouched("nom")}
                    required
                    autoComplete="family-name"
                    aria-label="Nom"
                    error={touched.nom && !regNomValid ? "Min. 2 caracteres, pas de chiffres" : undefined}
                    valid={touched.nom && regNomValid}
                  />
                  {touched.nom && !regNomValid && (
                    <p className="text-[11px] text-red-500">Min. 2 caracteres, pas de chiffres</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm text-slate-700 dark:text-slate-300">Email professionnel</Label>
                <IconInput
                  icon={Mail}
                  id="reg-email"
                  type="email"
                  placeholder="jean.dupont@cabinet.fr"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  onBlur={() => markTouched("email")}
                  required
                  autoComplete="email"
                  aria-label="Email professionnel"
                  error={touched.email && !regEmailValid ? "Format email invalide" : undefined}
                  valid={touched.email && regEmailValid}
                />
                {touched.email && !regEmailValid && (
                  <p className="text-[11px] text-red-500">Format email invalide</p>
                )}
              </div>

              {/* Cabinet */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-cabinet" className="text-sm text-slate-700 dark:text-slate-300">Nom du cabinet</Label>
                <IconInput
                  icon={Building2}
                  id="reg-cabinet"
                  placeholder="Cabinet Dupont & Associes"
                  value={regCabinet}
                  onChange={e => setRegCabinet(e.target.value)}
                  onBlur={() => markTouched("cabinet")}
                  required
                  aria-label="Nom du cabinet"
                  error={touched.cabinet && !regCabinetValid ? "Min. 3 caracteres" : undefined}
                  valid={touched.cabinet && regCabinetValid}
                />
                {touched.cabinet && !regCabinetValid && (
                  <p className="text-[11px] text-red-500">Min. 3 caracteres</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm text-slate-700 dark:text-slate-300">Mot de passe</Label>
                <PasswordInput
                  id="reg-password"
                  placeholder="Min. 8 caracteres"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  onBlur={() => markTouched("password")}
                  required
                  autoComplete="new-password"
                  aria-label="Mot de passe"
                  error={touched.password && !regPwValid ? " " : undefined}
                  valid={touched.password && regPwValid}
                />
                {/* Strength bar */}
                {regPassword.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < pwStrength.score ? pwStrength.color : "bg-gray-200 dark:bg-white/[0.08]"}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {pwStrength.rules.map(r => (
                        <span key={r.id} className={`text-[11px] flex items-center gap-1 transition-colors ${r.ok ? "text-emerald-500" : "text-slate-600 dark:text-slate-400"}`}>
                          {r.ok ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 inline-block rounded-full border border-slate-300 dark:border-white/[0.15]" />}
                          {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm" className="text-sm text-slate-700 dark:text-slate-300">Confirmer le mot de passe</Label>
                <PasswordInput
                  id="reg-confirm"
                  placeholder="Retapez le mot de passe"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  onBlur={() => markTouched("confirm")}
                  required
                  autoComplete="off"
                  aria-label="Confirmer le mot de passe"
                  error={touched.confirm && regConfirm.length > 0 && !regConfirmValid ? " " : undefined}
                  valid={touched.confirm && regConfirmValid}
                />
                {touched.confirm && regConfirm.length > 0 && !regConfirmValid && (
                  <p className="text-[11px] text-red-500">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 font-medium"
                disabled={loading || !registerValid}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creation du compte...</> : "Creer mon compte"}
              </Button>

              {/* Legal */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                En creant un compte, vous acceptez nos{" "}
                <Link to="/cgu" className="text-blue-500 hover:underline">CGU</Link>
                {" "}et notre{" "}
                <Link to="/politique-confidentialite" className="text-blue-500 hover:underline">Politique de confidentialite</Link>
              </p>

              {/* Switch link */}
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Deja un compte ?{" "}
                <button type="button" onClick={() => setTab("login")} className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium transition-colors">
                  Connectez-vous
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ════════ RIGHT: BRANDING PANEL (desktop only) ════════ */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-12 relative overflow-hidden">
        {/* Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(99,102,241,0.2) 0%, transparent 50%)",
        }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative z-10 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/20 mb-6">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-tight">GRIMY</h2>
          <p className="text-blue-200 text-lg mb-10">La conformite LCB-FT simplifiee pour les professionnels assujettis</p>

          <div className="space-y-5 text-left">
            {[
              { icon: FileSearch, title: "Screening automatique", desc: "9 APIs interrogees en 30 secondes" },
              { icon: Scale, title: "Scoring 6 axes", desc: "Evaluation du risque multi-criteres" },
              { icon: ChevronRight, title: "Lettres de mission", desc: "Generation PDF/DOCX en 3 etapes" },
            ].map(({ icon: FIcon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FIcon className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-sm text-blue-300/80">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-5 bg-white/[0.05] rounded-xl border border-white/[0.08]">
            <p className="text-sm italic text-blue-200 leading-relaxed">"GRIMY nous a fait gagner 2h par dossier client sur la conformite LCB-FT."</p>
            <p className="text-xs text-blue-400/70 mt-2.5">— Expert-comptable, Marseille</p>
          </div>

          <p className="text-xs text-blue-400/40 mt-8">Donnees chiffrees · Hebergement europeen · Conformite RGPD</p>
        </div>
      </div>
    </div>
  );
}
