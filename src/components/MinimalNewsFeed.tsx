import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
import { supabaseBrowser } from '@/utils/supabase-browser';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  priority: number;
  created_at: string;
  expires_at?: string;
}

export default function MinimalNewsFeed() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      // TODO: Uncomment when news_items table is created in the database
      // const { data, error } = await supabaseBrowser()
      //   .from('news_items')
      //   .select('id, title, content, priority, created_at, expires_at')
      //   .eq('is_active', true)
      //   .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      //   .order('priority', { ascending: false })
      //   .order('created_at', { ascending: false })
      //   .limit(3);

      // if (error) throw error;
      // setNewsItems(data || []);
      
      // Mock data for demonstration
      setNewsItems([
        {
          id: '1',
          title: 'Welcome to Ban Chess',
          content: 'Experience the strategic chess variant where you can ban your opponent\'s moves.',
          priority: 100,
          created_at: new Date().toISOString(),
        },
        {
          id: '2', 
          title: 'New Features',
          content: 'Real-time gameplay with move validation and ban mechanics now available.',
          priority: 90,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setNewsItems([]);
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
        p: 2.5,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          color: 'text.primary',
          fontSize: '0.95rem',
          fontWeight: 600,
          mb: 2,
          opacity: 0.9,
        }}
      >
        Latest Updates
      </Typography>
      
      {newsItems.map((item, index) => (
        <Box
          key={item.id}
          sx={{
            mb: index < newsItems.length - 1 ? 2 : 0,
            pb: index < newsItems.length - 1 ? 2 : 0,
            borderBottom: index < newsItems.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              mb: 0.5,
              fontSize: '0.85rem',
              color: 'text.primary',
              opacity: 0.95,
            }}
          >
            {item.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              opacity: 0.75,
              lineHeight: 1.4,
              fontSize: '0.8rem',
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
              mt: 0.75,
              fontSize: '0.7rem',
            }}
          >
            {new Date(item.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}