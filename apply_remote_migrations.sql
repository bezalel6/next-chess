-- Apply the text overload for handle_move_clock_update function
-- This fixes the issue where games.id is TEXT but the function expects UUID

-- Drop existing text overload if it exists
DROP FUNCTION IF EXISTS public.handle_move_clock_update(text, text);

-- Create text version of the function that converts to UUID internally
CREATE OR REPLACE FUNCTION public.handle_move_clock_update(
  p_game_id text,
  p_moving_color text
)
RETURNS jsonb AS $$
DECLARE
  clock_update jsonb;
  game_uuid uuid;
  color_enum player_color;
BEGIN
  -- Convert text parameters to proper types
  BEGIN
    game_uuid := p_game_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid game_id format: %', p_game_id;
  END;
  
  -- Convert text color to enum
  IF p_moving_color = 'white' THEN
    color_enum := 'white'::player_color;
  ELSIF p_moving_color = 'black' THEN
    color_enum := 'black'::player_color;
  ELSE
    RAISE EXCEPTION 'Invalid color: %', p_moving_color;
  END IF;
  
  -- Call the original UUID version
  SELECT public.handle_move_clock_update(game_uuid, color_enum) INTO clock_update;
  
  RETURN clock_update;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_move_clock_update(text, text) TO postgres, authenticated, service_role, anon;

-- Add comment
COMMENT ON FUNCTION public.handle_move_clock_update(text, text) IS 'Text overload for handle_move_clock_update to handle games.id being TEXT';

-- Create profiles for guest/anonymous users automatically

-- Function to create profile for new users (including anonymous)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 1;
BEGIN
  -- Generate base username for anonymous users
  IF NEW.is_anonymous = true THEN
    -- Generate a guest username like "Guest#1234"
    base_username := 'Guest#' || substring(NEW.id::text from 1 for 4);
  ELSE
    -- For regular users, use email prefix or a default
    base_username := split_part(NEW.email, '@', 1);
    IF base_username IS NULL OR base_username = '' THEN
      base_username := 'Player#' || substring(NEW.id::text from 1 for 4);
    END IF;
  END IF;

  -- Ensure username is unique
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || counter;
    counter := counter + 1;
  END LOOP;

  -- Insert profile record
  INSERT INTO public.profiles (id, username, created_at, updated_at)
  VALUES (
    NEW.id,
    final_username,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups (including anonymous)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for existing anonymous users who don't have profiles
-- Handle duplicate usernames by appending a unique suffix
DO $$
DECLARE
  user_record RECORD;
  base_username TEXT;
  final_username TEXT;
  counter INT;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.is_anonymous, u.email, u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Generate base username
    IF user_record.is_anonymous = true THEN
      base_username := 'Guest#' || substring(user_record.id::text from 1 for 4);
    ELSIF user_record.email IS NOT NULL AND user_record.email != '' THEN
      base_username := split_part(user_record.email, '@', 1);
    ELSE
      base_username := 'Player#' || substring(user_record.id::text from 1 for 4);
    END IF;
    
    -- Ensure username is unique
    final_username := base_username;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      final_username := base_username || '_' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Insert the profile
    INSERT INTO public.profiles (id, username, created_at, updated_at)
    VALUES (
      user_record.id,
      final_username,
      COALESCE(user_record.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- Verify the migrations were applied
SELECT 'Migrations applied successfully!' as status;