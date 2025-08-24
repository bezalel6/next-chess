# Before User Created Hook Authentication Fix

## Issue
The `before_user_created` hook was failing with "Hook requires authorization token" error when users attempted guest sign-in.

## Root Cause Analysis

### The Authentication Chain
1. **User signs up** → Supabase Auth
2. **Auth calls hook** → Kong API Gateway → Edge Functions Runtime
3. **Kong blocks request** → Returns 401 Unauthorized
4. **Auth receives error** → Returns "Hook requires authorization token" to client

### Key Discovery
Kong requires JWT authentication for `/functions/v1/*` routes, but:
- Auth hooks send webhook headers (`webhook-signature`, `webhook-id`, `webhook-timestamp`)
- Auth hooks DO NOT send Authorization headers
- Kong was expecting JWT auth that Auth doesn't provide

## Solution

### 1. Serve Edge Functions with --no-verify-jwt
```bash
npx supabase functions serve --no-verify-jwt --env-file supabase/functions/.env
```
This bypasses Kong's JWT requirement for local development.

### 2. Update Hook to Accept Webhook Headers
```typescript
// Check for webhook signature to verify the request is from Supabase
const webhookSignature = req.headers.get("webhook-signature");
const webhookId = req.headers.get("webhook-id");
const webhookTimestamp = req.headers.get("webhook-timestamp");

// In production, verify the webhook signature
// For local dev, accept requests with webhook headers
```

### 3. Environment Configuration
```bash
# .env.local
BEFORE_USER_CREATED_HOOK_SECRET=v1,whsec_bXktc3VwZXItc2VjcmV0LWhvb2sta2V5LWZvci1sb2NhbC1kZXY=

# supabase/functions/.env
BEFORE_USER_CREATED_HOOK_SECRET=v1,whsec_bXktc3VwZXItc2VjcmV0LWhvb2sta2V5LWZvci1sb2NhbC1kZXY=
```

## Diagnostic Method Used
Added single diagnostic log to identify exact request format:
```typescript
const diagnosticInfo = {
  url: req.url,
  method: req.method,
  headers: Object.fromEntries(req.headers.entries()),
  hasBody: req.body !== null,
};
console.log("🔍 HOOK REQUEST DIAGNOSTIC:", JSON.stringify(diagnosticInfo, null, 2));
```

This revealed:
- Auth WAS reaching the hook
- NO Authorization header was sent
- Webhook headers WERE present
- Hook WAS returning success

## Verification
Guest sign-in now works successfully, creating anonymous users with proper validation.