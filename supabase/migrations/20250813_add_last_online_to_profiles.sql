-- Add last_online column to profiles table for tracking user activity
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_online timestamp with time zone DEFAULT now() NOT NULL;

-- Create index for efficient querying of online users
CREATE INDEX IF NOT EXISTS idx_profiles_last_online 
ON public.profiles(last_online);

-- Update existing profiles to have current timestamp
UPDATE public.profiles SET last_online = now() WHERE last_online IS NULL;