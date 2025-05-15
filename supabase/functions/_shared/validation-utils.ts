/// <reference lib="deno.ns" />
import { errorResponse } from "./response-utils.ts";

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

/**
 * UUID validation helper
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
