import { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseServerClient } from '@/utils/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    if (req.method === 'GET') {
      // Optional filters
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const status = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status as string | undefined;

      let query = supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return res.status(200).json(data || []);
    }

    if (req.method === 'PUT') {
      // Update bug report status or fields
      const { id, status, assignee_id, resolution_note } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (assignee_id) updates.assignee_id = assignee_id;
      if (resolution_note) updates.resolution_note = resolution_note;

      const { data, error } = await supabase
        .from('bug_reports')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in admin bug reports API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

