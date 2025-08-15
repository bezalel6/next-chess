-- Efficient batch abandonment detection system
-- This migration creates optimized functions for detecting and handling abandoned games

-- Create a more efficient batch function that checks all active games at once
CREATE OR REPLACE FUNCTION batch_check_abandonments()
RETURNS TABLE(
  game_id text,
  abandoned_by player_color,
  minutes_inactive numeric,
  action_taken text
) AS $$
DECLARE
  WARNING_THRESHOLD_MINUTES constant integer := 2;
  ABANDONMENT_THRESHOLD_MINUTES constant integer := 5;
  FORFEIT_THRESHOLD_MINUTES constant integer := 10;
BEGIN
  RETURN QUERY
  WITH active_games AS (
    -- Get all active games with current player info
    SELECT 
      g.id,
      g.turn,
      g.status,
      g.abandoned_by AS current_abandoned_by,
      g.abandoned_at,
      g.abandonment_warning_at,
      CASE 
        WHEN g.turn = 'white' THEN g.white_player_id
        ELSE g.black_player_id
      END as current_player_id,
      CASE 
        WHEN g.turn = 'white' THEN g.black_player_id
        ELSE g.white_player_id
      END as opponent_id
    FROM public.games g
    WHERE g.status = 'active'
  ),
  player_activity AS (
    -- Get last activity for all players in active games
    SELECT DISTINCT
      ag.id as game_id,
      ag.turn,
      ag.current_abandoned_by,
      ag.abandoned_at,
      ag.abandonment_warning_at,
      ag.current_player_id,
      ag.opponent_id,
      p.last_active,
      EXTRACT(EPOCH FROM (now() - COALESCE(p.last_active, now() - interval '1 hour'))) / 60 as mins_inactive
    FROM active_games ag
    JOIN public.profiles p ON p.id = ag.current_player_id
  ),
  actions AS (
    SELECT 
      pa.game_id,
      pa.turn,
      pa.mins_inactive,
      CASE
        -- Forfeit games that have been abandoned for too long
        WHEN pa.current_abandoned_by IS NOT NULL 
          AND pa.abandoned_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (now() - pa.abandoned_at)) / 60 >= FORFEIT_THRESHOLD_MINUTES
        THEN 'forfeit'
        
        -- Mark as abandoned if inactive for too long
        WHEN pa.mins_inactive >= ABANDONMENT_THRESHOLD_MINUTES 
          AND pa.current_abandoned_by IS NULL
        THEN 'abandon'
        
        -- Issue warning if approaching abandonment
        WHEN pa.mins_inactive >= WARNING_THRESHOLD_MINUTES 
          AND pa.mins_inactive < ABANDONMENT_THRESHOLD_MINUTES
          AND pa.abandonment_warning_at IS NULL
        THEN 'warn'
        
        -- Clear warnings if player becomes active
        WHEN pa.mins_inactive < WARNING_THRESHOLD_MINUTES
          AND (pa.abandonment_warning_at IS NOT NULL OR pa.current_abandoned_by IS NOT NULL)
        THEN 'clear'
        
        ELSE 'none'
      END as action_needed
    FROM player_activity pa
  )
  -- Execute actions and return results
  SELECT 
    a.game_id::text,
    a.turn as abandoned_by,
    a.mins_inactive::numeric,
    CASE
      WHEN a.action_needed = 'forfeit' THEN
        CASE 
          WHEN (
            UPDATE public.games
            SET 
              status = 'completed',
              result = CASE 
                WHEN a.turn = 'white' THEN 'black_wins'
                ELSE 'white_wins'
              END,
              end_reason = 'abandonment',
              ended_at = now()
            WHERE id = a.game_id
            RETURNING 1
          ) IS NOT NULL THEN 'forfeited'
          ELSE 'forfeit_failed'
        END
        
      WHEN a.action_needed = 'abandon' THEN
        CASE
          WHEN (
            UPDATE public.games
            SET 
              abandoned_by = a.turn,
              abandoned_at = now()
            WHERE id = a.game_id
            RETURNING 1
          ) IS NOT NULL THEN 'marked_abandoned'
          ELSE 'abandon_failed'
        END
        
      WHEN a.action_needed = 'warn' THEN
        CASE
          WHEN (
            UPDATE public.games
            SET abandonment_warning_at = now()
            WHERE id = a.game_id
            RETURNING 1
          ) IS NOT NULL THEN 'warned'
          ELSE 'warn_failed'
        END
        
      WHEN a.action_needed = 'clear' THEN
        CASE
          WHEN (
            UPDATE public.games
            SET 
              abandonment_warning_at = NULL,
              abandoned_by = NULL,
              abandoned_at = NULL
            WHERE id = a.game_id
            RETURNING 1
          ) IS NOT NULL THEN 'cleared'
          ELSE 'clear_failed'
        END
        
      ELSE 'no_action'
    END as action_taken
  FROM actions a
  WHERE a.action_needed != 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a statistics function to monitor abandonment patterns
CREATE OR REPLACE FUNCTION get_abandonment_stats()
RETURNS TABLE(
  total_active_games bigint,
  games_with_warnings bigint,
  games_abandoned bigint,
  avg_minutes_to_abandonment numeric,
  abandonments_last_hour bigint,
  abandonments_by_color jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as total_active_games,
    COUNT(*) FILTER (WHERE abandonment_warning_at IS NOT NULL AND abandoned_by IS NULL) as games_with_warnings,
    COUNT(*) FILTER (WHERE abandoned_by IS NOT NULL) as games_abandoned,
    AVG(EXTRACT(EPOCH FROM (abandoned_at - created_at)) / 60) FILTER (WHERE abandoned_at IS NOT NULL) as avg_minutes_to_abandonment,
    COUNT(*) FILTER (WHERE abandoned_at > now() - interval '1 hour') as abandonments_last_hour,
    jsonb_build_object(
      'white', COUNT(*) FILTER (WHERE abandoned_by = 'white'),
      'black', COUNT(*) FILTER (WHERE abandoned_by = 'black')
    ) as abandonments_by_color
  FROM public.games
  WHERE created_at > now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an index to improve performance of batch checks
CREATE INDEX IF NOT EXISTS idx_games_active_abandonment 
ON public.games(status, abandoned_by, abandonment_warning_at) 
WHERE status = 'active';

-- Create index on profiles.last_active for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_last_active 
ON public.profiles(last_active);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION batch_check_abandonments TO service_role;
GRANT EXECUTE ON FUNCTION get_abandonment_stats TO authenticated, service_role;

-- Add comment documentation
COMMENT ON FUNCTION batch_check_abandonments IS 'Efficiently checks all active games for abandonment in a single query, returns actions taken';
COMMENT ON FUNCTION get_abandonment_stats IS 'Returns statistics about game abandonments for monitoring';