import { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseServerClient } from '@/utils/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createSupabaseServerClient(req, res);

  try {
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get high-level stats
    const [
      { count: totalUsers },
      { count: totalGames },
      { count: activeGames },
      { count: guestUsers },
      { count: emailUsers }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).is('email', null),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('email', 'is', null)
    ]);

    // Get recent activity stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: gamesLast24h } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    const { count: activeUsersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_sign_in_at', oneDayAgo);

    const stats = {
      totalUsers: totalUsers || 0,
      guestUsers: guestUsers || 0,
      emailUsers: emailUsers || 0,
      totalGames: totalGames || 0,
      activeGames: activeGames || 0,
      gamesLast24h: gamesLast24h || 0,
      activeUsersToday: activeUsersToday || 0
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}