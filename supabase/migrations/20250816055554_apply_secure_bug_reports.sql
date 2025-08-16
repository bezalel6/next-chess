-- Drop the insecure storage bucket and policies if they exist
DROP POLICY IF EXISTS "Anyone can upload bug report screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view bug report screenshots" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'bug-report-screenshots';

-- Since bug_reports table already exists, add constraints if they don't exist
DO $$ 
BEGIN
    -- Add length constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bug_reports_reasonable_data'
    ) THEN
        ALTER TABLE bug_reports 
        ADD CONSTRAINT bug_reports_reasonable_data CHECK (
            pg_column_size(browser_info) <= 10000 AND
            pg_column_size(additional_data) <= 10000
        );
    END IF;
END $$;

-- Create indexes for efficient querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_game_id ON bug_reports(game_id);

-- RLS policies for bug_reports table
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with better security
DROP POLICY IF EXISTS "Service role bypass" ON bug_reports;
DROP POLICY IF EXISTS "Users can create bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Users can view own bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Anon can create bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Anon can create bug reports limited" ON bug_reports;

-- Service role can do anything
CREATE POLICY "Service role bypass" ON bug_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can create bug reports (rate limited in application)
CREATE POLICY "Users can create bug reports" ON bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id OR user_id IS NULL
    );

-- Users can view their own bug reports
CREATE POLICY "Users can view own bug reports" ON bug_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Anonymous users can create bug reports but with restrictions
CREATE POLICY "Anon can create bug reports limited" ON bug_reports
    FOR INSERT
    TO anon
    WITH CHECK (
        user_id IS NULL AND
        -- Ensure reasonable data sizes for anonymous submissions
        length(title) <= 200 AND
        length(description) <= 2000
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bug_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON bug_reports;
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_bug_report_updated_at();