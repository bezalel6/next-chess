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
-- These ENUMs restrict possible values and improve performance over text fields with CHECK constraints
CREATE TYPE public.game_status AS ENUM ('active', 'finished', 'abandoned');
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

-- Core matchmaking logic to pair waiting players
CREATE OR REPLACE FUNCTION "public"."match_players"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  waiting_count INTEGER;
  matched_user_id UUID;
BEGIN
  -- Log trigger invocation
  RAISE NOTICE '[MATCHMAKING] Trigger fired by % operation on queue table', TG_OP;
  
  -- Check how many players are waiting
  SELECT COUNT(*) INTO waiting_count FROM queue WHERE status = 'waiting';
  RAISE NOTICE '[MATCHMAKING] Found % players waiting in queue', waiting_count;
  
  -- Check if we have at least 2 players in the queue
  IF waiting_count >= 2 THEN
    RAISE NOTICE '[MATCHMAKING] Attempting to match players...';
    
    -- Get the two oldest players in the queue with row locking to prevent race conditions
    WITH matched_players AS (
      SELECT id, user_id 
      FROM queue 
      WHERE status = 'waiting' 
      ORDER BY joined_at ASC 
      LIMIT 2
      FOR UPDATE SKIP LOCKED -- Prevent race conditions when multiple players join simultaneously
    )
    UPDATE queue q
    SET status = 'matched'
    FROM (
      SELECT user_id 
      FROM queue 
      WHERE status = 'waiting' 
      ORDER BY joined_at ASC 
      LIMIT 2
      FOR UPDATE SKIP LOCKED
    ) AS mp
    WHERE q.user_id = mp.user_id;
    
    -- Log successful match - we'll query the matched players directly
    RAISE NOTICE '[MATCHMAKING] Successfully matched players';
    
    -- Now query the matched players for logging instead of using RETURNING
    FOR matched_user_id IN 
      SELECT user_id FROM queue WHERE status = 'matched' LIMIT 2
    LOOP
      RAISE NOTICE '[MATCHMAKING] Matched player: %', matched_user_id;
    END LOOP;
    
    RAISE NOTICE '[MATCHMAKING] Edge function will create game for these players';
  ELSE
    RAISE NOTICE '[MATCHMAKING] Not enough players to make a match (need at least 2)';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create a game and notifications in a single transaction
CREATE OR REPLACE FUNCTION "public"."create_game_with_notifications"(
  white_player UUID,
  black_player UUID,
  initial_fen TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_game_id TEXT;
  new_game JSONB;
BEGIN
  -- Create the game
  INSERT INTO public.games (
    white_player_id,
    black_player_id,
    status,
    current_fen,
    pgn,
    turn,
    "banningPlayer"
  ) VALUES (
    white_player,
    black_player,
    'active',
    initial_fen,
    '',
    'white',
    'black'
  ) RETURNING id INTO new_game_id;
  
  -- Create notification
  INSERT INTO public.queue_notifications (
    type,
    game_id,
    white_player_id,
    black_player_id,
    data
  ) VALUES (
    'match_found',
    new_game_id,
    white_player,
    black_player,
    jsonb_build_object(
      'matchTime', now()
    )
  );
  
  -- Remove players from queue
  DELETE FROM public.queue
  WHERE user_id IN (white_player, black_player);
  
  -- Get the full game data to return
  SELECT jsonb_build_object(
    'id', g.id,
    'white_player_id', g.white_player_id,
    'black_player_id', g.black_player_id,
    'status', g.status,
    'current_fen', g.current_fen,
    'turn', g.turn,
    'created_at', g.created_at
  ) INTO new_game
  FROM public.games g
  WHERE g.id = new_game_id;
  
  RETURN new_game;
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
    "status" public.game_status NOT NULL DEFAULT 'active'::public.game_status, -- Game state (active/finished/abandoned)
    "turn" public.player_color NOT NULL DEFAULT 'white'::public.player_color, -- Whose turn it is currently
    "current_fen" "text" NOT NULL, -- Forsyth-Edwards Notation of current board state
    "pgn" "text" DEFAULT ''::"text" NOT NULL, -- Portable Game Notation storing move history
    "result" public.game_result, -- Final game result (null if game not finished)
    "draw_offered_by" public.player_color, -- Which player offered a draw (null if none)
    "rematch_offered_by" public.player_color, -- Which player offered rematch (null if none)
    "end_reason" public.end_reason, -- Why the game ended (checkmate, resignation, etc.)
    "last_move" "jsonb", -- Last move in JSON format for easy client rendering
    "banningPlayer" public.player_color, -- For variants with move-banning (null if standard game)
    "parent_game_id" "text", -- For rematches, links to the original game
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add column comments 
COMMENT ON COLUMN "public"."games"."pgn" IS 'Portable Game Notation (PGN) for the chess game, storing the move history';
COMMENT ON COLUMN "public"."games"."draw_offered_by" IS 'The color of the player who offered a draw';
COMMENT ON COLUMN "public"."games"."end_reason" IS 'The reason the game ended (checkmate, resignation, etc.)';
COMMENT ON COLUMN "public"."games"."rematch_offered_by" IS 'The color of the player who offered a rematch';
COMMENT ON COLUMN "public"."games"."parent_game_id" IS 'The ID of the original game that led to this rematch';
COMMENT ON COLUMN "public"."games"."banningPlayer" IS 'The color of the player who is currently banning a move';
COMMENT ON COLUMN "public"."games"."current_fen" IS 'Forsyth-Edwards Notation representing the current board state';

-- Records every move made in a game for history and analysis
CREATE TABLE IF NOT EXISTS "public"."moves" (
    "id" "text" DEFAULT "public"."generate_short_id"(10) NOT NULL,
    "game_id" "text" NOT NULL, -- Foreign key to games table
    "move" "jsonb" NOT NULL, -- Stores move data in JSON format (from, to, piece, capture, etc.)
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL -- Timestamp of when move was made
);

-- User profile information
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL, -- Maps to auth.users.id
    "username" "text" NOT NULL, -- Public-facing name for the user
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Matchmaking queue for players waiting for a game
CREATE TABLE IF NOT EXISTS "public"."queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL, -- The user waiting for a match
    "status" public.queue_status DEFAULT 'waiting'::public.queue_status NOT NULL, -- Waiting or matched
    "preferences" "jsonb" DEFAULT '{}'::"jsonb", -- Game preferences (time control, variants, etc.)
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL -- When they joined the queue (for FIFO ordering)
);

