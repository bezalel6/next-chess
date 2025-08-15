-- Fix RLS policies for games table and enable anonymous access for local development

-- Enable RLS on games table if not already enabled
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "games_select_authenticated" ON "public"."games";
DROP POLICY IF EXISTS "games_select_public" ON "public"."games";
DROP POLICY IF EXISTS "Users can view their own games" ON "public"."games";
DROP POLICY IF EXISTS "games_select_anonymous" ON "public"."games";

-- Create permissive SELECT policy for games table
-- Allow anyone (including anonymous users) to select games
CREATE POLICY "games_select_public" ON "public"."games" 
  FOR SELECT 
  USING (true);

-- Also ensure anonymous users can access games through authenticated policies
CREATE POLICY "games_select_anonymous" ON "public"."games"
  FOR SELECT
  TO anon
  USING (true);

-- Ensure profiles table also has permissive policies for anonymous/authenticated
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_select_anonymous" ON "public"."profiles";

CREATE POLICY "profiles_select_public" ON "public"."profiles"
  FOR SELECT
  USING (true);

CREATE POLICY "profiles_select_anonymous" ON "public"."profiles"
  FOR SELECT
  TO anon
  USING (true);

-- Ensure matchmaking table has proper policies
ALTER TABLE public.matchmaking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matchmaking_select_public" ON "public"."matchmaking";
DROP POLICY IF EXISTS "matchmaking_select_anonymous" ON "public"."matchmaking";

CREATE POLICY "matchmaking_select_public" ON "public"."matchmaking"
  FOR SELECT
  USING (true);

CREATE POLICY "matchmaking_select_anonymous" ON "public"."matchmaking"
  FOR SELECT
  TO anon
  USING (true);

-- Ensure moves table has proper policies
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moves_select_public" ON "public"."moves";
DROP POLICY IF EXISTS "moves_select_anonymous" ON "public"."moves";

CREATE POLICY "moves_select_public" ON "public"."moves"
  FOR SELECT
  USING (true);

CREATE POLICY "moves_select_anonymous" ON "public"."moves"
  FOR SELECT
  TO anon
  USING (true);