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
      body_metrics: {
        Row: {
          created_at: string
          height: number | null
          id: string
          recorded_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          recorded_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          recorded_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      exercise_favorites: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_favorites_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_part: string
          created_at: string
          description: string
          difficulty: string
          id: string
          name: string
          thumbnail_url: string | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          body_part: string
          created_at?: string
          description?: string
          difficulty: string
          id?: string
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          body_part?: string
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      goal_progress: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          memo: string | null
          recorded_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          memo?: string | null
          recorded_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          memo?: string | null
          recorded_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_value: number | null
          goal_type: string
          id: string
          start_date: string
          start_value: number | null
          target_date: string | null
          target_value: number | null
          title: string
          trainer_comment: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          goal_type: string
          id?: string
          start_date?: string
          start_value?: number | null
          target_date?: string | null
          target_value?: number | null
          title?: string
          trainer_comment?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          goal_type?: string
          id?: string
          start_date?: string
          start_value?: number | null
          target_date?: string | null
          target_value?: number | null
          title?: string
          trainer_comment?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_goals: {
        Row: {
          goal_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          goal_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          goal_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          joined_at: string
          memo: string
          name: string
          phone: string
          status: string
          total_sessions: number
          trainer_id: string | null
          used_sessions: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          joined_at?: string
          memo?: string
          name?: string
          phone?: string
          status?: string
          total_sessions?: number
          trainer_id?: string | null
          used_sessions?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          joined_at?: string
          memo?: string
          name?: string
          phone?: string
          status?: string
          total_sessions?: number
          trainer_id?: string | null
          used_sessions?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          read: boolean
          sender_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          gender: string | null
          id: string
          name: string
          nickname: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id: string
          name?: string
          nickname?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          nickname?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      schedule_requests: {
        Row: {
          created_at: string
          id: string
          member_name: string
          member_user_id: string
          original_date: string
          original_schedule_id: string | null
          original_time: string
          reject_reason: string | null
          request_type: string
          requested_date: string | null
          requested_time: string | null
          status: string
          trainer_name: string | null
          trainer_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_name: string
          member_user_id: string
          original_date: string
          original_schedule_id?: string | null
          original_time: string
          reject_reason?: string | null
          request_type: string
          requested_date?: string | null
          requested_time?: string | null
          status?: string
          trainer_name?: string | null
          trainer_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_name?: string
          member_user_id?: string
          original_date?: string
          original_schedule_id?: string | null
          original_time?: string
          reject_reason?: string | null
          request_type?: string
          requested_date?: string | null
          requested_time?: string | null
          status?: string
          trainer_name?: string | null
          trainer_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          attended: boolean | null
          created_at: string
          date: string
          id: string
          member_id: string
          signature_requested: boolean
          signature_url: string | null
          signed_at: string | null
          time: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          date: string
          id?: string
          member_id: string
          signature_requested?: boolean
          signature_url?: string | null
          signed_at?: string | null
          time: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          date?: string
          id?: string
          member_id?: string
          signature_requested?: boolean
          signature_url?: string | null
          signed_at?: string | null
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          trainer_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          trainer_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          trainer_id?: string
          weekday?: number
        }
        Relationships: []
      }
      trainer_time_off: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string
          trainer_id?: string
        }
        Relationships: []
      }
      trainers: {
        Row: {
          created_at: string
          id: string
          memo: string
          name: string
          phone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          memo?: string
          name?: string
          phone?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          memo?: string
          name?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          exercises: Json
          id: string
          member_id: string
          member_memos: Json
          schedule_id: string
          trainer_memo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exercises?: Json
          id?: string
          member_id: string
          member_memos?: Json
          schedule_id: string
          trainer_memo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exercises?: Json
          id?: string
          member_id?: string
          member_memos?: Json
          schedule_id?: string
          trainer_memo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trainers_public: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      app_role: "trainer" | "member" | "admin"
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
      app_role: ["trainer", "member", "admin"],
    },
  },
} as const
