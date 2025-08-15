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
    const { data: adminRecord, error: adminError } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (adminError || !adminRecord) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    switch (req.method) {
      case 'GET':
        // Get all settings
        const { data: settings, error: getError } = await supabase
          .from('settings')
          .select('*')
          .order('key', { ascending: true });

        if (getError) {
          throw getError;
        }

        res.status(200).json(settings);
        break;

      case 'PUT':
        // Update a setting
        const { key, value } = req.body;
        
        if (!key || value === undefined) {
          return res.status(400).json({ error: 'Key and value are required' });
        }

        const { data: updatedSetting, error: updateError } = await supabase
          .from('settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        res.status(200).json(updatedSetting);
        break;

      case 'POST':
        // Create a new setting
        const { key: newKey, value: newValue, description, category, is_public } = req.body;
        
        if (!newKey || newValue === undefined) {
          return res.status(400).json({ error: 'Key and value are required' });
        }

        const { data: newSetting, error: createError } = await supabase
          .from('settings')
          .insert({
            key: newKey,
            value: newValue,
            description,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        res.status(201).json(newSetting);
        break;

      case 'DELETE':
        // Delete a setting
        const { key: deleteKey } = req.query;
        
        if (!deleteKey) {
          return res.status(400).json({ error: 'Key is required' });
        }

        const { error: deleteError } = await supabase
          .from('settings')
          .delete()
          .eq('key', deleteKey);

        if (deleteError) {
          throw deleteError;
        }

        res.status(200).json({ message: 'Setting deleted successfully' });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in settings API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}