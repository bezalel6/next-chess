-- Reset script to clean up all data and tables
-- Run this when you want to start fresh

-- Drop all tables
DROP TABLE IF EXISTS public.moves;
DROP TABLE IF EXISTS public.games;

-- Drop all functions
DROP FUNCTION IF EXISTS public.generate_short_id(integer);
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Now you can run the schema.sql to recreate everything 