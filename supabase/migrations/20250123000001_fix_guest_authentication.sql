-- Fix guest authentication by updating the handle_new_user function
-- to properly handle anonymous users who don't have an email

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the old function
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function that handles both regular and anonymous users
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
DECLARE
  default_username TEXT;
BEGIN
  -- Generate username based on user type
  IF new.email IS NOT NULL THEN
    -- Regular user with email
    default_username := COALESCE(
      new.raw_user_meta_data->>'username', 
      split_part(new.email, '@', 1)
    );
  ELSE
    -- Anonymous user without email - generate random username
    default_username := 'guest_' || substr(new.id::text, 1, 8);
  END IF;

  -- Insert profile with generated username
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, default_username)
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
  
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- If username already exists, try with a random suffix
    default_username := default_username || '_' || substr(md5(random()::text), 1, 4);
    INSERT INTO public.profiles (id, username)
    VALUES (new.id, default_username)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Also ensure anonymous users can be created without email confirmation
-- Update auth settings to allow anonymous sign-ins (this is handled in config.toml)

-- Create a function to clean up old anonymous users (optional)
CREATE OR REPLACE FUNCTION cleanup_old_anonymous_users()
RETURNS void AS $$
BEGIN
  -- Delete anonymous users older than 30 days with no games
  DELETE FROM auth.users
  WHERE email IS NULL 
    AND created_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (
      SELECT DISTINCT white_player_id FROM games WHERE white_player_id IS NOT NULL
      UNION
      SELECT DISTINCT black_player_id FROM games WHERE black_player_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a comment for documentation
COMMENT ON FUNCTION handle_new_user() IS 'Creates a profile for new users, handling both regular email users and anonymous guests';