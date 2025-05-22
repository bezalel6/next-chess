-- Add time control fields to the games table
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS white_time_remaining BIGINT,
  ADD COLUMN IF NOT EXISTS black_time_remaining BIGINT,
  ADD COLUMN IF NOT EXISTS time_control JSONB;

-- Update existing games to have a default time control (10 minutes)
UPDATE public.games
SET time_control = '{"initial_time": 600000, "increment": 0}'::jsonb
WHERE time_control IS NULL; 