# User Management Edge Function Authorization Fix

**Date:** 2025-08-22  
**Issue:** Edge function returning "Hook requires authorization token" error for authenticated API calls

## Problem Description

The `user-management` edge function was incorrectly handling regular authenticated API calls, treating them as webhook requests and returning authorization errors.

### Error Logs
```
[ERROR] Hook requires authorization token
[WARN] [USER-MGMT] Unrecognized webhook format: { type: undefined, table: undefined, hasRecord: false }
```

### Root Cause

The edge function had three request handling paths:
1. **Standard Webhooks** - With webhook-id, webhook-timestamp, and webhook-signature headers
2. **Supabase Auth Hooks** - Without standard webhook headers but with specific body formats
3. **Regular Authenticated Requests** - With Bearer token authorization

The issue occurred when regular authenticated requests (path 3) were being processed by the webhook detection logic (path 2). When the function couldn't parse the request body as a webhook, it would return an error instead of falling through to the authenticated request handler.

## Solution Implemented

Modified the request routing logic in `supabase/functions/user-management/index.ts`:

### Before (Problematic Code)
```typescript
// Try to handle as a Supabase Auth Hook if we have a body but no Standard Webhook headers
if (!webhookId && !webhookTimestamp && !webhookSignature) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    
    // Check webhook formats...
    
    // If we don't recognize the format, return error
    return errorResponse("Hook requires authorization token", 500);
  } catch (error) {
    // ...
  }
}

return await handleAuthenticatedRequest(req, ...);
```

### After (Fixed Code)
```typescript
// Check if this is actually a user-authenticated request first
if (!webhookId && !webhookTimestamp && !webhookSignature && authHeader?.startsWith("Bearer ")) {
  // This is a regular authenticated request, not a webhook
  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await userRouter(user, body, supabase);
  });
}

// Only try webhook parsing for non-Bearer token requests
if (!webhookId && !webhookTimestamp && !webhookSignature) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    
    // Check webhook formats...
    
    // If unrecognized, return appropriate error
    return errorResponse("Invalid webhook request", 400);
  } catch (error) {
    // ...
  }
}
```

## Key Changes

1. **Priority Check for Bearer Tokens**: Before attempting webhook parsing, check if the request has a Bearer token authorization header
2. **Proper Request Routing**: Route Bearer token requests directly to `handleAuthenticatedRequest`
3. **Clear Error Messages**: Changed generic "Hook requires authorization token" to more specific "Invalid webhook request"

## Impact

- Regular API calls from the client (e.g., username updates) now work correctly
- Webhook handling remains intact for actual webhook requests
- Better separation of concerns between webhook and authenticated request handling

## Deployment

The fix was deployed using:
```bash
npx supabase functions deploy user-management --no-verify-jwt
```

## Testing Checklist

- [x] Regular authenticated API calls work (username updates)
- [x] Webhook requests still processed correctly
- [x] Error logging provides clear distinction between request types
- [x] No body consumption issues for authenticated requests