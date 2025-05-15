# Migration Guide: Adopting Centralized Utilities

This guide provides step-by-step instructions for refactoring existing edge functions to use the new centralized utilities. Follow these steps to ensure a smooth transition.

## Step 1: Update Imports

Start by adding the necessary imports:

```typescript
// Add these imports
import { successResponse, errorResponse } from "./_shared/response-utils.ts";
import { createLogger } from "./_shared/logger.ts";
import { dbQuery } from "./_shared/db-utils.ts";
import {
  validateRequired,
  validateSchema,
} from "./_shared/validation-utils.ts";
import { EventType, recordEvent } from "./_shared/event-utils.ts";

// Initialize the logger
const logger = createLogger("MODULE_NAME");

// Remove these imports
// import { buildResponse } from "./chess-utils.ts";
// import { corsHeaders } from "./auth-utils.ts";
```

## Step 2: Wrap Functions in Try/Catch

Update each handler function with a try/catch block:

```typescript
export async function handleSomeOperation(
  user: User,
  params: Params,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    // Function implementation
    // ...

    return successResponse(data);
  } catch (error) {
    logger.error(`Error handling operation:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
```

## Step 3: Add Parameter Validation

Replace manual parameter validation with the validation utility:

```typescript
// Before
if (!params.id) {
  return buildResponse("Missing required parameter: id", 400, corsHeaders);
}

// After
const validation = validateRequired(params, ["id"]);
if (!validation.valid) {
  logger.warn(`Missing required parameters:`, validation.errors);
  return errorResponse(validation.errors.join("; "), 400);
}
```

## Step 4: Replace Database Calls

Replace direct Supabase queries with dbQuery:

```typescript
// Before
const { data, error } = await supabase
  .from("table_name")
  .select("field1, field2")
  .eq("id", params.id)
  .single();

// After
const { data, error } = await dbQuery(supabase, "table_name", "select", {
  select: "field1, field2",
  match: { id: params.id },
  single: true,
  operation: "get record",
});
```

## Step 5: Update Response Handling

Replace buildResponse with the new response utilities:

```typescript
// Before
return buildResponse(data, 200, corsHeaders);
return buildResponse(error.message, 400, corsHeaders);

// After
return successResponse(data);
return errorResponse(error.message, 400);
```

## Step 6: Add Logging

Add appropriate logging throughout the function:

```typescript
// Add logging at key points
logger.info(`User ${user.id} starting operation`, params);
logger.debug("Intermediate step completed", { result });
logger.warn("Potential issue detected", { problem });
logger.error("Operation failed", error);
```

## Step 7: Add Event Recording

Add event recording for significant state changes:

```typescript
// Record important events
await recordEvent(
  supabase,
  EventType.GAME_UPDATED,
  {
    game_id: params.gameId,
    action: "move",
    data: params.move,
  },
  user.id,
);
```

## Step 8: Update Edge Function Entry Points

Update the main index.ts files to use the router utility:

```typescript
// Before
serve(async (req) => {
  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    const { operation, ...params } = body;

    switch (operation) {
      case "operation1":
        return await handler1(user, params, supabase);
      // more cases...
    }
  });
});

// After
const router = createRouter([
  defineRoute("operation1", handler1),
  defineRoute("operation2", handler2),
  defineRoute("adminOperation", adminHandler, "admin"), // With role requirement
]);

serve(async (req) => {
  logger.info(`Received request: ${req.method} ${new URL(req.url).pathname}`);

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await router(user, body, supabase);
  });
});
```

## Migration Checklist

For each function you migrate, verify:

- [ ] Imports updated
- [ ] Try/catch block added
- [ ] Parameter validation added
- [ ] Database queries updated to use dbQuery
- [ ] Response handling updated
- [ ] Logging added
- [ ] Event recording added (if applicable)

## Common Challenges

### Error Handling Context

When adding error handling, include helpful context:

```typescript
try {
  // Operation
} catch (error) {
  logger.error(`Failed to process ${operation} for ${resourceId}:`, error);
  return errorResponse(`Operation failed: ${error.message}`, 500);
}
```

### Complex Database Queries

For complex queries, use the match and order options:

```typescript
const { data, error } = await dbQuery(supabase, "table_name", "select", {
  select: "field1, field2",
  match: {
    _or: [`field1.eq.${value1}`, `field2.eq.${value2}`],
    status: "active",
  },
  order: { column: "created_at", ascending: false },
  limit: 10,
  operation: "search records",
});
```

### Improving Response Details

Provide more detail in success responses:

```typescript
// Include a descriptive message
return successResponse(data, "Operation completed successfully", 200);
```
