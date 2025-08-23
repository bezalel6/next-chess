/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleAuthenticatedRequest, corsHeaders, initSupabaseAdmin } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { logOperation, getTable } from "../_shared/db-utils.ts";
import { validateWithZod } from "../_shared/validation-utils.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { uuidSchema } from "./../_shared/validation-utils.ts";
import { validateUsername } from "../_shared/username-filter.ts";
// Create a logger for this module
const logger = createLogger("USER-MGMT");
// Enhanced user profile schemas with username filtering
const UserSchemas = {
  ProfileParams: z.object({
    username: z.string().min(3).max(20).optional().refine((username)=>{
      if (!username) return true; // Allow optional
      const result = validateUsername(username);
      return result.isValid;
    }, {
      message: "Username is not allowed"
    })
  }),
  UpdateProfileParams: z.object({
    username: z.string().min(3).max(20).refine((username)=>{
      const result = validateUsername(username);
      return result.isValid;
    }, {
      message: "Username is not allowed"
    })
  }),
  WebhookParams: z.object({
    user: z.object({
      id: uuidSchema,
      user_metadata: z.record(z.any()).optional()
    })
  })
};
// Define routes for user management operations
const userRouter = createRouter([
  defineRoute("createProfile", async (user, params, supabase)=>{
    return await handleCreateProfile(user, params, supabase);
  }),
  defineRoute("updateProfile", async (user, params, supabase)=>{
    return await handleUpdateProfile(user, params, supabase);
  }),
  // Admin-only route for handling auth webhook
  defineRoute("handleNewUser", async (user, params, supabase)=>{
    return await handleNewUserWebhook(params, supabase);
  }, "service_role")
]);
/**
 * Handle create profile operation
 */ async function handleCreateProfile(user, params, supabase) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.ProfileParams);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }
    let username = params.username;
    // If no username provided, generate a safe one
    if (!username) {
      username = `user_${crypto.randomUUID().substring(0, 8)}`;
    } else {
      // Additional validation with detailed error messages
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.isValid) {
        return errorResponse(usernameValidation.reason || "Username is not allowed", 400);
      }
      // Check if username already exists
      const { data: existingProfile } = await getTable(supabase, "profiles").select("id").ilike("username", username.toLowerCase().trim()).maybeSingle();
      if (existingProfile) {
        return errorResponse("Username already exists", 409);
      }
    }
    // Normalize username
    const normalizedUsername = username.toLowerCase().trim();
    // Create profile for user
    const { data: profile, error } = await getTable(supabase, "profiles").insert({
      id: user.id,
      username: normalizedUsername
    }).select("*").maybeSingle();
    logOperation("create profile", error);
    if (error) {
      // Handle duplicate username error
      if (error.code === '23505') {
        return errorResponse("Username already exists", 409);
      }
      return errorResponse(`Failed to create profile: ${error.message}`, 500);
    }
    // Log the event
    await logEvent(supabase, {
      eventType: "profile_created",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: {
        username: normalizedUsername
      }
    });
    return successResponse({
      profile
    });
  } catch (error) {
    logger.error("Error creating profile:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
/**
 * Handle update profile operation
 */ async function handleUpdateProfile(user, params, supabase) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.UpdateProfileParams);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }
    const { username } = params;
    // Check if user is a guest (anonymous user or username starts with guest_)
    // First, get the current user's profile to check their username
    const { data: currentProfile } = await getTable(supabase, "profiles").select("username").eq("id", user.id).maybeSingle();
    if (currentProfile?.username?.startsWith("guest_")) {
      return errorResponse("Guest users cannot change their username. Please sign up for a full account to choose your username.", 403);
    }
    // Check if the user is anonymous (using Supabase's anonymous auth)
    if (user.email === null || user.is_anonymous === true) {
      return errorResponse("Anonymous users cannot change their username. Please sign up for a full account.", 403);
    }
    // Additional validation with detailed error messages
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return errorResponse(usernameValidation.reason || "Username is not allowed", 400);
    }
    const normalizedUsername = username.toLowerCase().trim();
    // Check if username already exists (excluding current user)
    const { data: existingProfile } = await getTable(supabase, "profiles").select("id").ilike("username", normalizedUsername).neq("id", user.id).maybeSingle();
    if (existingProfile) {
      return errorResponse("Username already exists", 409);
    }
    // Update profile for user
    const { data: profile, error } = await getTable(supabase, "profiles").update({
      username: normalizedUsername
    }).eq("id", user.id).select("*").maybeSingle();
    logOperation("update profile", error);
    if (error) {
      // Handle duplicate username error
      if (error.code === '23505') {
        return errorResponse("Username already exists", 409);
      }
      return errorResponse(`Failed to update profile: ${error.message}`, 500);
    }
    // Log the event
    await logEvent(supabase, {
      eventType: "profile_updated",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: {
        username: normalizedUsername
      }
    });
    return successResponse({
      profile
    });
  } catch (error) {
    logger.error("Error updating profile:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
/**
 * Handle new user webhook (called by auth webhook)
 */ async function handleNewUserWebhook(params, supabase) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(params, UserSchemas.WebhookParams);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }
    const { user } = params;
    let username = user.user_metadata?.username;
    // If username provided, validate it
    if (username) {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.isValid) {
        // If provided username is invalid, generate a safe one instead
        username = `user_${crypto.randomUUID().substring(0, 8)}`;
        logger.warn(`Invalid username provided for user ${user.id}, using generated username: ${username}`);
      } else {
        // Check for duplicates and modify if needed
        let attempts = 0;
        const baseUsername = username.toLowerCase().trim();
        let finalUsername = baseUsername;
        while(attempts < 5){
          const { data: existingProfile } = await getTable(supabase, "profiles").select("id").ilike("username", finalUsername).maybeSingle();
          if (!existingProfile) {
            username = finalUsername;
            break;
          }
          attempts++;
          finalUsername = `${baseUsername}${attempts}`;
        }
        // If still conflicting after 5 attempts, generate random
        if (attempts >= 5) {
          username = `user_${crypto.randomUUID().substring(0, 8)}`;
        }
      }
    } else {
      // Generate a safe username
      username = `user_${crypto.randomUUID().substring(0, 8)}`;
    }
    const normalizedUsername = username.toLowerCase().trim();
    // Create profile for new user
    const { data: profile, error } = await getTable(supabase, "profiles").insert({
      id: user.id,
      username: normalizedUsername
    }).select("*").maybeSingle();
    logOperation("create profile for new user", error);
    if (error) {
      // If username conflict, try with generated username
      if (error.code === '23505') {
        const fallbackUsername = `user_${crypto.randomUUID().substring(0, 8)}`;
        const { data: retryProfile, error: retryError } = await getTable(supabase, "profiles").insert({
          id: user.id,
          username: fallbackUsername
        }).select("*").maybeSingle();
        if (retryError) {
          return errorResponse(`Failed to create profile: ${retryError.message}`, 500);
        }
        await logEvent(supabase, {
          eventType: "new_user_profile_created",
          entityType: "profile",
          entityId: user.id,
          userId: user.id,
          data: {
            username: fallbackUsername,
            fallback: true
          }
        });
        return successResponse({
          profile: retryProfile
        });
      }
      return errorResponse(`Failed to create profile: ${error.message}`, 500);
    }
    // Log the event
    await logEvent(supabase, {
      eventType: "new_user_profile_created",
      entityType: "profile",
      entityId: user.id,
      userId: user.id,
      data: {
        username: normalizedUsername
      }
    });
    return successResponse({
      profile
    });
  } catch (error) {
    logger.error("Error handling new user webhook:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
/**
 * Helper function to log events
 */ async function logEvent(supabase, { eventType, entityType, entityId, userId, data }) {
  try {
    await getTable(supabase, "event_log").insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      data: data || {}
    });
    logOperation("log event");
  } catch (error) {
    logger.warn(`Failed to log event ${eventType}:`, error);
  }
}
// Main serve function
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // Log all headers for debugging
  const headers = {};
  req.headers.forEach((value, key)=>{
    headers[key] = value;
  });
  logger.info("Received headers:", headers);
  // Special handling for auth webhooks using Standard Webhooks specification
  const webhookId = req.headers.get("webhook-id");
  const webhookTimestamp = req.headers.get("webhook-timestamp");
  const webhookSignature = req.headers.get("webhook-signature");
  if (webhookId && webhookTimestamp && webhookSignature) {
    try {
      // Get the raw body for signature verification
      const bodyText = await req.text();
      // Verify the webhook signature
      const webhookSecret = Deno.env.get("AUTH_WEBHOOK_SECRET");
      if (!webhookSecret) {
        logger.error("AUTH_WEBHOOK_SECRET not configured");
        return errorResponse("Webhook secret not configured", 500);
      }
      // Extract the base64 secret (remove "v1,whsec_" prefix if present)
      const secretKey = webhookSecret.startsWith("v1,whsec_") ? webhookSecret.substring(9) : webhookSecret;
      // Construct the signed content: id.timestamp.body
      const signedContent = `${webhookId}.${webhookTimestamp}.${bodyText}`;
      // Generate the expected signature using HMAC-SHA256
      const encoder = new TextEncoder();
      const keyData = Uint8Array.from(atob(secretKey), (c)=>c.charCodeAt(0));
      const key = await crypto.subtle.importKey("raw", keyData, {
        name: "HMAC",
        hash: "SHA-256"
      }, false, [
        "sign"
      ]);
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
      const expectedSignature = `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
      // Verify signatures match (extract v1 signature from header)
      const signatures = webhookSignature.split(" ");
      const v1Signature = signatures.find((sig)=>sig.startsWith("v1,"));
      if (v1Signature !== expectedSignature) {
        // For debugging - remove in production
        logger.warn("Signature mismatch:", {
          expected: expectedSignature.substring(0, 20) + "...",
          received: v1Signature?.substring(0, 20) + "..."
        });
        return errorResponse("Invalid webhook signature", 401);
      }
      // Verify timestamp is recent (within 5 minutes)
      const timestamp = parseInt(webhookTimestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - timestamp) > 300) {
        return errorResponse("Webhook timestamp too old", 401);
      }
      // Parse the verified payload
      const body = JSON.parse(bodyText);
      const supabaseAdmin = initSupabaseAdmin();
      // If this is a user.created event
      if (body.type === "user.created") {
        return await handleNewUserWebhook({
          user: body.record
        }, supabaseAdmin);
      }
      // Return 200 for unhandled webhook events
      return new Response(JSON.stringify({
        success: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      logger.error("Error processing webhook:", error);
      return errorResponse(`Error processing webhook: ${error.message}`, 500);
    }
  }
  // Check if this might be a Supabase Auth Hook (Before User Created)
  // These hooks might send the secret differently
  const authHeader = req.headers.get("authorization");
  const webhookSecret = Deno.env.get("AUTH_WEBHOOK_SECRET");
  
  // Try to handle as a Supabase Auth Hook if we have a body but no Standard Webhook headers
  // But first check if this is actually a user-authenticated request
  if (!webhookId && !webhookTimestamp && !webhookSignature && authHeader?.startsWith("Bearer ")) {
    // This is a regular authenticated request, not a webhook
    return await handleAuthenticatedRequest(req, async (user, body, supabase)=>{
      return await userRouter(user, body, supabase);
    });
  }
  
  // Try to handle as a potential webhook if no auth header or not a Bearer token
  if (!webhookId && !webhookTimestamp && !webhookSignature) {
    try {
      const bodyText = await req.text();
      const body = JSON.parse(bodyText);
      // Log what we received for debugging
      logger.info("Potential Auth Hook request:", {
        hasAuthHeader: !!authHeader,
        bodyType: body?.type,
        hasUserData: !!body?.user || !!body?.record,
        secretConfigured: !!webhookSecret
      });
      // Check if this looks like a user.created event from Supabase
      if (body?.type === "INSERT" && body?.table === "auth.users") {
        // This is the actual format Supabase sends for database webhooks
        const supabaseAdmin = initSupabaseAdmin();
        return await handleNewUserWebhook({
          user: body.record
        }, supabaseAdmin);
      }
      // Also check for the expected format
      if (body?.type === "user.created" && body?.record) {
        const supabaseAdmin = initSupabaseAdmin();
        return await handleNewUserWebhook({
          user: body.record
        }, supabaseAdmin);
      }
      // If we don't recognize the format, log it and return error
      logger.warn("Unrecognized webhook format:", {
        type: body?.type,
        table: body?.table,
        hasRecord: !!body?.record
      });
      return errorResponse("Invalid webhook request", 400);
    } catch (error) {
      logger.error("Error processing potential auth hook:", error);
      return errorResponse(`Error processing request: ${error.message}`, 500);
    }
  }
  
  // This shouldn't be reached but handle as authenticated request as fallback
  return await handleAuthenticatedRequest(req, async (user, body, supabase)=>{
    return await userRouter(user, body, supabase);
  });
});
