-- RPC to fetch moves for a game in the shape expected by the client
CREATE OR REPLACE FUNCTION public.get_game_moves(p_game_id uuid)
RETURNS TABLE (
  id text,
  move_number integer,
  ply_number integer,
  player_color text,
  from_square text,
  to_square text,
  promotion text,
  san text,
  fen_after text,
  banned_from text,
  banned_to text,
  banned_by text,
  time_taken_ms integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    -- synthetic id if table has no id column
    concat(m.game_id::text,'-',m.ply_number::text) AS id,
    m.move_number,
    m.ply_number,
    m.player_color::text,
    m.from_square,
    m.to_square,
    COALESCE(m.promotion, '') AS promotion,
    COALESCE(m.san, '') AS san,
    m.fen_after,
    m.banned_from,
    m.banned_to,
    m.banned_by::text,
    NULL::integer AS time_taken_ms
  FROM public.moves m
  WHERE m.game_id = p_game_id
  ORDER BY m.ply_number ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_moves(uuid) TO anon, authenticated, service_role;

