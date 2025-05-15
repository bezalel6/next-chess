# Supabase Edge Function Shared Utilities

This directory contains shared utilities for Supabase Edge Functions to reduce code duplication and improve maintainability.

## Available Utilities

### Authentication Utils (`auth-utils.ts`)

- CORS headers management
- User authentication
- Standard request handling

### Response Utils (`response-utils.ts`)

- Standardized success and error responses
- Consistent response format
- Error handling helpers

### Router Utils (`router-utils.ts`)

- Operation routing based on request parameters
- Role-based access control
- Simple route definition

### Database Utils (`db-utils.ts`)

- Simplified database query interface
- Error handling for common DB operations
- Record retrieval and existence checking

### Validation Utils (`validation-utils.ts`)

- Parameter validation
- Schema-based validation
- Common validation helpers (UUID, etc.)

### Logging (`logger.ts`)

- Consistent logging format
- Log level management
- Module-based loggers

### Chess Utils (`chess-utils.ts`)

- Game validation
- Move processing
- Chess-specific logic

### Domain Handlers

- `matchmaking-handlers.ts` - Matchmaking operations
- `game-handlers.ts` - Game operations
- `db-trigger-handlers.ts` - Database trigger handlers

## Usage Examples

### Router Usage

```typescript
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { handleCreateMatch } from "../_shared/matchmaking-handlers.ts";

const router = createRouter([
  defineRoute("createMatch", handleCreateMatch),
  // Add more routes as needed
]);

// In your serve function
serve(async (req) => {
  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await router(user, body, supabase);
  });
});
```

### Logger Usage

```typescript
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("MODULE_NAME");

logger.info("This is an info message");
logger.error("An error occurred", errorObject);
```

### Response Utils Usage

```typescript
import { successResponse, errorResponse } from "../_shared/response-utils.ts";

// Success response
return successResponse(data, "Operation successful", 200);

// Error response
return errorResponse("Something went wrong", 400);
```

### Validation Usage

```typescript
import { validateRequestParams } from "../_shared/validation-utils.ts";

const schema = {
  gameId: { type: "string", required: true },
  move: { type: "object", required: true },
};

const validationError = validateRequestParams(params, schema);
if (validationError) return validationError;

// Proceed with handler logic
```

## Best Practices

1. Always use the shared utilities for consistent behavior
2. Prefer typed parameters and return values
3. Use the logger with appropriate log levels
4. Handle errors consistently with the provided utilities
5. Follow the pattern of separating route definition from implementation
