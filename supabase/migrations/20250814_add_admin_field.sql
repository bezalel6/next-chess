-- Add is_admin field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Grant yourself admin access (replace with your actual user ID)
-- UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';