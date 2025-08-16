# Authentication and Signup Flow

This project uses Supabase Auth with multiple login paths and a unified callback page. This document explains the signup flow and how the callback handles various auth types.

## Overview
- Auth provider: Supabase
- Client: @supabase/ssr browser client
- Callback route: /auth/callback (pages router)
- User profile table: public.profiles
- Edge function: supabase/functions/user-management/index.ts (creates profiles from auth webhooks and provides username management)

## Supported auth types
1) Email/password signup (with confirm email)
   - Initiated from AuthContext.signUp(). We use an implicit-flow Supabase client for cross-device confirmations and set emailRedirectTo to /auth/callback.
   - Confirmation link can arrive as:
     - Query with ?type=signup&token_hash=... (or ?token=...)
     - URL hash with #access_token=...&refresh_token=...

2) Magic link sign-in
   - Initiated from AuthContext.signInWithMagicLink() using the implicit-flow client and emailRedirectTo /auth/callback.
   - Callback includes #access_token and #refresh_token in URL hash.

3) OAuth via Google (PKCE)
   - Initiated from AuthContext.signInWithGoogle().
   - Callback typically arrives with ?code=... and a PKCE code verifier stored locally.

4) Anonymous guest sign-in
   - Initiated from AuthContext.signInAsGuest().
   - Creates or updates a guest profile immediately on the client.

## Callback handler: /auth/callback
File: src/pages/auth/callback.tsx

The callback supports all three Supabase return styles, in this priority order:

1) PKCE OAuth code exchange
   - Condition: code is present in query AND a PKCE code verifier exists in storage (localStorage/cookie)
   - Action: sb.auth.exchangeCodeForSession(code)
   - Notes: We prefer this path even if a type= param is present, because some providers append type alongside code.

2) Email confirmation or magic link via token hash (no tokens in hash)
   - Condition: type is signup or magiclink AND token_hash (or token) exists in the query AND no access_token in the URL hash
   - Action: sb.auth.verifyOtp({ type: 'signup' | 'magiclink', token_hash })

3) Implicit flow (tokens in URL hash)
   - Condition: #access_token and #refresh_token are in the URL hash
   - Action: sb.auth.setSession({ access_token, refresh_token })

After establishing the session:
- We clean the URL (remove code/hash) to prevent re-processing on refresh.
- We fetch the session (sb.auth.getSession()) and proceed only if valid.
- We ensure a profile exists:
  - Primary path: Auth webhook (user-management edge function) creates the profile from user.created.
  - Safety net: If profile isn’t found yet, we upsert a minimal profile { id, username } with onConflict: 'id' and ignoreDuplicates: true to avoid 409s.
- Redirect to /.

## Username rules (provider-supplied usernames)
Handled in supabase/functions/user-management/index.ts during user.created webhook:
- If the provider supplies user_metadata.username:
  - Validate with _shared/username-filter.ts (length, characters, reserved words/prefixes, profanity, blacklist, common patterns).
  - If invalid: fallback to user_<8-random>.
  - If valid but taken: try base, base1..base5; if still taken, fallback to user_<8-random>.
  - Final username is lowercased and trimmed.
- If no username provided: use user_<8-random>.

## AuthContext behavior
File: src/contexts/AuthContext.tsx

- Maintains user, session, loading, profileUsername, isAdmin.
- On mount and periodically:
  - validateAndRefreshSession() checks/refreshes the session.
  - updateUserState() sets provisional username from user_metadata.
  - fetchProfile() attempts to load profile (username, is_admin).
- After sign-in (including Google) and on initial load if a session exists but the profile isn’t ready yet:
  - waitForProfile() polls fetchProfile every 400ms for up to ~5s to absorb webhook delays so the UI shows the user dropdown without manual refresh.

## Environment settings
- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.
- Supabase Auth redirect URLs should include your callback:
  - http://localhost:3000/auth/callback (dev)
  - https://your-domain/auth/callback (prod)

## Common issues & resolutions
- 400 “both auth code and code verifier should be non-empty” when confirming email
  - Caused by trying to exchange a code without a PKCE verifier. The callback now ensures we only exchange when a verifier exists; otherwise we verifyOtp or setSession.

- 409 Conflict on profiles insert
  - Caused by the webhook and client racing to create a profile. The safety net now upserts with onConflict: id and ignoreDuplicates.

- No user dropdown until refresh (Google)
  - Caused by webhook delay creating the profile. We now poll briefly after sign-in to populate profileUsername quickly.

