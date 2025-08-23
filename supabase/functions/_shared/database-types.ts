export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ban_history: {
        Row: {
          banned_at: string
          banned_by: Database["public"]["Enums"]["player_color"]
          banned_move: Json
          game_id: string
          id: string
          move_number: number
        }
        Insert: {
          banned_at?: string
          banned_by: Database["public"]["Enums"]["player_color"]
          banned_move: Json
          game_id: string
          id?: string
          move_number: number
        }
        Update: {
          banned_at?: string
          banned_by?: Database["public"]["Enums"]["player_color"]
          banned_move?: Json
          game_id?: string
          id?: string
          move_number?: number
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          actual_behavior: string | null
          additional_data: Json | null
          browser_info: Json | null
          category: string
          created_at: string | null
          description: string
          expected_behavior: string | null
          game_id: string | null
          id: string
          page_url: string | null
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_url: string | null
          severity: string
          status: string
          steps_to_reproduce: string | null
          title: string
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          actual_behavior?: string | null
          additional_data?: Json | null
          browser_info?: Json | null
          category: string
          created_at?: string | null
          description: string
          expected_behavior?: string | null
          game_id?: string | null
          id?: string
          page_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          severity: string
          status?: string
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          actual_behavior?: string | null
          additional_data?: Json | null
          browser_info?: Json | null
          category?: string
          created_at?: string | null
          description?: string
          expected_behavior?: string | null
          game_id?: string | null
          id?: string
          page_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_timeouts: {
        Row: {
          last_violation: string
          timeout_until: string
          user_id: string
          violation_count: number
        }
        Insert: {
          last_violation?: string
          timeout_until: string
          user_id: string
          violation_count?: number
        }
        Update: {
          last_violation?: string
          timeout_until?: string
          user_id?: string
          violation_count?: number
        }
        Relationships: []
      }
      event_log: {
        Row: {
          created_at: string
          data: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          content: string
          created_at: string | null
          game_id: string
          id: string
          message_type: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          game_id: string
          id?: string
          message_type?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          game_id?: string
          id?: string
          message_type?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_moves: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string | null
          game_id: string
          id: string
          ply: number
          time_taken_ms: number | null
        }
        Insert: {
          action_data: Json
          action_type: string
          created_at?: string | null
          game_id: string
          id?: string
          ply: number
          time_taken_ms?: number | null
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string | null
          game_id?: string
          id?: string
          ply?: number
          time_taken_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          ban_chess_state: string
          black_player_id: string | null
          black_time_remaining: number | null
          created_at: string | null
          id: string
          increment_seconds: number | null
          last_move_at: string | null
          result_reason: string | null
          status: string
          time_control_minutes: number | null
          updated_at: string | null
          white_player_id: string | null
          white_time_remaining: number | null
          winner: string | null
        }
        Insert: {
          ban_chess_state: string
          black_player_id?: string | null
          black_time_remaining?: number | null
          created_at?: string | null
          id?: string
          increment_seconds?: number | null
          last_move_at?: string | null
          result_reason?: string | null
          status?: string
          time_control_minutes?: number | null
          updated_at?: string | null
          white_player_id?: string | null
          white_time_remaining?: number | null
          winner?: string | null
        }
        Update: {
          ban_chess_state?: string
          black_player_id?: string | null
          black_time_remaining?: number | null
          created_at?: string | null
          id?: string
          increment_seconds?: number | null
          last_move_at?: string | null
          result_reason?: string | null
          status?: string
          time_control_minutes?: number | null
          updated_at?: string | null
          white_player_id?: string | null
          white_time_remaining?: number | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_player_id_fkey"
            columns: ["black_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_player_id_fkey"
            columns: ["white_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking: {
        Row: {
          game_id: string | null
          id: string
          joined_at: string
          last_online: string
          player_id: string
          preferences: Json | null
          status: Database["public"]["Enums"]["queue_status"]
        }
        Insert: {
          game_id?: string | null
          id?: string
          joined_at?: string
          last_online?: string
          player_id: string
          preferences?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Update: {
          game_id?: string | null
          id?: string
          joined_at?: string
          last_online?: string
          player_id?: string
          preferences?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          created_at: string | null
          id: string
          increment_seconds: number | null
          player_id: string
          time_control_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          increment_seconds?: number | null
          player_id: string
          time_control_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          increment_seconds?: number | null
          player_id?: string
          time_control_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          banned_by: Database["public"]["Enums"]["player_color"] | null
          banned_from: string | null
          banned_to: string | null
          created_at: string
          created_by: string | null
          fen_after: string
          from_square: string
          game_id: string
          id: string
          move_number: number
          player_color: Database["public"]["Enums"]["player_color"]
          ply_number: number
          promotion: string | null
          san: string
          to_square: string
        }
        Insert: {
          banned_by?: Database["public"]["Enums"]["player_color"] | null
          banned_from?: string | null
          banned_to?: string | null
          created_at?: string
          created_by?: string | null
          fen_after: string
          from_square: string
          game_id: string
          id?: string
          move_number: number
          player_color: Database["public"]["Enums"]["player_color"]
          ply_number: number
          promotion?: string | null
          san?: string
          to_square: string
        }
        Update: {
          banned_by?: Database["public"]["Enums"]["player_color"] | null
          banned_from?: string | null
          banned_to?: string | null
          created_at?: string
          created_by?: string | null
          fen_after?: string
          from_square?: string
          game_id?: string
          id?: string
          move_number?: number
          player_color?: Database["public"]["Enums"]["player_color"]
          ply_number?: number
          promotion?: string | null
          san?: string
          to_square?: string
        }
        Relationships: []
      }
      news_items: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          last_online: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          last_online?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          last_online?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_follow_stats: {
        Args: { user_id: string }
        Returns: Json
      }
      handle_player_disconnect: {
        Args: { disconnect_type?: string; game_id: string; player_id: string }
        Returns: Json
      }
      handle_player_reconnect: {
        Args: { game_id: string; player_id: string }
        Returns: Json
      }
      is_following: {
        Args: { follower: string; following: string }
        Returns: boolean
      }
      is_user_timed_out: {
        Args: { p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      end_reason:
        | "checkmate"
        | "resignation"
        | "draw_agreement"
        | "stalemate"
        | "insufficient_material"
        | "threefold_repetition"
        | "fifty_move_rule"
        | "timeout"
      game_result: "white" | "black" | "draw"
      game_status: "active" | "finished"
      player_color: "white" | "black"
      queue_status: "waiting" | "matched"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      end_reason: [
        "checkmate",
        "resignation",
        "draw_agreement",
        "stalemate",
        "insufficient_material",
        "threefold_repetition",
        "fifty_move_rule",
        "timeout",
      ],
      game_result: ["white", "black", "draw"],
      game_status: ["active", "finished"],
      player_color: ["white", "black"],
      queue_status: ["waiting", "matched"],
    },
  },
} as const

