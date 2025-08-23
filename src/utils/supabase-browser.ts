import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env.mjs";
import type { Database } from "@/types/database";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables!");
}

// Internal helper to build a browser client with a specific flow
const buildBrowserClient = (flow: 'pkce' | 'implicit') => {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: flow,
      storage: {
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null;
          // Try to get from cookies first (for SSR compatibility)
          const cookies = document.cookie.split('; ');
          const cookie = cookies.find(c => c.startsWith(`${key}=`));
          if (cookie) {
            return decodeURIComponent(cookie.split('=')[1]);
          }
          // Fallback to localStorage
          return localStorage.getItem(key);
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') return;
          // Set in both cookies and localStorage for compatibility
          const maxAge = 60 * 60 * 24 * 7; // 7 days
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          localStorage.setItem(key, value);
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return;
          // Remove from both cookies and localStorage
          document.cookie = `${key}=; path=/; max-age=0`;
          localStorage.removeItem(key);
        },
      },
    },
    global: {
      headers: {
        "X-Client-Info": "ban-chess",
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
};

// Default PKCE client (for OAuth and same-device flows)
export const createSupabaseBrowser = () => buildBrowserClient('pkce');

// Singleton instances - IMPORTANT: Only create once to avoid WebSocket connection issues
let browserClient: ReturnType<typeof createSupabaseBrowser> | undefined;
let browserClientImplicit: ReturnType<typeof buildBrowserClient> | undefined;

// Only create the client once per page load to avoid multiple WebSocket connections
if (typeof window !== 'undefined' && !browserClient) {
  browserClient = createSupabaseBrowser();
}

export const supabaseBrowser = () => {
  if (!browserClient) {
    browserClient = createSupabaseBrowser();
  }
  return browserClient;
};

// Implicit-flow client (for email confirmation and magic links to support cross-device)
export const supabaseBrowserImplicit = () => {
  if (!browserClientImplicit) {
    browserClientImplicit = buildBrowserClient('implicit');
  }
  return browserClientImplicit;
};
