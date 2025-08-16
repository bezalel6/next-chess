-- Create profiles for guest/anonymous users automatically

-- Function to create profile for new users (including anonymous)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  guest_username text;
BEGIN
  -- Generate username for anonymous users
  IF NEW.is_anonymous = true THEN
    -- Generate a guest username like "Guest#1234"
    guest_username := 'Guest#' || substring(NEW.id::text from 1 for 4);
  ELSE
    -- For regular users, use email prefix or a default
    guest_username := split_part(NEW.email, '@', 1);
    IF guest_username IS NULL OR guest_username = '' THEN
      guest_username := 'Player#' || substring(NEW.id::text from 1 for 4);
    END IF;
  END IF;

  -- Insert profile record
  INSERT INTO public.profiles (id, username, created_at, updated_at)
  VALUES (
    NEW.id,
    guest_username,
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
INSERT INTO public.profiles (id, username, created_at, updated_at)
SELECT 
  u.id,
  CASE 
    WHEN u.is_anonymous = true THEN 'Guest#' || substring(u.id::text from 1 for 4)
    WHEN u.email IS NOT NULL THEN split_part(u.email, '@', 1)
    ELSE 'Player#' || substring(u.id::text from 1 for 4)
  END as username,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;