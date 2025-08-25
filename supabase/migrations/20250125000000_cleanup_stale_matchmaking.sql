-- Create a function to clean up stale matchmaking entries
CREATE OR REPLACE FUNCTION cleanup_stale_matchmaking_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete matchmaking entries older than 5 minutes
    DELETE FROM matchmaking
    WHERE status = 'waiting'
    AND joined_at < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Create a function that runs on profile updates to clean matchmaking
CREATE OR REPLACE FUNCTION cleanup_matchmaking_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If last_online is older than 5 minutes, remove from matchmaking
    IF NEW.last_online < NOW() - INTERVAL '5 minutes' THEN
        DELETE FROM matchmaking
        WHERE player_id = NEW.id
        AND status = 'waiting';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to clean up on profile updates
DROP TRIGGER IF EXISTS cleanup_matchmaking_on_profile_update_trigger ON profiles;
CREATE TRIGGER cleanup_matchmaking_on_profile_update_trigger
    AFTER UPDATE OF last_online ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_matchmaking_on_profile_update();

-- Create a periodic cleanup function (can be called via cron or edge function)
CREATE OR REPLACE FUNCTION periodic_matchmaking_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove entries where the player hasn't been online for 5 minutes
    DELETE FROM matchmaking m
    WHERE m.status = 'waiting'
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = m.player_id
        AND p.last_online < NOW() - INTERVAL '5 minutes'
    );
    
    -- Also remove orphaned entries older than 10 minutes
    DELETE FROM matchmaking
    WHERE status = 'waiting'
    AND joined_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_stale_matchmaking_entries() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_matchmaking_on_profile_update() TO service_role;
GRANT EXECUTE ON FUNCTION periodic_matchmaking_cleanup() TO service_role;