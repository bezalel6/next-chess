-- Comprehensive fix for anonymous user permissions in local development
-- This ensures the anon role can access all necessary tables

-- First, grant necessary permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Specifically grant permissions on our main tables
GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.matchmaking TO anon;
GRANT SELECT ON public.moves TO anon;
GRANT SELECT ON public.event_log TO anon;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Now ensure RLS policies work for anon role
-- Games table - ensure anon can select
DROP POLICY IF EXISTS "anon_select_games" ON public.games;
CREATE POLICY "anon_select_games" ON public.games
  FOR SELECT
  TO anon
  USING (true);

-- Profiles table - ensure anon can select
DROP POLICY IF EXISTS "anon_select_profiles" ON public.profiles;
CREATE POLICY "anon_select_profiles" ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

-- Matchmaking table - ensure anon can select
DROP POLICY IF EXISTS "anon_select_matchmaking" ON public.matchmaking;
CREATE POLICY "anon_select_matchmaking" ON public.matchmaking
  FOR SELECT
  TO anon
  USING (true);

-- Moves table - ensure anon can select
DROP POLICY IF EXISTS "anon_select_moves" ON public.moves;
CREATE POLICY "anon_select_moves" ON public.moves
  FOR SELECT
  TO anon
  USING (true);

-- Event log table - ensure anon can select
DROP POLICY IF EXISTS "anon_select_event_log" ON public.event_log;
CREATE POLICY "anon_select_event_log" ON public.event_log
  FOR SELECT
  TO anon
  USING (true);

-- Also ensure authenticated users can do everything (for local dev)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant execute on all functions in public schema to anon
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;