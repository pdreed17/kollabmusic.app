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
      activities: {
        Row: {
          activity_type: string
          audio_file_id: string | null
          comment_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          metadata: Json | null
          project_id: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          audio_file_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          project_id?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          audio_file_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          project_id?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_embeddings: {
        Row: {
          audio_file_id: string
          created_at: string | null
          duration: number
          embedding: number[]
          features: Json
          id: string
          project_id: string | null
          sample_rate: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_file_id: string
          created_at?: string | null
          duration: number
          embedding: number[]
          features: Json
          id?: string
          project_id?: string | null
          sample_rate: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_file_id?: string
          created_at?: string | null
          duration?: number
          embedding?: number[]
          features?: Json
          id?: string
          project_id?: string | null
          sample_rate?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_embeddings_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audio_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_files: {
        Row: {
          bit_depth: number | null
          bpm: number | null
          color: string | null
          created_at: string | null
          created_by: string
          duration_ms: number | null
          file_name: string
          file_path: string
          file_size: number
          file_size_bytes: number | null
          file_type: string
          format: string
          id: string
          is_hidden: boolean | null
          is_muted: boolean | null
          is_soloed: boolean | null
          is_trimmed: boolean | null
          midi_data: Json | null
          order_index: number | null
          original_file_path: string | null
          pan: number | null
          parent_file_id: string | null
          priority: string | null
          project_id: string
          sample_rate: number | null
          start_time_ms: number
          stem_name: string | null
          stem_type: string | null
          trim_end_ms: number | null
          trim_start_ms: number | null
          updated_at: string | null
          version: number | null
          volume: number | null
          waveform_data: Json | null
        }
        Insert: {
          bit_depth?: number | null
          bpm?: number | null
          color?: string | null
          created_at?: string | null
          created_by: string
          duration_ms?: number | null
          file_name: string
          file_path: string
          file_size: number
          file_size_bytes?: number | null
          file_type: string
          format: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_soloed?: boolean | null
          is_trimmed?: boolean | null
          midi_data?: Json | null
          order_index?: number | null
          original_file_path?: string | null
          pan?: number | null
          parent_file_id?: string | null
          priority?: string | null
          project_id: string
          sample_rate?: number | null
          start_time_ms?: number
          stem_name?: string | null
          stem_type?: string | null
          trim_end_ms?: number | null
          trim_start_ms?: number | null
          updated_at?: string | null
          version?: number | null
          volume?: number | null
          waveform_data?: Json | null
        }
        Update: {
          bit_depth?: number | null
          bpm?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string
          duration_ms?: number | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_size_bytes?: number | null
          file_type?: string
          format?: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_soloed?: boolean | null
          is_trimmed?: boolean | null
          midi_data?: Json | null
          order_index?: number | null
          original_file_path?: string | null
          pan?: number | null
          parent_file_id?: string | null
          priority?: string | null
          project_id?: string
          sample_rate?: number | null
          start_time_ms?: number
          stem_name?: string | null
          stem_type?: string | null
          trim_end_ms?: number | null
          trim_start_ms?: number | null
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          invitation_accepted_at: string | null
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
          invitation_accepted_at?: string | null
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
          invitation_accepted_at?: string | null
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
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
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
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
      highlights: {
        Row: {
          audio_type: string | null
          bpm: number | null
          created_at: string | null
          duration: number
          file_name: string
          file_url: string
          id: string
          key: string | null
          order_index: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_type?: string | null
          bpm?: number | null
          created_at?: string | null
          duration: number
          file_name: string
          file_url: string
          id?: string
          key?: string | null
          order_index?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_type?: string | null
          bpm?: number | null
          created_at?: string | null
          duration?: number
          file_name?: string
          file_url?: string
          id?: string
          key?: string | null
          order_index?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          project_id: string | null
          project_message_id: string | null
          read: boolean | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          project_id?: string | null
          project_message_id?: string | null
          read?: boolean | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          project_id?: string | null
          project_message_id?: string | null
          read?: boolean | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_message_id_fkey"
            columns: ["project_message_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_transfers: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          project_id: string
          received_at: string | null
          recipient_user_id: string
          sender_user_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          project_id: string
          received_at?: string | null
          recipient_user_id: string
          sender_user_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          project_id?: string
          received_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "p2p_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_changes: {
        Row: {
          change_type: string | null
          created_at: string | null
          device_info: Json | null
          field_changed: string
          id: string
          ip_address: unknown
          location: string | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          change_type?: string | null
          created_at?: string | null
          device_info?: Json | null
          field_changed: string
          id?: string
          ip_address?: unknown
          location?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          change_type?: string | null
          created_at?: string | null
          device_info?: Json | null
          field_changed?: string
          id?: string
          ip_address?: unknown
          location?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          accepted_at: string | null
          can_comment: boolean | null
          can_delete: boolean | null
          can_download: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_invite: boolean | null
          can_upload: boolean | null
          id: string
          invitation_status: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          last_activity_at: string | null
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
          can_export?: boolean | null
          can_invite?: boolean | null
          can_upload?: boolean | null
          id?: string
          invitation_status?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_activity_at?: string | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          can_comment?: boolean | null
          can_delete?: boolean | null
          can_download?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_invite?: boolean | null
          can_upload?: boolean | null
          id?: string
          invitation_status?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_activity_at?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          project_id: string
          reply_to: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          project_id: string
          reply_to?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          project_id?: string
          reply_to?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "project_messages"
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
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
          collaboration_needs: string[] | null
          created_at: string | null
          creator_id: string
          description: string | null
          genre: string | null
          id: string
          is_public: boolean | null
          key: string | null
          looking_for_collaborators: boolean | null
          looking_for_kollabs: boolean | null
          needed_roles: string[] | null
          status: string | null
          time_signature: string | null
          title: string
          track_count: number | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          bpm?: number | null
          collaboration_needs?: string[] | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          key?: string | null
          looking_for_collaborators?: boolean | null
          looking_for_kollabs?: boolean | null
          needed_roles?: string[] | null
          status?: string | null
          time_signature?: string | null
          title: string
          track_count?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          bpm?: number | null
          collaboration_needs?: string[] | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          key?: string | null
          looking_for_collaborators?: boolean | null
          looking_for_kollabs?: boolean | null
          needed_roles?: string[] | null
          status?: string | null
          time_signature?: string | null
          title?: string
          track_count?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      proximity_sessions: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          is_active: boolean | null
          last_seen: string | null
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proximity_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proximity_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_track_limits"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
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
      user_connections: {
        Row: {
          created_at: string | null
          following_id: string
          id: string
          seen: boolean | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          following_id: string
          id?: string
          seen?: boolean | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          following_id?: string
          id?: string
          seen?: boolean | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_connections_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_connections_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_messages_sender_id_fkey"
            columns: ["sender_id"]
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
          email: string | null
          first_name: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          last_name: string | null
          open_to_kollab: boolean | null
          profile_visibility: string | null
          role: string[] | null
          show_activity: boolean | null
          show_collaborations: boolean | null
          show_collaborators: boolean | null
          show_highlights: boolean | null
          show_projects: boolean | null
          skills: Json | null
          specialties: Json | null
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
          email?: string | null
          first_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          id: string
          last_name?: string | null
          open_to_kollab?: boolean | null
          profile_visibility?: string | null
          role?: string[] | null
          show_activity?: boolean | null
          show_collaborations?: boolean | null
          show_collaborators?: boolean | null
          show_highlights?: boolean | null
          show_projects?: boolean | null
          skills?: Json | null
          specialties?: Json | null
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
          email?: string | null
          first_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          last_name?: string | null
          open_to_kollab?: boolean | null
          profile_visibility?: string | null
          role?: string[] | null
          show_activity?: boolean | null
          show_collaborations?: boolean | null
          show_collaborators?: boolean | null
          show_highlights?: boolean | null
          show_projects?: boolean | null
          skills?: Json | null
          specialties?: Json | null
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
      project_track_limits: {
        Row: {
          can_upload_more: boolean | null
          creator_id: string | null
          owner_tier: string | null
          project_id: string | null
          storage_used_mb: number | null
          title: string | null
          track_count: number | null
          track_limit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "user_project_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_project_limits: {
        Row: {
          can_create_more_projects: boolean | null
          can_join_more_collaborations: boolean | null
          collaborated_projects_count: number | null
          collaborated_projects_limit: number | null
          owned_projects_count: number | null
          owned_projects_limit: number | null
          subscription_tier: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_project: { Args: { p_user_id: string }; Returns: boolean }
      can_join_collaboration: { Args: { p_user_id: string }; Returns: boolean }
      can_upload_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      cleanup_stale_proximity_sessions: { Args: never; Returns: undefined }
      cosine_similarity: { Args: { a: number[]; b: number[] }; Returns: number }
      get_collaborator_role: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: string
      }
      get_project_owner: { Args: { p_project_id: string }; Returns: string }
      get_project_track_usage: { Args: { p_project_id: string }; Returns: Json }
      get_user_active_collabs_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_owned_projects_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_usage_stats: { Args: { p_user_id: string }; Returns: Json }
      has_project_permission: {
        Args: { p_permission: string; p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      initialize_track_counts: { Args: never; Returns: undefined }
      is_accepted_collaborator: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_collaborator: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_public: { Args: { p_project_id: string }; Returns: boolean }
      is_user_blocked: {
        Args: { p_user1: string; p_user2: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_activity_type: string
          p_audio_file_id?: string
          p_comment_id?: string
          p_description?: string
          p_is_public?: boolean
          p_metadata?: Json
          p_project_id?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
      search_similar_audio: {
        Args: {
          min_similarity?: number
          query_embedding: number[]
          query_user_id: string
          result_limit?: number
        }
        Returns: {
          audio_file_id: string
          bpm: number
          created_at: string
          display_name: string
          energy: number
          file_name: string
          key: string
          project_title: string
          similarity_score: number
          username: string
        }[]
      }
      user_follows: {
        Args: { p_follower_id: string; p_following_id: string }
        Returns: boolean
      }
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
