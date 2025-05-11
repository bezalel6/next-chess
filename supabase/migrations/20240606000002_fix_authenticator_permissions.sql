-- Grant permissions to the authenticator role
GRANT ALL ON public.profiles TO authenticator;
-- Modify the policy for inserts to allow the authenticator role
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Anyone can insert profiles" 
    ON public.profiles 
    FOR INSERT 
    TO authenticated, anon, service_role
    WITH CHECK (true);
-- Create a policy specifically for the authenticator role
CREATE POLICY "Authenticator can do all operations on profiles"
    ON public.profiles
    FOR ALL
    TO authenticator
    USING (true)
    WITH CHECK (true);
