-- Remove placeholder settings that are not actually used in the codebase
-- Only keeping default_time_control which is actively used by edge functions

-- Delete unused time control presets
DELETE FROM public.settings 
WHERE key IN (
  'blitz_time_control',      -- Not referenced anywhere in code
  'rapid_time_control',      -- Not referenced anywhere in code
  'classical_time_control',  -- Not referenced anywhere in code
  'bullet_time_control'      -- Not referenced anywhere in code
);

-- Delete unused feature settings that were never implemented
DELETE FROM public.settings 
WHERE key IN (
  'max_concurrent_games',        -- Not enforced anywhere
  'game_timeout_hours',          -- Not used (abandonment handled differently)
  'allow_time_control_selection' -- Feature not implemented
);

-- Add comment to document the only active setting
COMMENT ON TABLE public.settings IS 'Application settings table. Currently only default_time_control is actively used by the system.';

-- Document the active setting
UPDATE public.settings 
SET description = 'Default time control for new games. Used by edge functions when creating games. Format: {"initial_time": milliseconds, "increment": milliseconds}'
WHERE key = 'default_time_control';