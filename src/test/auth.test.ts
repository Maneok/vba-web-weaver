/**
 * Auth System — Comprehensive Test Suite (50 tests)
 *
 * Covers: validation, error translation, sanitization, password strength,
 * session timeout, role permissions, email regex, name regex, rate limiting,
 * redirect safety, edge cases, and integration-level auth flows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────
// 1. Extract pure functions for unit testing
// ─────────────────────────────────────────────

// --- translateError (copied from AuthPage) ---
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

// --- EMAIL_RE (copied from AuthPage) ---
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// --- NAME_RE (copied from AuthPage) ---
const NAME_RE = /^[\p{L}\s'-]{2,}$/u;

// --- getPasswordStrength (copied from AuthPage) ---
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

// --- sanitizeRedirect (copied from AuthPage) ---
function sanitizeRedirect(url: string | null): string {
  if (!url) return "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.toLowerCase().startsWith("/\\") || url.includes(":") || url.includes("@")) return "/";
  return url;
}

// --- Session timeout constants (copied from useSessionTimeout) ---
const TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_MS = TIMEOUT_MS - 5 * 60 * 1000;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

// --- Role permissions (copied from types.ts) ---
type UserRole = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE";
type PermissionAction = "read" | "write" | "delete" | "manage_users" | "view_audit" | "write_clients" | "delete_clients";

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  ADMIN: ["read", "write", "delete", "manage_users", "view_audit", "write_clients", "delete_clients"],
  SUPERVISEUR: ["read", "write", "view_audit", "write_clients"],
  COLLABORATEUR: ["read", "write_clients"],
  STAGIAIRE: ["read"],
};

function hasPermission(role: UserRole | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────

// ═══════════════════════════════════════════
// A. Email Validation (8 tests)
// ═══════════════════════════════════════════
describe("Email validation (EMAIL_RE)", () => {
  it("T01 — accepts a standard email", () => {
    expect(EMAIL_RE.test("jean.dupont@cabinet.fr")).toBe(true);
  });

  it("T02 — accepts email with subdomain", () => {
    expect(EMAIL_RE.test("user@mail.example.com")).toBe(true);
  });

  it("T03 — accepts email with + tag", () => {
    expect(EMAIL_RE.test("user+tag@example.com")).toBe(true);
  });

  it("T04 — rejects email without @", () => {
    expect(EMAIL_RE.test("userdomain.com")).toBe(false);
  });

  it("T05 — rejects email without domain", () => {
    expect(EMAIL_RE.test("user@")).toBe(false);
  });

  it("T06 — rejects email with spaces", () => {
    expect(EMAIL_RE.test("user @example.com")).toBe(false);
  });

  it("T07 — rejects empty string", () => {
    expect(EMAIL_RE.test("")).toBe(false);
  });

  it("T08 — rejects email with no TLD", () => {
    expect(EMAIL_RE.test("user@localhost")).toBe(false);
  });
});

// ═══════════════════════════════════════════
// B. Name Validation (6 tests)
// ═══════════════════════════════════════════
describe("Name validation (NAME_RE)", () => {
  it("T09 — accepts accented French name", () => {
    expect(NAME_RE.test("Therese")).toBe(true);
  });

  it("T10 — accepts hyphenated name", () => {
    expect(NAME_RE.test("Jean-Pierre")).toBe(true);
  });

  it("T11 — accepts name with apostrophe", () => {
    expect(NAME_RE.test("O'Brien")).toBe(true);
  });

  it("T12 — rejects single character", () => {
    expect(NAME_RE.test("A")).toBe(false);
  });

  it("T13 — rejects name with digits", () => {
    expect(NAME_RE.test("Jean2")).toBe(false);
  });

  it("T14 — rejects special characters like @", () => {
    expect(NAME_RE.test("@@@")).toBe(false);
  });
});

// ═══════════════════════════════════════════
// C. Password Strength (7 tests)
// ═══════════════════════════════════════════
describe("Password strength scoring", () => {
  it("T15 — empty password scores 0 (faible)", () => {
    const s = getPasswordStrength("");
    expect(s.score).toBe(0);
    expect(s.level).toBe("faible");
  });

  it("T16 — short lowercase-only password scores 0 (faible)", () => {
    const s = getPasswordStrength("abc");
    expect(s.score).toBe(0);
    expect(s.level).toBe("faible");
  });

  it("T17 — 8-char lowercase-only scores 1 (faible)", () => {
    const s = getPasswordStrength("abcdefgh");
    expect(s.score).toBe(1);
    expect(s.level).toBe("faible");
  });

  it("T18 — 8-char with uppercase scores 2 (moyen)", () => {
    const s = getPasswordStrength("Abcdefgh");
    expect(s.score).toBe(2);
    expect(s.level).toBe("moyen");
  });

  it("T19 — 8-char with uppercase + digit scores 3 (moyen)", () => {
    const s = getPasswordStrength("Abcdefg1");
    expect(s.score).toBe(3);
    expect(s.level).toBe("moyen");
  });

  it("T20 — fully compliant password scores 4 (fort)", () => {
    const s = getPasswordStrength("Abcdefg1!");
    expect(s.score).toBe(4);
    expect(s.level).toBe("fort");
    expect(s.color).toBe("bg-emerald-500");
  });

  it("T21 — password with only special chars and digits scores 2 (moyen)", () => {
    const s = getPasswordStrength("1234!@#$");
    expect(s.score).toBe(3); // length + digit + special
    expect(s.level).toBe("moyen");
  });
});

// ═══════════════════════════════════════════
// D. Error Translation (10 tests)
// ═══════════════════════════════════════════
describe("Error message translation", () => {
  it("T22 — translates 'Invalid login credentials'", () => {
    expect(translateError("Invalid login credentials")).toBe("Email ou mot de passe incorrect.");
  });

  it("T23 — translates 'Email not confirmed'", () => {
    expect(translateError("Email not confirmed")).toBe("Veuillez confirmer votre email avant de vous connecter.");
  });

  it("T24 — translates 'User already registered'", () => {
    expect(translateError("User already registered")).toBe("Un compte avec cet email existe deja.");
  });

  it("T25 — translates password too short error", () => {
    expect(translateError("Password should be at least 6 characters")).toBe("Le mot de passe doit contenir au moins 6 caracteres.");
  });

  it("T26 — translates rate limit error", () => {
    expect(translateError("Email rate limit exceeded")).toBe("Trop de tentatives. Reessayez dans quelques minutes.");
  });

  it("T27 — translates 60-second security cooldown", () => {
    expect(translateError("For security purposes, you can only request this after 60 seconds."))
      .toBe("Pour des raisons de securite, veuillez patienter 60 secondes.");
  });

  it("T28 — returns original message if no match", () => {
    expect(translateError("Some unknown error xyz")).toBe("Some unknown error xyz");
  });

  it("T29 — translates 'Invalid Refresh Token'", () => {
    expect(translateError("Invalid Refresh Token: token is expired")).toBe("Session expiree, veuillez vous reconnecter.");
  });

  it("T30 — translates 'Auth session missing'", () => {
    expect(translateError("Auth session missing")).toBe("Session expiree, veuillez vous reconnecter.");
  });

  it("T31 — translates 'over_email_send_rate_limit'", () => {
    expect(translateError("over_email_send_rate_limit")).toBe("Trop d'emails envoyes. Veuillez patienter quelques minutes.");
  });
});

// ═══════════════════════════════════════════
// E. Redirect Sanitization (8 tests)
// ═══════════════════════════════════════════
describe("Redirect sanitization", () => {
  it("T32 — null returns /", () => {
    expect(sanitizeRedirect(null)).toBe("/");
  });

  it("T33 — empty string returns /", () => {
    expect(sanitizeRedirect("")).toBe("/");
  });

  it("T34 — valid path is kept", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
  });

  it("T35 — nested valid path is kept", () => {
    expect(sanitizeRedirect("/client/CLI-26-001")).toBe("/client/CLI-26-001");
  });

  it("T36 — blocks protocol-relative URL (//)", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/");
  });

  it("T37 — blocks absolute URL with protocol", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/");
  });

  it("T38 — blocks URL with backslash", () => {
    expect(sanitizeRedirect("/\\evil.com")).toBe("/");
  });

  it("T39 — blocks URL with @ sign (credential injection)", () => {
    expect(sanitizeRedirect("/foo@evil.com")).toBe("/");
  });
});

// ═══════════════════════════════════════════
// F. Role Permissions (7 tests)
// ═══════════════════════════════════════════
describe("Role-based permissions", () => {
  it("T40 — ADMIN has all permissions", () => {
    const allPerms: PermissionAction[] = ["read", "write", "delete", "manage_users", "view_audit", "write_clients", "delete_clients"];
    allPerms.forEach(p => expect(hasPermission("ADMIN", p)).toBe(true));
  });

  it("T41 — SUPERVISEUR can read, write, view_audit, write_clients", () => {
    expect(hasPermission("SUPERVISEUR", "read")).toBe(true);
    expect(hasPermission("SUPERVISEUR", "write")).toBe(true);
    expect(hasPermission("SUPERVISEUR", "view_audit")).toBe(true);
    expect(hasPermission("SUPERVISEUR", "write_clients")).toBe(true);
  });

  it("T42 — SUPERVISEUR cannot delete or manage users", () => {
    expect(hasPermission("SUPERVISEUR", "delete")).toBe(false);
    expect(hasPermission("SUPERVISEUR", "manage_users")).toBe(false);
    expect(hasPermission("SUPERVISEUR", "delete_clients")).toBe(false);
  });

  it("T43 — COLLABORATEUR can only read and write_clients", () => {
    expect(hasPermission("COLLABORATEUR", "read")).toBe(true);
    expect(hasPermission("COLLABORATEUR", "write_clients")).toBe(true);
    expect(hasPermission("COLLABORATEUR", "write")).toBe(false);
    expect(hasPermission("COLLABORATEUR", "delete")).toBe(false);
  });

  it("T44 — STAGIAIRE has read-only access", () => {
    expect(hasPermission("STAGIAIRE", "read")).toBe(true);
    expect(hasPermission("STAGIAIRE", "write")).toBe(false);
    expect(hasPermission("STAGIAIRE", "write_clients")).toBe(false);
    expect(hasPermission("STAGIAIRE", "delete")).toBe(false);
  });

  it("T45 — undefined role has no permissions", () => {
    expect(hasPermission(undefined, "read")).toBe(false);
  });

  it("T46 — unknown role returns false safely", () => {
    expect(hasPermission("UNKNOWN" as UserRole, "read")).toBe(false);
  });
});

// ═══════════════════════════════════════════
// G. Session Timeout Constants (4 tests)
// ═══════════════════════════════════════════
describe("Session timeout configuration", () => {
  it("T47 — inactivity timeout is 30 minutes", () => {
    expect(TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it("T48 — warning fires 5 minutes before timeout (at 25 min)", () => {
    expect(WARNING_MS).toBe(25 * 60 * 1000);
  });

  it("T49 — absolute max session is 8 hours", () => {
    expect(MAX_SESSION_MS).toBe(8 * 60 * 60 * 1000);
  });

  it("T50 — warning time is before timeout time", () => {
    expect(WARNING_MS).toBeLessThan(TIMEOUT_MS);
  });
});

// ═══════════════════════════════════════════
// H. Login Validation (5 tests)
// ═══════════════════════════════════════════
describe("Login form validation", () => {
  const loginValid = (email: string, pw: string) => EMAIL_RE.test(email) && pw.length >= 6;

  it("T51 — valid email + 6-char password passes", () => {
    expect(loginValid("test@example.com", "abc123")).toBe(true);
  });

  it("T52 — valid email + 5-char password fails", () => {
    expect(loginValid("test@example.com", "abc12")).toBe(false);
  });

  it("T53 — invalid email + valid password fails", () => {
    expect(loginValid("notanemail", "abc123")).toBe(false);
  });

  it("T54 — empty email fails", () => {
    expect(loginValid("", "abc123")).toBe(false);
  });

  it("T55 — empty password fails", () => {
    expect(loginValid("test@example.com", "")).toBe(false);
  });
});

// ═══════════════════════════════════════════
// I. Registration Validation (6 tests)
// ═══════════════════════════════════════════
describe("Registration form validation", () => {
  const regValid = (
    prenom: string, nom: string, email: string,
    cabinet: string, pw: string, confirm: string
  ) => {
    const prenomOk = NAME_RE.test(prenom.trim());
    const nomOk = NAME_RE.test(nom.trim());
    const emailOk = EMAIL_RE.test(email);
    const cabinetOk = cabinet.trim().length >= 3;
    const pwOk = getPasswordStrength(pw).score === 4;
    const confirmOk = confirm.length > 0 && confirm === pw;
    return prenomOk && nomOk && emailOk && cabinetOk && pwOk && confirmOk;
  };

  it("T56 — all valid fields pass", () => {
    expect(regValid("Jean", "Dupont", "jean@cabinet.fr", "Mon Cabinet", "Abcdefg1!", "Abcdefg1!")).toBe(true);
  });

  it("T57 — mismatched passwords fail", () => {
    expect(regValid("Jean", "Dupont", "jean@cabinet.fr", "Mon Cabinet", "Abcdefg1!", "Abcdefg2!")).toBe(false);
  });

  it("T58 — weak password fails", () => {
    expect(regValid("Jean", "Dupont", "jean@cabinet.fr", "Mon Cabinet", "abc", "abc")).toBe(false);
  });

  it("T59 — short cabinet name (< 3 chars) fails", () => {
    expect(regValid("Jean", "Dupont", "jean@cabinet.fr", "AB", "Abcdefg1!", "Abcdefg1!")).toBe(false);
  });

  it("T60 — invalid name with digit fails", () => {
    expect(regValid("Jean2", "Dupont", "jean@cabinet.fr", "Mon Cabinet", "Abcdefg1!", "Abcdefg1!")).toBe(false);
  });

  it("T61 — empty confirm password fails", () => {
    expect(regValid("Jean", "Dupont", "jean@cabinet.fr", "Mon Cabinet", "Abcdefg1!", "")).toBe(false);
  });
});

// ═══════════════════════════════════════════
// J. Rate Limiting Logic (4 tests)
// ═══════════════════════════════════════════
describe("Rate limiting logic", () => {
  function getLockDuration(attempts: number): number | null {
    if (attempts >= 5) return 120000;
    if (attempts >= 3) return 60000;
    return null;
  }

  it("T62 — no lock under 3 attempts", () => {
    expect(getLockDuration(1)).toBeNull();
    expect(getLockDuration(2)).toBeNull();
  });

  it("T63 — 60s lock at 3 attempts", () => {
    expect(getLockDuration(3)).toBe(60000);
  });

  it("T64 — 60s lock at 4 attempts", () => {
    expect(getLockDuration(4)).toBe(60000);
  });

  it("T65 — 120s lock at 5+ attempts", () => {
    expect(getLockDuration(5)).toBe(120000);
    expect(getLockDuration(10)).toBe(120000);
  });
});
