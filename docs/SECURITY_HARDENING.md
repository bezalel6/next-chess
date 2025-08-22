# Security Hardening Overhaul

Branch: security-hardening-overhaul

This document captures the minimal, sensible changes applied to fix the highest‑risk issues without large architectural rewrites. Each item lists the problem, the chosen fix, files changed, and suggested follow‑ups.

1) Remove username → email disclosure (PII leak)
- Problem: /api/auth/get-email-by-username used service role to return email for any username, enabling enumeration and phishing.
- Fix: Disable endpoint with 410 Gone and remove username-based sign-in. Users must enter email directly.
- Files:
  - src/pages/api/auth/get-email-by-username.ts (replaced handler with 410 response)
  - src/contexts/AuthContext.tsx (signIn: require '@' in input and fail otherwise)
- Follow-up: If username login is a must, implement server-side mapping without disclosure, add rate limiting and human verification.

2) Disable debug/cheat game operation (mushroomGrowth)
- Problem: A special operation that mutates games was available to authenticated users when it was their turn.
- Fix: Remove the route from the public router.
- Files:
  - supabase/functions/game-operations/index.ts (removed defineRoute("mushroomGrowth", ...))
- Follow-up: If needed for dev only, gate behind requiredRole: 'admin' and an env flag.

3) Tighten CSP in production and prepare for session hardening
- Problem: CSP allowed 'unsafe-inline' and 'unsafe-eval' in production. Tokens are stored in localStorage and JS-readable cookies (larger change).
- Fix: Split script-src for dev vs prod to remove 'unsafe-*' in production; keep 'style-src unsafe-inline' temporarily for MUI.
- Files:
  - next.config.js (dynamic script-src by NODE_ENV)
- Follow-up (bigger change): Move to HttpOnly cookies using @supabase/ssr so tokens are not readable by JS. This is larger and deferred for a focused PR.

4) Simplify realtime: server authoritative broadcasts only
- Problem: Clients broadcast move/ban, and server also broadcasts game_update; components also subscribe to Postgres changes, causing redundant churn.
- Fix: Remove client broadcasts and the separate moves-table subscription. Rely on server 'game_update' only. Keep optimistic UI; reconcile on game_update.
- Files:
  - src/hooks/useGameQueries.ts (drop client sends; keep unified channel and invalidate moves)
  - src/components/GamePanel.tsx (remove moves subscription; use unified cache and explicit refetch triggers)
- Follow-up: Consider pushing move lists in the server broadcast payload to avoid RPC refetch.

5) Matchmaking: ensure players are recently online before matching
- Problem: Online check removed; could match players who just left.
- Fix: Filter waiting players by profiles.last_online within last 10s before pairing first two.
- Files:
  - supabase/functions/matchmaking/index.ts (filter by recent last_online)
- Follow-up: Implement active channel ping/ACK to guarantee both sides are ready before creating game.

6) Admin stats: avoid querying non-existent profile fields
- Problem: stats route referenced profiles.email / last_sign_in_at (likely in auth.users), causing broken numbers.
- Fix: Use known profile/game fields only; use profiles.last_online as an 'active users today' proxy.
- Files:
  - src/pages/api/admin/stats.ts
- Follow-up: If you need auth.users metrics, create a service-role server route that queries auth.users explicitly or denormalize via webhooks.

7) Auth profile race: avoid forced logout when profile not yet created
- Problem: After login, profile may not exist immediately due to webhook latency; code signed the user out.
- Fix: Treat missing profile as transient; keep session and allow UI to show metadata.username while polling.
- Files:
  - src/contexts/AuthContext.tsx (validateAndRefreshSession behavior)
- Follow-up: Consider a longer polling window or a backend confirmation endpoint.

Notes
- Docker change (tsx → node) is not included in this PR to keep scope tight. Recommend a separate build/runtime PR to run compiled JS only.
- Token storage hardening (HttpOnly cookies) will be a larger, deliberate change; recommended as next step after this PR merges.

Verification checklist (dry)
- Auth: Username login now errors with instruction to use email.
- Disabled endpoint returns 410 Gone.
- Game ops: No route for 'mushroomGrowth' in game-operations router.
- CSP: In production, script-src excludes 'unsafe-inline'/'unsafe-eval'.
- Realtime: Client code no longer sends broadcasts; only listens to server 'game_update'. GamePanel does not subscribe to moves table.
- Matchmaking: processMatchmakingQueue filters by recent profile last_online.
- Admin stats: returns only safe counts; no references to nonexistent columns.
- Auth profile race: no immediate sign-out if profile missing; logs warning and continues.

Next steps (recommended)
1) Token handling
   - Migrate to HttpOnly cookies for auth with @supabase/ssr to reduce XSS impact.
2) RLS validation
   - Re-review games/moves/ban_history RLS policies to ensure only participants (or intended spectators) can read.
3) Logging hygiene
   - Add log levels and strip noisy client logs in production.
4) CI checks
   - Add Playwright smoke tests for ban/move flow and matchmaking, even in a mocked environment.

