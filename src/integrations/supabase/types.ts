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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          organization_id: string
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          organization_id: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          organization_id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          event_type: string
          id: string
          payload: Json
          provider: string
          provider_event_id: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          event_type: string
          id?: string
          payload?: Json
          provider?: string
          provider_event_id?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          event_type?: string
          id?: string
          payload?: Json
          provider?: string
          provider_event_id?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          currency: string
          id: string
          interval: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string
          provider_plan_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_plan_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_plan_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          created_at: string
          id: string
          intro: string
          sections: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro?: string
          sections?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intro?: string
          sections?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_posts: {
        Row: {
          author_name: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          kind: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          kind?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          kind?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          analysis: Json
          char_count: number
          created_at: string
          doc_type: string | null
          doc_type_confidence: number
          effective_date: string | null
          error_message: string | null
          expiry_date: string | null
          extracted_text: string
          file_name: string
          file_size: number
          governing_law: string | null
          human_label: string | null
          human_reviewed_at: string | null
          id: string
          jurisdiction: string | null
          matter_id: string | null
          mime_type: string
          model: string | null
          needs_human_review: boolean
          parse_method: string | null
          parties: Json
          renewal_window: string | null
          risk_level: string | null
          risk_reasons: Json
          status: string
          storage_path: string
          termination_clause: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          char_count?: number
          created_at?: string
          doc_type?: string | null
          doc_type_confidence?: number
          effective_date?: string | null
          error_message?: string | null
          expiry_date?: string | null
          extracted_text?: string
          file_name: string
          file_size?: number
          governing_law?: string | null
          human_label?: string | null
          human_reviewed_at?: string | null
          id?: string
          jurisdiction?: string | null
          matter_id?: string | null
          mime_type: string
          model?: string | null
          needs_human_review?: boolean
          parse_method?: string | null
          parties?: Json
          renewal_window?: string | null
          risk_level?: string | null
          risk_reasons?: Json
          status?: string
          storage_path: string
          termination_clause?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          char_count?: number
          created_at?: string
          doc_type?: string | null
          doc_type_confidence?: number
          effective_date?: string | null
          error_message?: string | null
          expiry_date?: string | null
          extracted_text?: string
          file_name?: string
          file_size?: number
          governing_law?: string | null
          human_label?: string | null
          human_reviewed_at?: string | null
          id?: string
          jurisdiction?: string | null
          matter_id?: string | null
          mime_type?: string
          model?: string | null
          needs_human_review?: boolean
          parse_method?: string | null
          parties?: Json
          renewal_window?: string | null
          risk_level?: string | null
          risk_reasons?: Json
          status?: string
          storage_path?: string
          termination_clause?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_cells: {
        Row: {
          answer: string
          confidence: number
          document_id: string
          error_message: string | null
          id: string
          model: string | null
          page_ref: string
          question_id: string
          room_id: string
          status: string
          updated_at: string
          user_id: string
          verbatim_quote: string
        }
        Insert: {
          answer?: string
          confidence?: number
          document_id: string
          error_message?: string | null
          id?: string
          model?: string | null
          page_ref?: string
          question_id: string
          room_id: string
          status?: string
          updated_at?: string
          user_id: string
          verbatim_quote?: string
        }
        Update: {
          answer?: string
          confidence?: number
          document_id?: string
          error_message?: string | null
          id?: string
          model?: string | null
          page_ref?: string
          question_id?: string
          room_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          verbatim_quote?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_cells_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "diligence_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diligence_cells_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "diligence_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diligence_cells_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "diligence_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_documents: {
        Row: {
          created_at: string
          error_message: string | null
          extracted_text: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          page_count: number
          position: number
          room_id: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extracted_text?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type: string
          page_count?: number
          position?: number
          room_id: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extracted_text?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          page_count?: number
          position?: number
          room_id?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_documents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "diligence_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_questions: {
        Row: {
          created_at: string
          expected_format: string
          id: string
          label: string
          position: number
          prompt: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_format?: string
          id?: string
          label: string
          position?: number
          prompt: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_format?: string
          id?: string
          label?: string
          position?: number
          prompt?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "diligence_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_rooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          matter_id: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          matter_id?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          matter_id?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_rooms_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_attachments: {
        Row: {
          created_at: string
          draft_id: string
          error_message: string | null
          extracted_text: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          error_message?: string | null
          extracted_text?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type: string
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          error_message?: string | null
          extracted_text?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_attachments_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          content: string
          created_at: string
          id: string
          inputs: Json
          matter_id: string | null
          risk_flags: Json
          status: string
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          inputs?: Json
          matter_id?: string | null
          risk_flags?: Json
          status?: string
          template: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          inputs?: Json
          matter_id?: string | null
          risk_flags?: Json
          status?: string
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      judgments: {
        Row: {
          bench: string | null
          citation: string | null
          court: string
          created_at: string
          decision_date: string | null
          disposition: string | null
          embedding: string | null
          external_id: string | null
          full_text: string | null
          headnote: string | null
          id: string
          issues: string[] | null
          judges: string[] | null
          neutral_citation: string | null
          source_url: string | null
          summary: string | null
          title: string
          tsv: unknown
        }
        Insert: {
          bench?: string | null
          citation?: string | null
          court?: string
          created_at?: string
          decision_date?: string | null
          disposition?: string | null
          embedding?: string | null
          external_id?: string | null
          full_text?: string | null
          headnote?: string | null
          id?: string
          issues?: string[] | null
          judges?: string[] | null
          neutral_citation?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          tsv?: unknown
        }
        Update: {
          bench?: string | null
          citation?: string | null
          court?: string
          created_at?: string
          decision_date?: string | null
          disposition?: string | null
          embedding?: string | null
          external_id?: string | null
          full_text?: string | null
          headnote?: string | null
          id?: string
          issues?: string[] | null
          judges?: string[] | null
          neutral_citation?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          tsv?: unknown
        }
        Relationships: []
      }
      litigation_watchlist: {
        Row: {
          created_at: string
          id: string
          identifier: string
          kind: string
          label: string
          last_checked_at: string | null
          last_snapshot: Json
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          kind: string
          label: string
          last_checked_at?: string | null
          last_snapshot?: Json
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          kind?: string
          label?: string
          last_checked_at?: string | null
          last_snapshot?: Json
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matters: {
        Row: {
          area: string | null
          client: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          client?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          client?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sso: {
        Row: {
          created_at: string
          default_role: Database["public"]["Enums"]["org_role"]
          email_domain: string
          id: string
          is_active: boolean
          organization_id: string
          provider: string
          role_mappings: Json
          sso_provider_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["org_role"]
          email_domain: string
          id?: string
          is_active?: boolean
          organization_id: string
          provider: string
          role_mappings?: Json
          sso_provider_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["org_role"]
          email_domain?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          provider?: string
          role_mappings?: Json
          sso_provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_sso_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bar_council_number: string | null
          created_at: string
          firm_name: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          practice_areas: string[] | null
          updated_at: string
        }
        Insert: {
          bar_council_number?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          practice_areas?: string[] | null
          updated_at?: string
        }
        Update: {
          bar_council_number?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          practice_areas?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      research_notes: {
        Row: {
          answer: string
          citations: Json
          created_at: string
          id: string
          matter_id: string | null
          query: string
          user_id: string
        }
        Insert: {
          answer: string
          citations?: Json
          created_at?: string
          id?: string
          matter_id?: string | null
          query: string
          user_id: string
        }
        Update: {
          answer?: string
          citations?: Json
          created_at?: string
          id?: string
          matter_id?: string | null
          query?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_notes_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          checkout_status: string
          created_at: string
          current_period_end: string | null
          dodo_checkout_session_id: string | null
          dodo_customer_id: string | null
          dodo_payment_id: string | null
          dodo_subscription_id: string | null
          id: string
          last_payment_at: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          razorpay_customer_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          status: Database["public"]["Enums"]["sub_status"]
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          checkout_status?: string
          created_at?: string
          current_period_end?: string | null
          dodo_checkout_session_id?: string | null
          dodo_customer_id?: string | null
          dodo_payment_id?: string | null
          dodo_subscription_id?: string | null
          id?: string
          last_payment_at?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          razorpay_customer_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          checkout_status?: string
          created_at?: string
          current_period_end?: string | null
          dodo_checkout_session_id?: string | null
          dodo_customer_id?: string | null
          dodo_payment_id?: string | null
          dodo_subscription_id?: string | null
          id?: string
          last_payment_at?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          razorpay_customer_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invite: { Args: { _token: string }; Returns: string }
      has_org_role: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org: string
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _metadata?: Json
          _org: string
          _resource_id?: string
          _resource_type?: string
        }
        Returns: string
      }
      org_sso_for_domain: {
        Args: { _domain: string }
        Returns: {
          email_domain: string
          organization_id: string
          organization_name: string
          provider: string
          sso_provider_id: string
        }[]
      }
      search_judgments: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          bench: string
          citation: string
          court: string
          decision_date: string
          headnote: string
          id: string
          judges: string[]
          neutral_citation: string
          rank: number
          similarity: number
          summary: string
          title: string
        }[]
      }
      sso_jit_provision: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "lawyer"
      org_role: "owner" | "admin" | "member"
      plan_tier: "solo" | "firm"
      sub_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "incomplete"
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
      app_role: ["admin", "lawyer"],
      org_role: ["owner", "admin", "member"],
      plan_tier: ["solo", "firm"],
      sub_status: ["trialing", "active", "past_due", "cancelled", "incomplete"],
    },
  },
} as const
