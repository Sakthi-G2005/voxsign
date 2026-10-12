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
      chat_messages: {
        Row: {
          attachment_duration: number | null
          attachment_mime: string | null
          attachment_path: string | null
          attachment_type: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachment_duration?: number | null
          attachment_mime?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          author_id: string
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachment_duration?: number | null
          attachment_mime?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      gesture_events: {
        Row: {
          created_at: string
          device_id: string | null
          gesture_code: string
          gesture_message: string
          help_request_id: string | null
          id: string
          sensor_data: Json
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          gesture_code: string
          gesture_message?: string
          help_request_id?: string | null
          id?: string
          sensor_data?: Json
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          gesture_code?: string
          gesture_message?: string
          help_request_id?: string | null
          id?: string
          sensor_data?: Json
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gesture_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gesture_events_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          assigned_receiver_id: string | null
          created_at: string
          delivered_at: string | null
          gesture_code: string
          helped_at: string | null
          id: string
          message: string
          notification_status: Database["public"]["Enums"]["notification_status"]
          responder_id: string | null
          responder_note: string | null
          seen_at: string | null
          sender_id: string
          source: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          assigned_receiver_id?: string | null
          created_at?: string
          delivered_at?: string | null
          gesture_code?: string
          helped_at?: string | null
          id?: string
          message?: string
          notification_status?: Database["public"]["Enums"]["notification_status"]
          responder_id?: string | null
          responder_note?: string | null
          seen_at?: string | null
          sender_id: string
          source?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          assigned_receiver_id?: string | null
          created_at?: string
          delivered_at?: string | null
          gesture_code?: string
          helped_at?: string | null
          id?: string
          message?: string
          notification_status?: Database["public"]["Enums"]["notification_status"]
          responder_id?: string | null
          responder_note?: string | null
          seen_at?: string | null
          sender_id?: string
          source?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_assigned_receiver_id_fkey"
            columns: ["assigned_receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          delivered_at: string | null
          help_request_id: string
          id: string
          notification_type: string
          receiver_id: string
          responded_at: string | null
          seen_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["notification_status"]
          trusted_contact_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          help_request_id: string
          id?: string
          notification_type?: string
          receiver_id: string
          responded_at?: string | null
          seen_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["notification_status"]
          trusted_contact_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          help_request_id?: string
          id?: string
          notification_type?: string
          receiver_id?: string
          responded_at?: string | null
          seen_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["notification_status"]
          trusted_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trusted_contact_id_fkey"
            columns: ["trusted_contact_id"]
            isOneToOne: false
            referencedRelation: "trusted_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          escalation_timeout_seconds: number
          full_name: string
          id: string
          notify_all_contacts: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          escalation_timeout_seconds?: number
          full_name?: string
          id: string
          notify_all_contacts?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          escalation_timeout_seconds?: number
          full_name?: string
          id?: string
          notify_all_contacts?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      trusted_contacts: {
        Row: {
          contact_name: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          link_status: Database["public"]["Enums"]["link_status"]
          phone: string | null
          priority: number
          receiver_id: string | null
          relationship: string
          sender_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          link_status?: Database["public"]["Enums"]["link_status"]
          phone?: string | null
          priority?: number
          receiver_id?: string | null
          relationship?: string
          sender_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          link_status?: Database["public"]["Enums"]["link_status"]
          phone?: string | null
          priority?: number
          receiver_id?: string | null
          relationship?: string
          sender_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trusted_contacts_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_contacts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_is: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      dispatch_help_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      escalate_help_request: {
        Args: { _caller_id: string; _request_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "sender" | "receiver"
      link_status: "unlinked" | "pending" | "accepted" | "declined"
      notification_status:
        | "pending"
        | "sent"
        | "delivered"
        | "seen"
        | "accepted"
        | "declined"
        | "expired"
      request_status: "sent" | "delivered" | "seen" | "help_provided"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["sender", "receiver"],
      link_status: ["unlinked", "pending", "accepted", "declined"],
      notification_status: [
        "pending",
        "sent",
        "delivered",
        "seen",
        "accepted",
        "declined",
        "expired",
      ],
      request_status: ["sent", "delivered", "seen", "help_provided"],
    },
  },
} as const
