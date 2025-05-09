-- Allow bypassing RLS for the service role
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Grant all privileges on profiles table to the service role 
GRANT ALL ON public.profiles TO service_role;

-- Grant all privileges on profiles table to authenticated users
GRANT ALL ON public.profiles TO authenticated;

-- Add a policy that specifically allows the service_role to do all operations
CREATE POLICY "Service role can do all operations on profiles"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true); 