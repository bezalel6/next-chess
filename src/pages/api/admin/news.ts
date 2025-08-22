import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseServerClient } from '@/utils/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createSupabaseServerClient(req, res);
  
  // Get current user session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin - PROPERLY checking the is_admin field in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, supabase);
    case 'POST':
      return handlePost(req, res, supabase, session.user.id);
    case 'PUT':
      return handlePut(req, res, supabase);
    case 'DELETE':
      return handleDelete(req, res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, supabase: any) {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Error fetching news items:', error);
    return res.status(500).json({ error: 'Failed to fetch news items' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, supabase: any, userId: string) {
  try {
    const { title, content, priority, category, is_active, expires_at } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const { data, error } = await supabase
      .from('news_items')
      .insert({
        title,
        content,
        priority: priority || 5,
        category: category || 'general',
        is_active: is_active ?? true,
        expires_at: expires_at || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating news item:', error);
    return res.status(500).json({ error: 'Failed to create news item' });
  }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, supabase: any) {
  try {
    const { id, title, content, priority, category, is_active, expires_at } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (expires_at !== undefined) updateData.expires_at = expires_at;

    const { data, error } = await supabase
      .from('news_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error updating news item:', error);
    return res.status(500).json({ error: 'Failed to update news item' });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, supabase: any) {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const { error } = await supabase
      .from('news_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting news item:', error);
    return res.status(500).json({ error: 'Failed to delete news item' });
  }
}