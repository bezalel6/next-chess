-- Create news_items table for admin-managed announcements
CREATE TABLE IF NOT EXISTS public.news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher priority items show first
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Additional metadata
  category TEXT DEFAULT 'general', -- general, update, maintenance, feature
  expires_at TIMESTAMPTZ, -- Optional expiration date
  
  CHECK (priority >= 0 AND priority <= 10)
);

-- Create index for efficient queries
CREATE INDEX idx_news_items_active_priority ON public.news_items(is_active, priority DESC, created_at DESC);
CREATE INDEX idx_news_items_expires ON public.news_items(expires_at) WHERE expires_at IS NOT NULL;

-- RLS policies
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read active news
CREATE POLICY "Public can read active news" ON public.news_items
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Only admins can manage news (we'll check admin status in the API)
CREATE POLICY "Service role can manage news" ON public.news_items
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_news_items_updated_at
  BEFORE UPDATE ON public.news_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_news_updated_at();

-- Insert some default news items
INSERT INTO public.news_items (title, content, priority, category) VALUES
  ('Welcome to Ban Chess!', 'Experience the strategic chess variant where you can ban your opponent''s moves. Join the queue to start playing!', 5, 'general'),
  ('New Feature: Bug Reporting', 'Found an issue? Use the bug report feature in the game menu to let us know!', 3, 'feature');