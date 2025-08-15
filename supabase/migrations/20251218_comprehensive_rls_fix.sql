-- Comprehensive RLS fix for local development
-- This migration ensures all operations work properly with both authenticated users and service role

-- First, drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on our main tables
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('games', 'matchmaking', 'profiles', 'moves', 'event_log'))
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled on all tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Create a single permissive policy for service_role on each table
-- Service role should bypass all RLS
CREATE POLICY "service_role_all" ON public.games
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.matchmaking
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.profiles
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.moves
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.event_log
    TO service_role
    USING (true)
    WITH CHECK (true);

-- For authenticated users, create permissive policies for local development
-- GAMES table
CREATE POLICY "authenticated_select_games" ON public.games
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_games" ON public.games
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_games" ON public.games
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_games" ON public.games
    FOR DELETE TO authenticated
    USING (true);

-- MATCHMAKING table
CREATE POLICY "authenticated_select_matchmaking" ON public.matchmaking
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_matchmaking" ON public.matchmaking
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_matchmaking" ON public.matchmaking
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_matchmaking" ON public.matchmaking
    FOR DELETE TO authenticated
    USING (true);

-- PROFILES table
CREATE POLICY "authenticated_select_profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_profiles" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_profiles" ON public.profiles
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_profiles" ON public.profiles
    FOR DELETE TO authenticated
    USING (true);

-- MOVES table
CREATE POLICY "authenticated_select_moves" ON public.moves
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_moves" ON public.moves
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_moves" ON public.moves
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_moves" ON public.moves
    FOR DELETE TO authenticated
    USING (true);

-- EVENT_LOG table
CREATE POLICY "authenticated_select_event_log" ON public.event_log
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_event_log" ON public.event_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- For anon role (unauthenticated users), allow SELECT only
CREATE POLICY "anon_select_games" ON public.games
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "anon_select_matchmaking" ON public.matchmaking
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "anon_select_profiles" ON public.profiles
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "anon_select_moves" ON public.moves
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "anon_select_event_log" ON public.event_log
    FOR SELECT TO anon
    USING (true);

-- Grant necessary permissions at the role level
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Ensure future tables also get proper permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;