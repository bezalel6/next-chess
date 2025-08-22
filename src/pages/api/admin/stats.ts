import type { NextApiRequest, NextApiResponse } from 'next';
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

    // Get comprehensive stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel fetch all stats
    const [
      { count: totalUsers },
      { count: totalGames },
      { count: activeGames },
      { count: gamesLast24h },
      { count: gamesLastWeek },
      { count: activeUsersToday },
      { count: activeUsersWeek },
      authUsers,
      gameResults,
      endReasons,
      recentGames,
      banStats
    ] = await Promise.all([
      // User counts
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      // Game counts
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('games').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('games').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
      // Active users
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_online', oneDayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_online', oneWeekAgo),
      // Auth users (email vs guest)
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      // Game results distribution
      supabase
        .from('games')
        .select('result')
        .eq('status', 'finished')
        .not('result', 'is', null),
      // End reasons distribution
      supabase
        .from('games')
        .select('end_reason')
        .eq('status', 'finished')
        .not('end_reason', 'is', null),
      // Recent games for average duration
      supabase
        .from('games')
        .select('created_at, updated_at, status')
        .eq('status', 'finished')
        .order('updated_at', { ascending: false })
        .limit(100),
      // Ban statistics
      supabase.from('ban_history').select('*', { count: 'exact', head: true })
    ]);

    // Calculate user type breakdown
    let emailUsers = 0;
    let guestUsers = 0;
    if (!authUsers.error && (authUsers as any)?.data?.users) {
      const users = ((authUsers as any).data.users as Array<{ email?: string | null }>);
      users.forEach((user) => {
        if (user?.email) {
          emailUsers++;
        } else {
          guestUsers++;
        }
      });
    }

    // Calculate game result percentages
    const resultCounts = { white: 0, black: 0, draw: 0 };
    if (!gameResults.error && gameResults.data) {
      gameResults.data.forEach(game => {
        if (game.result) {
          resultCounts[game.result as keyof typeof resultCounts]++;
        }
      });
    }
    const totalFinishedGames = resultCounts.white + resultCounts.black + resultCounts.draw;

    // Calculate end reason distribution
    const endReasonCounts: Record<string, number> = {};
    if (!endReasons.error && endReasons.data) {
      endReasons.data.forEach(game => {
        if (game.end_reason) {
          endReasonCounts[game.end_reason] = (endReasonCounts[game.end_reason] || 0) + 1;
        }
      });
    }

    // Calculate average game duration
    let avgGameDuration = 0;
    if (!recentGames.error && recentGames.data && recentGames.data.length > 0) {
      const durations = recentGames.data.map(game => {
        const start = new Date(game.created_at).getTime();
        const end = new Date(game.updated_at).getTime();
        return end - start;
      }).filter(d => d > 0 && d < 24 * 60 * 60 * 1000); // Filter out invalid/too long games
      
      if (durations.length > 0) {
        avgGameDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000); // in minutes
      }
    }

    const stats = {
      // User stats
      totalUsers: totalUsers || 0,
      emailUsers,
      guestUsers,
      activeUsersToday: activeUsersToday || 0,
      activeUsersWeek: activeUsersWeek || 0,
      
      // Game stats
      totalGames: totalGames || 0,
      activeGames: activeGames || 0,
      gamesLast24h: gamesLast24h || 0,
      gamesLastWeek: gamesLastWeek || 0,
      avgGameDurationMinutes: avgGameDuration,
      
      // Game outcomes
      gameResults: totalFinishedGames > 0 ? {
        white: Math.round((resultCounts.white / totalFinishedGames) * 100),
        black: Math.round((resultCounts.black / totalFinishedGames) * 100),
        draw: Math.round((resultCounts.draw / totalFinishedGames) * 100)
      } : { white: 0, black: 0, draw: 0 },
      
      // End reasons
      endReasons: endReasonCounts,
      
      // Ban Chess specific
      totalBans: banStats.count || 0,
      avgBansPerGame: totalGames > 0 ? Math.round((banStats.count || 0) / totalGames * 10) / 10 : 0
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}