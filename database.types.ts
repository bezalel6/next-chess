export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          banningPlayer: string | null;
          black_player_id: string | null;
          created_at: string;
          current_fen: string;
          draw_offered_by: string | null;
          end_reason: string | null;
          id: string;
          last_move: Json | null;
          parent_game_id: string | null;
          pgn: string;
          rematch_offered_by: string | null;
          result: string | null;
          status: string;
          turn: string;
          updated_at: string;
          white_player_id: string | null;
          black_time_remaining: number | null;
          white_time_remaining: number | null;
          time_control: Json | null;
        };
        Insert: {
          banningPlayer?: string | null;
          black_player_id?: string | null;
          created_at?: string;
          current_fen: string;
          draw_offered_by?: string | null;
          end_reason?: string | null;
          id?: string;
          last_move?: Json | null;
          parent_game_id?: string | null;
          pgn?: string;
          rematch_offered_by?: string | null;
          result?: string | null;
          status: string;
          turn: string;
          updated_at?: string;
          white_player_id?: string | null;
          black_time_remaining?: number | null;
          white_time_remaining?: number | null;
          time_control?: Json | null;
        };
        Update: {
          banningPlayer?: string | null;
          black_player_id?: string | null;
          created_at?: string;
          current_fen?: string;
          draw_offered_by?: string | null;
          end_reason?: string | null;
          id?: string;
          last_move?: Json | null;
          parent_game_id?: string | null;
          pgn?: string;
          rematch_offered_by?: string | null;
          result?: string | null;
          status?: string;
          turn?: string;
          updated_at?: string;
          white_player_id?: string | null;
          black_time_remaining?: number | null;
          white_time_remaining?: number | null;
          time_control?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_parent_game_id_fkey";
            columns: ["parent_game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      moves: {
        Row: {
          created_at: string;
          game_id: string | null;
          id: string;
          move: Json;
        };
        Insert: {
          created_at?: string;
          game_id?: string | null;
          id?: string;
          move: Json;
        };
        Update: {
          created_at?: string;
          game_id?: string | null;
          id?: string;
          move?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "moves_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      queue: {
        Row: {
          id: string;
          joined_at: string;
          preferences: Json | null;
          status: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          preferences?: Json | null;
          status?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          preferences?: Json | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      queue_notifications: {
        Row: {
          black_player_id: string | null;
          created_at: string;
          data: Json | null;
          game_id: string | null;
          id: string;
          type: string;
          white_player_id: string | null;
        };
        Insert: {
          black_player_id?: string | null;
          created_at?: string;
          data?: Json | null;
          game_id?: string | null;
          id?: string;
          type: string;
          white_player_id?: string | null;
        };
        Update: {
          black_player_id?: string | null;
          created_at?: string;
          data?: Json | null;
          game_id?: string | null;
          id?: string;
          type?: string;
          white_player_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "queue_notifications_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_short_id: {
        Args: { length?: number };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
