# Captcha Testing Guide

## Overview
This application uses Cloudflare Turnstile for bot protection. Since Supabase Auth is configured to require Turnstile verification at the project level, we bypass it for testing by using Supabase's service role key to create anonymous users server-side.

## Testing Approach

### Service Role Bypass
For E2E testing and development, we use a server-side API endpoint that leverages Supabase's service role key to create anonymous users without captcha verification.

**API Endpoint**: `/api/test/create-guest`
- Creates anonymous users using `signInAnonymously()` with service role privileges
- Bypasses captcha requirement entirely
- Returns session tokens that can be used for authentication
- Only available in development/test environments

### Why This Works
- Service role key has admin privileges and bypasses all auth restrictions
- Anonymous users are created server-side without client interaction
- No need for test keys or mock captcha implementations
- Cleaner and more reliable than trying to mock client-side captcha

## Running Tests

### E2E Tests
```bash
# Run E2E tests (uses service role for auth)
bun run test:e2e

# Debug mode with visible browser
bun run test:e2e:debug

# Watch mode for development
bun run test:e2e:watch
```

### Test Helpers
The `AuthHelper` class provides methods for testing:
- `createGuestUser(page)` - Creates anonymous user via service role
- `signInAsGuest(page)` - Signs in as guest without UI interaction

### Local Development
```bash
# Start dev server normally
bun run dev
```

## How It Works

1. E2E tests call `/api/test/create-guest` endpoint
2. The endpoint uses service role key to call `signInAnonymously()`
3. Service role bypasses captcha verification requirement
4. Anonymous user is created and session tokens are returned
5. Tests set the session in browser localStorage
6. Page reload applies the session and user is authenticated

## Important Notes

- **Service role key must never be exposed to client** - Keep it server-side only
- The `/api/test/create-guest` endpoint is disabled in production by default
- Anonymous users auto-expire after 30 days (configurable in Supabase)
- This approach works regardless of Supabase project captcha settings
- Perfect for CI/CD pipelines and automated testing

## Troubleshooting

### API Endpoint Not Working
If the `/api/test/create-guest` endpoint fails:
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment
2. Check that you're not in production environment
3. Verify Supabase URL is correct
4. Check server logs for detailed error messages

### Session Not Persisting
If the session doesn't persist after creation:
1. Ensure localStorage key matches your Supabase project
2. Verify page reload after setting session
3. Check browser console for auth errors
4. Confirm anonymous sign-ins are enabled in Supabase

## References
- [Cloudflare Turnstile Testing Documentation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Excluding Turnstile from E2E Tests](https://developers.cloudflare.com/turnstile/tutorials/excluding-turnstile-from-e2e-tests/)