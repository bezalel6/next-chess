-- Fix the moves insert policy to allow service role to insert
DROP POLICY IF EXISTS "Server inserts moves" ON moves;

-- Allow service role to insert moves (edge functions use service role)
CREATE POLICY "Service role inserts moves" ON moves
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Also ensure service role can update moves if needed
CREATE POLICY "Service role updates moves" ON moves
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');