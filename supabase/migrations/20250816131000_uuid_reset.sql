-- UUID-only schema reset for next-chess
-- WARNING: This migration DROPS and recreates core objects.

-- ===============================================
-- Drop existing dependent objects (if any)
-- ===============================================
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Drop tables in dependency-safe order
DROP TABLE IF EXISTS public.moves CASCADE;
DROP TABLE IF EXISTS public.ban_history CASCADE;
DROP TABLE IF EXISTS public.event_log CASCADE;
DROP TABLE IF EXISTS public.matchmaking CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;

-- Drop functions that may conflict
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_disconnect(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_reconnect(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_disconnect(text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_reconnect(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_disconnect(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_player_reconnect(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.safe_uuid_cast(text) CASCADE;

-- Drop enums
DROP TYPE IF EXISTS public.game_status CASCADE;
DROP TYPE IF EXISTS public.game_result CASCADE;
DROP TYPE IF EXISTS public.player_color CASCADE;
DROP TYPE IF EXISTS public.queue_status CASCADE;
DROP TYPE IF EXISTS public.end_reason CASCADE;

-- ===============================================
-- Enums
-- ===============================================
CREATE TYPE public.game_status AS ENUM ('active', 'finished');
CREATE TYPE public.game_result AS ENUM ('white', 'black', 'draw');
CREATE TYPE public.player_color AS ENUM ('white', 'black');
CREATE TYPE public.queue_status AS ENUM ('waiting', 'matched');
CREATE TYPE public.end_reason AS ENUM (
  'checkmate','resignation','draw_agreement','stalemate',
  'insufficient_material','threefold_repetition','fifty_move_rule','timeout'
);

-- ===============================================
-- Utility functions
-- ===============================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- Core tables (UUID-only)
-- ===============================================
-- Profiles (minimal, linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_online timestamptz NOT NULL DEFAULT now()
);

-- Games
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY,
  white_player_id uuid NOT NULL REFERENCES auth.users(id),
  black_player_id uuid NOT NULL REFERENCES auth.users(id),
  status public.game_status NOT NULL DEFAULT 'active',
  turn public.player_color NOT NULL DEFAULT 'white',
  current_fen text NOT NULL,
  pgn text NOT NULL DEFAULT '',
  result public.game_result,
  draw_offered_by public.player_color,
  rematch_offered_by public.player_color,
  end_reason public.end_reason,
  last_move jsonb,
  banning_player public.player_color,
  parent_game_id uuid REFERENCES public.games(id),
  -- clock
  time_control jsonb,
  white_time_remaining bigint,
  black_time_remaining bigint,
  white_turn_start_time bigint,
  black_turn_start_time bigint,
  last_clock_update timestamptz,
  clock_state jsonb,
  lag_compensation_ms integer,
  -- disconnect / abandonment
  disconnect_started_at timestamptz,
  total_disconnect_seconds integer DEFAULT 0,
  disconnect_allowance_seconds integer DEFAULT 120,
  claim_available_at timestamptz,
  last_connection_type text CHECK (last_connection_type IN ('online','rage_quit','disconnect')),
  -- misc
  current_banned_move jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Moves
CREATE TABLE IF NOT EXISTS public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number integer NOT NULL,
  ply_number integer NOT NULL,
  player_color public.player_color NOT NULL,
  from_square text NOT NULL,
  to_square text NOT NULL,
  promotion text,
  san text NOT NULL DEFAULT '',
  fen_after text NOT NULL,
  banned_from text,
  banned_to text,
  banned_by public.player_color,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Matchmaking (simplified)
CREATE TABLE IF NOT EXISTS public.matchmaking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.queue_status NOT NULL DEFAULT 'waiting',
  preferences jsonb DEFAULT '{}'::jsonb,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_online timestamptz NOT NULL DEFAULT now()
);

-- Event log
CREATE TABLE IF NOT EXISTS public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ban history (analytics)
CREATE TABLE IF NOT EXISTS public.ban_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number integer NOT NULL,
  banned_by public.player_color NOT NULL,
  banned_move jsonb NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now()
);

-- Bug reports (unchanged but game_id now uuid)
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  category text NOT NULL CHECK (category IN ('logic','visual','performance','other')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title text NOT NULL,
  description text NOT NULL,
  steps_to_reproduce text,
  expected_behavior text,
  actual_behavior text,
  browser_info jsonb,
  page_url text,
  game_id uuid REFERENCES public.games(id),
  screenshot_url text,
  additional_data jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','duplicate')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);

-- ===============================================
-- Indexes
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_games_white_player ON public.games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON public.games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_moves_game ON public.moves(game_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_status ON public.matchmaking(status);
CREATE INDEX IF NOT EXISTS idx_event_log_entity ON public.event_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);

-- ===============================================
-- Triggers
-- ===============================================
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ===============================================
-- RLS
-- ===============================================
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust as needed)
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_service_all ON public.profiles TO service_role USING (true) WITH CHECK (true);

CREATE POLICY games_select_all ON public.games FOR SELECT USING (true);
CREATE POLICY games_service_all ON public.games TO service_role USING (true) WITH CHECK (true);

CREATE POLICY moves_service_all ON public.moves TO service_role USING (true) WITH CHECK (true);
CREATE POLICY matchmaking_service_all ON public.matchmaking TO service_role USING (true) WITH CHECK (true);
CREATE POLICY event_log_service_all ON public.event_log TO service_role USING (true) WITH CHECK (true);
CREATE POLICY bug_reports_service_all ON public.bug_reports TO service_role USING (true) WITH CHECK (true);

-- ===============================================
-- Reconnect/Disconnect functions (UUID only)
-- ===============================================
CREATE OR REPLACE FUNCTION public.handle_player_reconnect(
  game_id uuid,
  player_id uuid
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  current_time timestamptz := now();
BEGIN
  SELECT * INTO game_record
  FROM public.games g
  WHERE g.id = game_id
    AND g.status = 'active'
    AND (g.white_player_id = player_id OR g.black_player_id = player_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or player not in game');
  END IF;

  IF game_record.disconnect_started_at IS NOT NULL THEN
    UPDATE public.games
      SET total_disconnect_seconds = COALESCE(total_disconnect_seconds, 0) + EXTRACT(EPOCH FROM (current_time - game_record.disconnect_started_at))::int,
          disconnect_started_at = NULL,
          claim_available_at = NULL,
          last_connection_type = 'online',
          updated_at = current_time
      WHERE id = game_id;
  ELSE
    UPDATE public.games
      SET last_connection_type = 'online', updated_at = current_time
      WHERE id = game_id;
  END IF;

  UPDATE public.profiles SET last_online = current_time WHERE id = player_id;

  RETURN jsonb_build_object('success', true, 'gameId', game_id, 'playerId', player_id, 'reconnectedAt', current_time);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_reconnect(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_player_disconnect(
  game_id uuid,
  player_id uuid,
  disconnect_type text DEFAULT 'disconnect'
) RETURNS jsonb AS $$
DECLARE
  game_record record;
  timeout_seconds integer;
  current_time timestamptz := now();
BEGIN
  SELECT * INTO game_record FROM public.games WHERE id = game_id AND status = 'active';
  IF game_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  IF NOT ((game_record.turn = 'white' AND game_record.white_player_id = player_id)
       OR  (game_record.turn = 'black' AND game_record.black_player_id = player_id)) THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'reason', 'not_players_turn');
  END IF;

  IF disconnect_type = 'rage_quit' THEN
    timeout_seconds := 10;
  ELSE
    timeout_seconds := GREATEST(
      COALESCE(game_record.disconnect_allowance_seconds, 120) - COALESCE(game_record.total_disconnect_seconds, 0),
      10
    );
  END IF;

  UPDATE public.games
    SET disconnect_started_at = current_time,
        last_connection_type = disconnect_type,
        claim_available_at = current_time + make_interval(secs => timeout_seconds),
        updated_at = current_time
    WHERE id = game_id;

  RETURN jsonb_build_object(
    'success', true,
    'gameId', game_id,
    'playerId', player_id,
    'disconnectType', disconnect_type,
    'timeout_seconds', timeout_seconds,
    'claim_available_at', current_time + make_interval(secs => timeout_seconds)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_player_disconnect(uuid, uuid, text) TO authenticated, service_role;

-- ===============================================
-- Realtime publication
-- ===============================================
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games, public.matchmaking, public.event_log;

