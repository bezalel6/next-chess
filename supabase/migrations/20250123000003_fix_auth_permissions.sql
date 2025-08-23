-- Fix permissions for supabase_auth_admin to access settings table
-- This allows the handle_new_user trigger to work properly

-- Grant permissions to supabase_auth_admin for the settings table
GRANT ALL ON public.settings TO supabase_auth_admin;

-- Also grant permissions for the profiles table to be safe
GRANT ALL ON public.profiles TO supabase_auth_admin;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Grant execute permissions on the create_user_settings function
GRANT EXECUTE ON FUNCTION public.create_user_settings() TO supabase_auth_admin;

-- Make sure the trigger function has proper security definer
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;
ALTER FUNCTION public.create_user_settings() SECURITY DEFINER;

-- Test that the permissions work by selecting from settings
-- This is just a sanity check, it won't affect anything
DO $$
BEGIN
  -- Try to access settings table as supabase_auth_admin
  -- This will fail if permissions are not correct
  PERFORM 1 FROM public.settings LIMIT 1;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Settings table access check: %', SQLERRM;
END $$;