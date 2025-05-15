/// <reference lib="deno.ns" />
import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, successResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("AUTH");

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
export function initSupabaseAdmin(): SupabaseClient {
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
export async function authenticateUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<User> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    logger.warn("Authentication failed: No authorization header");
    throw new Error("No authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    logger.warn("Authentication failed: Invalid token", authError);
    throw new Error(`Invalid token: ${authError?.message || "Unknown error"}`);
  }

  logger.debug(`User authenticated: ${user.id}`);
  return user;
}

/**
 * Standard handler for edge function requests with authentication
 */
export async function handleAuthenticatedRequest(
  req: Request,
  handler: (
    user: User,
    body: any,
    supabase: SupabaseClient,
  ) => Promise<Response>,
): Promise<Response> {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Initialize Supabase with admin privileges
    const supabase = initSupabaseAdmin();

    // Parse request body first to check for special cases
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error(`Error parsing request body:`, parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Special case for database triggers
    let user: User;
    if (
      body.source === "db_trigger" &&
      body.operation === "create-game-from-matched"
    ) {
      logger.info(
        "Request from database trigger, using service role authentication",
      );
      // For database trigger calls, we use a special system user
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        app_metadata: { role: "service_role" },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;
    } else {
      // Regular user authentication
      try {
        user = await authenticateUser(req, supabase);
      } catch (authError) {
        return errorResponse(
          `Authentication failed: ${authError.message}`,
          401,
        );
      }
    }

    // Handle the authenticated request
    try {
      return await handler(user, body, supabase);
    } catch (error) {
      logger.error(`Error in request handler:`, error);
      return errorResponse(`Server error: ${error.message}`, 500);
    }
  } catch (error) {
    logger.error(`Unhandled error processing request:`, error);
    return errorResponse(error.message, 500);
  }
}
