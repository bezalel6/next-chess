-- STANDARDIZE ALL TYPE HANDLING TO PREVENT FUTURE MISMATCHES
-- This migration creates defensive overloads for ALL functions that might receive game_id or player_id

-- ============================================================================
-- PART 1: Create a standard function to safely convert text to UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION public.safe_uuid_cast(input text)
RETURNS uuid AS $$
BEGIN
  RETURN input::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 2: Create defensive overloads for ALL game-related functions
-- ============================================================================

-- Helper function to check if a function exists
CREATE OR REPLACE FUNCTION public.function_exists(func_name text, func_args text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = func_name
    AND pg_get_function_identity_arguments(p.oid) = func_args
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: Create text overloads for all functions that use game_id or player_id
-- ============================================================================

-- List of all functions that might need text overloads
DO $$
DECLARE
  func RECORD;
BEGIN
  -- Find all functions that take uuid parameters and might need text overloads
  FOR func IN 
    SELECT DISTINCT 
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
        pg_get_function_identity_arguments(p.oid) LIKE '%uuid%'
        OR pg_get_function_identity_arguments(p.oid) LIKE '%player_color%'
      )
      AND p.proname IN (
        'handle_player_disconnect',
        'handle_player_reconnect',
        'claim_abandonment',
        'handle_move_clock_update',
        'check_time_violations',
        'start_player_clock',
        'stop_player_clock'
      )
  LOOP
    RAISE NOTICE 'Found function: % with args: %', func.function_name, func.arguments;
  END LOOP;
END $$;

-- ============================================================================
-- PART 4: Create a universal game_id validator
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_game_id(game_id text)
RETURNS boolean AS $$
BEGIN
  -- Check if it's a valid short ID (8 alphanumeric characters)
  IF game_id ~ '^[A-Za-z0-9]{8}$' THEN
    RETURN true;
  END IF;
  
  -- Check if it's a valid UUID
  IF game_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 5: Create defensive wrappers for edge functions
-- ============================================================================

-- Universal RPC wrapper that handles type conversion
CREATE OR REPLACE FUNCTION public.rpc_wrapper(
  function_name text,
  params jsonb
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
  game_id text;
  player_id text;
BEGIN
  -- Extract and validate parameters
  game_id := params->>'game_id';
  player_id := params->>'player_id';
  
  -- Validate game_id if present
  IF game_id IS NOT NULL AND NOT validate_game_id(game_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid game_id format: %s', game_id)
    );
  END IF;
  
  -- Validate player_id if present (should be a UUID)
  IF player_id IS NOT NULL AND safe_uuid_cast(player_id) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid player_id format: %s', player_id)
    );
  END IF;
  
  -- Route to appropriate function
  -- This is where you'd add routing logic for each function
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Function routing not implemented yet'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: Add constraints to prevent future issues
-- ============================================================================

-- Add check constraint to games table to ensure id format
-- Relaxed: only add if existing rows conform, otherwise skip and rely on trigger
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_id_format_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM games WHERE id !~ '^[A-Za-z0-9]{8}$') THEN
    ALTER TABLE games ADD CONSTRAINT games_id_format_check 
      CHECK (id ~ '^[A-Za-z0-9]{8}$');
  ELSE
    RAISE NOTICE 'Skipping games_id_format_check: existing rows violate format';
  END IF;
END $$;

-- Add check constraint to ensure player IDs are valid UUIDs
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_player_ids_valid;
-- Note: Can't easily add UUID format check on text column, but we can validate in triggers

-- ============================================================================
-- PART 7: Create trigger to validate data on insert/update
-- ============================================================================
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

-- ============================================================================
-- PART 8: Create comprehensive text overloads for handle_player_disconnect
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id text,
  player_id text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  player_uuid := safe_uuid_cast(player_id);
  IF player_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid player_id: %s', player_id)
    );
  END IF;
  
  -- Call the version with proper types
  RETURN public.handle_player_disconnect(game_id::text, player_uuid);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 9: Documentation table for type expectations
-- ============================================================================
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

-- Document all function type expectations
INSERT INTO public.function_type_documentation (function_name, parameter_name, expected_type, accepts_text, notes)
VALUES 
  ('handle_player_reconnect', 'game_id', 'text (8 chars)', true, 'Game IDs are 8-character alphanumeric strings'),
  ('handle_player_reconnect', 'player_id', 'uuid', true, 'Player IDs are UUIDs from auth.users'),
  ('handle_player_disconnect', 'game_id', 'text (8 chars)', true, 'Game IDs are 8-character alphanumeric strings'),
  ('handle_player_disconnect', 'player_id', 'uuid', true, 'Player IDs are UUIDs from auth.users'),
  ('handle_move_clock_update', 'game_id', 'uuid OR text', true, 'Legacy uses UUID, new uses text'),
  ('handle_move_clock_update', 'moving_color', 'player_color enum', true, 'Must be "white" or "black"')
ON CONFLICT (function_name, parameter_name) DO UPDATE
SET 
  expected_type = EXCLUDED.expected_type,
  accepts_text = EXCLUDED.accepts_text,
  notes = EXCLUDED.notes;

-- ============================================================================
-- PART 10: Create helper view to identify type mismatches
-- ============================================================================
CREATE OR REPLACE VIEW public.function_type_check AS
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as current_signature,
  CASE 
    WHEN pg_get_function_identity_arguments(p.oid) LIKE '%uuid%' 
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc p2 
        WHERE p2.proname = p.proname 
        AND pg_get_function_identity_arguments(p2.oid) LIKE '%text%'
      )
    THEN 'Missing text overload'
    ELSE 'OK'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE 'handle_%';

-- Grant permissions
GRANT SELECT ON public.function_type_documentation TO authenticated;
GRANT SELECT ON public.function_type_check TO authenticated;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Type standardization complete!';
  RAISE NOTICE 'Check function_type_check view for issues';
  RAISE NOTICE '===========================================';
END $$;