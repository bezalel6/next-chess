import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Skeleton,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Announcement as AnnouncementIcon,
  Update as UpdateIcon,
  Build as BuildIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
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

const categoryIcons = {
  general: <AnnouncementIcon fontSize="small" />,
  update: <UpdateIcon fontSize="small" />,
  feature: <BuildIcon fontSize="small" />,
  maintenance: <WarningIcon fontSize="small" />,
};

const categoryColors = {
  general: 'info' as const,
  update: 'success' as const,
  feature: 'primary' as const,
  maintenance: 'warning' as const,
};

export default function NewsFeed() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

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
        .limit(5);

      if (error) throw error;
      setNewsItems(data || []);
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
        }}
      >
        <Skeleton variant="text" width="30%" height={32} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (newsItems.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        mb: 3,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnnouncementIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            News & Updates
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ color: 'text.secondary' }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {newsItems.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                mb: index < newsItems.length - 1 ? 2 : 0,
                pb: index < newsItems.length - 1 ? 2 : 0,
                borderBottom:
                  index < newsItems.length - 1
                    ? '1px solid rgba(255, 255, 255, 0.05)'
                    : 'none',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <Chip
                  label={item.category}
                  size="small"
                  color={categoryColors[item.category] || 'default'}
                  icon={categoryIcons[item.category]}
                  sx={{ height: 24 }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.disabled',
                      display: 'block',
                      mt: 1,
                    }}
                  >
                    {new Date(item.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}