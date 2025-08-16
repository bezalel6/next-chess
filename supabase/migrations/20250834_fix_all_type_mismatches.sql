-- Fix all type mismatches comprehensively
-- This migration ensures all functions accept text game_id parameters

-- ============================================================================
-- PART 1: Create utility functions first
-- ============================================================================

-- Safe UUID cast function
CREATE OR REPLACE FUNCTION public.safe_uuid_cast(input text)
RETURNS uuid AS $$
BEGIN
  RETURN input::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Game ID validator
CREATE OR REPLACE FUNCTION public.validate_game_id(game_id text)
RETURNS boolean AS $$
BEGIN
  -- Check if it's a valid short ID (8 alphanumeric characters)
  IF game_id ~ '^[A-Za-z0-9]{8}$' THEN
    RETURN true;
  END IF;
  
  -- Check if it's a valid UUID (for legacy data)
  IF game_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 2: Fix handle_player_reconnect
-- ============================================================================

-- Drop all existing versions
DROP FUNCTION IF EXISTS public.handle_player_reconnect(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_player_reconnect(text, uuid);
DROP FUNCTION IF EXISTS public.handle_player_reconnect(text, text);

-- Create the correct text/uuid version
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,  
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  result jsonb;
  current_time timestamp with time zone := NOW();
BEGIN
  SELECT * INTO game_record
  FROM games g
  WHERE g.id = game_id
    AND g.status = 'active'
    AND (g.white_player_id = player_id OR g.black_player_id = player_id);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found or player not in game'
    );
  END IF;
  
  IF game_record.abandoned_by IS NOT NULL OR game_record.abandonment_warning_at IS NOT NULL THEN
    UPDATE games
    SET 
      abandoned_by = NULL,
      abandoned_at = NULL,
      abandonment_warning_at = NULL,
      updated_at = current_time
    WHERE id = game_id;
  END IF;
  
  UPDATE profiles
  SET last_online = current_time
  WHERE id = player_id;
  
  result := jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'reconnectedAt', current_time,
    'clearedAbandonment', (game_record.abandoned_by IS NOT NULL)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create text/text overload for edge functions
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,
  player_id text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  BEGIN
    player_uuid := player_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid player_id format'
    );
  END;
  
  RETURN public.handle_player_reconnect(game_id, player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 3: Fix handle_player_disconnect
-- ============================================================================

-- Drop existing versions
DROP FUNCTION IF EXISTS public.handle_player_disconnect(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_player_disconnect(text, uuid);
DROP FUNCTION IF EXISTS public.handle_player_disconnect(text, text);

-- Create text/uuid version
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id text,
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  result jsonb;
  current_time timestamp with time zone := NOW();
BEGIN
  SELECT * INTO game_record
  FROM games g
  WHERE g.id = game_id
    AND g.status = 'active'
    AND (g.white_player_id = player_id OR g.black_player_id = player_id);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found or player not in game'
    );
  END IF;
  
  IF game_record.white_player_id = player_id THEN
    UPDATE games
    SET white_last_disconnect = current_time
    WHERE id = game_id;
  ELSE
    UPDATE games
    SET black_last_disconnect = current_time
    WHERE id = game_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'disconnectedAt', current_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create text/text overload
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id text,
  player_id text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  BEGIN
    player_uuid := player_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid player_id format'
    );
  END;
  
  RETURN public.handle_player_disconnect(game_id, player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 4: Create monitoring infrastructure
-- ============================================================================

-- Create documentation table
CREATE TABLE IF NOT EXISTS public.function_type_documentation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  parameter_name text NOT NULL,
  expected_type text NOT NULL,
  accepts_text boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT NOW(),
  UNIQUE(function_name, parameter_name)
);

-- Document function type expectations
INSERT INTO public.function_type_documentation (function_name, parameter_name, expected_type, accepts_text, notes)
VALUES 
  ('handle_player_reconnect', 'game_id', 'text (8 chars)', true, 'Game IDs are 8-character alphanumeric strings'),
  ('handle_player_reconnect', 'player_id', 'uuid', true, 'Player IDs are UUIDs from auth.users'),
  ('handle_player_disconnect', 'game_id', 'text (8 chars)', true, 'Game IDs are 8-character alphanumeric strings'),
  ('handle_player_disconnect', 'player_id', 'uuid', true, 'Player IDs are UUIDs from auth.users')
ON CONFLICT (function_name, parameter_name) DO UPDATE
SET 
  expected_type = EXCLUDED.expected_type,
  accepts_text = EXCLUDED.accepts_text,
  notes = EXCLUDED.notes;

-- Create monitoring view
CREATE OR REPLACE VIEW public.function_type_check AS
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as current_signature,
  CASE 
    WHEN pg_get_function_identity_arguments(p.oid) LIKE '%uuid%uuid%' 
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc p2 
        JOIN pg_namespace n2 ON p2.pronamespace = n2.oid
        WHERE n2.nspname = 'public'
        AND p2.proname = p.proname 
        AND pg_get_function_identity_arguments(p2.oid) LIKE '%text%text%'
      )
    THEN 'Missing text overload'
    WHEN pg_get_function_identity_arguments(p.oid) LIKE '%game_id uuid%'
    THEN 'game_id should be text, not uuid'
    ELSE 'OK'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'handle_%' OR p.proname LIKE 'claim_%');

GRANT SELECT ON public.function_type_documentation TO authenticated;
GRANT SELECT ON public.function_type_check TO authenticated;

-- ============================================================================
-- PART 5: Add validation trigger
-- ============================================================================

-- Validation function for game data
CREATE OR REPLACE FUNCTION public.validate_game_data()
RETURNS trigger AS $$
BEGIN
  -- Validate game ID format
  IF NOT (NEW.id ~ '^[A-Za-z0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid game ID format: %. Must be 8 alphanumeric characters', NEW.id;
  END IF;
  
  -- Validate player IDs are valid UUIDs
  IF safe_uuid_cast(NEW.white_player_id::text) IS NULL THEN
    RAISE EXCEPTION 'Invalid white_player_id: %. Must be a valid UUID', NEW.white_player_id;
  END IF;
  
  IF safe_uuid_cast(NEW.black_player_id::text) IS NULL THEN
    RAISE EXCEPTION 'Invalid black_player_id: %. Must be a valid UUID', NEW.black_player_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_game_data_trigger ON games;
CREATE TRIGGER validate_game_data_trigger
  BEFORE INSERT OR UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_game_data();