/// <reference lib="deno.ns" />
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { dbQuery } from "../_shared/db-utils.ts";
import { validateWithZod } from "../_shared/validation-utils.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { uuidSchema } from "./../_shared/validation-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

// Create a logger for this module
const logger = createLogger("USER-MGMT");

// User profile schemas
const UserSchemas = {
  ProfileParams: z.object({
    username: z.string().min(3).max(30).optional(),
  }),
  UpdateProfileParams: z.object({
    username: z.string().min(3).max(30),
  }),
  WebhookParams: z.object({
    user: z.object({
      id: uuidSchema,
      user_metadata: z.record(z.any()).optional(),
    }),
  }),
};

// Define routes for user management operations
const userRouter = createRouter([
  defineRoute("createProfile", async (user, params, supabase) => {
    return await handleCreateProfile(user, params, supabase);
  }),

  defineRoute("updateProfile", async (user, params, supabase) => {
    return await handleUpdateProfile(user, params, supabase);
  }),

  // Admin-only route for handling auth webhook
  defineRoute(
    "handleNewUser",
    async (user, params, supabase) => {
      return await handleNewUserWebhook(params, supabase);
    },
    "service_role",
  ),
]);

/**
 * Handle create profile operation
 */
async function handleCreateProfile(
  user: User,
  params: any,
  supabase: SupabaseClient,
) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.ProfileParams);
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const username =
      params.username || `user_${crypto.randomUUID().substring(0, 8)}`;

    // Create profile for user
    const { data: profile, error } = await dbQuery(
      supabase,
      "profiles",
      "insert",
      {
        data: {
          id: user.id,
          username,
        },
        select: "*",
        single: true,
        operation: "create profile",
      },
    );

    if (error) {
      return errorResponse(`Failed to create profile: ${error.message}`, 500);
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "profile_created",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: { username },
    });

    return successResponse({ profile });
  } catch (error) {
    logger.error("Error creating profile:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handle update profile operation
 */
async function handleUpdateProfile(
  user: User,
  params: any,
  supabase: SupabaseClient,
) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.UpdateProfileParams);
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { username } = params;

    // Update profile for user
    const { data: profile, error } = await dbQuery(
      supabase,
      "profiles",
      "update",
      {
        data: { username },
        match: { id: user.id },
        select: "*",
        single: true,
        operation: "update profile",
      },
    );

    if (error) {
      return errorResponse(`Failed to update profile: ${error.message}`, 500);
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "profile_updated",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: { username },
    });

    return successResponse({ profile });
  } catch (error) {
    logger.error("Error updating profile:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handle new user webhook (called by auth webhook)
 */
async function handleNewUserWebhook(params: any, supabase: SupabaseClient) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.WebhookParams);
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { user } = params;

    // Extract username from user metadata if available, otherwise generate a random one
    const username =
      user.user_metadata?.username ||
      `user_${crypto.randomUUID().substring(0, 8)}`;

    // Create profile for new user
    const { data: profile, error } = await dbQuery(
      supabase,
      "profiles",
      "insert",
      {
        data: {
          id: user.id,
          username,
        },
        select: "*",
        single: true,
        operation: "create profile for new user",
      },
    );

    if (error) {
      return errorResponse(`Failed to create profile: ${error.message}`, 500);
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "new_user_profile_created",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: { username },
    });

    return successResponse({ profile });
  } catch (error) {
    logger.error("Error handling new user webhook:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Helper function to log events
 */
async function logEvent(
  supabase: SupabaseClient,
  {
    eventType,
    entityType,
    entityId,
    userId,
    data,
  }: {
    eventType: string;
    entityType: string;
    entityId: string;
    userId?: string;
    data?: Record<string, any>;
  },
) {
  try {
    await dbQuery(supabase, "event_log", "insert", {
      data: {
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        data: data || {},
      },
      operation: "log event",
    });
  } catch (error) {
    logger.warn(`Failed to log event ${eventType}:`, error);
  }
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Special handling for auth webhooks
  if (
    req.headers.get("Authorization") ===
    `Bearer ${Deno.env.get("AUTH_WEBHOOK_SECRET")}`
  ) {
    try {
      // Parse the webhook payload
      const body = await req.json();
      const supabaseAdmin = initSupabaseAdmin();

      // If this is a user.created event
      if (body.type === "user.created") {
        return await handleNewUserWebhook({ user: body.record }, supabaseAdmin);
      }

      // Return 200 for unhandled webhook events
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error("Error processing webhook:", error);
      return errorResponse(`Error processing webhook: ${error.message}`, 500);
    }
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await userRouter(user, body, supabase);
  });
});