-- Notification system for matchmaking and game events
CREATE TABLE IF NOT EXISTS "public"."queue_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL, -- Type of notification (match_found, game_started, etc.)
    "game_id" "text", -- Related game (if applicable)
    "white_player_id" "uuid", -- For game-related notifications
    "black_player_id" "uuid", -- For game-related notifications
    "data" "jsonb", -- Additional notification details in flexible JSON format
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary and unique keys
ALTER TABLE ONLY "public"."games" ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."moves" ADD CONSTRAINT "moves_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
ALTER TABLE ONLY "public"."queue_notifications" ADD CONSTRAINT "queue_notifications_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."queue" ADD CONSTRAINT "queue_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."queue" ADD CONSTRAINT "queue_user_id_key" UNIQUE ("user_id");

-- Indexes for performance optimization
CREATE INDEX "idx_games_black_player" ON "public"."games" USING "btree" ("black_player_id"); -- For finding games by black player
CREATE INDEX "idx_games_white_player" ON "public"."games" USING "btree" ("white_player_id"); -- For finding games by white player
CREATE INDEX "idx_games_parent_game_id" ON "public"."games" USING "btree" ("parent_game_id"); -- For finding rematches
CREATE INDEX "idx_games_status" ON "public"."games" USING "btree" ("status"); -- For finding active/finished games
CREATE INDEX "idx_moves_game_id" ON "public"."moves" USING "btree" ("game_id"); -- For retrieving all moves in a game
CREATE INDEX "idx_moves_created_at" ON "public"."moves" USING "btree" ("created_at"); -- For ordering moves chronologically
CREATE INDEX "idx_queue_joined_at" ON "public"."queue" USING "btree" ("joined_at"); -- For FIFO queue order
CREATE INDEX "idx_queue_status" ON "public"."queue" USING "btree" ("status"); -- For finding waiting/matched players
CREATE INDEX "idx_queue_notif_game_id" ON "public"."queue_notifications" USING "btree" ("game_id"); -- For game-related notifications

-- Automatic timestamp updates when games are modified
CREATE OR REPLACE TRIGGER "update_games_updated_at" BEFORE UPDATE ON "public"."games" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
-- Automatic timestamp updates when profiles are modified
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();
-- Try to match players when a new player joins the queue
CREATE OR REPLACE TRIGGER "match_players_trigger" AFTER INSERT ON "public"."queue" 
    FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();
