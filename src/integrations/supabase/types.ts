export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _data_snapshots: {
        Row: {
          cabinet_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          row_count: number | null
          snapshot_date: string
          table_name: string
        }
        Insert: {
          cabinet_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          row_count?: number | null
          snapshot_date?: string
          table_name: string
        }
        Update: {
          cabinet_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          row_count?: number | null
          snapshot_date?: string
          table_name?: string
        }
        Relationships: []
      }
      _encryption_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      access_tokens: {
        Row: {
          access_type: string
          cabinet_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          label: string
          last_used_at: string | null
          permissions: Json | null
          token: string
          usage_count: number | null
        }
        Insert: {
          access_type?: string
          cabinet_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          label: string
          last_used_at?: string | null
          permissions?: Json | null
          token?: string
          usage_count?: number | null
        }
        Update: {
          access_type?: string
          cabinet_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          label?: string
          last_used_at?: string | null
          permissions?: Json | null
          token?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_tokens_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "access_tokens_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      active_sessions: {
        Row: {
          cabinet_id: string
          client_type: string | null
          created_at: string | null
          device_info: string | null
          id: string
          ip_address: unknown
          last_activity: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          cabinet_id: string
          client_type?: string | null
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: unknown
          last_activity?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          cabinet_id?: string
          client_type?: string | null
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: unknown
          last_activity?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_sessions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "active_sessions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      alertes_registre: {
        Row: {
          action_prise: string | null
          cabinet_id: string
          categorie: string | null
          client_concerne: string | null
          created_at: string
          date: string
          date_butoir: string | null
          details: string | null
          id: string
          qualification: string | null
          responsable: string | null
          statut: string | null
          type_decision: string | null
          validateur: string | null
        }
        Insert: {
          action_prise?: string | null
          cabinet_id: string
          categorie?: string | null
          client_concerne?: string | null
          created_at?: string
          date: string
          date_butoir?: string | null
          details?: string | null
          id?: string
          qualification?: string | null
          responsable?: string | null
          statut?: string | null
          type_decision?: string | null
          validateur?: string | null
        }
        Update: {
          action_prise?: string | null
          cabinet_id?: string
          categorie?: string | null
          client_concerne?: string | null
          created_at?: string
          date?: string
          date_butoir?: string | null
          details?: string | null
          id?: string
          qualification?: string | null
          responsable?: string | null
          statut?: string | null
          type_decision?: string | null
          validateur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertes_registre_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_registre_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "alertes_registre_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      api_cache: {
        Row: {
          api_name: string
          cabinet_id: string
          cached_at: string
          expires_at: string
          response_data: Json
          siren: string
        }
        Insert: {
          api_name: string
          cabinet_id: string
          cached_at?: string
          expires_at?: string
          response_data?: Json
          siren: string
        }
        Update: {
          api_name?: string
          cabinet_id?: string
          cached_at?: string
          expires_at?: string
          response_data?: Json
          siren?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_cache_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cache_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "api_cache_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          cabinet_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          permissions: Json | null
          rate_limit_per_hour: number | null
          usage_count: number | null
        }
        Insert: {
          cabinet_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          permissions?: Json | null
          rate_limit_per_hour?: number | null
          usage_count?: number | null
        }
        Update: {
          cabinet_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          permissions?: Json | null
          rate_limit_per_hour?: number | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "api_keys_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      audit_trail: {
        Row: {
          action: string
          cabinet_id: string
          created_at: string
          id: number
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          cabinet_id: string
          created_at?: string
          id?: never
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          cabinet_id?: string
          created_at?: string
          id?: never
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_trail_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "audit_trail_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      backup_history: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          size_bytes: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          tables_backed_up: string[] | null
          total_rows: number | null
        }
        Insert: {
          backup_type: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          size_bytes?: number | null
          started_at?: string | null
          status: string
          storage_path?: string | null
          tables_backed_up?: string[] | null
          total_rows?: number | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          size_bytes?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tables_backed_up?: string[] | null
          total_rows?: number | null
        }
        Relationships: []
      }
      brouillons: {
        Row: {
          cabinet_id: string | null
          data: Json
          id: string
          siren: string | null
          step: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cabinet_id?: string | null
          data: Json
          id?: string
          siren?: string | null
          step?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cabinet_id?: string | null
          data?: Json
          id?: string
          siren?: string | null
          step?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brouillons_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brouillons_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "brouillons_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      cabinet_subscriptions: {
        Row: {
          billing_cycle: string | null
          cabinet_id: string
          coupon_code: string | null
          created_at: string | null
          discount_percent: number | null
          discount_until: string | null
          extra_seat_price_cents: number | null
          extra_seats: number | null
          grace_extra_clients: number | null
          grace_extra_clients_until: string | null
          id: string
          max_clients: number
          max_seats: number
          max_storage_mb: number
          monthly_price_cents: number | null
          notification_email: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_start: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cabinet_id: string
          coupon_code?: string | null
          created_at?: string | null
          discount_percent?: number | null
          discount_until?: string | null
          extra_seat_price_cents?: number | null
          extra_seats?: number | null
          grace_extra_clients?: number | null
          grace_extra_clients_until?: string | null
          id?: string
          max_clients?: number
          max_seats?: number
          max_storage_mb?: number
          monthly_price_cents?: number | null
          notification_email?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cabinet_id?: string
          coupon_code?: string | null
          created_at?: string | null
          discount_percent?: number | null
          discount_until?: string | null
          extra_seat_price_cents?: number | null
          extra_seats?: number | null
          grace_extra_clients?: number | null
          grace_extra_clients_until?: string | null
          id?: string
          max_clients?: number
          max_seats?: number
          max_storage_mb?: number
          monthly_price_cents?: number | null
          notification_email?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_subscriptions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: true
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_subscriptions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: true
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "cabinet_subscriptions_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: true
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      cabinets: {
        Row: {
          created_at: string
          id: string
          nom: string
          siren: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          siren?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          siren?: string | null
        }
        Relationships: []
      }
      client_history: {
        Row: {
          cabinet_id: string
          client_ref: string
          description: string
          event_date: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_email: string | null
        }
        Insert: {
          cabinet_id: string
          client_ref: string
          description: string
          event_date?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_email?: string | null
        }
        Update: {
          cabinet_id?: string
          client_ref?: string
          description?: string
          event_date?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "client_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          ape: string | null
          assigned_to: string | null
          associe: string | null
          atypique: string | null
          be: string | null
          bic_encrypted: string | null
          cabinet_id: string
          capital: number | null
          cash: string | null
          cni_encrypted: string | null
          comptable: string
          cp: string | null
          created_at: string
          date_butoir: string | null
          date_creation: string | null
          date_creation_ligne: string | null
          date_derniere_revue: string | null
          date_exp_cni: string | null
          date_fin: string | null
          date_reprise: string | null
          dirigeant: string | null
          distanciel: string | null
          domaine: string | null
          effectif: string | null
          etat: string
          etat_pilotage: string | null
          forme: string
          frequence: string | null
          honoraires: number | null
          iban_encrypted: string | null
          id: string
          juridique: number | null
          mail: string | null
          malus: number | null
          mission: string
          niv_vigilance: string | null
          pays_risque: string | null
          ppe: string | null
          pression: string | null
          raison_sociale: string
          ref: string
          reprise: number | null
          score_activite: number | null
          score_global: number | null
          score_maturite: number | null
          score_mission: number | null
          score_pays: number | null
          score_structure: number | null
          search_vector: unknown
          siren: string | null
          statut: string | null
          superviseur: string | null
          tel: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          ape?: string | null
          assigned_to?: string | null
          associe?: string | null
          atypique?: string | null
          be?: string | null
          bic_encrypted?: string | null
          cabinet_id: string
          capital?: number | null
          cash?: string | null
          cni_encrypted?: string | null
          comptable?: string
          cp?: string | null
          created_at?: string
          date_butoir?: string | null
          date_creation?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_exp_cni?: string | null
          date_fin?: string | null
          date_reprise?: string | null
          dirigeant?: string | null
          distanciel?: string | null
          domaine?: string | null
          effectif?: string | null
          etat?: string
          etat_pilotage?: string | null
          forme?: string
          frequence?: string | null
          honoraires?: number | null
          iban_encrypted?: string | null
          id?: string
          juridique?: number | null
          mail?: string | null
          malus?: number | null
          mission?: string
          niv_vigilance?: string | null
          pays_risque?: string | null
          ppe?: string | null
          pression?: string | null
          raison_sociale: string
          ref: string
          reprise?: number | null
          score_activite?: number | null
          score_global?: number | null
          score_maturite?: number | null
          score_mission?: number | null
          score_pays?: number | null
          score_structure?: number | null
          search_vector?: unknown
          siren?: string | null
          statut?: string | null
          superviseur?: string | null
          tel?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          ape?: string | null
          assigned_to?: string | null
          associe?: string | null
          atypique?: string | null
          be?: string | null
          bic_encrypted?: string | null
          cabinet_id?: string
          capital?: number | null
          cash?: string | null
          cni_encrypted?: string | null
          comptable?: string
          cp?: string | null
          created_at?: string
          date_butoir?: string | null
          date_creation?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_exp_cni?: string | null
          date_fin?: string | null
          date_reprise?: string | null
          dirigeant?: string | null
          distanciel?: string | null
          domaine?: string | null
          effectif?: string | null
          etat?: string
          etat_pilotage?: string | null
          forme?: string
          frequence?: string | null
          honoraires?: number | null
          iban_encrypted?: string | null
          id?: string
          juridique?: number | null
          mail?: string | null
          malus?: number | null
          mission?: string
          niv_vigilance?: string | null
          pays_risque?: string | null
          ppe?: string | null
          pression?: string | null
          raison_sociale?: string
          ref?: string
          reprise?: number | null
          score_activite?: number | null
          score_global?: number | null
          score_maturite?: number | null
          score_mission?: number | null
          score_pays?: number | null
          score_structure?: number | null
          search_vector?: unknown
          siren?: string | null
          statut?: string | null
          superviseur?: string | null
          tel?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      collaborateurs: {
        Row: {
          cabinet_id: string
          created_at: string
          date_signature_manuel: string | null
          derniere_formation: string | null
          email: string | null
          fonction: string | null
          id: string
          niveau_competence: string | null
          nom: string
          referent_lcb: boolean | null
          statut_formation: string | null
          suppleant: string | null
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          date_signature_manuel?: string | null
          derniere_formation?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          niveau_competence?: string | null
          nom: string
          referent_lcb?: boolean | null
          statut_formation?: string | null
          suppleant?: string | null
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          date_signature_manuel?: string | null
          derniere_formation?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          niveau_competence?: string | null
          nom?: string
          referent_lcb?: boolean | null
          statut_formation?: string | null
          suppleant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborateurs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborateurs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "collaborateurs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      controles_croec: {
        Row: {
          actions_suite: Json | null
          cabinet_id: string
          controleur: string | null
          created_at: string | null
          date_controle: string
          date_prochain_controle: string | null
          id: string
          observations: string | null
          rapport_url: string | null
          resultat: string | null
          type: string | null
        }
        Insert: {
          actions_suite?: Json | null
          cabinet_id: string
          controleur?: string | null
          created_at?: string | null
          date_controle: string
          date_prochain_controle?: string | null
          id?: string
          observations?: string | null
          rapport_url?: string | null
          resultat?: string | null
          type?: string | null
        }
        Update: {
          actions_suite?: Json | null
          cabinet_id?: string
          controleur?: string | null
          created_at?: string | null
          date_controle?: string
          date_prochain_controle?: string | null
          id?: string
          observations?: string | null
          rapport_url?: string | null
          resultat?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_croec_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_croec_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "controles_croec_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      controles_qualite: {
        Row: {
          action_correctrice: string | null
          atypique: string | null
          cabinet_id: string
          cash: string | null
          commentaire: string | null
          controleur: string | null
          created_at: string
          date_echeance: string | null
          date_tirage: string | null
          distanciel: string | null
          dossier_audite: string | null
          forme: string | null
          id: string
          incident: string | null
          niv_vigilance: string | null
          pays_risque: string | null
          point1: string | null
          point2: string | null
          point3: string | null
          ppe: string | null
          pression: string | null
          resultat_global: string | null
          score_global: number | null
          siren: string | null
          suivi_statut: string | null
        }
        Insert: {
          action_correctrice?: string | null
          atypique?: string | null
          cabinet_id: string
          cash?: string | null
          commentaire?: string | null
          controleur?: string | null
          created_at?: string
          date_echeance?: string | null
          date_tirage?: string | null
          distanciel?: string | null
          dossier_audite?: string | null
          forme?: string | null
          id?: string
          incident?: string | null
          niv_vigilance?: string | null
          pays_risque?: string | null
          point1?: string | null
          point2?: string | null
          point3?: string | null
          ppe?: string | null
          pression?: string | null
          resultat_global?: string | null
          score_global?: number | null
          siren?: string | null
          suivi_statut?: string | null
        }
        Update: {
          action_correctrice?: string | null
          atypique?: string | null
          cabinet_id?: string
          cash?: string | null
          commentaire?: string | null
          controleur?: string | null
          created_at?: string
          date_echeance?: string | null
          date_tirage?: string | null
          distanciel?: string | null
          dossier_audite?: string | null
          forme?: string | null
          id?: string
          incident?: string | null
          niv_vigilance?: string | null
          pays_risque?: string | null
          point1?: string | null
          point2?: string | null
          point3?: string | null
          ppe?: string | null
          pression?: string | null
          resultat_global?: string | null
          score_global?: number | null
          siren?: string | null
          suivi_statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_qualite_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_qualite_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "controles_qualite_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      dashboard_configs: {
        Row: {
          cabinet_id: string | null
          created_at: string
          id: string
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cabinet_id?: string | null
          created_at?: string
          id?: string
          layout?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cabinet_id?: string | null
          created_at?: string
          id?: string
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_configs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_configs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "dashboard_configs_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      declarations_soupcon: {
        Row: {
          cabinet_id: string
          client_nom: string | null
          client_ref: string | null
          correspondant_tracfin: string | null
          created_at: string | null
          date_declaration: string | null
          date_detection: string
          decision: string | null
          declarant: string | null
          elements_rassembles: string | null
          id: string
          justification_classement: string | null
          motif: string
          pieces_jointes: Json | null
          reference_tracfin: string | null
          statut: string | null
        }
        Insert: {
          cabinet_id: string
          client_nom?: string | null
          client_ref?: string | null
          correspondant_tracfin?: string | null
          created_at?: string | null
          date_declaration?: string | null
          date_detection: string
          decision?: string | null
          declarant?: string | null
          elements_rassembles?: string | null
          id?: string
          justification_classement?: string | null
          motif: string
          pieces_jointes?: Json | null
          reference_tracfin?: string | null
          statut?: string | null
        }
        Update: {
          cabinet_id?: string
          client_nom?: string | null
          client_ref?: string | null
          correspondant_tracfin?: string | null
          created_at?: string | null
          date_declaration?: string | null
          date_detection?: string
          decision?: string | null
          declarant?: string | null
          elements_rassembles?: string | null
          id?: string
          justification_classement?: string | null
          motif?: string
          pieces_jointes?: Json | null
          reference_tracfin?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "declarations_soupcon_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declarations_soupcon_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "declarations_soupcon_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      documents_kyc: {
        Row: {
          cabinet_id: string
          client_ref: string
          created_at: string | null
          date_document: string | null
          file_size: number | null
          id: string
          label: string
          mime_type: string | null
          ocr_data: Json | null
          public_url: string | null
          siren: string | null
          source: string | null
          status: string | null
          storage_path: string | null
          type: string
        }
        Insert: {
          cabinet_id: string
          client_ref: string
          created_at?: string | null
          date_document?: string | null
          file_size?: number | null
          id?: string
          label: string
          mime_type?: string | null
          ocr_data?: Json | null
          public_url?: string | null
          siren?: string | null
          source?: string | null
          status?: string | null
          storage_path?: string | null
          type: string
        }
        Update: {
          cabinet_id?: string
          client_ref?: string
          created_at?: string | null
          date_document?: string | null
          file_size?: number | null
          id?: string
          label?: string
          mime_type?: string | null
          ocr_data?: Json | null
          public_url?: string | null
          siren?: string | null
          source?: string | null
          status?: string | null
          storage_path?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_kyc_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_kyc_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "documents_kyc_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      formations: {
        Row: {
          attestation_url: string | null
          cabinet_id: string
          collaborateur_id: string | null
          collaborateur_nom: string
          created_at: string | null
          date_formation: string
          duree_heures: number | null
          id: string
          notes: string | null
          organisme: string | null
          quiz_date: string | null
          quiz_score: number | null
          theme: string | null
          type: string | null
        }
        Insert: {
          attestation_url?: string | null
          cabinet_id: string
          collaborateur_id?: string | null
          collaborateur_nom: string
          created_at?: string | null
          date_formation: string
          duree_heures?: number | null
          id?: string
          notes?: string | null
          organisme?: string | null
          quiz_date?: string | null
          quiz_score?: number | null
          theme?: string | null
          type?: string | null
        }
        Update: {
          attestation_url?: string | null
          cabinet_id?: string
          collaborateur_id?: string | null
          collaborateur_nom?: string
          created_at?: string | null
          date_formation?: string
          duree_heures?: number | null
          id?: string
          notes?: string | null
          organisme?: string | null
          quiz_date?: string | null
          quiz_score?: number | null
          theme?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "formations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "formations_collaborateur_id_fkey"
            columns: ["collaborateur_id"]
            isOneToOne: false
            referencedRelation: "collaborateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          attempt_count: number | null
          cabinet_id: string
          created_at: string | null
          custom_message: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          token: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          attempt_count?: number | null
          cabinet_id: string
          created_at?: string | null
          custom_message?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token?: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          attempt_count?: number | null
          cabinet_id?: string
          created_at?: string | null
          custom_message?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "invitations_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      lettres_mission: {
        Row: {
          cabinet_id: string | null
          clauses: Json | null
          client_id: string | null
          client_ref: string | null
          created_at: string | null
          data: Json
          date_signature: string | null
          docx_url: string | null
          forme_juridique: string | null
          generated_content: Json | null
          honoraires_details: Json | null
          id: string
          intervenants: Json | null
          missions_selected: Json | null
          modalites: Json | null
          numero: string | null
          pdf_url: string | null
          signature_image: string | null
          status: string | null
          statut_lm: string | null
          template_id: string | null
          type_mission: string | null
          updated_at: string | null
          user_id: string | null
          wizard_data: Json | null
          wizard_step: number | null
        }
        Insert: {
          cabinet_id?: string | null
          clauses?: Json | null
          client_id?: string | null
          client_ref?: string | null
          created_at?: string | null
          data: Json
          date_signature?: string | null
          docx_url?: string | null
          forme_juridique?: string | null
          generated_content?: Json | null
          honoraires_details?: Json | null
          id?: string
          intervenants?: Json | null
          missions_selected?: Json | null
          modalites?: Json | null
          numero?: string | null
          pdf_url?: string | null
          signature_image?: string | null
          status?: string | null
          statut_lm?: string | null
          template_id?: string | null
          type_mission?: string | null
          updated_at?: string | null
          user_id?: string | null
          wizard_data?: Json | null
          wizard_step?: number | null
        }
        Update: {
          cabinet_id?: string | null
          clauses?: Json | null
          client_id?: string | null
          client_ref?: string | null
          created_at?: string | null
          data?: Json
          date_signature?: string | null
          docx_url?: string | null
          forme_juridique?: string | null
          generated_content?: Json | null
          honoraires_details?: Json | null
          id?: string
          intervenants?: Json | null
          missions_selected?: Json | null
          modalites?: Json | null
          numero?: string | null
          pdf_url?: string | null
          signature_image?: string | null
          status?: string | null
          statut_lm?: string | null
          template_id?: string | null
          type_mission?: string | null
          updated_at?: string | null
          user_id?: string | null
          wizard_data?: Json | null
          wizard_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lettres_mission_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lettres_mission_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "lettres_mission_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "lettres_mission_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lettres_mission_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_decrypted"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lettres_mission_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "lm_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lm_templates: {
        Row: {
          cabinet_id: string | null
          created_at: string | null
          description: string | null
          forme_juridique: string
          id: string
          is_default: boolean | null
          nom: string
          sections: Json
          updated_at: string | null
        }
        Insert: {
          cabinet_id?: string | null
          created_at?: string | null
          description?: string | null
          forme_juridique: string
          id?: string
          is_default?: boolean | null
          nom: string
          sections?: Json
          updated_at?: string | null
        }
        Update: {
          cabinet_id?: string | null
          created_at?: string | null
          description?: string | null
          forme_juridique?: string
          id?: string
          is_default?: boolean | null
          nom?: string
          sections?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lm_templates_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lm_templates_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "lm_templates_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      login_history: {
        Row: {
          cabinet_id: string | null
          created_at: string | null
          email: string | null
          failure_reason: string | null
          id: string
          ip_address: unknown
          login_method: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          cabinet_id?: string | null
          created_at?: string | null
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          login_method?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          cabinet_id?: string | null
          created_at?: string | null
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          login_method?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "login_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      manuel_lectures: {
        Row: {
          cabinet_id: string
          collaborateur_id: string | null
          collaborateur_nom: string
          date_lecture: string | null
          id: string
          manuel_id: string
        }
        Insert: {
          cabinet_id: string
          collaborateur_id?: string | null
          collaborateur_nom: string
          date_lecture?: string | null
          id?: string
          manuel_id: string
        }
        Update: {
          cabinet_id?: string
          collaborateur_id?: string | null
          collaborateur_nom?: string
          date_lecture?: string | null
          id?: string
          manuel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuel_lectures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuel_lectures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "manuel_lectures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "manuel_lectures_collaborateur_id_fkey"
            columns: ["collaborateur_id"]
            isOneToOne: false
            referencedRelation: "collaborateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuel_lectures_manuel_id_fkey"
            columns: ["manuel_id"]
            isOneToOne: false
            referencedRelation: "manuel_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      manuel_procedures: {
        Row: {
          cabinet_id: string
          contenu: Json | null
          created_at: string | null
          date_prochaine_revue: string | null
          date_validation: string | null
          id: string
          statut: string | null
          titre: string | null
          updated_at: string | null
          valide_par: string | null
          version: number
        }
        Insert: {
          cabinet_id: string
          contenu?: Json | null
          created_at?: string | null
          date_prochaine_revue?: string | null
          date_validation?: string | null
          id?: string
          statut?: string | null
          titre?: string | null
          updated_at?: string | null
          valide_par?: string | null
          version?: number
        }
        Update: {
          cabinet_id?: string
          contenu?: Json | null
          created_at?: string | null
          date_prochaine_revue?: string | null
          date_validation?: string | null
          id?: string
          statut?: string | null
          titre?: string | null
          updated_at?: string | null
          valide_par?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "manuel_procedures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuel_procedures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "manuel_procedures_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      non_conformites: {
        Row: {
          action_corrective: string | null
          cabinet_id: string
          client_ref: string | null
          created_at: string | null
          date_detection: string
          date_echeance: string | null
          date_resolution: string | null
          description: string
          gravite: string | null
          id: string
          pieces_jointes: Json | null
          responsable: string | null
          source: string | null
          statut: string | null
        }
        Insert: {
          action_corrective?: string | null
          cabinet_id: string
          client_ref?: string | null
          created_at?: string | null
          date_detection: string
          date_echeance?: string | null
          date_resolution?: string | null
          description: string
          gravite?: string | null
          id?: string
          pieces_jointes?: Json | null
          responsable?: string | null
          source?: string | null
          statut?: string | null
        }
        Update: {
          action_corrective?: string | null
          cabinet_id?: string
          client_ref?: string | null
          created_at?: string | null
          date_detection?: string
          date_echeance?: string | null
          date_resolution?: string | null
          description?: string
          gravite?: string | null
          id?: string
          pieces_jointes?: Json | null
          responsable?: string | null
          source?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformites_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformites_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "non_conformites_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      notifications: {
        Row: {
          cabinet_id: string
          client_ref: string | null
          created_at: string | null
          id: string
          lue: boolean | null
          message: string
          priority: string | null
          titre: string
          type: string
          user_id: string | null
        }
        Insert: {
          cabinet_id: string
          client_ref?: string | null
          created_at?: string | null
          id?: string
          lue?: boolean | null
          message: string
          priority?: string | null
          titre: string
          type: string
          user_id?: string | null
        }
        Update: {
          cabinet_id?: string
          client_ref?: string | null
          created_at?: string | null
          id?: string
          lue?: boolean | null
          message?: string
          priority?: string | null
          titre?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "notifications_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      parametres: {
        Row: {
          cabinet_id: string | null
          cle: string
          id: string
          updated_at: string | null
          user_id: string | null
          valeur: Json
        }
        Insert: {
          cabinet_id?: string | null
          cle: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
          valeur: Json
        }
        Update: {
          cabinet_id?: string | null
          cle?: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
          valeur?: Json
        }
        Relationships: [
          {
            foreignKeyName: "parametres_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parametres_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "parametres_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_cents: number
          cabinet_id: string
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          plan: string | null
          receipt_url: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          cabinet_id: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan?: string | null
          receipt_url?: string | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          cabinet_id?: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan?: string | null
          receipt_url?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cabinet_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          signup_source: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cabinet_id: string
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          signup_source?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cabinet_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          signup_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "profiles_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          cabinet_id: string | null
          data: Json | null
          id: string
          processed_at: string | null
          type: string
        }
        Insert: {
          cabinet_id?: string | null
          data?: Json | null
          id: string
          processed_at?: string | null
          type: string
        }
        Update: {
          cabinet_id?: string | null
          data?: Json | null
          id?: string
          processed_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_events_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_events_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "stripe_events_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
    }
    Views: {
      v_admin_overview: {
        Row: {
          audit_entries: number | null
          cabinet_id: string | null
          cabinet_nom: string | null
          clients_used: number | null
          created_at: string | null
          max_clients: number | null
          max_seats: number | null
          plan: string | null
          seats_used: number | null
          sub_status: string | null
          trial_end: string | null
        }
        Relationships: []
      }
      v_billing_history: {
        Row: {
          cabinet_id: string | null
          date_paiement: string | null
          description: string | null
          montant_euros: number | null
          plan: string | null
          receipt_url: string | null
          statut: string | null
        }
        Insert: {
          cabinet_id?: string | null
          date_paiement?: string | null
          description?: string | null
          montant_euros?: never
          plan?: string | null
          receipt_url?: string | null
          statut?: string | null
        }
        Update: {
          cabinet_id?: string | null
          date_paiement?: string | null
          description?: string | null
          montant_euros?: never
          plan?: string | null
          receipt_url?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "payment_history_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      v_cabinet_stats: {
        Row: {
          alertes_en_cours: number | null
          alertes_total: number | null
          cabinet_id: string | null
          cabinet_nom: string | null
          clients_actifs: number | null
          clients_total: number | null
          controles_total: number | null
          nb_collaborateurs: number | null
          nb_renforcee: number | null
          nb_simplifiee: number | null
          nb_standard: number | null
          score_moyen: number | null
        }
        Insert: {
          alertes_en_cours?: never
          alertes_total?: never
          cabinet_id?: string | null
          cabinet_nom?: string | null
          clients_actifs?: never
          clients_total?: never
          controles_total?: never
          nb_collaborateurs?: never
          nb_renforcee?: never
          nb_simplifiee?: never
          nb_standard?: never
          score_moyen?: never
        }
        Update: {
          alertes_en_cours?: never
          alertes_total?: never
          cabinet_id?: string | null
          cabinet_nom?: string | null
          clients_actifs?: never
          clients_total?: never
          controles_total?: never
          nb_collaborateurs?: never
          nb_renforcee?: never
          nb_simplifiee?: never
          nb_standard?: never
          score_moyen?: never
        }
        Relationships: []
      }
      v_clients_decrypted: {
        Row: {
          adresse: string | null
          ape: string | null
          assigned_to: string | null
          associe: string | null
          atypique: string | null
          be: string | null
          bic_clear: string | null
          bic_encrypted: string | null
          cabinet_id: string | null
          capital: number | null
          cash: string | null
          cni_clear: string | null
          cni_encrypted: string | null
          comptable: string | null
          cp: string | null
          created_at: string | null
          date_butoir: string | null
          date_creation: string | null
          date_creation_ligne: string | null
          date_derniere_revue: string | null
          date_exp_cni: string | null
          date_fin: string | null
          date_reprise: string | null
          dirigeant: string | null
          distanciel: string | null
          domaine: string | null
          effectif: string | null
          etat: string | null
          etat_pilotage: string | null
          forme: string | null
          frequence: string | null
          honoraires: number | null
          iban_clear: string | null
          iban_encrypted: string | null
          id: string | null
          juridique: number | null
          mail: string | null
          malus: number | null
          mission: string | null
          niv_vigilance: string | null
          pays_risque: string | null
          ppe: string | null
          pression: string | null
          raison_sociale: string | null
          ref: string | null
          reprise: number | null
          score_activite: number | null
          score_global: number | null
          score_maturite: number | null
          score_mission: number | null
          score_pays: number | null
          score_structure: number | null
          search_vector: unknown
          siren: string | null
          statut: string | null
          superviseur: string | null
          tel: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          ape?: string | null
          assigned_to?: string | null
          associe?: string | null
          atypique?: string | null
          be?: string | null
          bic_clear?: never
          bic_encrypted?: string | null
          cabinet_id?: string | null
          capital?: number | null
          cash?: string | null
          cni_clear?: never
          cni_encrypted?: string | null
          comptable?: string | null
          cp?: string | null
          created_at?: string | null
          date_butoir?: string | null
          date_creation?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_exp_cni?: string | null
          date_fin?: string | null
          date_reprise?: string | null
          dirigeant?: string | null
          distanciel?: string | null
          domaine?: string | null
          effectif?: string | null
          etat?: string | null
          etat_pilotage?: string | null
          forme?: string | null
          frequence?: string | null
          honoraires?: number | null
          iban_clear?: never
          iban_encrypted?: string | null
          id?: string | null
          juridique?: number | null
          mail?: string | null
          malus?: number | null
          mission?: string | null
          niv_vigilance?: string | null
          pays_risque?: string | null
          ppe?: string | null
          pression?: string | null
          raison_sociale?: string | null
          ref?: string | null
          reprise?: number | null
          score_activite?: number | null
          score_global?: number | null
          score_maturite?: number | null
          score_mission?: number | null
          score_pays?: number | null
          score_structure?: number | null
          search_vector?: unknown
          siren?: string | null
          statut?: string | null
          superviseur?: string | null
          tel?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          ape?: string | null
          assigned_to?: string | null
          associe?: string | null
          atypique?: string | null
          be?: string | null
          bic_clear?: never
          bic_encrypted?: string | null
          cabinet_id?: string | null
          capital?: number | null
          cash?: string | null
          cni_clear?: never
          cni_encrypted?: string | null
          comptable?: string | null
          cp?: string | null
          created_at?: string | null
          date_butoir?: string | null
          date_creation?: string | null
          date_creation_ligne?: string | null
          date_derniere_revue?: string | null
          date_exp_cni?: string | null
          date_fin?: string | null
          date_reprise?: string | null
          dirigeant?: string | null
          distanciel?: string | null
          domaine?: string | null
          effectif?: string | null
          etat?: string | null
          etat_pilotage?: string | null
          forme?: string | null
          frequence?: string | null
          honoraires?: number | null
          iban_clear?: never
          iban_encrypted?: string | null
          id?: string | null
          juridique?: number | null
          mail?: string | null
          malus?: number | null
          mission?: string | null
          niv_vigilance?: string | null
          pays_risque?: string | null
          ppe?: string | null
          pression?: string | null
          raison_sociale?: string | null
          ref?: string | null
          reprise?: number | null
          score_activite?: number | null
          score_global?: number | null
          score_maturite?: number | null
          score_mission?: number | null
          score_pays?: number | null
          score_structure?: number | null
          search_vector?: unknown
          siren?: string | null
          statut?: string | null
          superviseur?: string | null
          tel?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_admin_overview"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "clients_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "v_cabinet_stats"
            referencedColumns: ["cabinet_id"]
          },
        ]
      }
      v_clients_export: {
        Row: {
          Adresse: string | null
          "Associé signataire": string | null
          Atypique: string | null
          Capital: number | null
          Cash: string | null
          "Code APE": string | null
          "Code postal": string | null
          "Comptable assigné": string | null
          "Date butoir revue": string | null
          "Date création": string | null
          "Date création ligne": string | null
          Dirigeant: string | null
          Distanciel: string | null
          Domaine: string | null
          Effectif: string | null
          Email: string | null
          "État pilotage": string | null
          "Forme juridique": string | null
          Fréquence: string | null
          "Honoraires HT": number | null
          Malus: number | null
          Mission: string | null
          "Pays risque": string | null
          PPE: string | null
          Pression: string | null
          "Raison sociale": string | null
          Référence: string | null
          "Score activité": number | null
          "Score global": number | null
          "Score maturité": number | null
          "Score mission": number | null
          "Score pays": number | null
          "Score structure": number | null
          SIREN: string | null
          Statut: string | null
          Téléphone: string | null
          Vigilance: string | null
          Ville: string | null
        }
        Insert: {
          Adresse?: string | null
          "Associé signataire"?: string | null
          Atypique?: string | null
          Capital?: number | null
          Cash?: string | null
          "Code APE"?: string | null
          "Code postal"?: string | null
          "Comptable assigné"?: string | null
          "Date butoir revue"?: string | null
          "Date création"?: string | null
          "Date création ligne"?: string | null
          Dirigeant?: string | null
          Distanciel?: string | null
          Domaine?: string | null
          Effectif?: string | null
          Email?: string | null
          "État pilotage"?: string | null
          "Forme juridique"?: string | null
          Fréquence?: string | null
          "Honoraires HT"?: number | null
          Malus?: number | null
          Mission?: string | null
          "Pays risque"?: string | null
          PPE?: string | null
          Pression?: string | null
          "Raison sociale"?: string | null
          Référence?: string | null
          "Score activité"?: number | null
          "Score global"?: number | null
          "Score maturité"?: number | null
          "Score mission"?: number | null
          "Score pays"?: number | null
          "Score structure"?: number | null
          SIREN?: string | null
          Statut?: string | null
          Téléphone?: string | null
          Vigilance?: string | null
          Ville?: string | null
        }
        Update: {
          Adresse?: string | null
          "Associé signataire"?: string | null
          Atypique?: string | null
          Capital?: number | null
          Cash?: string | null
          "Code APE"?: string | null
          "Code postal"?: string | null
          "Comptable assigné"?: string | null
          "Date butoir revue"?: string | null
          "Date création"?: string | null
          "Date création ligne"?: string | null
          Dirigeant?: string | null
          Distanciel?: string | null
          Domaine?: string | null
          Effectif?: string | null
          Email?: string | null
          "État pilotage"?: string | null
          "Forme juridique"?: string | null
          Fréquence?: string | null
          "Honoraires HT"?: number | null
          Malus?: number | null
          Mission?: string | null
          "Pays risque"?: string | null
          PPE?: string | null
          Pression?: string | null
          "Raison sociale"?: string | null
          Référence?: string | null
          "Score activité"?: number | null
          "Score global"?: number | null
          "Score maturité"?: number | null
          "Score mission"?: number | null
          "Score pays"?: number | null
          "Score structure"?: number | null
          SIREN?: string | null
          Statut?: string | null
          Téléphone?: string | null
          Vigilance?: string | null
          Ville?: string | null
        }
        Relationships: []
      }
      v_registre_complet: {
        Row: {
          "Action prise": string | null
          Catégorie: string | null
          Client: string | null
          Date: string | null
          "Date butoir": string | null
          Décision: string | null
          Détails: string | null
          Horodatage: string | null
          Qualification: string | null
          Responsable: string | null
          Statut: string | null
          Validateur: string | null
        }
        Insert: {
          "Action prise"?: string | null
          Catégorie?: string | null
          Client?: string | null
          Date?: string | null
          "Date butoir"?: string | null
          Décision?: string | null
          Détails?: string | null
          Horodatage?: string | null
          Qualification?: string | null
          Responsable?: string | null
          Statut?: string | null
          Validateur?: string | null
        }
        Update: {
          "Action prise"?: string | null
          Catégorie?: string | null
          Client?: string | null
          Date?: string | null
          "Date butoir"?: string | null
          Décision?: string | null
          Détails?: string | null
          Horodatage?: string | null
          Qualification?: string | null
          Responsable?: string | null
          Statut?: string | null
          Validateur?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: boolean
      }
      add_extra_seat: { Args: { p_cabinet_id: string }; Returns: Json }
      apply_coupon: {
        Args: {
          p_cabinet_id: string
          p_code: string
          p_months?: number
          p_percent: number
        }
        Returns: Json
      }
      apply_data_retention: { Args: never; Returns: Json }
      can_add_client: { Args: { p_cabinet_id: string }; Returns: boolean }
      can_add_seat: { Args: { p_cabinet_id: string }; Returns: boolean }
      can_reactivate: { Args: { p_cabinet_id: string }; Returns: Json }
      change_plan: {
        Args: {
          p_cabinet_id: string
          p_new_plan: string
          p_stripe_sub_id?: string
        }
        Returns: Json
      }
      check_user_access: { Args: { p_user_id: string }; Returns: Json }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_invitations: { Args: never; Returns: number }
      cleanup_inactive_sessions: { Args: never; Returns: number }
      create_controller_access: {
        Args: { p_days?: number; p_label: string }
        Returns: Json
      }
      create_daily_snapshot: { Args: never; Returns: Json }
      daily_full_maintenance: { Args: never; Returns: Json }
      daily_subscription_maintenance: { Args: never; Returns: Json }
      decrypt_sensitive: { Args: { p_encrypted: string }; Returns: string }
      encrypt_sensitive: { Args: { p_data: string }; Returns: string }
      export_cabinet_data: { Args: { p_cabinet_id: string }; Returns: Json }
      force_disconnect: { Args: { p_user_id: string }; Returns: boolean }
      generate_notifications: {
        Args: { p_cabinet_id: string }
        Returns: number
      }
      get_cabinet_usage: { Args: { p_cabinet_id: string }; Returns: Json }
      get_monthly_stats: {
        Args: { p_cabinet_id: string; p_months?: number }
        Returns: Json
      }
      get_user_cabinet_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      grant_grace_clients: {
        Args: { p_cabinet_id: string; p_days?: number; p_extra: number }
        Returns: Json
      }
      handle_payment_failed: { Args: { p_cabinet_id: string }; Returns: Json }
      is_subscription_active: {
        Args: { p_cabinet_id: string }
        Returns: boolean
      }
      merge_cabinets: {
        Args: { p_source_cabinet: string; p_target_cabinet: string }
        Returns: Json
      }
      next_lm_ref: { Args: { p_user_id: string }; Returns: string }
      offboard_collaborator: { Args: { p_user_id: string }; Returns: Json }
      purge_cabinet: { Args: { p_cabinet_id: string }; Returns: Json }
      reactivate_cabinet: {
        Args: {
          p_cabinet_id: string
          p_plan?: string
          p_stripe_sub_id?: string
        }
        Returns: Json
      }
      restore_snapshot: {
        Args: { p_cabinet_id: string; p_date: string; p_table_name: string }
        Returns: Json
      }
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: boolean }
      search_clients: {
        Args: { p_cabinet_id: string; p_query: string }
        Returns: {
          adresse: string | null
          ape: string | null
          assigned_to: string | null
          associe: string | null
          atypique: string | null
          be: string | null
          bic_encrypted: string | null
          cabinet_id: string
          capital: number | null
          cash: string | null
          cni_encrypted: string | null
          comptable: string
          cp: string | null
          created_at: string
          date_butoir: string | null
          date_creation: string | null
          date_creation_ligne: string | null
          date_derniere_revue: string | null
          date_exp_cni: string | null
          date_fin: string | null
          date_reprise: string | null
          dirigeant: string | null
          distanciel: string | null
          domaine: string | null
          effectif: string | null
          etat: string
          etat_pilotage: string | null
          forme: string
          frequence: string | null
          honoraires: number | null
          iban_encrypted: string | null
          id: string
          juridique: number | null
          mail: string | null
          malus: number | null
          mission: string
          niv_vigilance: string | null
          pays_risque: string | null
          ppe: string | null
          pression: string | null
          raison_sociale: string
          ref: string
          reprise: number | null
          score_activite: number | null
          score_global: number | null
          score_maturite: number | null
          score_mission: number | null
          score_pays: number | null
          score_structure: number | null
          search_vector: unknown
          siren: string | null
          statut: string | null
          superviseur: string | null
          tel: string | null
          updated_at: string
          ville: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      suspend_cabinet: {
        Args: { p_cabinet_id: string; p_reason?: string }
        Returns: Json
      }
      suspend_expired_trials: { Args: never; Returns: number }
      transfer_admin: { Args: { p_new_admin_id: string }; Returns: Json }
      validate_controller_token: { Args: { p_token: string }; Returns: Json }
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
      user_role: ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"],
    },
  },
} as const

