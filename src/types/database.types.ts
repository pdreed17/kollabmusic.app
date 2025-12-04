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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audio_files: {
        Row: {
          bit_depth: number | null
          color: string | null
          created_at: string | null
          created_by: string
          duration_ms: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          format: string
          id: string
          is_muted: boolean | null
          is_soloed: boolean | null
          midi_data: Json | null
          pan: number | null
          parent_file_id: string | null
          project_id: string
          sample_rate: number | null
          stem_name: string | null
          stem_type: string | null
          updated_at: string | null
          version: number | null
          volume: number | null
          waveform_data: Json | null
        }
        Insert: {
          bit_depth?: number | null
          color?: string | null
          created_at?: string | null
          created_by: string
          duration_ms?: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          format: string
          id?: string
          is_muted?: boolean | null
          is_soloed?: boolean | null
          midi_data?: Json | null
          pan?: number | null
          parent_file_id?: string | null
          project_id: string
          sample_rate?: number | null
          stem_name?: string | null
          stem_type?: string | null
          updated_at?: string | null
          version?: number | null
          volume?: number | null
          waveform_data?: Json | null
        }
        Update: {
          bit_depth?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string
          duration_ms?: number | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          format?: string
          id?: string
          is_muted?: boolean | null
          is_soloed?: boolean | null
          midi_data?: Json | null
          pan?: number | null
          parent_file_id?: string | null
          project_id?: string
          sample_rate?: number | null
          stem_name?: string | null
          stem_type?: string | null
          updated_at?: string | null
          version?: number | null
          volume?: number | null
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_files_parent_file_id_fkey"
            columns: ["parent_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          accepted_at: string | null
          can_comment: boolean | null
          can_delete: boolean | null
          can_download: boolean | null
          can_edit: boolean | null
          can_invite: boolean | null
          can_upload: boolean | null
          created_at: string | null
          id: string
          invitation_status: string | null
          invited_by: string | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          can_comment?: boolean | null
          can_delete?: boolean | null
          can_download?: boolean | null
          can_edit?: boolean | null
          can_invite?: boolean | null
          can_upload?: boolean | null
          created_at?: string | null
          id?: string
          invitation_status?: string | null
          invited_by?: string | null
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          can_comment?: boolean | null
          can_delete?: boolean | null
          can_download?: boolean | null
          can_edit?: boolean | null
          can_invite?: boolean | null
          can_upload?: boolean | null
          created_at?: string | null
          id?: string
          invitation_status?: string | null
          invited_by?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          audio_file_id: string | null
          content: string
          created_at: string | null
          end_timestamp_ms: number | null
          id: string
          parent_comment_id: string | null
          project_id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          timestamp_ms: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_file_id?: string | null
          content: string
          created_at?: string | null
          end_timestamp_ms?: number | null
          id?: string
          parent_comment_id?: string | null
          project_id: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          timestamp_ms?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_file_id?: string | null
          content?: string
          created_at?: string | null
          end_timestamp_ms?: number | null
          id?: string
          parent_comment_id?: string | null
          project_id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          timestamp_ms?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          project_id: string
          snapshot_data: Json
          version_name: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          project_id: string
          snapshot_data: Json
          version_name?: string | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          project_id?: string
          snapshot_data?: Json
          version_name?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bpm: number | null
          created_at: string | null
          creator_id: string
          description: string | null
          genre: string | null
          id: string
          is_public: boolean | null
          key: string | null
          looking_for_collaborators: boolean | null
          needed_roles: string[] | null
          status: string | null
          time_signature: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bpm?: number | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          key?: string | null
          looking_for_collaborators?: boolean | null
          needed_roles?: string[] | null
          status?: string | null
          time_signature?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bpm?: number | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          key?: string | null
          looking_for_collaborators?: boolean | null
          needed_roles?: string[] | null
          status?: string | null
          time_signature?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_splits: {
        Row: {
          agreed: boolean | null
          agreed_at: string | null
          created_at: string | null
          id: string
          percentage: number
          project_id: string
          role: string | null
          signature_data: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agreed?: boolean | null
          agreed_at?: string | null
          created_at?: string | null
          id?: string
          percentage: number
          project_id: string
          role?: string | null
          signature_data?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agreed?: boolean | null
          agreed_at?: string | null
          created_at?: string | null
          id?: string
          percentage?: number
          project_id?: string
          role?: string | null
          signature_data?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_splits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          role: string[] | null
          skills: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          role?: string[] | null
          skills?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string[] | null
          skills?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// Helper type aliases for common table types
export type Project = Tables<'projects'>
export type Collaborator = Tables<'collaborators'>
export type User = Tables<'users'>
export type AudioFile = Tables<'audio_files'>
export type Comment = Tables<'comments'>

// Extended types with relations
export interface ProjectWithCreator extends Project {
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}
