/// <reference lib="deno.ns" />
import { errorResponse } from "./response-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const uuidSchema = z.string();
/**
 * Validator result type
 */
export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};

/**
 * Validates required parameters are present and returns error response if not
 */
export function validateRequired(
  params: Record<string, any>,
  requiredParams: string[],
): ValidationResult {
  const missingParams = requiredParams.filter(
    (param) => params[param] === undefined || params[param] === null,
  );

  if (missingParams.length > 0) {
    return {
      valid: false,
      errors: [`Missing required parameters: ${missingParams.join(", ")}`],
    };
  }

  return { valid: true };
}

/**
 * Common Zod schemas for game operations
 */
export const Schemas = {
  // Core schemas for common types
  UUID: uuidSchema,
  ChessMove: z.object({
    from: z.string().min(2).max(2),
    to: z.string().min(2).max(2),
    promotion: z.string().optional(),
  }),
  PlayerColor: z.enum(["white", "black"]),

  // Parameter schemas for game operations
  GameParams: z.object({
    gameId: uuidSchema,
  }),

  MoveParams: z.object({
    gameId: uuidSchema,
    move: z.object({
      from: z.string().min(2).max(2),
      to: z.string().min(2).max(2),
      promotion: z.string().optional(),
    }),
  }),

  PlayerParams: z.object({
    gameId: uuidSchema,
    playerColor: z.enum(["white", "black"]).optional(),
  }),
};

/**
 * Helper to validate with Zod schema
 * @returns ValidationResult with same interface as other validation functions
 */
export function validateWithZod<T>(
  data: unknown,
  schema: z.ZodType<T>,
): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
}

/**
 * Helper to validate request parameters with Zod and return an error response if invalid
 */
export function validateRequestWithZod<T>(
  params: unknown,
  schema: z.ZodType<T>,
): Response | null {
  const validationResult = validateWithZod(params, schema);

  if (!validationResult.valid) {
    return errorResponse(
      validationResult.errors?.join("; ") || "Invalid parameters",
      400,
    );
  }

  return null;
}

/**
 * Validates parameters against a schema with type checking and returns errors if invalid
 */
export function validateSchema(
  params: Record<string, any>,
  schema: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "object" | "array";
      required?: boolean;
      enum?: any[];
      validator?: (value: any) => boolean | string;
    }
  >,
): ValidationResult {
  const errors: string[] = [];

  // Check each field in the schema
  for (const [key, rules] of Object.entries(schema)) {
    const value = params[key];

    // Check if required
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Parameter '${key}' is required`);
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rules.type) {
      errors.push(
        `Parameter '${key}' must be of type '${rules.type}', got '${actualType}'`,
      );
      continue;
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(
        `Parameter '${key}' must be one of: ${rules.enum.join(", ")}`,
      );
      continue;
    }

    // Custom validator
    if (rules.validator) {
      const validatorResult = rules.validator(value);
      if (validatorResult !== true) {
        const errorMessage =
          typeof validatorResult === "string"
            ? validatorResult
            : `Invalid value for parameter '${key}'`;
        errors.push(errorMessage);
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Helper to validate request parameters and return an error response if invalid
 */
export function validateRequestParams(
  params: Record<string, any>,
  schema: Record<string, any>,
): Response | null {
  const validationResult = validateSchema(params, schema);

  if (!validationResult.valid) {
    return errorResponse(
      validationResult.errors?.join("; ") || "Invalid parameters",
      400,
    );
  }

  return null;
}
