-- Fix the default time control to be 10 minutes (600000ms) instead of 1 minute (60000ms)
UPDATE public.settings 
SET value = '{"initial_time": 600000, "increment": 0}'::jsonb
WHERE key = 'default_time_control';

-- Also update any existing games that might have the wrong time values
UPDATE public.games
SET 
  time_control = '{"initial_time": 600000, "increment": 0}'::jsonb,
  white_time_remaining = CASE 
    WHEN white_time_remaining = 60000 THEN 600000 
    ELSE white_time_remaining 
  END,
  black_time_remaining = CASE 
    WHEN black_time_remaining = 60000 THEN 600000 
    ELSE black_time_remaining 
  END
WHERE status IN ('waiting', 'active')
  AND (
    (time_control->>'initial_time')::BIGINT = 60000
    OR white_time_remaining = 60000
    OR black_time_remaining = 60000
  );