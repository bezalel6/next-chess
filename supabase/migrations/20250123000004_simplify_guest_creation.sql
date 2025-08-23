-- Simplify guest creation by removing the cascading settings trigger
-- We'll handle settings creation separately to avoid permission issues

-- Drop the trigger that creates settings when a profile is created
DROP TRIGGER IF EXISTS create_settings_on_profile_create ON profiles;

-- Drop the function if it's not used elsewhere
DROP FUNCTION IF EXISTS create_user_settings();

-- Now the handle_new_user function should work without issues
-- Settings can be created lazily when the user first accesses settings

-- Add a comment to document this change
COMMENT ON TABLE settings IS 'User settings table - created lazily on first access, not automatically on user creation';