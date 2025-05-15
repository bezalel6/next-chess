-- Use single configuration block for performance
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Create extensions in a consolidated block
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Create custom types for better data integrity
CREATE TYPE public.game_status AS ENUM ('active', 'finished');
CREATE TYPE public.game_result AS ENUM ('white', 'black', 'draw');
CREATE TYPE public.player_color AS ENUM ('white', 'black');
CREATE TYPE public.end_reason AS ENUM ('checkmate', 'resignation', 'draw_agreement', 'stalemate', 
                                      'insufficient_material', 'threefold_repetition', 'fifty_move_rule');
CREATE TYPE public.queue_status AS ENUM ('waiting', 'matched');

-- Automatically updates the updated_at timestamp when a record is modified
CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Set the updated_at column to the current timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Generates random short IDs for user-friendly game/move identifiers
CREATE OR REPLACE FUNCTION "public"."generate_short_id"("length" integer DEFAULT 8) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  -- Loop to build a random string of the specified length
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to check if a user exists in auth.users table
CREATE OR REPLACE FUNCTION "public"."get_user"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = "public", "auth", "pg_temp"
    AS $$
DECLARE
  user_exists boolean;
BEGIN
  -- Check if the user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = user_id
  ) INTO user_exists;
  
  RETURN user_exists;
END;
$$;

-- Triggered when a new user signs up to create their profile
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Extract username from user metadata if available, otherwise generate a random one
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'username')::TEXT,
      CONCAT('user_', SUBSTRING(gen_random_uuid()::TEXT, 1, 8))
    )
  );
  RETURN NEW;
END;
$$;

-- Simple function to match players in queue
CREATE OR REPLACE FUNCTION "public"."match_players"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  player1_id UUID;
  player2_id UUID;
  new_game_id TEXT;
BEGIN
  -- Find the two players who have been waiting the longest
  WITH waiting_players AS (
    SELECT player_id FROM matchmaking 
    WHERE status = 'waiting'
    ORDER BY joined_at ASC
    LIMIT 2
    FOR UPDATE SKIP LOCKED
  )
  SELECT array_agg(player_id) INTO STRICT player1_id, player2_id
  FROM waiting_players;
  
  -- If we found two players, create a game for them
  IF player1_id IS NOT NULL AND player2_id IS NOT NULL THEN
    -- Create the game
    INSERT INTO public.games (
      white_player_id,
      black_player_id,
      status,
      current_fen,
      pgn,
      turn,
      banning_player
    ) VALUES (
      player1_id,
      player2_id,
      'active',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      '',
      'white',
      'black'
    ) RETURNING id INTO new_game_id;
    
    -- Update the matchmaking entries
    UPDATE matchmaking
    SET status = 'matched', game_id = new_game_id
    WHERE player_id IN (player1_id, player2_id);
  END IF;
END;
$$;

-- Function to notify game updates to players
CREATE OR REPLACE FUNCTION "public"."notify_game_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Notify when a game is updated
  PERFORM pg_notify(
    'game_update',
    json_build_object(
      'game_id', NEW.id,
      'white_player_id', NEW.white_player_id,
      'black_player_id', NEW.black_player_id,
      'status', NEW.status,
      'turn', NEW.turn
    )::text
  );
  RETURN NEW;
END;
$$;

-- Set table creation defaults
SET default_tablespace = '';
SET default_table_access_method = "heap";

-- Main table storing chess games
CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "text" DEFAULT "public"."generate_short_id"() NOT NULL,
    "white_player_id" "uuid" NOT NULL, 
    "black_player_id" "uuid" NOT NULL,
    "status" public.game_status NOT NULL DEFAULT 'active'::public.game_status,
    "turn" public.player_color NOT NULL DEFAULT 'white'::public.player_color,
    "current_fen" "text" NOT NULL,
    "pgn" "text" DEFAULT ''::"text" NOT NULL,
    "result" public.game_result,
    "draw_offered_by" public.player_color,
    "rematch_offered_by" public.player_color,
    "end_reason" public.end_reason,
    "last_move" "jsonb",
    "banning_player" public.player_color,
    "parent_game_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- User profile information
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Simplified matchmaking table
CREATE TABLE IF NOT EXISTS "public"."matchmaking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "status" public.queue_status DEFAULT 'waiting'::public.queue_status NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "game_id" "text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary and unique keys
ALTER TABLE ONLY "public"."games" ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
ALTER TABLE ONLY "public"."matchmaking" ADD CONSTRAINT "matchmaking_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."matchmaking" ADD CONSTRAINT "matchmaking_player_id_key" UNIQUE ("player_id");

