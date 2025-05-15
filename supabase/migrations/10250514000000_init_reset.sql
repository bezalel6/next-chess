-- Drop tables if they exist
DROP TABLE IF EXISTS public.event_log CASCADE;
DROP TABLE IF EXISTS public.matchmaking CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS public.game_status CASCADE;
DROP TYPE IF EXISTS public.game_result CASCADE;
DROP TYPE IF EXISTS public.player_color CASCADE;
DROP TYPE IF EXISTS public.end_reason CASCADE;
DROP TYPE IF EXISTS public.queue_status CASCADE;

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;

-- Optionally drop extensions (if you want to reset them)
-- DROP EXTENSION IF EXISTS "pg_net" CASCADE;
-- DROP EXTENSION IF EXISTS "pg_graphql" CASCADE;
-- ... (repeat for other extensions as needed)

-- Now, recreate everything (copy from your latest migration)
-- (Paste the contents of your 20250513092029_remote_schema.sql here)