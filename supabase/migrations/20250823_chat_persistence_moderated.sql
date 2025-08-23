-- Chat persistence with moderation support

-- Chat messages table
CREATE TABLE public.game_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL CHECK (length(content) <= 200),
  message_type text NOT NULL CHECK (message_type IN ('player', 'system', 'server')) DEFAULT 'player',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat timeouts tracking
CREATE TABLE public.chat_timeouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  timeout_until timestamptz NOT NULL,
  violation_count int NOT NULL DEFAULT 1,
  last_violation timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_game_messages_game ON public.game_messages(game_id, created_at);
CREATE INDEX idx_chat_timeouts_expiry ON public.chat_timeouts(timeout_until);

-- RLS policies for messages
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view their game messages" ON public.game_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.games g 
      WHERE g.id = game_id 
      AND (g.white_player_id = auth.uid() OR g.black_player_id = auth.uid())
    )
  );

CREATE POLICY "Players send messages to active games" ON public.game_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.games g 
      WHERE g.id = game_id 
      AND (g.white_player_id = auth.uid() OR g.black_player_id = auth.uid())
      AND g.status = 'active'
    )
  );

-- RLS policies for timeouts
ALTER TABLE public.chat_timeouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own timeouts" ON public.chat_timeouts
  FOR SELECT USING (user_id = auth.uid());

-- Service role can manage timeouts
CREATE POLICY "Service role manages timeouts" ON public.chat_timeouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add moderation settings
INSERT INTO public.settings (key, value) VALUES 
  ('chat_timeout_seconds', '30'::jsonb),
  ('chat_timeout_multiplier', '2'::jsonb),
  ('banned_words', '["spam", "cheat", "hack", "bot", "engine", "stockfish", "leela"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Function to check if user is timed out
CREATE OR REPLACE FUNCTION is_user_timed_out(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_timeouts
    WHERE user_id = p_user_id
    AND timeout_until > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION is_user_timed_out TO anon, authenticated, service_role;