-- Indexes for performance optimization
CREATE INDEX "idx_games_black_player" ON "public"."games" USING "btree" ("black_player_id");
CREATE INDEX "idx_games_white_player" ON "public"."games" USING "btree" ("white_player_id");
CREATE INDEX "idx_games_parent_game_id" ON "public"."games" USING "btree" ("parent_game_id");
CREATE INDEX "idx_games_status" ON "public"."games" USING "btree" ("status");
CREATE INDEX "idx_games_active_players" ON "public"."games" USING "btree" ("white_player_id", "black_player_id") WHERE (status = 'active'::public.game_status);
CREATE INDEX "idx_matchmaking_joined_at" ON "public"."matchmaking" USING "btree" ("joined_at");
CREATE INDEX "idx_matchmaking_status" ON "public"."matchmaking" USING "btree" ("status");
CREATE INDEX "idx_matchmaking_player_id" ON "public"."matchmaking" USING "btree" ("player_id");
CREATE INDEX "idx_matchmaking_game_id" ON "public"."matchmaking" USING "btree" ("game_id");

-- Automatic timestamp updates when records are modified
CREATE TRIGGER "update_games_updated_at" BEFORE UPDATE ON "public"."games" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
CREATE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();

-- Try to match players when queue changes
CREATE TRIGGER "try_match_players" AFTER INSERT OR UPDATE ON "public"."matchmaking" 
    FOR EACH ROW WHEN (NEW.status = 'waiting'::public.queue_status) 
    EXECUTE FUNCTION "public"."match_players"();

-- Automatically create profile when user signs up
CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Notify game updates
CREATE TRIGGER "notify_game_update" AFTER UPDATE ON "public"."games" 
    FOR EACH ROW EXECUTE FUNCTION "public"."notify_game_change"();

-- Foreign key constraints for referential integrity
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_parent_game_id_fkey" FOREIGN KEY ("parent_game_id") REFERENCES "public"."games"("id");
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."matchmaking"
    ADD CONSTRAINT "matchmaking_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."matchmaking"
    ADD CONSTRAINT "matchmaking_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;

-- Enable Row Level Security on all tables
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."matchmaking" ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ("auth"."uid"() = "id");
CREATE POLICY "profiles_service_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);

-- RLS policies for games
CREATE POLICY "games_select_player" ON "public"."games" FOR SELECT USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id"
);
CREATE POLICY "games_service_all" ON "public"."games" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "games_update_player" ON "public"."games" FOR UPDATE USING (
  ("status" = 'active') AND 
  ("auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id")
);

-- RLS policies for matchmaking
CREATE POLICY "matchmaking_select_own" ON "public"."matchmaking" FOR SELECT USING ("auth"."uid"() = "player_id");
CREATE POLICY "matchmaking_insert_own" ON "public"."matchmaking" FOR INSERT WITH CHECK ("auth"."uid"() = "player_id");
CREATE POLICY "matchmaking_update_own" ON "public"."matchmaking" FOR UPDATE USING ("auth"."uid"() = "player_id");
CREATE POLICY "matchmaking_delete_own" ON "public"."matchmaking" FOR DELETE USING ("auth"."uid"() = "player_id");
CREATE POLICY "matchmaking_service_all" ON "public"."matchmaking" TO "service_role" USING (true) WITH CHECK (true);

-- Add tables to realtime publication
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."matchmaking";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."games";

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA "public" TO "postgres", "anon", "authenticated", "service_role";

-- Grant function permissions
GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."match_players"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_user"("user_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."notify_game_change"() TO "anon", "authenticated", "service_role";

-- Grant table permissions
GRANT ALL ON TABLE "public"."games" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."matchmaking" TO "anon", "authenticated", "service_role";

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";

-- Finalize
RESET ALL;

-- Ensure auth user creation trigger is in place
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



