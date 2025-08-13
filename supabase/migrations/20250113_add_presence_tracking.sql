-- Add presence tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_heartbeat timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_active timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- Create index for faster queries on active users
CREATE INDEX IF NOT EXISTS idx_profiles_last_heartbeat ON public.profiles(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online) WHERE is_online = true;

-- Function to update user heartbeat
CREATE OR REPLACE FUNCTION update_user_heartbeat(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    last_heartbeat = now(),
    last_active = now(),
    is_online = true
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark users as offline if heartbeat is stale
CREATE OR REPLACE FUNCTION mark_stale_users_offline()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET is_online = false
  WHERE 
    is_online = true 
    AND last_heartbeat < now() - interval '2 minutes'; -- Mark offline after 2 minutes of no heartbeat
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is alive before matchmaking
CREATE OR REPLACE FUNCTION is_user_alive(user_id uuid, threshold_seconds integer DEFAULT 120)
RETURNS boolean AS $$
DECLARE
  last_seen timestamp with time zone;
BEGIN
  SELECT last_heartbeat INTO last_seen
  FROM public.profiles
  WHERE id = user_id;
  
  IF last_seen IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN last_seen > now() - (threshold_seconds || ' seconds')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update matchmaking to check for alive users
CREATE OR REPLACE FUNCTION remove_stale_from_matchmaking()
RETURNS void AS $$
DECLARE
  STALE_THRESHOLD_SECONDS constant integer := 90; -- Remove from queue after 90 seconds of no heartbeat
BEGIN
  -- Remove stale users from matchmaking queue
  DELETE FROM public.matchmaking
  WHERE status = 'waiting'
    AND player_id IN (
      SELECT id FROM public.profiles
      WHERE last_heartbeat < now() - (STALE_THRESHOLD_SECONDS || ' seconds')::interval
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up stale users (if pg_cron is available)
-- This would run every minute to mark users offline and remove from queue
-- Note: pg_cron needs to be enabled in Supabase dashboard
-- SELECT cron.schedule('cleanup-stale-users', '*/1 * * * *', $$
--   SELECT mark_stale_users_offline();
--   SELECT remove_stale_from_matchmaking();
-- $$);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_heartbeat TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_alive TO authenticated;
GRANT EXECUTE ON FUNCTION mark_stale_users_offline TO service_role;
GRANT EXECUTE ON FUNCTION remove_stale_from_matchmaking TO service_role;