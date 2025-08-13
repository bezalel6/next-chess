/// <reference lib="deno.ns" />
// heartbeat/index.ts
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import {
  corsHeaders,
  handleAuthenticatedRequest,
} from "../_shared/auth-utils.ts";
import { getTable } from "../_shared/db-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { successResponse } from "../_shared/response-utils.ts";

const logger = createLogger("HEARTBEAT");

// Update user's last_online timestamp
async function updateHeartbeat(user: any, supabase: any) {
  try {
    const now = new Date().toISOString();
    
    // Update last_online in profiles
    const { error } = await getTable(supabase, "profiles")
      .update({ last_online: now })
      .eq("id", user.id);
    
    if (error) {
      logger.error(`Failed to update heartbeat for user ${user.id}:`, error);
      throw error;
    }
    
    logger.debug(`Heartbeat updated for user ${user.id}`);
    
    return successResponse({ 
      success: true,
      last_online: now 
    });
  } catch (error) {
    logger.error("Error updating heartbeat:", error);
    throw error;
  }
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await updateHeartbeat(user, supabase);
  });
});