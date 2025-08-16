-- Follow features helpers and view for app compatibility
-- Adds missing functions and columns referenced by the client

-- 1) Ensure profiles.is_admin exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2) Create follows table if missing
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);

-- 3) Follow stats function
CREATE OR REPLACE FUNCTION public.get_follow_stats(user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'followers_count', (
      SELECT COUNT(*)::int FROM public.follows f WHERE f.following_id = user_id
    ),
    'following_count', (
      SELECT COUNT(*)::int FROM public.follows f WHERE f.follower_id = user_id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_stats(uuid) TO anon, authenticated, service_role;

-- 3) View for followed users with optional active game
CREATE OR REPLACE VIEW public.followed_users_status AS
SELECT
  f.follower_id,
  f.following_id,
  f.created_at AS followed_at,
  p.username,
  (
    SELECT to_jsonb(g) - 'pgn'
    FROM public.games g
    WHERE g.status = 'active'
      AND (g.white_player_id = f.following_id OR g.black_player_id = f.following_id)
    ORDER BY g.created_at DESC
    LIMIT 1
  ) AS active_game
FROM public.follows f
JOIN public.profiles p ON p.id = f.following_id;

GRANT SELECT ON public.followed_users_status TO anon, authenticated, service_role;

