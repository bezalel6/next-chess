-- Fix the batch abandonment detection function with proper syntax
DROP FUNCTION IF EXISTS batch_check_abandonments();

CREATE OR REPLACE FUNCTION batch_check_abandonments()
RETURNS TABLE(
  game_id text,
  abandoned_by player_color,
  minutes_inactive numeric,
  action_taken text
) AS $$
DECLARE
  rec RECORD;
  WARNING_THRESHOLD_MINUTES constant integer := 2;
  ABANDONMENT_THRESHOLD_MINUTES constant integer := 5;
  FORFEIT_THRESHOLD_MINUTES constant integer := 10;
  action text;
BEGIN
  -- Loop through all active games and check for abandonment
  FOR rec IN
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
      p.last_active,
      EXTRACT(EPOCH FROM (now() - COALESCE(p.last_active, now() - interval '1 hour'))) / 60 as mins_inactive
    FROM public.games g
    LEFT JOIN public.profiles p ON p.id = CASE 
      WHEN g.turn = 'white' THEN g.white_player_id
      ELSE g.black_player_id
    END
    WHERE g.status = 'active'
  LOOP
    action := 'no_action';
    
    -- Determine what action to take
    IF rec.current_abandoned_by IS NOT NULL 
      AND rec.abandoned_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (now() - rec.abandoned_at)) / 60 >= FORFEIT_THRESHOLD_MINUTES THEN
      -- Forfeit the game
      UPDATE public.games
      SET 
        status = 'completed',
        result = CASE 
          WHEN rec.turn = 'white' THEN 'black_wins'
          ELSE 'white_wins'
        END,
        end_reason = 'abandonment',
        ended_at = now()
      WHERE id = rec.id;
      
      action := 'forfeited';
      
    ELSIF rec.mins_inactive >= ABANDONMENT_THRESHOLD_MINUTES 
      AND rec.current_abandoned_by IS NULL THEN
      -- Mark as abandoned
      UPDATE public.games
      SET 
        abandoned_by = rec.turn,
        abandoned_at = now()
      WHERE id = rec.id;
      
      action := 'marked_abandoned';
      
    ELSIF rec.mins_inactive >= WARNING_THRESHOLD_MINUTES 
      AND rec.mins_inactive < ABANDONMENT_THRESHOLD_MINUTES
      AND rec.abandonment_warning_at IS NULL THEN
      -- Issue warning
      UPDATE public.games
      SET abandonment_warning_at = now()
      WHERE id = rec.id;
      
      action := 'warned';
      
    ELSIF rec.mins_inactive < WARNING_THRESHOLD_MINUTES
      AND (rec.abandonment_warning_at IS NOT NULL OR rec.current_abandoned_by IS NOT NULL) THEN
      -- Clear warnings
      UPDATE public.games
      SET 
        abandonment_warning_at = NULL,
        abandoned_by = NULL,
        abandoned_at = NULL
      WHERE id = rec.id;
      
      action := 'cleared';
    END IF;
    
    -- Return result if action was taken
    IF action != 'no_action' THEN
      game_id := rec.id::text;
      abandoned_by := rec.turn;
      minutes_inactive := rec.mins_inactive::numeric;
      action_taken := action;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION batch_check_abandonments TO service_role;
GRANT EXECUTE ON FUNCTION batch_check_abandonments TO authenticated;