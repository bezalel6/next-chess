// Legacy export - use supabase-browser.ts or supabase-server.ts instead
import { supabaseBrowser } from "./supabase-browser";
import type { Database } from "@/types/database";

// Export the browser client as the default for backward compatibility
// This will use cookie-based session storage
export const supabase = supabaseBrowser();

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
