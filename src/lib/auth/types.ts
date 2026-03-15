import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE";

export interface UserProfile {
  id: string;
  cabinet_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, cabinetName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (action: PermissionAction) => boolean;
  refreshProfile: () => Promise<UserProfile | null>;
}

export type PermissionAction =
  | "read"
  | "write"
  | "delete"
  | "manage_users"
  | "view_audit"
  | "write_clients"
  | "delete_clients";

export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  ADMIN: ["read", "write", "delete", "manage_users", "view_audit", "write_clients", "delete_clients"],
  SUPERVISEUR: ["read", "write", "view_audit", "write_clients"],
  COLLABORATEUR: ["read", "write_clients"],
  STAGIAIRE: ["read"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrateur (Associe signataire)",
  SUPERVISEUR: "Superviseur",
  COLLABORATEUR: "Collaborateur",
  STAGIAIRE: "Stagiaire",
};
