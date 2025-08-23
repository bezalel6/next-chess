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

    // Get count of open bug reports
    const { count, error } = await supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    if (error) {
      throw error;
    }

    return res.status(200).json({ count: count || 0 });
  } catch (error) {
    console.error('Error in bug reports count API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}