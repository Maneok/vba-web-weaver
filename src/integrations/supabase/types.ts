export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cabinets: {
        Row: {
          id: string
          nom: string
          siren: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          siren?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          siren?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          cabinet_id: string
          email: string
          full_name: string
          role: "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE"
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          cabinet_id: string
          email: string
          full_name?: string
          role?: "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE"
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cabinet_id?: string
          email?: string
          full_name?: string
          role?: "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE"
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_trail: {
        Row: {
          id: number
          cabinet_id: string
          user_id: string | null
          user_email: string | null
          action: string
          table_name: string | null
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          cabinet_id: string
          user_id?: string | null
          user_email?: string | null
          action: string
          table_name?: string | null
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: "audit_trail_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          cabinet_id: string
          ref: string
          etat: string
          comptable: string
          mission: string
          raison_sociale: string
          forme: string
          adresse: string | null
          cp: string | null
          ville: string | null
          siren: string | null
          capital: number | null
          ape: string | null
          dirigeant: string | null
          domaine: string | null
          effectif: string | null
          tel: string | null
          mail: string | null
          date_creation: string | null
          date_reprise: string | null
          honoraires: number | null
          reprise: number | null
          juridique: number | null
          frequence: string | null
          iban_encrypted: string | null
          bic_encrypted: string | null
          cni_encrypted: string | null
          associe: string | null
          superviseur: string | null
          ppe: string | null
          pays_risque: string | null
          atypique: string | null
          distanciel: string | null
          cash: string | null
          pression: string | null
          score_activite: number | null
          score_pays: number | null
          score_mission: number | null
          score_maturite: number | null
          score_structure: number | null
          malus: number | null
          score_global: number | null
          niv_vigilance: string | null
          date_creation_ligne: string | null
          date_derniere_revue: string | null
          date_butoir: string | null
          etat_pilotage: string | null
          date_exp_cni: string | null
          statut: string | null
          be: string | null
          date_fin: string | null
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          ref: string
          etat?: string
          comptable?: string
          mission?: string
          raison_sociale: string
          forme?: string
          adresse?: string | null
          cp?: string | null
          ville?: string | null
          siren?: string | null
          capital?: number | null
          ape?: string | null
          dirigeant?: string | null
          domaine?: string | null
          effectif?: string | null
          tel?: string | null
          mail?: string | null
          date_creation?: string | null
          date_reprise?: string | null
          honoraires?: number | null
          reprise?: number | null
          juridique?: number | null
          frequence?: string | null
          iban_encrypted?: string | null
          bic_encrypted?: string | null
          cni_encrypted?: string | null
          associe?: string | null
          superviseur?: string | null
          ppe?: string | null
          pays_risque?: string | null
          atypique?: string | null
          distanciel?: string | null
          cash?: string | null
          pression?: string | null
          score_activite?: number | null
          score_pays?: number | null
          score_mission?: number | null
          score_maturite?: number | null
          score_structure?: number | null
          malus?: number | null
          score_global?: number | null
          niv_vigilance?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_butoir?: string | null
          etat_pilotage?: string | null
          date_exp_cni?: string | null
          statut?: string | null
          be?: string | null
          date_fin?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cabinet_id?: string
          ref?: string
          etat?: string
          comptable?: string
          mission?: string
          raison_sociale?: string
          forme?: string
          adresse?: string | null
          cp?: string | null
          ville?: string | null
          siren?: string | null
          capital?: number | null
          ape?: string | null
          dirigeant?: string | null
          domaine?: string | null
          effectif?: string | null
          tel?: string | null
          mail?: string | null
          date_creation?: string | null
          date_reprise?: string | null
          honoraires?: number | null
          reprise?: number | null
          juridique?: number | null
          frequence?: string | null
          iban_encrypted?: string | null
          bic_encrypted?: string | null
          cni_encrypted?: string | null
          associe?: string | null
          superviseur?: string | null
          ppe?: string | null
          pays_risque?: string | null
          atypique?: string | null
          distanciel?: string | null
          cash?: string | null
          pression?: string | null
          score_activite?: number | null
          score_pays?: number | null
          score_mission?: number | null
          score_maturite?: number | null
          score_structure?: number | null
          malus?: number | null
          score_global?: number | null
          niv_vigilance?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_butoir?: string | null
          etat_pilotage?: string | null
          date_exp_cni?: string | null
          statut?: string | null
          be?: string | null
          date_fin?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
      collaborateurs: {
        Row: {
          id: string
          cabinet_id: string
          nom: string
          fonction: string | null
          referent_lcb: boolean | null
          suppleant: string | null
          niveau_competence: string | null
          date_signature_manuel: string | null
          derniere_formation: string | null
          statut_formation: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          nom: string
          fonction?: string | null
          referent_lcb?: boolean | null
          suppleant?: string | null
          niveau_competence?: string | null
          date_signature_manuel?: string | null
          derniere_formation?: string | null
          statut_formation?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cabinet_id?: string
          nom?: string
          fonction?: string | null
          referent_lcb?: boolean | null
          suppleant?: string | null
          niveau_competence?: string | null
          date_signature_manuel?: string | null
          derniere_formation?: string | null
          statut_formation?: string | null
          email?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborateurs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
      alertes_registre: {
        Row: {
          id: string
          cabinet_id: string
          date: string
          client_concerne: string | null
          categorie: string | null
          details: string | null
          action_prise: string | null
          responsable: string | null
          qualification: string | null
          statut: string | null
          date_butoir: string | null
          type_decision: string | null
          validateur: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          date: string
          client_concerne?: string | null
          categorie?: string | null
          details?: string | null
          action_prise?: string | null
          responsable?: string | null
          qualification?: string | null
          statut?: string | null
          date_butoir?: string | null
          type_decision?: string | null
          validateur?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cabinet_id?: string
          date?: string
          client_concerne?: string | null
          categorie?: string | null
          details?: string | null
          action_prise?: string | null
          responsable?: string | null
          qualification?: string | null
          statut?: string | null
          date_butoir?: string | null
          type_decision?: string | null
          validateur?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertes_registre_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
      controles_qualite: {
        Row: {
          id: string
          cabinet_id: string
          date_tirage: string | null
          dossier_audite: string | null
          siren: string | null
          forme: string | null
          ppe: string | null
          pays_risque: string | null
          atypique: string | null
          distanciel: string | null
          cash: string | null
          pression: string | null
          score_global: number | null
          niv_vigilance: string | null
          point1: string | null
          point2: string | null
          point3: string | null
          resultat_global: string | null
          incident: string | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          date_tirage?: string | null
          dossier_audite?: string | null
          siren?: string | null
          forme?: string | null
          ppe?: string | null
          pays_risque?: string | null
          atypique?: string | null
          distanciel?: string | null
          cash?: string | null
          pression?: string | null
          score_global?: number | null
          niv_vigilance?: string | null
          point1?: string | null
          point2?: string | null
          point3?: string | null
          resultat_global?: string | null
          incident?: string | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cabinet_id?: string
          date_tirage?: string | null
          dossier_audite?: string | null
          siren?: string | null
          forme?: string | null
          ppe?: string | null
          pays_risque?: string | null
          atypique?: string | null
          distanciel?: string | null
          cash?: string | null
          pression?: string | null
          score_global?: number | null
          niv_vigilance?: string | null
          point1?: string | null
          point2?: string | null
          point3?: string | null
          resultat_global?: string | null
          incident?: string | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_qualite_cabinet_id_fkey"
            columns: ["cabinet_id"]
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_cabinet_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE"
      }
    }
    Enums: {
      user_role: "ADMIN" | "SUPERVISEUR" | "COLLABORATEUR" | "STAGIAIRE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"] as const,
    },
  },
} as const
