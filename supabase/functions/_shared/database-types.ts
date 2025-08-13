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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      games: {
        Row: {
          banning_player: Database["public"]["Enums"]["player_color"] | null
          black_player_id: string
          black_time_remaining: number | null
          created_at: string
          current_banned_move: Json | null
          current_fen: string
          draw_offered_by: Database["public"]["Enums"]["player_color"] | null
          end_reason: Database["public"]["Enums"]["end_reason"] | null
          id: string
          last_move: Json | null
          parent_game_id: string | null
          pgn: string
          rematch_offered_by: Database["public"]["Enums"]["player_color"] | null
          result: Database["public"]["Enums"]["game_result"] | null
          status: Database["public"]["Enums"]["game_status"]
          time_control: Json | null
          turn: Database["public"]["Enums"]["player_color"]
          updated_at: string
          white_player_id: string
          white_time_remaining: number | null
        }
        Insert: {
          banning_player?: Database["public"]["Enums"]["player_color"] | null
          black_player_id: string
          black_time_remaining?: number | null
          created_at?: string
          current_banned_move?: Json | null
          current_fen: string
          draw_offered_by?: Database["public"]["Enums"]["player_color"] | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          id: string
          last_move?: Json | null
          parent_game_id?: string | null
          pgn?: string
          rematch_offered_by?:
            | Database["public"]["Enums"]["player_color"]
            | null
          result?: Database["public"]["Enums"]["game_result"] | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: Json | null
          turn?: Database["public"]["Enums"]["player_color"]
          updated_at?: string
          white_player_id: string
          white_time_remaining?: number | null
        }
        Update: {
          banning_player?: Database["public"]["Enums"]["player_color"] | null
          black_player_id?: string
          black_time_remaining?: number | null
          created_at?: string
          current_banned_move?: Json | null
          current_fen?: string
          draw_offered_by?: Database["public"]["Enums"]["player_color"] | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          id?: string
          last_move?: Json | null
          parent_game_id?: string | null
          pgn?: string
          rematch_offered_by?:
            | Database["public"]["Enums"]["player_color"]
            | null
          result?: Database["public"]["Enums"]["game_result"] | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: Json | null
          turn?: Database["public"]["Enums"]["player_color"]
          updated_at?: string
          white_player_id?: string
          white_time_remaining?: number | null
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
          player_id: string
          preferences: Json | null
          status: Database["public"]["Enums"]["queue_status"]
        }
        Insert: {
          game_id?: string | null
          id?: string
          joined_at?: string
          player_id: string
          preferences?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Update: {
          game_id?: string | null
          id?: string
          joined_at?: string
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
          banned_by: string | null
          banned_from: string | null
          banned_to: string | null
          created_at: string | null
          created_by: string | null
          fen_after: string
          from_square: string
          game_id: string
          id: string
          move_number: number
          player_color: string
          ply_number: number
          promotion: string | null
          san: string
          time_taken_ms: number | null
          to_square: string
        }
        Insert: {
          banned_by?: string | null
          banned_from?: string | null
          banned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          fen_after: string
          from_square: string
          game_id: string
          id?: string
          move_number: number
          player_color: string
          ply_number: number
          promotion?: string | null
          san: string
          time_taken_ms?: number | null
          to_square: string
        }
        Update: {
          banned_by?: string | null
          banned_from?: string | null
          banned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          fen_after?: string
          from_square?: string
          game_id?: string
          id?: string
          move_number?: number
          player_color?: string
          ply_number?: number
          promotion?: string | null
          san?: string
          time_taken_ms?: number | null
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
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
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
      followed_users_status: {
        Row: {
          active_game: Json | null
          followed_at: string | null
          follower_id: string | null
          following_id: string | null
          username: string | null
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
    }
    Functions: {
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
        Args: { p_game_id: string } | { p_game_id: string }
        Returns: {
          id: string
          move_number: number
          ply_number: number
          player_color: string
          from_square: string
          to_square: string
          promotion: string
          san: string
          fen_after: string
          banned_from: string
          banned_to: string
          banned_by: string
          time_taken_ms: number
        }[]
      }
      is_following: {
        Args: { follower: string; following: string }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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

