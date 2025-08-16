-- Fix updated_at assignments to use timestamptz rather than timetz in core RPCs
-- Recreate functions with current_ts timestamptz := now()

-- ==============================
-- handle_player_reconnect(uuid, uuid)
-- ==============================
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id uuid,
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  current_ts timestamptz := now();
BEGIN
  SELECT * INTO game_record
  FROM public.games g
  WHERE g.id = game_id
    AND g.status = 'active'
    AND (g.white_player_id = player_id OR g.black_player_id = player_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or player not in game');
  END IF;

  IF game_record.disconnect_started_at IS NOT NULL THEN
    UPDATE public.games
      SET total_disconnect_seconds = COALESCE(total_disconnect_seconds, 0) + EXTRACT(EPOCH FROM (current_ts - game_record.disconnect_started_at))::int,
          disconnect_started_at = NULL,
          claim_available_at = NULL,
          last_connection_type = 'online',
          updated_at = current_ts
      WHERE id = game_id;
  ELSE
    UPDATE public.games
      SET last_connection_type = 'online',
          updated_at = current_ts
      WHERE id = game_id;
  END IF;

  UPDATE public.profiles
    SET last_online = current_ts
    WHERE id = player_id;

  RETURN jsonb_build_object('success', true, 'gameId', game_id, 'playerId', player_id, 'reconnectedAt', current_ts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(uuid, uuid) TO authenticated, service_role;

-- ==============================
-- handle_player_disconnect(uuid, uuid, text)
-- ==============================
CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id uuid,
  player_id uuid,
  disconnect_type text DEFAULT 'disconnect'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  timeout_seconds integer;
  current_ts timestamptz := now();
BEGIN
  SELECT * INTO game_record FROM public.games WHERE id = game_id AND status = 'active';
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  IF NOT ((game_record.turn = 'white' AND game_record.white_player_id = player_id)
       OR  (game_record.turn = 'black' AND game_record.black_player_id = player_id)) THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'reason', 'not_players_turn');
  END IF;

  IF disconnect_type = 'rage_quit' THEN
    timeout_seconds := 10;
  ELSE
    timeout_seconds := GREATEST(
      COALESCE(game_record.disconnect_allowance_seconds, 120) - COALESCE(game_record.total_disconnect_seconds, 0),
      10
    );
  END IF;

  UPDATE public.games
    SET disconnect_started_at = current_ts,
        last_connection_type = disconnect_type,
        claim_available_at = current_ts + make_interval(secs => timeout_seconds),
        updated_at = current_ts
    WHERE id = game_id;

  RETURN jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'disconnectType', disconnect_type,
    'timeout_seconds', timeout_seconds,
    'claim_available_at', current_ts + make_interval(secs => timeout_seconds)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(uuid, uuid, text) TO authenticated, service_role;

