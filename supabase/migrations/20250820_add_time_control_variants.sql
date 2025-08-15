-- Add additional time control variants for admins to choose from

-- Insert common time control presets
INSERT INTO public.settings (key, value, description) VALUES
  ('blitz_time_control', '{"initial_time": 300000, "increment": 3000}', 'Blitz time control: 5 minutes + 3 second increment'),
  ('rapid_time_control', '{"initial_time": 900000, "increment": 10000}', 'Rapid time control: 15 minutes + 10 second increment'),
  ('classical_time_control', '{"initial_time": 1800000, "increment": 0}', 'Classical time control: 30 minutes per player'),
  ('bullet_time_control', '{"initial_time": 60000, "increment": 1000}', 'Bullet time control: 1 minute + 1 second increment')
ON CONFLICT (key) DO NOTHING;

-- Add max games per user setting
INSERT INTO public.settings (key, value, description) VALUES
  ('max_concurrent_games', '3', 'Maximum number of concurrent games per user'),
  ('game_timeout_hours', '24', 'Hours after which inactive games are abandoned'),
  ('allow_time_control_selection', 'false', 'Allow players to choose time control when creating games')
ON CONFLICT (key) DO NOTHING;