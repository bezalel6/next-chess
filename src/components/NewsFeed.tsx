import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
} from '@mui/material';
import { supabaseBrowser } from '@/utils/supabase-browser';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  priority: number;
  category: string;
  created_at: string;
  expires_at?: string;
}

const categoryEmojis: Record<string, string> = {
  general: '📢',
  update: '✨',
  feature: '🚀',
  maintenance: '🔧',
};

export default function NewsFeed() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseBrowser()
        .from('news_items')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3); // Just show top 3

      if (error) throw error;
      setNewsItems(data || []);
    } catch (err: any) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || newsItems.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 2,
        background: 'rgba(255,255,255,0.01)',
        borderRadius: 1,
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.disabled',
          fontSize: '0.7rem',
          letterSpacing: 1,
          textTransform: 'uppercase',
          display: 'block',
          mb: 1.5,
        }}
      >
        Updates
      </Typography>
      
      {newsItems.map((item, index) => (
        <Box
          key={item.id}
          sx={{
            mb: index < newsItems.length - 1 ? 1.5 : 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.9rem', mt: 0.1 }}>
              {categoryEmojis[item.category] || '📌'}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  mb: 0.25,
                  fontSize: '0.8rem',
                  color: 'text.primary',
                  opacity: 0.9,
                }}
              >
                {item.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  opacity: 0.7,
                  lineHeight: 1.3,
                  display: 'block',
                  fontSize: '0.75rem',
                }}
              >
                {item.content}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  opacity: 0.5,
                  display: 'block',
                  mt: 0.25,
                  fontSize: '0.65rem',
                }}
              >
                {new Date(item.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}