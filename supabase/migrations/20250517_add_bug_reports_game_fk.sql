-- Add foreign key constraint to bug_reports.game_id after games table exists
-- This migration runs after games table is created
DO $$
BEGIN
    -- Check if the foreign key constraint doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bug_reports_game_id_fkey'
        AND table_name = 'bug_reports'
    ) THEN
        ALTER TABLE bug_reports
        ADD CONSTRAINT bug_reports_game_id_fkey 
        FOREIGN KEY (game_id) REFERENCES games(id);
    END IF;
END
$$;