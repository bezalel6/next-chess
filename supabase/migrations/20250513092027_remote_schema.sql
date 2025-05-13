

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






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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


ALTER FUNCTION "public"."generate_short_id"("length" integer) OWNER TO "postgres";


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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


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
    )
    UPDATE queue
    SET status = 'matched'
    WHERE id IN (SELECT id FROM matched_players);
    
    -- Notify through the notification system could happen here
    -- or via a trigger on queue update
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."match_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "text" DEFAULT "public"."generate_short_id"() NOT NULL,
    "white_player_id" "uuid",
    "black_player_id" "uuid",
    "status" "text" NOT NULL,
    "result" "text",
    "current_fen" "text" NOT NULL,
    "pgn" "text" DEFAULT ''::"text" NOT NULL,
    "last_move" "jsonb",
    "turn" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "draw_offered_by" "text",
    "end_reason" "text",
    "rematch_offered_by" "text",
    "parent_game_id" "text",
    "banningPlayer" "text",
    CONSTRAINT "games_banningplayer_check" CHECK (("banningPlayer" = ANY (ARRAY['white'::"text", 'black'::"text"]))),
    CONSTRAINT "games_draw_offered_by_check" CHECK (("draw_offered_by" = ANY (ARRAY['white'::"text", 'black'::"text"]))),
    CONSTRAINT "games_end_reason_check" CHECK (("end_reason" = ANY (ARRAY['checkmate'::"text", 'resignation'::"text", 'draw_agreement'::"text", 'stalemate'::"text", 'insufficient_material'::"text", 'threefold_repetition'::"text", 'fifty_move_rule'::"text"]))),
    CONSTRAINT "games_rematch_offered_by_check" CHECK (("rematch_offered_by" = ANY (ARRAY['white'::"text", 'black'::"text"]))),
    CONSTRAINT "games_result_check" CHECK (("result" = ANY (ARRAY['white'::"text", 'black'::"text", 'draw'::"text"]))),
    CONSTRAINT "games_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'finished'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "games_turn_check" CHECK (("turn" = ANY (ARRAY['white'::"text", 'black'::"text"])))
);


ALTER TABLE "public"."games" OWNER TO "postgres";


COMMENT ON COLUMN "public"."games"."pgn" IS 'Portable Game Notation (PGN) for the chess game, storing the move history';



COMMENT ON COLUMN "public"."games"."draw_offered_by" IS 'The color of the player who offered a draw';



COMMENT ON COLUMN "public"."games"."end_reason" IS 'The reason the game ended (checkmate, resignation, etc.)';



COMMENT ON COLUMN "public"."games"."rematch_offered_by" IS 'The color of the player who offered a rematch';



COMMENT ON COLUMN "public"."games"."parent_game_id" IS 'The ID of the original game that led to this rematch';



COMMENT ON COLUMN "public"."games"."banningPlayer" IS 'The color of the player who is currently banning a move';



CREATE TABLE IF NOT EXISTS "public"."moves" (
    "id" "text" DEFAULT "public"."generate_short_id"(10) NOT NULL,
    "game_id" "text",
    "move" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."moves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."queue_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL,
    "game_id" "text",
    "white_player_id" "uuid",
    "black_player_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data" "jsonb"
);


ALTER TABLE "public"."queue_notifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."queue"
    ADD CONSTRAINT "queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."queue"
    ADD CONSTRAINT "queue_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_games_black_player" ON "public"."games" USING "btree" ("black_player_id");



CREATE INDEX "idx_games_parent_game_id" ON "public"."games" USING "btree" ("parent_game_id");



CREATE INDEX "idx_games_white_player" ON "public"."games" USING "btree" ("white_player_id");



CREATE INDEX "idx_moves_game_id" ON "public"."moves" USING "btree" ("game_id");



CREATE INDEX "queue_joined_at_idx" ON "public"."queue" USING "btree" ("joined_at");



CREATE INDEX "queue_notifications_game_id_idx" ON "public"."queue_notifications" USING "btree" ("game_id");



CREATE INDEX "queue_status_idx" ON "public"."queue" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "match_players_leave_trigger" AFTER DELETE OR UPDATE ON "public"."queue" FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();



CREATE OR REPLACE TRIGGER "match_players_trigger" AFTER INSERT ON "public"."queue" FOR EACH ROW EXECUTE FUNCTION "public"."match_players"();



CREATE OR REPLACE TRIGGER "update_games_updated_at" BEFORE UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_parent_game_id_fkey" FOREIGN KEY ("parent_game_id") REFERENCES "public"."games"("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue_notifications"
    ADD CONSTRAINT "queue_notifications_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queue"
    ADD CONSTRAINT "queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated", "anon", "service_role" WITH CHECK (true);



CREATE POLICY "Authenticator can do all operations on profiles" ON "public"."profiles" TO "authenticator" USING (true) WITH CHECK (true);



CREATE POLICY "Players can update their games on their turn" ON "public"."games" FOR UPDATE USING (((("auth"."uid"() = "white_player_id") AND ("turn" = 'white'::"text")) OR (("auth"."uid"() = "black_player_id") AND ("turn" = 'black'::"text"))));



CREATE POLICY "Players can view moves for their games" ON "public"."moves" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "moves"."game_id") AND (("auth"."uid"() = "games"."white_player_id") OR ("auth"."uid"() = "games"."black_player_id"))))));



CREATE POLICY "Players can view their own games" ON "public"."games" FOR SELECT USING ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Service role can do all operations on profiles" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can do everything" ON "public"."games" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can insert moves" ON "public"."moves" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can insert notifications" ON "public"."queue_notifications" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can add themselves to the queue" ON "public"."queue" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert games" ON "public"."games" FOR INSERT WITH CHECK ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Users can insert moves in their games" ON "public"."moves" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "moves"."game_id") AND (("games"."white_player_id" = "auth"."uid"()) OR ("games"."black_player_id" = "auth"."uid"()))))));



CREATE POLICY "Users can remove themselves from queue" ON "public"."queue" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own games" ON "public"."games" FOR UPDATE USING ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view moves in their games" ON "public"."moves" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "moves"."game_id") AND (("games"."white_player_id" = "auth"."uid"()) OR ("games"."black_player_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own games" ON "public"."games" FOR SELECT USING ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Users can view their own notifications" ON "public"."queue_notifications" FOR SELECT USING ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Users can view their own queue position" ON "public"."queue" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."queue_notifications" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_short_id"("length" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_players"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_players"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."moves" TO "anon";
GRANT ALL ON TABLE "public"."moves" TO "authenticated";
GRANT ALL ON TABLE "public"."moves" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "authenticator";



GRANT ALL ON TABLE "public"."queue" TO "anon";
GRANT ALL ON TABLE "public"."queue" TO "authenticated";
GRANT ALL ON TABLE "public"."queue" TO "service_role";



GRANT ALL ON TABLE "public"."queue_notifications" TO "anon";
GRANT ALL ON TABLE "public"."queue_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."queue_notifications" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;

--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



