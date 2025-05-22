import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables!");
}

// Create Supabase client with auto-injected auth headers for edge functions
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
      try {
        return await fetch(url, options);
      } catch (error) {
        console.error(`Supabase fetch error:`, {
          url,
          method: options?.method || "GET",
          headers: options?.headers,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
        });
        throw error;
      }
    },
    headers: {
      "X-Client-Info": "next-chess",
    },
  },
});

/**
 * Invoke a Supabase Edge Function with authentication
 * Uses the current user session from Supabase Auth
 * @param functionName The name of the function to invoke
 * @param params The parameters to pass to the function
 * @returns The result of the function invocation
 */
export const invokeWithAuth = async (
  functionName: string,
  params: { body: Record<string, any> },
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error(
      "No active session. User must be authenticated to use this function.",
    );
  }

  return supabase.functions.invoke(functionName, {
    ...params,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
};
