-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    category TEXT NOT NULL CHECK (category IN ('logic', 'visual', 'performance', 'other')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    expected_behavior TEXT,
    actual_behavior TEXT,
    browser_info JSONB,
    page_url TEXT,
    game_id TEXT, -- Will add foreign key constraint later when games table exists
    screenshot_url TEXT,
    additional_data JSONB,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'duplicate')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Create indexes for efficient querying
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_category ON bug_reports(category);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_game_id ON bug_reports(game_id);

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'bug-report-screenshots',
    'bug-report-screenshots', 
    true,
    false,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for bug_reports table
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role bypass" ON bug_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can create bug reports
CREATE POLICY "Users can create bug reports" ON bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own bug reports
CREATE POLICY "Users can view own bug reports" ON bug_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Anon users can create bug reports (without user_id)
CREATE POLICY "Anon can create bug reports" ON bug_reports
    FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);

-- Storage policies for screenshots
CREATE POLICY "Anyone can upload bug report screenshots" ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'bug-report-screenshots');

CREATE POLICY "Anyone can view bug report screenshots" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'bug-report-screenshots');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bug_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_bug_report_updated_at();