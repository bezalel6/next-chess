import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log environment variables (without exposing the full key)
console.log('Initializing Supabase client...');
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key available:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Log successful initialization
console.log('Supabase client initialized successfully');
