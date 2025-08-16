-- Lichess-style abandonment detection system
-- Implements two-tier timeout with cumulative disconnect tracking

-- First, drop all old abandonment-related columns if they exist
ALTER TABLE public.games
  DROP COLUMN IF EXISTS abandoned_by,
  DROP COLUMN IF EXISTS abandoned_at,
  DROP COLUMN IF EXISTS abandonment_warning_at;

-- Drop old abandonment-related functions if they exist
DROP FUNCTION IF EXISTS batch_check_abandonments();
DROP FUNCTION IF EXISTS get_abandonment_stats();
DROP FUNCTION IF EXISTS check_abandonment();
DROP FUNCTION IF EXISTS handle_abandonment();

-- Drop old indexes
DROP INDEX IF EXISTS idx_games_active_abandonment;

-- Add new columns for Lichess-style tracking
ALTER TABLE public.games
  ADD COLUMN disconnect_started_at timestamptz,
  ADD COLUMN total_disconnect_seconds integer DEFAULT 0,
  ADD COLUMN disconnect_allowance_seconds integer DEFAULT 120,
  ADD COLUMN claim_available_at timestamptz,
  ADD COLUMN last_connection_type text CHECK (last_connection_type IN ('online', 'rage_quit', 'disconnect'));

-- Create function to calculate disconnect allowance based on time control
CREATE OR REPLACE FUNCTION calculate_disconnect_allowance(
  time_control_minutes integer,
  is_rapid boolean DEFAULT false,
  is_classical boolean DEFAULT false
) RETURNS integer AS $$
DECLARE
  base_allowance integer := 120; -- 2 minutes base
  speed_multiplier numeric := 1;
BEGIN
  -- Scale by time control (like Lichess)
  IF is_classical THEN
    speed_multiplier := 10;
  ELSIF is_rapid THEN
    speed_multiplier := 4;
  ELSIF time_control_minutes <= 3 THEN
    speed_multiplier := 1; -- Bullet
  ELSE
    speed_multiplier := 2; -- Blitz
  END IF;
  
  RETURN FLOOR(base_allowance * speed_multiplier);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to handle player disconnect
