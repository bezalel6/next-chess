/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";

/**
 * Response types to standardize API responses
 */
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
};

/**
 * Creates a success response with standardized format
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status = 200,
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    statusCode: status,
  };

  // Log success responses for easier debugging
  console.log(
    `[SUCCESS] Status: ${status}${message ? ", Message: " + message : ""}`,
    data,
  );

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates an error response with standardized format
 */
export function errorResponse(
  message: string,
  status = 400,
  errorDetails?: any,
): Response {
  // Log errors for easier debugging
  console.error(`[ERROR] ${message}`, errorDetails || "");

  const response: ApiResponse = {
    success: false,
    error: message,
    statusCode: status,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Standardized handler for database errors
 */
export function handleDbError(error: any, operation: string): Response {
  console.error(`[DB ERROR] ${operation}: ${error.message}`, error);
  return errorResponse(
    `Database error during ${operation}: ${error.message}`,
    500,
    error,
  );
}

/**
 * Handles unexpected errors in edge functions
 */
export function handleUnexpectedError(error: any, context?: string): Response {
  const message = context
    ? `Error in ${context}: ${error.message}`
    : error.message;

  console.error(`[UNEXPECTED ERROR] ${message}`, error);

  return errorResponse(`Internal server error: ${error.message}`, 500, error);
}
