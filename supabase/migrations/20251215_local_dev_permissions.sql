-- More permissive policies for local development
-- These policies allow authenticated users to perform operations directly on tables

-- Drop existing restrictive policies first (if they exist)
DROP POLICY IF EXISTS "games_insert_authenticated" ON "public"."games";
DROP POLICY IF EXISTS "games_update_authenticated" ON "public"."games";
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_update_authenticated" ON "public"."profiles";
DROP POLICY IF EXISTS "matchmaking_insert_authenticated" ON "public"."matchmaking";
DROP POLICY IF EXISTS "matchmaking_update_authenticated" ON "public"."matchmaking";
DROP POLICY IF EXISTS "matchmaking_delete_authenticated" ON "public"."matchmaking";
DROP POLICY IF EXISTS "moves_insert_authenticated" ON "public"."moves";
DROP POLICY IF EXISTS "event_log_insert_authenticated" ON "public"."event_log";

-- Games table - allow authenticated users to insert and update
CREATE POLICY "games_insert_authenticated" ON "public"."games" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "games_update_authenticated" ON "public"."games" 
  FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Profiles table - allow authenticated users to insert and update any profile
CREATE POLICY "profiles_insert_authenticated" ON "public"."profiles" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "profiles_update_authenticated" ON "public"."profiles" 
  FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Matchmaking table - allow authenticated users full access
CREATE POLICY "matchmaking_insert_authenticated" ON "public"."matchmaking" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "matchmaking_update_authenticated" ON "public"."matchmaking" 
  FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "matchmaking_delete_authenticated" ON "public"."matchmaking" 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Moves table - allow authenticated users to insert
CREATE POLICY "moves_insert_authenticated" ON "public"."moves" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Event log - allow authenticated users to insert
CREATE POLICY "event_log_insert_authenticated" ON "public"."event_log" 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);