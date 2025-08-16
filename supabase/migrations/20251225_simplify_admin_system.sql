-- Simplify admin system by using profiles.is_admin instead of separate admins table

-- First, migrate any existing admins to profiles.is_admin
UPDATE profiles 
SET is_admin = true 
WHERE id IN (SELECT user_id FROM admins);

-- Drop the old admin checking functions
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS is_current_user_admin();

-- Create new simplified admin checking function
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop policies on admins table before dropping the table
DROP POLICY IF EXISTS "Admins can view admin list" ON admins;
DROP POLICY IF EXISTS "No client modifications" ON admins;

-- Drop the admins table and its indexes
DROP INDEX IF EXISTS idx_admins_user_id;
DROP INDEX IF EXISTS idx_admins_email;
DROP TABLE IF EXISTS admins;

-- Update RLS policies to use profiles.is_admin
-- Example: Update any policies that reference the admins table
-- (These would need to be updated based on what policies exist)

-- Add RLS policy for profiles to protect the is_admin field
-- Note: PostgreSQL RLS doesn't support OLD/NEW references, so we use a trigger instead
-- Create a function to check admin field updates
CREATE OR REPLACE FUNCTION check_admin_field_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_admin field is being changed
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- Check if the current user is an admin
    IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
      RAISE EXCEPTION 'Only admins can modify admin status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce admin field protection
CREATE TRIGGER protect_admin_field
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_admin_field_update();

-- Ensure profiles table has proper index on is_admin
-- (This already exists from previous migration but adding IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Add comment to the is_admin column for documentation
COMMENT ON COLUMN profiles.is_admin IS 'Indicates if the user has admin privileges. Defaults to false.';