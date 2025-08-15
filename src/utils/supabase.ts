// Legacy export - use supabase-browser.ts or supabase-server.ts instead
import { supabaseBrowser } from "./supabase-browser";
import { handleAuthError } from "./auth-interceptor";
import type { Database } from "@/types/database";

// Export the browser client as the default for backward compatibility
// This will use cookie-based session storage
export const supabase = supabaseBrowser();

/**
 * Invoke a Supabase Edge Function with authentication
 * Uses the current user session from Supabase Auth with automatic retry on auth errors
 * @param functionName The name of the function to invoke
 * @param params The parameters to pass to the function
 * @returns The result of the function invocation
 */
export const invokeWithAuth = async (
  functionName: string,
  params: { body: Record<string, any> },
) => {
  // First attempt to get the session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    // Try to refresh the session if it's missing
    const refreshed = await handleAuthError({ status: 401 });
    
    if (!refreshed) {
      throw new Error(
        "No active session. User must be authenticated to use this function.",
      );
    }
    
    // Get the refreshed session
    const refreshResult = await supabase.auth.getSession();
    session = refreshResult.data.session;
    
    if (!session) {
      throw new Error(
        "Failed to refresh session. Please sign in again.",
      );
    }
  }

  // Make the function call
  const result = await supabase.functions.invoke(functionName, {
    ...params,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  // Check if we got an auth error
  if (result.error && (result.error.message?.includes('401') || result.error.message?.includes('406'))) {
    console.log('[invokeWithAuth] Got auth error, attempting refresh...');
    
    // Try to refresh the session
    const refreshed = await handleAuthError({ status: 401 });
    
    if (refreshed) {
      // Get the new session and retry
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (newSession) {
        // Retry with the new session
        return supabase.functions.invoke(functionName, {
          ...params,
          headers: {
            Authorization: `Bearer ${newSession.access_token}`,
          },
        });
      }
    }
  }

  return result;
};
