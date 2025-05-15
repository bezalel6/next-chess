# Code Standards for Next Chess

This document outlines the coding standards and patterns to be followed throughout the Next Chess codebase. Adhering to these standards ensures code consistency, maintainability, and reliability.

## Core Principles

1. **Centralize Common Patterns** - Extract repeated code patterns into utility functions
2. **Consistent Error Handling** - Use standardized error responses
3. **Structured Logging** - Use the logger utility with appropriate levels
4. **Validation First** - Validate inputs before processing
5. **Declarative Routing** - Use the router utility for edge function operations
6. **Type Everything** - Use TypeScript types for all function parameters and returns

## Directory Structure

- `supabase/functions/_shared/` - Central location for all shared utilities
- `supabase/functions/[function-name]/` - Individual edge functions

## Utility Usage Guidelines

### Response Handling

Always use the response utilities for consistent formatting:

```typescript
// Good
return successResponse(data);
return errorResponse("Error message", 400);

// Bad
return new Response(JSON.stringify({ data }));
return buildResponse(data, 200, headers);
```

### Database Operations

Use the database utilities to standardize queries:

```typescript
// Good
const { data, error } = await dbQuery(supabase, "table_name", "select", {
  select: "field1, field2",
  match: { id: recordId },
  single: true,
  operation: "get record",
});

// Bad
const { data, error } = await supabase
  .from("table_name")
  .select("field1, field2")
  .eq("id", recordId)
  .single();
```

### Logging

Use the logger with appropriate levels:

```typescript
// Good
const logger = createLogger("MODULE_NAME");
logger.info("Operation started", contextData);
logger.error("Operation failed", error);

// Bad
console.log("[MODULE_NAME] Operation started");
console.error(`Error: ${error.message}`);
```

### Validation

Always validate inputs:

```typescript
// Good
const validation = validateRequired(params, ["userId", "gameId"]);
if (!validation.valid) {
  return errorResponse(validation.errors.join("; "), 400);
}

// Bad
if (!params.userId || !params.gameId) {
  return errorResponse("Missing parameters", 400);
}
```

### Router Definition

Use the router utility for edge functions:

```typescript
// Good
const router = createRouter([
  defineRoute("operation1", handleOperation1),
  defineRoute("operation2", handleOperation2, "admin"), // With role requirement
]);

// Bad
switch (operation) {
  case "operation1":
    return await handleOperation1(user, params, supabase);
  case "operation2":
    return await handleOperation2(user, params, supabase);
}
```

### Event Tracking

Use event utilities for consistency:

```typescript
// Good
await recordEvent(supabase, EventType.MOVE_MADE, { gameId, move }, userId);

// Bad
await supabase.from("events").insert({
  type: "move_made",
  user_id: userId,
  data: { gameId, move },
});
```

## Error Handling Pattern

Use this pattern for service functions:

```typescript
export async function handleSomeOperation(
  user: User,
  params: Params,
  supabase: SupabaseClient
): Promise<Response> {
  try {
    logger.info("Operation started", { userId: user.id, ...params });

    // 1. Validate inputs
    const validation = validateRequired(params, ['requiredParam']);
    if (!validation.valid) {
      return errorResponse(validation.errors.join('; '), 400);
    }

    // 2. Business logic

    // 3. Database operations with error handling
    const { data, error } = await dbQuery(...);
    if (error) {
      logger.error("Database error", error);
      return errorResponse(`Operation failed: ${error.message}`, 500);
    }

    // 4. Event recording (when applicable)
    await recordEvent(...);

    // 5. Success response
    return successResponse(data);
  }
  catch (error) {
    // Catch unexpected errors
    logger.error("Unexpected error", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
```

## Review Checklist

When reviewing code, check for:

1. ✅ Consistent use of utility functions
2. ✅ Proper error handling and logging
3. ✅ Input validation
4. ✅ Type definitions for parameters and returns
5. ✅ Event recording for significant state changes
6. ✅ Try/catch blocks for unexpected errors

## Implementation Process

When implementing a new feature:

1. Start by defining types for all parameters and return values
2. Implement validation for all inputs
3. Use dbQuery for all database operations
4. Add logging at appropriate points
5. Use try/catch for top-level error handling
6. Record events for important state changes
