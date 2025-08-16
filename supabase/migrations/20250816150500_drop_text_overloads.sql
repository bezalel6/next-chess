-- Drop text-based overloads that can conflict with PostgREST function resolution
-- Ensures only UUID signatures are available for RPC calls

DO $$
BEGIN
  -- handle_player_reconnect overloads
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_player_reconnect'
      AND pg_get_function_identity_arguments(p.oid) = 'game_id text, player_id uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.handle_player_reconnect(text, uuid)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_player_reconnect'
      AND pg_get_function_identity_arguments(p.oid) = 'game_id text, player_id text'
  ) THEN
    EXECUTE 'DROP FUNCTION public.handle_player_reconnect(text, text)';
  END IF;

  -- handle_player_disconnect overloads
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_player_disconnect'
      AND pg_get_function_identity_arguments(p.oid) = 'game_id text, player_id uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.handle_player_disconnect(text, uuid)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_player_disconnect'
      AND pg_get_function_identity_arguments(p.oid) = 'game_id text, player_id text'
  ) THEN
    EXECUTE 'DROP FUNCTION public.handle_player_disconnect(text, text)';
  END IF;
END $$;

