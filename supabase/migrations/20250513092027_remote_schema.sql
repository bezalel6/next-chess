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

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE TYPE public.game_status AS ENUM ('active', 'finished', 'abandoned');
CREATE TYPE public.game_result AS ENUM ('white', 'black', 'draw');
CREATE TYPE public.player_color AS ENUM ('white', 'black');
CREATE TYPE public.end_reason AS ENUM ('checkmate', 'resignation', 'draw_agreement', 'stalemate', 
                                      'insufficient_material', 'threefold_repetition', 'fifty_move_rule');
CREATE TYPE public.queue_status AS ENUM ('waiting', 'matched');

CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."generate_short_id"("length" integer DEFAULT 8) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Extract username from user metadata if available, otherwise use a guest prefix
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

CREATE OR REPLACE FUNCTION "public"."match_players"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if we have at least 2 players in the queue
  IF (SELECT COUNT(*) FROM queue WHERE status = 'waiting') >= 2 THEN
    -- Get the two oldest players in the queue
    WITH matched_players AS (
      SELECT id, user_id 
      FROM queue 
      WHERE status = 'waiting' 
      ORDER BY joined_at ASC 
      LIMIT 2
      FOR UPDATE SKIP LOCKED -- Add locking to prevent race conditions
    )
    UPDATE queue
    SET status = 'matched'
    WHERE id IN (SELECT id FROM matched_players);
  END IF;
  RETURN NEW;
END;
$$;

SET default_tablespace = '';
SET default_table_access_method = "heap";

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
    "banningPlayer" public.player_color,
    "parent_game_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON COLUMN "public"."games"."pgn" IS 'Portable Game Notation (PGN) for the chess game, storing the move history';
COMMENT ON COLUMN "public"."games"."draw_offered_by" IS 'The color of the player who offered a draw';
COMMENT ON COLUMN "public"."games"."end_reason" IS 'The reason the game ended (checkmate, resignation, etc.)';
COMMENT ON COLUMN "public"."games"."rematch_offered_by" IS 'The color of the player who offered a rematch';
COMMENT ON COLUMN "public"."games"."parent_game_id" IS 'The ID of the original game that led to this rematch';
COMMENT ON COLUMN "public"."games"."banningPlayer" IS 'The color of the player who is currently banning a move';

CREATE TABLE IF NOT EXISTS "public"."moves" (
    "id" "text" DEFAULT "public"."generate_short_id"(10) NOT NULL,
    "game_id" "text" NOT NULL,
    "move" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" public.queue_status DEFAULT 'waiting'::public.queue_status NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."queue_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL,
    "game_id" "text",
    "white_player_id" "uuid",
    "black_player_id" "uuid",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."games" ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."moves" ADD CONSTRAINT "moves_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
ALTER TABLE ONLY "public"."queue_notifications" ADD CONSTRAINT "queue_notifications_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."queue" ADD CONSTRAINT "queue_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."queue" ADD CONSTRAINT "queue_user_id_key" UNIQUE ("user_id");

CREATE INDEX "idx_games_black_player" ON "public"."games" USING "btree" ("black_player_id");
CREATE INDEX "idx_games_white_player" ON "public"."games" USING "btree" ("white_player_id");
CREATE INDEX "idx_games_parent_game_id" ON "public"."games" USING "btree" ("parent_game_id");
CREATE INDEX "idx_games_status" ON "public"."games" USING "btree" ("status");
CREATE INDEX "idx_moves_game_id" ON "public"."moves" USING "btree" ("game_id");
CREATE INDEX "idx_moves_created_at" ON "public"."moves" USING "btree" ("created_at");
CREATE INDEX "idx_queue_joined_at" ON "public"."queue" USING "btree" ("joined_at");
CREATE INDEX "idx_queue_status" ON "public"."queue" USING "btree" ("status");
CREATE INDEX "idx_queue_notif_game_id" ON "public"."queue_notifications" USING "btree" ("game_id");

CREATE OR REPLACE TRIGGER "update_games_updated_at" BEFORE UPDATE ON "public"."games" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
CREATE OR REPLACE TRIGGER "match_players_trigger" AFTER INSERT ON "public"."queue" 
    FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();
CREATE OR REPLACE TRIGGER "match_players_leave_trigger" AFTER DELETE OR UPDATE ON "public"."queue" 
    FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_parent_game_id_fkey" FOREIGN KEY ("parent_game_id") REFERENCES "public"."games"("id");
ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."queue"
    ADD CONSTRAINT "queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."moves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue_notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true);
CREATE POLICY "profiles_insert_auth" ON "public"."profiles" FOR INSERT TO "authenticated", "anon", "service_role" WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ("auth"."uid"() = "id");
CREATE POLICY "profiles_service_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "profiles_auth_all" ON "public"."profiles" TO "authenticator" USING (true) WITH CHECK (true);

CREATE POLICY "games_select_own" ON "public"."games" FOR SELECT USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id"
);
CREATE POLICY "games_insert_own" ON "public"."games" FOR INSERT WITH CHECK (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id"
);
CREATE POLICY "games_update_own" ON "public"."games" FOR UPDATE USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id"
);
CREATE POLICY "games_update_turn" ON "public"."games" FOR UPDATE USING (
  ("auth"."uid"() = "white_player_id" AND "turn" = 'white') OR 
  ("auth"."uid"() = "black_player_id" AND "turn" = 'black')
);
CREATE POLICY "games_service_all" ON "public"."games" USING ("auth"."jwt"() ->> 'role' = 'service_role');

CREATE POLICY "moves_select_game_player" ON "public"."moves" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "public"."games"
    WHERE "games"."id" = "moves"."game_id" 
    AND ("auth"."uid"() = "games"."white_player_id" OR "auth"."uid"() = "games"."black_player_id")
  )
);
CREATE POLICY "moves_insert_game_player" ON "public"."moves" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."games"
    WHERE "games"."id" = "moves"."game_id" 
    AND ("auth"."uid"() = "games"."white_player_id" OR "auth"."uid"() = "games"."black_player_id")
  )
);
CREATE POLICY "moves_service_insert" ON "public"."moves" FOR INSERT WITH CHECK ("auth"."jwt"() ->> 'role' = 'service_role');

CREATE POLICY "queue_select_own" ON "public"."queue" FOR SELECT USING ("auth"."uid"() = "user_id");
CREATE POLICY "queue_insert_own" ON "public"."queue" FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");
CREATE POLICY "queue_delete_own" ON "public"."queue" FOR DELETE USING ("auth"."uid"() = "user_id");

CREATE POLICY "queue_notif_select_own" ON "public"."queue_notifications" FOR SELECT USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id"
);
CREATE POLICY "queue_notif_service_insert" ON "public"."queue_notifications" FOR INSERT WITH CHECK (
  "auth"."jwt"() ->> 'role' = 'service_role'
);

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres", "anon", "authenticated", "service_role";

GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."match_players"() TO "anon", "authenticated", "service_role";

GRANT ALL ON TABLE "public"."games" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."moves" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role", "authenticator";
GRANT ALL ON TABLE "public"."queue" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."queue_notifications" TO "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";

RESET ALL;

--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