CREATE OR REPLACE FUNCTION handle_player_disconnect(
  game_id uuid,
  player_id uuid,
  disconnect_type text -- 'rage_quit' or 'disconnect'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  is_current_player boolean;
  timeout_seconds integer;
  result jsonb;
BEGIN
  -- Get game details
  SELECT * INTO game_record FROM public.games WHERE id = game_id;
  
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;
  
  -- Check if it's the current player's turn
  is_current_player := (
    (game_record.turn = 'white' AND game_record.white_player_id = player_id) OR
    (game_record.turn = 'black' AND game_record.black_player_id = player_id)
  );
  
  IF NOT is_current_player THEN
    RETURN jsonb_build_object('error', 'Not player''s turn');
  END IF;
  
  -- Determine timeout based on disconnect type
  IF disconnect_type = 'rage_quit' THEN
    timeout_seconds := 10; -- 10 seconds for rage quit
  ELSE
    -- Use remaining disconnect allowance
    timeout_seconds := GREATEST(
      game_record.disconnect_allowance_seconds - game_record.total_disconnect_seconds,
      10 -- Minimum 10 seconds
    );
  END IF;
  
  -- Update game with disconnect info
  UPDATE public.games
  SET 
    disconnect_started_at = now(),
    last_connection_type = disconnect_type,
    claim_available_at = now() + (timeout_seconds || ' seconds')::interval
  WHERE id = game_id;
  
  result := jsonb_build_object(
    'success', true,
    'timeout_seconds', timeout_seconds,
    'claim_available_at', now() + (timeout_seconds || ' seconds')::interval,
    'disconnect_type', disconnect_type
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle player reconnect
CREATE OR REPLACE FUNCTION handle_player_reconnect(
  game_id uuid,
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  disconnect_duration integer;
BEGIN
  -- Get game details
  SELECT * INTO game_record FROM public.games WHERE id = game_id;
  
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;
  
  -- Calculate disconnect duration if applicable
  IF game_record.disconnect_started_at IS NOT NULL THEN
    disconnect_duration := EXTRACT(EPOCH FROM (now() - game_record.disconnect_started_at))::integer;
    
    -- Update total disconnect time
    UPDATE public.games
    SET 
      total_disconnect_seconds = COALESCE(total_disconnect_seconds, 0) + disconnect_duration,
      disconnect_started_at = NULL,
      claim_available_at = NULL,
      last_connection_type = 'online'
    WHERE id = game_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'disconnect_duration', disconnect_duration,
      'total_disconnect_seconds', game_record.total_disconnect_seconds + disconnect_duration,
      'remaining_allowance', game_record.disconnect_allowance_seconds - (game_record.total_disconnect_seconds + disconnect_duration)
    );
  END IF;
  
  -- Player wasn't disconnected
  UPDATE public.games
  SET last_connection_type = 'online'
  WHERE id = game_id;
  
  RETURN jsonb_build_object('success', true, 'was_disconnected', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim victory/draw on abandonment
CREATE OR REPLACE FUNCTION claim_abandonment(
  game_id uuid,
  claiming_player_id uuid,
  claim_type text -- 'victory', 'draw', 'wait'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  is_opponent boolean;
  can_claim boolean;
  winner player_color;
BEGIN
  -- Get game details
  SELECT * INTO game_record FROM public.games WHERE id = game_id;
  
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;
  
  -- Check if claiming player is the opponent
  is_opponent := (
    (game_record.white_player_id = claiming_player_id AND game_record.turn = 'black') OR
    (game_record.black_player_id = claiming_player_id AND game_record.turn = 'white')
  );
  
  IF NOT is_opponent THEN
    RETURN jsonb_build_object('error', 'Only opponent can claim');
  END IF;
  
  -- Check if claim is available
  can_claim := game_record.claim_available_at IS NOT NULL AND now() >= game_record.claim_available_at;
  
  IF NOT can_claim THEN
    RETURN jsonb_build_object('error', 'Cannot claim yet', 'claim_available_at', game_record.claim_available_at);
  END IF;
  
  -- Handle claim based on type
  IF claim_type = 'wait' THEN
    -- Give more time (reset claim timer)
    UPDATE public.games
    SET claim_available_at = now() + interval '60 seconds'
    WHERE id = game_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'waited', 'new_claim_time', now() + interval '60 seconds');
  
  ELSIF claim_type = 'draw' THEN
    -- Claim draw
    UPDATE public.games
    SET 
      status = 'completed',
      result = 'draw',
      end_reason = 'abandonment_draw',
      ended_at = now()
    WHERE id = game_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'draw_claimed');
  
  ELSIF claim_type = 'victory' THEN
    -- Determine winner
    IF game_record.white_player_id = claiming_player_id THEN
      winner := 'white';
    ELSE
      winner := 'black';
    END IF;
    
    -- Claim victory
    UPDATE public.games
    SET 
      status = 'completed',
      result = CASE 
        WHEN winner = 'white' THEN 'white_wins'
        ELSE 'black_wins'
      END,
      end_reason = 'abandonment',
      ended_at = now(),
      abandoned_by = game_record.turn
    WHERE id = game_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'victory_claimed', 'winner', winner);
  
  ELSE
    RETURN jsonb_build_object('error', 'Invalid claim type');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (robust across overloads)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_player_disconnect',
        'handle_player_reconnect',
        'claim_abandonment',
        'calculate_disconnect_allowance'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_disconnect_tracking 
ON public.games(disconnect_started_at, claim_available_at) 
WHERE status = 'active';

-- Add comments for documentation
COMMENT ON COLUMN public.games.disconnect_started_at IS 'When the current disconnect started';
COMMENT ON COLUMN public.games.total_disconnect_seconds IS 'Cumulative disconnect time for the game';
COMMENT ON COLUMN public.games.disconnect_allowance_seconds IS 'Total allowed disconnect time based on time control';
COMMENT ON COLUMN public.games.claim_available_at IS 'When opponent can claim victory/draw';
COMMENT ON COLUMN public.games.last_connection_type IS 'Type of last connection event: online, rage_quit, or disconnect';