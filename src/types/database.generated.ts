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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "ban_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "bug_reports_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          banning_player: Database["public"]["Enums"]["player_color"] | null
          black_player_id: string
          black_time_remaining: number | null
          black_turn_start_time: number | null
          claim_available_at: string | null
          clock_state: Json | null
          created_at: string
          current_banned_move: Json | null
          current_fen: string
          disconnect_allowance_seconds: number | null
          disconnect_started_at: string | null
          draw_offered_by: Database["public"]["Enums"]["player_color"] | null
          end_reason: Database["public"]["Enums"]["end_reason"] | null
          id: string
          lag_compensation_ms: number | null
          last_clock_update: string | null
          last_connection_type: string | null
          last_move: Json | null
          parent_game_id: string | null
          pgn: string
          rematch_offered_by: Database["public"]["Enums"]["player_color"] | null
          result: Database["public"]["Enums"]["game_result"] | null
          status: Database["public"]["Enums"]["game_status"]
          time_control: Json | null
          total_disconnect_seconds: number | null
          turn: Database["public"]["Enums"]["player_color"]
          updated_at: string
          white_player_id: string
          white_time_remaining: number | null
          white_turn_start_time: number | null
        }
        Insert: {
          banning_player?: Database["public"]["Enums"]["player_color"] | null
          black_player_id: string
          black_time_remaining?: number | null
          black_turn_start_time?: number | null
          claim_available_at?: string | null
          clock_state?: Json | null
          created_at?: string
          current_banned_move?: Json | null
          current_fen: string
          disconnect_allowance_seconds?: number | null
          disconnect_started_at?: string | null
          draw_offered_by?: Database["public"]["Enums"]["player_color"] | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          id: string
          lag_compensation_ms?: number | null
          last_clock_update?: string | null
          last_connection_type?: string | null
          last_move?: Json | null
          parent_game_id?: string | null
          pgn?: string
          rematch_offered_by?:
            | Database["public"]["Enums"]["player_color"]
            | null
          result?: Database["public"]["Enums"]["game_result"] | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: Json | null
          total_disconnect_seconds?: number | null
          turn?: Database["public"]["Enums"]["player_color"]
          updated_at?: string
          white_player_id: string
          white_time_remaining?: number | null
          white_turn_start_time?: number | null
        }
        Update: {
          banning_player?: Database["public"]["Enums"]["player_color"] | null
          black_player_id?: string
          black_time_remaining?: number | null
          black_turn_start_time?: number | null
          claim_available_at?: string | null
          clock_state?: Json | null
          created_at?: string
          current_banned_move?: Json | null
          current_fen?: string
          disconnect_allowance_seconds?: number | null
          disconnect_started_at?: string | null
          draw_offered_by?: Database["public"]["Enums"]["player_color"] | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          id?: string
          lag_compensation_ms?: number | null
          last_clock_update?: string | null
          last_connection_type?: string | null
          last_move?: Json | null
          parent_game_id?: string | null
          pgn?: string
          rematch_offered_by?:
            | Database["public"]["Enums"]["player_color"]
            | null
          result?: Database["public"]["Enums"]["game_result"] | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: Json | null
          total_disconnect_seconds?: number | null
          turn?: Database["public"]["Enums"]["player_color"]
          updated_at?: string
          white_player_id?: string
          white_time_remaining?: number | null
          white_turn_start_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_parent_game_id_fkey"
            columns: ["parent_game_id"]
            isOneToOne: false
            referencedRelation: "games"
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
        Relationships: [
          {
            foreignKeyName: "matchmaking_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
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
        Relationships: [
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          last_online: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          last_online?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          last_online?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
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
      calculate_time_remaining: {
        Args: {
          current_ts?: number
          initial_time: number
          turn_start_time: number
        }
        Returns: number
      }
      check_time_violations: {
        Args: { game_id: string }
        Returns: Database["public"]["Enums"]["player_color"]
      }
      cleanup_expired_clocks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_default_initial_time: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_default_time_control: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_follow_stats: {
        Args: { user_id: string }
        Returns: Json
      }
      get_game_moves: {
        Args: { p_game_id: string }
        Returns: {
          banned_by: string
          banned_from: string
          banned_to: string
          fen_after: string
          from_square: string
          id: string
          move_number: number
          player_color: string
          ply_number: number
          promotion: string
          san: string
          time_taken_ms: number
          to_square: string
        }[]
      }
      handle_move_clock_update: {
        Args:
          | {
              game_id: string
              moving_color: Database["public"]["Enums"]["player_color"]
            }
          | { p_game_id: string; p_moving_color: string }
        Returns: Json
      }
      handle_player_disconnect: {
        Args:
          | { disconnect_type?: string; game_id: string; player_id: string }
          | { disconnect_type?: string; game_id: string; player_id: string }
        Returns: Json
      }
      handle_player_reconnect: {
        Args:
          | { game_id: string; player_id: string }
          | { game_id: string; player_id: string }
        Returns: Json
      }
      is_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_following: {
        Args: { follower: string; following: string }
        Returns: boolean
      }
      is_user_alive: {
        Args: { threshold_seconds?: number; user_id: string }
        Returns: boolean
      }
      mark_stale_users_offline: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      remove_stale_from_matchmaking: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      start_player_clock: {
        Args: {
          game_id: string
          player_color: Database["public"]["Enums"]["player_color"]
        }
        Returns: undefined
      }
      stop_player_clock: {
        Args: {
          apply_increment?: boolean
          game_id: string
          player_color: Database["public"]["Enums"]["player_color"]
        }
        Returns: number
      }
      update_user_heartbeat: {
        Args: { user_id: string }
        Returns: undefined
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
