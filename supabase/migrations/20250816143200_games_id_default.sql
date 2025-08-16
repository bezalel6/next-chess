-- Set default UUID generation for games.id so inserts can omit id
ALTER TABLE public.games
ALTER COLUMN id SET DEFAULT gen_random_uuid();

