import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables!");
}

// Create Supabase client with auto-injected auth headers for edge functions
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) =>
      fetch(url, options),
    headers: {
      "X-Client-Info": "next-chess",
    },
  },
});

// Log successful initialization
console.log("Supabase client initialized successfully");
