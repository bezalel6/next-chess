-- Seed file with sample data for testing
-- This is automatically run when using 'supabase db reset'

-- Insert a sample game
INSERT INTO public.games (
    id,
    white_player_id,
    black_player_id,
    status,
    current_fen,
    pgn,
    turn
) VALUES (
    'test123',  -- Using a predictable ID for testing
    '00000000-0000-0000-0000-000000000000',  -- Replace with actual user ID if needed
    '00000000-0000-0000-0000-000000000001',  -- Replace with actual user ID if needed
    'active',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    '',
    'white'
);

-- Insert some test moves
INSERT INTO public.moves (
    game_id,
    move
) VALUES 
    ('test123', '{"from":"e2","to":"e4"}'),
    ('test123', '{"from":"e7","to":"e5"}');

-- Update the game with the moves (normally this would happen through your app)
UPDATE public.games
SET 
    current_fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    pgn = '1. e4 e5',
    turn = 'white',
    last_move = '{"from":"e7","to":"e5"}'
WHERE id = 'test123'; 