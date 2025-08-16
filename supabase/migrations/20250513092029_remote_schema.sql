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

-- Simple utility function for timestamps - keeping this as it's very basic
CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Set table creation defaults
SET default_tablespace = '';
SET default_table_access_method = "heap";

-- Main table storing chess games
CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "text" NOT NULL, -- Will be filled by edge function
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

-- Event log table for tracking changes/operations
CREATE TABLE IF NOT EXISTS "public"."event_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL, 
    "entity_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary and unique keys
ALTER TABLE ONLY "public"."games" ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
ALTER TABLE ONLY "public"."matchmaking" ADD CONSTRAINT "matchmaking_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."matchmaking" ADD CONSTRAINT "matchmaking_player_id_key" UNIQUE ("player_id");
ALTER TABLE ONLY "public"."event_log" ADD CONSTRAINT "event_log_pkey" PRIMARY KEY ("id");

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
CREATE INDEX "idx_event_log_entity" ON "public"."event_log" USING "btree" ("entity_type", "entity_id");
CREATE INDEX "idx_event_log_event_type" ON "public"."event_log" USING "btree" ("event_type");
CREATE INDEX "idx_event_log_user_id" ON "public"."event_log" USING "btree" ("user_id");

-- Simple timestamp update triggers
CREATE TRIGGER "update_games_updated_at" BEFORE UPDATE ON "public"."games" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
CREATE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();

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
ALTER TABLE ONLY "public"."event_log"
    ADD CONSTRAINT "event_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Enable Row Level Security on all tables
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."matchmaking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_log" ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK ("auth"."uid"() = "id");
CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ("auth"."uid"() = "id");
CREATE POLICY "profiles_service_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);

-- RLS policies for games
CREATE POLICY "games_select_all" ON "public"."games" FOR SELECT USING (true);
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

-- RLS policies for event log
CREATE POLICY "event_log_select_own_events" ON "public"."event_log" FOR SELECT USING ("auth"."uid"() = "user_id");
CREATE POLICY "event_log_service_all" ON "public"."event_log" TO "service_role" USING (true) WITH CHECK (true);

-- Add tables to realtime publication
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."matchmaking";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."games";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."event_log";

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA "public" TO "postgres", "anon", "authenticated", "service_role";

-- Grant function permissions
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon", "authenticated", "service_role";

-- Grant table permissions
GRANT ALL ON TABLE "public"."games" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."matchmaking" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."event_log" TO "anon", "authenticated", "service_role";

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";

-- Finalize
RESET ALL;



