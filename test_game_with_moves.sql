-- First, let's check if we can access the production database
SELECT COUNT(*) FROM games WHERE created_at > NOW() - INTERVAL '1 day';

-- Create a test game between two users
INSERT INTO games (
  id,
  white_player_id,
  black_player_id,
  current_turn,
  current_fen,
  status,
  game_state,
  created_at
) VALUES (
  'test-move-history-' || gen_random_uuid()::text,
  '7208bfee-a016-490e-968c-8390249b377d',  -- The guest user we're using
  gen_random_uuid(),  -- Random opponent
  'white',
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'active',
  jsonb_build_object(
    'fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'moveHistory', jsonb_build_array()
  ),
  NOW()
) RETURNING id;
