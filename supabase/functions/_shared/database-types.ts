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
      bug_reports: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_log: {
        Row: {
          created_at: string | null
          data: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          message: string
          player_id: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          message: string
          player_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          message?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "active_games_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_player_id_fkey"
            columns: ["player_id"]
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
        }
        Insert: {
          action_data: Json
          action_type: string
          created_at?: string | null
          game_id: string
          id?: string
          ply: number
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string | null
          game_id?: string
          id?: string
          ply?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "active_games_view"
            referencedColumns: ["id"]
          },
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
          ban_history: Json | null
          banning_player: string | null
          black_player_id: string | null
          black_time_remaining: number | null
          created_at: string | null
          current_fen: string | null
          elo_change_black: number | null
          elo_change_white: number | null
          end_reason: string | null
          id: string
          is_public: boolean | null
          is_rated: boolean | null
          last_move_at: string | null
          move_history: Json | null
          opening_name: string | null
          pgn: string | null
          spectators: string[] | null
          status: string
          time_control: Json | null
          turn: string | null
          updated_at: string | null
          white_player_id: string | null
          white_time_remaining: number | null
          winner: string | null
        }
        Insert: {
          ban_chess_state: string
          ban_history?: Json | null
          banning_player?: string | null
          black_player_id?: string | null
          black_time_remaining?: number | null
          created_at?: string | null
          current_fen?: string | null
          elo_change_black?: number | null
          elo_change_white?: number | null
          end_reason?: string | null
          id?: string
          is_public?: boolean | null
          is_rated?: boolean | null
          last_move_at?: string | null
          move_history?: Json | null
          opening_name?: string | null
          pgn?: string | null
          spectators?: string[] | null
          status?: string
          time_control?: Json | null
          turn?: string | null
          updated_at?: string | null
          white_player_id?: string | null
          white_time_remaining?: number | null
          winner?: string | null
        }
        Update: {
          ban_chess_state?: string
          ban_history?: Json | null
          banning_player?: string | null
          black_player_id?: string | null
          black_time_remaining?: number | null
          created_at?: string | null
          current_fen?: string | null
          elo_change_black?: number | null
          elo_change_white?: number | null
          end_reason?: string | null
          id?: string
          is_public?: boolean | null
          is_rated?: boolean | null
          last_move_at?: string | null
          move_history?: Json | null
          opening_name?: string | null
          pgn?: string | null
          spectators?: string[] | null
          status?: string
          time_control?: Json | null
          turn?: string | null
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
          id: string
          joined_at: string | null
          player_id: string
          preferences: Json | null
          rating_max: number | null
          rating_min: number | null
          status: string | null
          time_control_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          player_id: string
          preferences?: Json | null
          rating_max?: number | null
          rating_min?: number | null
          status?: string | null
          time_control_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          player_id?: string
          preferences?: Json | null
          rating_max?: number | null
          rating_min?: number | null
          status?: string | null
          time_control_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_time_control_id_fkey"
            columns: ["time_control_id"]
            isOneToOne: false
            referencedRelation: "time_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          elo_rating: number | null
          games_drawn: number | null
          games_lost: number | null
          games_played: number | null
          games_won: number | null
          id: string
          is_online: boolean | null
          last_online: string | null
          last_seen: string | null
          title: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          elo_rating?: number | null
          games_drawn?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id: string
          is_online?: boolean | null
          last_online?: string | null
          last_seen?: string | null
          title?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          elo_rating?: number | null
          games_drawn?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          is_online?: boolean | null
          last_online?: string | null
          last_seen?: string | null
          title?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          auto_queen: boolean | null
          board_style: string | null
          clock_position: string | null
          created_at: string | null
          highlight_moves: boolean | null
          notifications_enabled: boolean | null
          piece_style: string | null
          preferences: Json | null
          premove_enabled: boolean | null
          show_coordinates: boolean | null
          show_legal_moves: boolean | null
          sound_enabled: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_queen?: boolean | null
          board_style?: string | null
          clock_position?: string | null
          created_at?: string | null
          highlight_moves?: boolean | null
          notifications_enabled?: boolean | null
          piece_style?: string | null
          preferences?: Json | null
          premove_enabled?: boolean | null
          show_coordinates?: boolean | null
          show_legal_moves?: boolean | null
          sound_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_queen?: boolean | null
          board_style?: string | null
          clock_position?: string | null
          created_at?: string | null
          highlight_moves?: boolean | null
          notifications_enabled?: boolean | null
          piece_style?: string | null
          preferences?: Json | null
          premove_enabled?: boolean | null
          show_coordinates?: boolean | null
          show_legal_moves?: boolean | null
          sound_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_controls: {
        Row: {
          created_at: string | null
          id: string
          increment: number
          initial_time: number
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          increment: number
          initial_time: number
          is_default?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          increment?: number
          initial_time?: number
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_games_view: {
        Row: {
          ban_chess_state: string | null
          ban_history: Json | null
          banning_player: string | null
          black_elo: number | null
          black_online: boolean | null
          black_player_id: string | null
          black_time_remaining: number | null
          black_username: string | null
          created_at: string | null
          current_fen: string | null
          elo_change_black: number | null
          elo_change_white: number | null
          end_reason: string | null
          id: string | null
          is_public: boolean | null
          is_rated: boolean | null
          last_move_at: string | null
          move_history: Json | null
          opening_name: string | null
          pgn: string | null
          spectators: string[] | null
          status: string | null
          time_control: Json | null
          turn: string | null
          updated_at: string | null
          white_elo: number | null
          white_online: boolean | null
          white_player_id: string | null
          white_time_remaining: number | null
          white_username: string | null
          winner: string | null
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
    }
    Functions: {
      before_user_created_hook: {
        Args: { event: Json }
        Returns: Json
      }
      cleanup_abandoned_games: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_anonymous_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_user_active_game: {
        Args: { user_id: string }
        Returns: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

