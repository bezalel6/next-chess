-- Fix handle_player_reconnect to accept text game_id
-- The games table uses text IDs (like "Hqz08ubN") not UUIDs

-- First, create a text overload that handles the text game_id
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,  -- Changed from uuid to text
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  result jsonb;
  current_time timestamp with time zone := NOW();
BEGIN
  -- Get the game record (games.id is text)
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
  
  -- Clear abandonment warnings if player is reconnecting
  IF game_record.abandoned_by IS NOT NULL OR game_record.abandonment_warning_at IS NOT NULL THEN
    UPDATE games
    SET 
      abandoned_by = NULL,
      abandoned_at = NULL,
      abandonment_warning_at = NULL,
      updated_at = current_time
    WHERE id = game_id;
  END IF;
  
  -- Update player's last activity
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, uuid) TO authenticated, service_role;

-- If you also need a version that accepts both as text (for edge functions)
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id text,
  player_id text
) RETURNS jsonb AS $$
DECLARE
  player_uuid uuid;
BEGIN
  -- Convert player_id to UUID
  BEGIN
    player_uuid := player_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid player_id format'
    );
  END;
  
  -- Call the main function
  RETURN public.handle_player_reconnect(game_id, player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for text version
GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(text, text) TO authenticated, service_role;

-- Verify the functions exist
SELECT 
  proname,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'handle_player_reconnect'
ORDER BY oid;