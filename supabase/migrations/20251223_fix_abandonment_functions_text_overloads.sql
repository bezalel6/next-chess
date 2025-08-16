-- Fix abandonment-related functions to use text game_id and provide text overloads
-- Safe to run multiple times; uses DROP IF EXISTS before recreation

-- ============================================================================
-- PART 1: Drop conflicting uuid-based versions (if any)
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_player_disconnect(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_player_reconnect(uuid, uuid);
DROP FUNCTION IF EXISTS public.claim_abandonment(uuid, uuid, text);

-- ============================================================================
-- PART 2: Utilities (idempotent)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.safe_uuid_cast(input text)
RETURNS uuid AS $$
BEGIN
  RETURN input::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Simple validator for short game IDs and legacy UUIDs
CREATE OR REPLACE FUNCTION public.validate_game_id(game_id text)
RETURNS boolean AS $$
BEGIN
  IF game_id ~ '^[A-Za-z0-9]{8}$' THEN
    RETURN true;
  END IF;
  IF game_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 3: Reconnect functions (text game_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  current_time timestamptz := now();
BEGIN
  IF NOT validate_game_id(game_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game_id format');
  END IF;

  SELECT * INTO game_record
  FROM public.games g
  WHERE g.id = game_id
    AND g.status = 'active'
    AND (g.white_player_id = player_id OR g.black_player_id = player_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or player not in game');
  END IF;

  -- If disconnect tracking was in progress, finalize it
  IF game_record.disconnect_started_at IS NOT NULL THEN
    UPDATE public.games
    SET 
      total_disconnect_seconds = COALESCE(total_disconnect_seconds, 0) + EXTRACT(EPOCH FROM (current_time - game_record.disconnect_started_at))::int,
      disconnect_started_at = NULL,
      claim_available_at = NULL,
      last_connection_type = 'online',
      updated_at = current_time
    WHERE id = game_id;
  ELSE
    UPDATE public.games
    SET last_connection_type = 'online', updated_at = current_time
    WHERE id = game_id;
  END IF;

  -- Touch profile last_online
  UPDATE public.profiles SET last_online = current_time WHERE id = player_id;

  RETURN jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'reconnectedAt', current_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- text/text overload for edge functions
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,
  player_id text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  player_uuid := safe_uuid_cast(player_id);
  IF player_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid player_id format');
  END IF;
  RETURN public.handle_player_reconnect(game_id, player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 4: Disconnect functions (text game_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id text,
  player_id uuid,
  disconnect_type text DEFAULT 'disconnect'  -- 'rage_quit' | 'disconnect'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  timeout_seconds integer;
  current_time timestamptz := now();
BEGIN
  IF NOT validate_game_id(game_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game_id format');
  END IF;

  SELECT * INTO game_record FROM public.games WHERE id = game_id AND status = 'active';
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Only meaningful to track for the side to move; otherwise just ignore timers
  IF NOT (
    (game_record.turn = 'white' AND game_record.white_player_id = player_id) OR
    (game_record.turn = 'black' AND game_record.black_player_id = player_id)
  ) THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'reason', 'not_players_turn');
  END IF;

  -- Determine timeout budget
  IF disconnect_type = 'rage_quit' THEN
    timeout_seconds := 10; -- strict budget for rage quit
  ELSE
    timeout_seconds := GREATEST(
      COALESCE(game_record.disconnect_allowance_seconds, 120) - COALESCE(game_record.total_disconnect_seconds, 0),
      10
    );
  END IF;

  UPDATE public.games
  SET 
    disconnect_started_at = current_time,
    last_connection_type = disconnect_type,
    claim_available_at = current_time + make_interval(secs => timeout_seconds),
    updated_at = current_time
  WHERE id = game_id;

  RETURN jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'disconnectType', disconnect_type,
    'timeout_seconds', timeout_seconds,
    'claim_available_at', current_time + make_interval(secs => timeout_seconds)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- text/text overload
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id text,
  player_id text,
  disconnect_type text DEFAULT 'disconnect'
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  player_uuid := safe_uuid_cast(player_id);
  IF player_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid player_id format');
  END IF;
  RETURN public.handle_player_disconnect(game_id, player_uuid, disconnect_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(text, text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 5: Claim abandonment (text game_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_abandonment(
  game_id text,
  claiming_player_id uuid,
  claim_type text  -- 'victory' | 'draw' | 'wait'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  is_opponent boolean;
  can_claim boolean;
  winner public.player_color;
BEGIN
  IF NOT validate_game_id(game_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game_id format');
  END IF;

  SELECT * INTO game_record FROM public.games WHERE id = game_id AND status = 'active';
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  is_opponent := (
    (game_record.white_player_id = claiming_player_id AND game_record.turn = 'black') OR
    (game_record.black_player_id = claiming_player_id AND game_record.turn = 'white')
  );
  IF NOT is_opponent THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only opponent can claim');
  END IF;

  can_claim := game_record.claim_available_at IS NOT NULL AND now() >= game_record.claim_available_at;
  IF NOT can_claim THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot claim yet', 'claim_available_at', game_record.claim_available_at);
  END IF;

  IF claim_type = 'wait' THEN
    UPDATE public.games
    SET claim_available_at = now() + interval '60 seconds', updated_at = now()
    WHERE id = game_id;
    RETURN jsonb_build_object('success', true, 'action', 'waited', 'new_claim_time', now() + interval '60 seconds');
  ELSIF claim_type = 'draw' THEN
    UPDATE public.games
    SET status = 'finished', result = 'draw', end_reason = 'timeout', updated_at = now()
    WHERE id = game_id;
    RETURN jsonb_build_object('success', true, 'action', 'draw_claimed');
  ELSIF claim_type = 'victory' THEN
    IF game_record.white_player_id = claiming_player_id THEN
      winner := 'white';
    ELSE
      winner := 'black';
    END IF;
    UPDATE public.games
    SET status = 'finished', result = winner, end_reason = 'timeout', updated_at = now()
    WHERE id = game_id;
    RETURN jsonb_build_object('success', true, 'action', 'victory_claimed', 'winner', winner);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid claim type');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- text/text overload
CREATE OR REPLACE FUNCTION public.claim_abandonment(
  game_id text,
  claiming_player_id text,
  claim_type text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  player_uuid := safe_uuid_cast(claiming_player_id);
  IF player_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid player_id format');
  END IF;
  RETURN public.claim_abandonment(game_id, player_uuid, claim_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_abandonment(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_abandonment(text, text, text) TO authenticated, service_role;

-- ============================================================================
-- PART 6: Monitoring view (idempotent)
-- ============================================================================
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
      ) THEN 'Missing text overload'
    WHEN pg_get_function_identity_arguments(p.oid) LIKE '%game_id uuid%'
      THEN 'game_id should be text, not uuid'
    ELSE 'OK'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'handle_%' OR p.proname LIKE 'claim_%');

GRANT SELECT ON public.function_type_check TO authenticated;