-- Try to match remaining players when someone leaves or is matched
CREATE OR REPLACE TRIGGER "match_players_leave_trigger" AFTER DELETE OR UPDATE ON "public"."queue" 
    FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();
-- Automatically create profile when user signs up
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Foreign key constraints for referential integrity
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

-- Enable Row Level Security on all tables
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."moves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue_notifications" ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles - who can see and modify user profiles
CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true); -- Anyone can view profiles
CREATE POLICY "profiles_insert_auth" ON "public"."profiles" FOR INSERT TO "authenticated", "anon", "service_role" WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ("auth"."uid"() = "id"); -- Users can only update their own profile
CREATE POLICY "profiles_service_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "profiles_auth_all" ON "public"."profiles" TO "authenticator" USING (true) WITH CHECK (true);

-- RLS policies for games - who can see and modify games
CREATE POLICY "games_select_own" ON "public"."games" FOR SELECT USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id" -- Only players can see their games
);
CREATE POLICY "games_insert_own" ON "public"."games" FOR INSERT WITH CHECK (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id" -- Only can create games they play in
);
CREATE POLICY "games_update_own" ON "public"."games" FOR UPDATE USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id" -- Only players can update their games
);
CREATE POLICY "games_update_turn" ON "public"."games" FOR UPDATE USING (
  -- Only the player whose turn it is can make moves
  ("auth"."uid"() = "white_player_id" AND "turn" = 'white') OR 
  ("auth"."uid"() = "black_player_id" AND "turn" = 'black')
);
CREATE POLICY "games_service_all" ON "public"."games" USING ("auth"."jwt"() ->> 'role' = 'service_role'); -- Backend service can manage all games

-- RLS policies for moves - who can see and add moves
CREATE POLICY "moves_select_game_player" ON "public"."moves" FOR SELECT USING (
  EXISTS (
    -- Can only see moves for games they're playing in
    SELECT 1 FROM "public"."games"
    WHERE "games"."id" = "moves"."game_id" 
    AND ("auth"."uid"() = "games"."white_player_id" OR "auth"."uid"() = "games"."black_player_id")
  )
);
CREATE POLICY "moves_insert_game_player" ON "public"."moves" FOR INSERT WITH CHECK (
  EXISTS (
    -- Can only add moves to games they're playing in
    SELECT 1 FROM "public"."games"
    WHERE "games"."id" = "moves"."game_id" 
    AND ("auth"."uid"() = "games"."white_player_id" OR "auth"."uid"() = "games"."black_player_id")
  )
);
CREATE POLICY "moves_service_insert" ON "public"."moves" FOR INSERT WITH CHECK ("auth"."jwt"() ->> 'role' = 'service_role');

-- RLS policies for queue - who can see and manage queue entries
CREATE POLICY "queue_select_own" ON "public"."queue" FOR SELECT USING ("auth"."uid"() = "user_id"); -- Only see own queue entry
CREATE POLICY "queue_insert_own" ON "public"."queue" FOR INSERT WITH CHECK ("auth"."uid"() = "user_id"); -- Only join queue as self
CREATE POLICY "queue_delete_own" ON "public"."queue" FOR DELETE USING ("auth"."uid"() = "user_id"); -- Only remove self from queue

-- RLS policies for queue notifications - who can see notifications
CREATE POLICY "queue_notif_select_own" ON "public"."queue_notifications" FOR SELECT USING (
  "auth"."uid"() = "white_player_id" OR "auth"."uid"() = "black_player_id" -- Only see notifications for your games
);
CREATE POLICY "queue_notif_service_insert" ON "public"."queue_notifications" FOR INSERT WITH CHECK (
  "auth"."jwt"() ->> 'role' = 'service_role' -- Only backend services can create notifications
);

-- Grant appropriate permissions
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

-- Add tables to realtime publication
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."queue_notifications";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."queue";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."games";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."moves";

GRANT USAGE ON SCHEMA "public" TO "postgres", "anon", "authenticated", "service_role";

-- Grant function permissions
GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."match_players"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_user"("user_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."create_game_with_notifications"(UUID, UUID, TEXT) TO "anon", "authenticated", "service_role";

-- Grant table permissions
GRANT ALL ON TABLE "public"."games" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."moves" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role", "authenticator";
GRANT ALL ON TABLE "public"."queue" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."queue_notifications" TO "anon", "authenticated", "service_role";

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
GRANT ALL ON TABLES TO "postgres", "anon", "authenticated", "service_role";

-- Finalize
RESET ALL;

--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



