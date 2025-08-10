-- Create follows table for user following relationships
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure a user cannot follow themselves
    CONSTRAINT cannot_follow_self CHECK (follower_id != following_id),
    -- Ensure unique follow relationships
    CONSTRAINT unique_follow UNIQUE(follower_id, following_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_created_at ON public.follows(created_at DESC);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see who they follow
CREATE POLICY "Users can see who they follow"
    ON public.follows
    FOR SELECT
    USING (auth.uid() = follower_id);

-- Users can see who follows them
CREATE POLICY "Users can see their followers"
    ON public.follows
    FOR SELECT
    USING (auth.uid() = following_id);

-- Users can follow others
CREATE POLICY "Users can follow others"
    ON public.follows
    FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
    ON public.follows
    FOR DELETE
    USING (auth.uid() = follower_id);

-- Create view for followed users with their current game status
CREATE OR REPLACE VIEW public.followed_users_status AS
SELECT 
    f.follower_id,
    f.following_id,
    f.created_at as followed_at,
    u.username,
    u.rating,
    -- Get active game info if exists
    CASE 
        WHEN g.id IS NOT NULL THEN 
            jsonb_build_object(
                'game_id', g.id,
                'status', g.status,
                'white_player_id', g.white_player_id,
                'black_player_id', g.black_player_id,
                'created_at', g.created_at,
                'current_position', g.current_position
            )
        ELSE NULL
    END as active_game
FROM public.follows f
JOIN public.users u ON u.id = f.following_id
LEFT JOIN LATERAL (
    SELECT * FROM public.games
    WHERE status = 'active'
    AND (white_player_id = f.following_id OR black_player_id = f.following_id)
    ORDER BY created_at DESC
    LIMIT 1
) g ON true;

-- Grant access to the view
GRANT SELECT ON public.followed_users_status TO authenticated;

-- Function to get follower/following counts
CREATE OR REPLACE FUNCTION public.get_follow_stats(user_id UUID)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'followers_count', (SELECT COUNT(*) FROM public.follows WHERE following_id = user_id),
        'following_count', (SELECT COUNT(*) FROM public.follows WHERE follower_id = user_id)
    );
$$;

-- Function to check if user A follows user B
CREATE OR REPLACE FUNCTION public.is_following(follower UUID, following UUID)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.follows 
        WHERE follower_id = follower AND following_id = following
    );
$$;