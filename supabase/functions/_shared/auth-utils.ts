/// <reference lib="deno.ns" />
import { createClient } from "supabase";
import { buildResponse } from "./chess-utils.ts";

// CORS headers for all edge functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Initializes a Supabase client with admin privileges
 */
export function initSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Handles CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/**
 * Authenticates a user from request headers
 * Returns the authenticated user or throws an error
 */
export async function authenticateUser(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("No authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error(`Invalid token: ${authError?.message || "Unknown error"}`);
  }

  return user;
}

/**
 * Standard handler for edge function requests with authentication
 */
export async function handleAuthenticatedRequest(
  req: Request,
  handler: (user: any, body: any, supabase: any) => Promise<Response>,
): Promise<Response> {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Initialize Supabase with admin privileges
    const supabase = initSupabaseAdmin();

    // Authenticate the user
    const user = await authenticateUser(req, supabase);

    // Parse request body
    const body = await req.json();

    // Handle the authenticated request
    return await handler(user, body, supabase);
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    return buildResponse(error.message, 500, corsHeaders);
  }
}
