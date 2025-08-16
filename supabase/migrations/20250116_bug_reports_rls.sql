-- Add RLS policies for bug_reports table

-- Allow anyone (including anonymous users) to insert bug reports
CREATE POLICY bug_reports_insert_all ON public.bug_reports 
FOR INSERT 
WITH CHECK (true);

-- Allow users to view their own bug reports
CREATE POLICY bug_reports_select_own ON public.bug_reports 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow service role full access
CREATE POLICY bug_reports_service_all ON public.bug_reports 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Allow admins to view all bug reports (optional, for admin panel)
CREATE POLICY bug_reports_select_admin ON public.bug_reports 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);