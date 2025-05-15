/// <reference lib="deno.ns" />
import type {
  User,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("ROUTER");

export type RequestHandler = (
  user: User,
  params: any,
  supabase: SupabaseClient,
) => Promise<Response>;

export type RouteDefinition = {
  operation: string;
  handler: RequestHandler;
  requiredRole?: string;
};

/**
 * Creates a router for handling different operations in edge functions
 */
export function createRouter(routes: RouteDefinition[]) {
  const routeMap = new Map<string, RouteDefinition>();

  // Build the route map for quick access
  for (const route of routes) {
    routeMap.set(route.operation, route);
  }

  // Return the router handler function
  return async (
    user: User,
    body: any,
    supabase: SupabaseClient,
  ): Promise<Response> => {
    const { operation, ...params } = body;

    // Check if operation exists
    if (!operation) {
      return errorResponse("Missing required 'operation' parameter", 400);
    }

    // Find the route
    const route = routeMap.get(operation);
    if (!route) {
      return errorResponse(`Unknown operation: ${operation}`, 400);
    }

    // Check role requirements if specified
    if (route.requiredRole) {
      const userRole = user.app_metadata?.role;

      // Special case for database triggers
      const isDbTrigger =
        params.source === "db_trigger" &&
        operation === "create-game-from-matched";

      if (userRole !== route.requiredRole && !isDbTrigger) {
        logger.warn(
          `User ${user.id} attempted unauthorized access to ${operation}`,
        );
        return errorResponse("Unauthorized to perform this operation", 403);
      }
    }

    // Execute the handler
    try {
      logger.debug(`Routing to handler for operation: ${operation}`);
      return await route.handler(user, params, supabase);
    } catch (error) {
      logger.error(`Error executing handler for ${operation}:`, error);
      return errorResponse(`Error executing operation: ${error.message}`, 500);
    }
  };
}

/**
 * Helper to create route definitions
 */
export function defineRoute(
  operation: string,
  handler: RequestHandler,
  requiredRole?: string,
): RouteDefinition {
  return { operation, handler, requiredRole };
}
