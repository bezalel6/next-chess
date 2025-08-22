-- Deduplicate moves by (game_id, ply_number) keeping the first row per group
-- This ensures the unique index on (game_id, ply_number) can be created.

WITH ranked AS (
  SELECT ctid, ROW_NUMBER() OVER (PARTITION BY game_id, ply_number ORDER BY ctid) AS rn
  FROM public.moves
)
DELETE FROM public.moves m
USING ranked r
WHERE m.ctid = r.ctid
  AND r.rn > 1;

