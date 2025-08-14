-- Fix RLS policies to allow anonymous users in local development

-- Allow anonymous users to read and insert profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
CREATE POLICY "Users can create profiles" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
  );

-- Allow anonymous users to view and create games
DROP POLICY IF EXISTS "Games can be viewed by participants and spectators" ON games;
CREATE POLICY "Games can be viewed by all" ON games
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Active players can update their games" ON games;
CREATE POLICY "Active players can update their games" ON games
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      white_player_id = auth.uid() OR 
      black_player_id = auth.uid()
    )
  );

-- Allow anonymous users to use matchmaking
DROP POLICY IF EXISTS "Users can view their own matchmaking entry" ON matchmaking;
CREATE POLICY "Users can view matchmaking" ON matchmaking
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own matchmaking entry" ON matchmaking;
CREATE POLICY "Users can insert matchmaking" ON matchmaking
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND player_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own matchmaking entry" ON matchmaking;
CREATE POLICY "Users can update matchmaking" ON matchmaking
  FOR UPDATE USING (
    auth.uid() = player_id
  );

-- Fix moves table policies to properly allow service role
DROP POLICY IF EXISTS "Service role inserts moves" ON moves;
DROP POLICY IF EXISTS "Service role updates moves" ON moves;

-- Allow anyone to view moves for games they can see
DROP POLICY IF EXISTS "View game moves" ON moves;
CREATE POLICY "View game moves" ON moves
  FOR SELECT USING (true);

-- Keep insert restricted (will be done via edge functions with service role)
DROP POLICY IF EXISTS "Server inserts moves" ON moves;
CREATE POLICY "No direct move inserts" ON moves
  FOR INSERT WITH CHECK (false);