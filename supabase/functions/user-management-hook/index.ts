/// <reference lib="deno.ns" />
import { corsHeaders } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { validateUsername } from "../_shared/username-filter.ts";

const logger = createLogger("USER-HOOK");

/**
 * Before User Created Hook
 * This function is called by Supabase Auth before a user is created
 * It can reject the signup or allow it to proceed
 * 
 * Note: This hook does NOT require JWT authentication as it's called
 * internally by Supabase Auth. We use Deno.serve directly to bypass
 * the default auth check.
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // For Auth hooks, Supabase sends webhook headers instead of Authorization
    // Check for webhook signature to verify the request is from Supabase
    const webhookSignature = req.headers.get("webhook-signature");
    const webhookId = req.headers.get("webhook-id");
    const webhookTimestamp = req.headers.get("webhook-timestamp");
    
    // Log request info for debugging
    logger.info("Hook request received", {
      hasWebhookSignature: !!webhookSignature,
      hasWebhookId: !!webhookId,
      hasWebhookTimestamp: !!webhookTimestamp,
      method: req.method,
    });
    
    // In production, you would verify the webhook signature here
    // For local dev, we accept requests with webhook headers
    if (!webhookId || !webhookSignature) {
      logger.warn("Request missing webhook headers", {
        webhookId: !!webhookId,
        webhookSignature: !!webhookSignature,
      });
      // For local dev, we'll allow it to proceed
      // In production, you might want to reject the request
    }
    
    const body = await req.json();
    logger.info("Before user created hook called", {
      hasUser: !!body?.user,
      hasMetadata: !!body?.metadata,
      isAnonymous: body?.user?.is_anonymous,
      email: body?.user?.email,
      authMethod: body?.user?.auth_method,
    });

    // Extract user data
    const user = body?.user;
    const metadata = body?.metadata;

    // Allow anonymous users without any checks
    if (user?.is_anonymous === true || user?.email === null) {
      logger.info("Allowing anonymous user signup");
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if username is provided in metadata
    const username = user?.user_metadata?.username;
    if (username) {
      // Validate username
      const validationResult = validateUsername(username);
      if (!validationResult.isValid) {
        logger.warn("Rejecting signup due to invalid username", {
          username,
          reason: validationResult.reason,
        });
        return new Response(
          JSON.stringify({
            error: {
              http_code: 400,
              message: validationResult.reason || "Username is not allowed",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Allow the signup to proceed
    logger.info("Allowing user signup", {
      email: user?.email,
      username,
    });
    
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error in before_user_created hook", error);
    // On error, allow signup to proceed rather than blocking
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});