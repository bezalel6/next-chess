/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import { handleGameOperation } from "../_shared/game-handlers.ts";
import {
  createGameFromMatchedPlayers,
  processMatchmakingQueue,
} from "../_shared/db-trigger-handlers.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { validateWithZod } from "../_shared/validation-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { uuidSchema } from "./../_shared/validation-utils.ts";
import { ensureSingle, logOperation, getTable } from "../_shared/db-utils.ts";
import type { TypedSupabaseClient } from "../_shared/db-utils.ts";

// Create a logger for this module
const logger = createLogger("GAME-OPS");

// Game operations schemas
const GameOpsSchemas = {
  NotifyUpdateParams: z.object({
    gameId: uuidSchema,
  }),
};

// Define routes for game operations - admin routes have required role
const gameRouter = createRouter([
  defineRoute(
    "process-matches",
    async (user, params, supabase) => {
      return await processMatchmakingQueue(supabase);
    },
    "admin",
  ),

  defineRoute(
    "create-game-from-matched",
    async (user, params, supabase) => {
      logger.info("Creating game from matched players, source:", params.source);
      return await createGameFromMatchedPlayers(supabase);
    },
    "admin",
  ),

  // Game notification route - admin only
  defineRoute(
    "notify-game-update",
    async (user, params, supabase) => {
      return await notifyGameUpdate(params, supabase);
    },
    "service_role",
  ),


  // Game operation routes using unified handler
  defineRoute("makeMove", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "makeMove",
    );

    // After successful operation, notify game update and broadcast minimal move
    if (result.status === 200 && params.gameId) {
      try {
        // Minimal move broadcast for optimistic UX
        const channel = supabase.channel(`game:${params.gameId}:unified`);
        if (params?.move?.from && params?.move?.to) {
          await channel.send({
            type: 'broadcast',
            event: 'move',
            payload: { from: params.move.from, to: params.move.to },
          });
        }
      } catch (e) {
        logger.warn(`Failed to broadcast move: ${e?.message}`);
      }
      try {
        await notifyGameChange(supabase, params.gameId);
      } catch (error) {
        logger.warn(`Failed to notify game change: ${error.message}`);
      }
    }

    return result;
  }),

  defineRoute("banMove", async (user, params, supabase) => {
    const result = await handleGameOperation(user, params, supabase, "banMove");
    if (result.status === 200 && params.gameId) {
      try {
        const channel = supabase.channel(`game:${params.gameId}:unified`);
        if (params?.move?.from && params?.move?.to) {
          await channel.send({ type: 'broadcast', event: 'ban', payload: { from: params.move.from, to: params.move.to } });
        }
      } catch (e) {
        logger.warn(`Failed to broadcast ban: ${e?.message}`);
      }
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("offerDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "offerDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("acceptDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "acceptDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("declineDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "declineDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("offerRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "offerRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("acceptRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "acceptRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("declineRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "declineRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("resign", async (user, params, supabase) => {
    const result = await handleGameOperation(user, params, supabase, "resign");
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("sendChatMessage", async (user, params, supabase) => {
    const result = await handleChatMessage(user, params, supabase);
    return result;
  }),

]);

/**
 * Handles chat message with moderation
 */
async function handleChatMessage(
  user: User,
  params: Record<string, unknown>,
  supabase: TypedSupabaseClient
) {
  try {
    const { gameId, content } = params;
    
    if (!gameId || !content) {
      return errorResponse("Missing gameId or content", 400);
    }
    
    // Trim and validate content
    const trimmedContent = content.trim();
    if (!trimmedContent || trimmedContent.length > 200) {
      return errorResponse("Invalid message content", 400);
    }
    
    // Check if user is timed out
    const { data: timeout, error: timeoutError } = await getTable(supabase, "chat_timeouts")
      .select("timeout_until, violation_count")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (timeout && new Date(timeout.timeout_until) > new Date()) {
      return {
        status: 403,
        body: {
          error: "moderation_timeout",
          data: {
            timeout_until: timeout.timeout_until,
            timeout_seconds: Math.ceil((new Date(timeout.timeout_until).getTime() - Date.now()) / 1000)
          }
        }
      };
    }
    
    // Get moderation settings
    const { data: settings } = await getTable(supabase, "settings")
      .select("key, value")
      .in("key", ["banned_words", "chat_timeout_seconds", "chat_timeout_multiplier"]);
    
    const bannedWordsRow = settings?.find((s: { key: string; value: unknown }) => s.key === "banned_words");
    const timeoutSecondsRow = settings?.find((s: { key: string; value: unknown }) => s.key === "chat_timeout_seconds");
    const timeoutMultiplierRow = settings?.find((s: { key: string; value: unknown }) => s.key === "chat_timeout_multiplier");
    
    const bannedWords = bannedWordsRow?.value || ["spam", "cheat", "hack", "bot", "engine", "stockfish", "leela"];
    const timeoutSeconds = timeoutSecondsRow?.value || 30;
    const timeoutMultiplier = timeoutMultiplierRow?.value || 2;
    
    // Check for banned words (case-insensitive)
    const contentLower = trimmedContent.toLowerCase();
    const containsBannedWord = bannedWords.some((word: string) => 
      contentLower.includes(word.toLowerCase())
    );
    
    if (containsBannedWord) {
      // Calculate timeout duration
      const violationCount = (timeout?.violation_count || 0) + 1;
      const actualTimeout = timeoutSeconds * Math.pow(timeoutMultiplier, violationCount - 1);
      const timeoutUntil = new Date(Date.now() + actualTimeout * 1000);
      
      // Upsert timeout record
      const { error: upsertError } = await getTable(supabase, "chat_timeouts")
        .upsert({
          user_id: user.id,
          timeout_until: timeoutUntil.toISOString(),
          violation_count: violationCount,
          last_violation: new Date().toISOString()
        });
      
      if (upsertError) {
        logger.error("Failed to update chat timeout:", upsertError);
      }
      
      // Log moderation event
      await getTable(supabase, "event_log")
        .insert({
          event_type: "chat_moderation",
          user_id: user.id,
          game_id: gameId,
          details: { 
            action: "timeout",
            violation_count: violationCount,
            timeout_seconds: actualTimeout
          }
        });
      
      return {
        status: 403,
        body: {
          error: "moderation_violation",
          data: {
            timeout_until: timeoutUntil.toISOString(),
            timeout_seconds: actualTimeout
          }
        }
      };
    }
    
    // Validate game and player authorization
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .select("id, white_player_id, black_player_id, status, white_player:profiles!games_white_player_id_fkey(username), black_player:profiles!games_black_player_id_fkey(username)")
      .eq("id", gameId)
      .maybeSingle();
    
    if (gameError || !game) {
      return errorResponse("Game not found", 404);
    }
    
    const isWhite = game.white_player_id === user.id;
    const isBlack = game.black_player_id === user.id;
    
    if (!isWhite && !isBlack) {
      return errorResponse("Not authorized to chat in this game", 403);
    }
    
    if (game.status !== "active") {
      return errorResponse("Cannot chat in finished games", 400);
    }
    
    // Get sender name
    const senderName = isWhite ? game.white_player?.username : game.black_player?.username;
    
    // Insert message
    const { data: message, error: insertError } = await getTable(supabase, "game_messages")
      .insert({
        game_id: gameId,
        sender_id: user.id,
        content: trimmedContent,
        message_type: "player"
      })
      .select()
      .single();
    
    if (insertError) {
      logger.error("Failed to insert chat message:", insertError);
      return errorResponse("Failed to send message", 500);
    }
    
    // Map to client format
    const clientMessage = {
      id: message.id,
      gameId: message.game_id,
      type: message.message_type,
      senderId: message.sender_id,
      senderName: senderName,
      content: message.content,
      timestamp: message.created_at,
      metadata: message.metadata || {}
    };
    
    return successResponse({ message: clientMessage });
  } catch (error) {
    logger.error("Error handling chat message:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}

/**
 * Handles game update notifications
 */
async function notifyGameUpdate(params: Record<string, unknown>, supabase: TypedSupabaseClient) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(
      params,
      GameOpsSchemas.NotifyUpdateParams,
    );
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { gameId } = params;

    await notifyGameChange(supabase, gameId);

    return successResponse({ success: true });
  } catch (error) {
    logger.error("Error notifying game update:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}

/**
 * Notify game changes via Supabase realtime
 * This replaces the database notify function
 */
async function notifyGameChange(supabase: TypedSupabaseClient, gameId: string) {
  try {
    // Fetch the game data
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle();

    logOperation("get game for notification", gameError);

    if (!game) {
      logger.warn(`Game not found for notification: ${gameId}`);
      return false;
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "game_updated",
      entityType: "game",
      entityId: gameId,
      data: {
        status: game.status,
        turn: game.turn,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        draw_offered_by: (game as Record<string, unknown>).draw_offered_by ?? (game as Record<string, unknown>).drawOfferedBy ?? null,
        result: game.result,
        end_reason: (game as Record<string, unknown>).end_reason ?? (game as Record<string, unknown>).endReason ?? null,
      },
    });

    // Broadcast realtime update so both clients get the change immediately
    const channel = supabase.channel(`game:${gameId}:unified`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: game,
    });

    logger.info(`Broadcasted game_update for ${gameId}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to notify game change: ${errorMessage}`);
    return false;
  }
}

/**
 * Helper function to log events
 */
async function logEvent(
  supabase: TypedSupabaseClient,
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
    data?: Record<string, unknown>;
  },
) {
  try {
    await getTable(supabase, "event_log").insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      data: data || {},
    });

    logOperation("log event");
  } catch (error) {
    logger.warn(`Failed to log event ${eventType}:`, error);
  }
}

// CRON job access handler
async function handleCronRequest(req: Request) {
  logger.info("Processing matchmaking queue from CRON job");

  try {
    const supabaseAdmin = initSupabaseAdmin();
    return await processMatchmakingQueue(supabaseAdmin);
  } catch (error) {
    logger.error("Error in cron handler:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
}

// Main serve function
serve(async (req) => {
  // Extract request path
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  logger.info(`Received request: ${req.method} ${url.pathname}`);

  // Special handling for CRON jobs (authenticated by Supabase platform)
  if (
    path === "process-matches" &&
    req.headers.get("Authorization") === `Bearer ${Deno.env.get("CRON_SECRET")}`
  ) {
    return await handleCronRequest(req);
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await gameRouter(user, body, supabase);
  });
});
