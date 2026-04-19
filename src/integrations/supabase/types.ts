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
      agents: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          system_prompt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_key: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_key?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_key?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ipm_endpoints: {
        Row: {
          auth_type: string
          base_url: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          kind: string
          label: string
          notes: string | null
          token: string | null
          updated_at: string
        }
        Insert: {
          auth_type?: string
          base_url: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          label: string
          notes?: string | null
          token?: string | null
          updated_at?: string
        }
        Update: {
          auth_type?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ipm_query_cache: {
        Row: {
          cache_key: string
          created_at: string
          endpoint_id: string | null
          expires_at: string
          filtro_status: string | null
          hit_count: number
          id: string
          last_hit_at: string
          path: string | null
          response: Json
          tipo: string
          url: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          endpoint_id?: string | null
          expires_at?: string
          filtro_status?: string | null
          hit_count?: number
          id?: string
          last_hit_at?: string
          path?: string | null
          response: Json
          tipo: string
          url?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          endpoint_id?: string | null
          expires_at?: string
          filtro_status?: string | null
          hit_count?: number
          id?: string
          last_hit_at?: string
          path?: string | null
          response?: Json
          tipo?: string
          url?: string | null
        }
        Relationships: []
      }
      kera_settings: {
        Row: {
          id: string
          singleton: boolean
          system_prompt: string
          updated_at: string
          updated_by: string | null
          voice_id: string
        }
        Insert: {
          id?: string
          singleton?: boolean
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          voice_id?: string
        }
        Update: {
          id?: string
          singleton?: boolean
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      kera_triggers: {
        Row: {
          created_at: string
          enabled: boolean
          excluded_emails: string[]
          id: string
          intensity: string
          keywords: string
          name: string
          regex_pattern: string | null
          scope: string
          sort_order: number
          theme: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          excluded_emails?: string[]
          id?: string
          intensity?: string
          keywords: string
          name: string
          regex_pattern?: string | null
          scope?: string
          sort_order?: number
          theme: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          excluded_emails?: string[]
          id?: string
          intensity?: string
          keywords?: string
          name?: string
          regex_pattern?: string | null
          scope?: string
          sort_order?: number
          theme?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      licitacoes_alerts: {
        Row: {
          created_at: string
          data_encerramento: string | null
          id: string
          link: string | null
          modalidade: string | null
          numero: string | null
          objeto: string | null
          read_at: string | null
          snapshot_id: string | null
          status: string | null
          valor: string | null
        }
        Insert: {
          created_at?: string
          data_encerramento?: string | null
          id?: string
          link?: string | null
          modalidade?: string | null
          numero?: string | null
          objeto?: string | null
          read_at?: string | null
          snapshot_id?: string | null
          status?: string | null
          valor?: string | null
        }
        Update: {
          created_at?: string
          data_encerramento?: string | null
          id?: string
          link?: string | null
          modalidade?: string | null
          numero?: string | null
          objeto?: string | null
          read_at?: string | null
          snapshot_id?: string | null
          status?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacoes_alerts_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "licitacoes_snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacoes_snapshot: {
        Row: {
          data_abertura: string | null
          data_encerramento: string | null
          first_seen_at: string
          hash: string
          id: string
          is_open: boolean
          last_seen_at: string
          link: string | null
          modalidade: string | null
          numero: string | null
          objeto: string | null
          raw: Json | null
          source_url: string
          status: string | null
          valor: string | null
          vencedor: string | null
        }
        Insert: {
          data_abertura?: string | null
          data_encerramento?: string | null
          first_seen_at?: string
          hash: string
          id?: string
          is_open?: boolean
          last_seen_at?: string
          link?: string | null
          modalidade?: string | null
          numero?: string | null
          objeto?: string | null
          raw?: Json | null
          source_url: string
          status?: string | null
          valor?: string | null
          vencedor?: string | null
        }
        Update: {
          data_abertura?: string | null
          data_encerramento?: string | null
          first_seen_at?: string
          hash?: string
          id?: string
          is_open?: boolean
          last_seen_at?: string
          link?: string | null
          modalidade?: string | null
          numero?: string | null
          objeto?: string | null
          raw?: Json | null
          source_url?: string
          status?: string | null
          valor?: string | null
          vencedor?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      monitor_targets: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      network_metrics: {
        Row: {
          avg_ms: number | null
          checked_at: string
          host: string
          id: string
          jitter_ms: number | null
          label: string
          last_status: number | null
          loss_pct: number
          max_ms: number | null
          min_ms: number | null
          received: number
          resolved_ip: string | null
          sent: number
          target_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          avg_ms?: number | null
          checked_at?: string
          host: string
          id?: string
          jitter_ms?: number | null
          label: string
          last_status?: number | null
          loss_pct?: number
          max_ms?: number | null
          min_ms?: number | null
          received?: number
          resolved_ip?: string | null
          sent?: number
          target_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          avg_ms?: number | null
          checked_at?: string
          host?: string
          id?: string
          jitter_ms?: number | null
          label?: string
          last_status?: number | null
          loss_pct?: number
          max_ms?: number | null
          min_ms?: number | null
          received?: number
          resolved_ip?: string | null
          sent?: number
          target_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          email: string
          id: string
          note: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          email: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          email?: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pronunciation_fixes: {
        Row: {
          case_sensitive: boolean
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          replacement: string
          updated_at: string
          updated_by: string | null
          whole_word: boolean
          word: string
        }
        Insert: {
          case_sensitive?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          replacement: string
          updated_at?: string
          updated_by?: string | null
          whole_word?: boolean
          word: string
        }
        Update: {
          case_sensitive?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          replacement?: string
          updated_at?: string
          updated_by?: string | null
          whole_word?: boolean
          word?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
