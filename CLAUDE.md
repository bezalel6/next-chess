# CLAUDE.md

Last updated: 2025-08-22

## Project Overview
Real-time multiplayer chess with the Ban Chess variant. Before each turn, the non-moving player bans one legal move from the opponent.

## Tech Stack
- Next.js 15.4 (Pages Router) + TypeScript
- React 19.1
- Supabase (Database, Auth, Realtime, Edge Functions)
- Material-UI (MUI) 5.15
- Framer Motion 12
- chess.ts 0.16 (rules engine)
- Zustand 5 (state management)

## Current Architecture (Unified, server-authoritative)
- Single source of truth: The server (Supabase Edge Functions + Postgres) authoritatively validates moves and bans.
- Client state: Centralized in `useUnifiedGameStore` (Zustand). UI reads/updates solely through this store.
- Realtime sync: Lightweight, explicit sync via a dedicated hook (`useGameSync`) that subscribes to relevant channels and applies state updates.
- Legacy removal: All legacy hooks/services (presence, clock sync, React Query game queries, LocalGamePanel) have been removed. See `docs/LEGACY_REMOVAL.md` for details.
- Components: Board and panels call `GameService` methods and update the store; no deprecated hooks in components or tests.

### Key Files
- `src/stores/unifiedGameStore.ts` — Centralized game state and actions
- `src/hooks/useGameSync.ts` — Realtime game synchronization
- `src/services/gameService.ts` — Server operations (move, ban, start/end)
- `src/components/LichessBoardV2.tsx` — Board UI and interactions
- `src/components/GamePanel.tsx` — Move history, actions, and PGN
- `src/contexts/AuthContext.tsx` — Session management (with refresh/recovery)
- `src/contexts/ConnectionContext.tsx` — Realtime connection plumbing
- `supabase/functions/_shared/game-handlers.ts` — Server-side game logic
- `docs/LEGACY_REMOVAL.md` — What was removed and why
- `docs/SECURITY_HARDENING.md` — Security posture and guidance

## Ban Chess Rules (Concise)
1. Black bans one of White’s possible first moves.
2. White plays a move that avoids the ban.
3. White bans one of Black’s possible moves.
4. Black plays a move that avoids the ban.
5. Repeat: after each move, the player who just moved bans the opponent’s next move.

Checkmate condition: If a king is in check and the side to move has exactly one legal move, the opponent can ban that move, resulting in no legal moves to escape check.

## Development
```bash path=null start=null
npm run dev       # Start dev server (remote Supabase)
npm run dev:local # Start dev server with local Supabase
```
Notes:
- Use npm for all scripts (bun not supported).

## Linting & TypeScript
- ESLint uses a flat config at `eslint.config.mjs`.
- Status: `npm run lint` → 0 errors. Non-blocking warnings remain by design.
- TypeScript 5.9 is in use; @typescript-eslint prints a support warning, which is acceptable for now.

## Testing
### Playwright (E2E)
End-to-end tests validate turn mechanics, bans, and critical flows. For testing UI/UX issues like board resizing, visual element visibility, and interactive features, use the playwright-automation-executor MCP agent to perform browser-based testing rather than relying on TypeScript type checking.
```bash path=null start=null
npm run test          # run all tests
npm run test:ui       # run with Playwright UI
npm run test:debug    # headed + debug logs
npm run test:headed   # headed only
```
Test entry: `tests/e2e/ban-chess.spec.ts`.

### In-browser Logic Tests
A logic suite exists under `/test/logic-test` to exercise core Ban Chess flows in the browser.

## Authentication
Client performs minimal validation; server performs enforcement via Supabase Auth webhook + `user-management` function.
- `src/components/auth-form.tsx` — light Zod checks only
- `src/contexts/AuthContext.tsx` — session validation/refresh
- `supabase/functions/user-management/index.ts` — username policy + profile creation (handles both webhooks and authenticated API calls)
- `src/pages/auth/callback.tsx` — post-signup redirect

**Note:** The user-management edge function handles three request types:
1. Standard Webhooks (with webhook headers)
2. Supabase Auth Hooks (specific body formats)
3. Regular authenticated API calls (Bearer token)

See `docs/USER_MANAGEMENT_FIX.md` for details on the 2025-08-22 fix that properly routes these request types.

## Important Notes
- Server-authoritative move/ban validation
- Supabase is the state of record; client replays updates received via realtime
- Client store is the only state consumed by UI

## Zustand Store Best Practices
**CRITICAL: Prevent infinite loops by using individual selectors**

When using Zustand stores with React components, NEVER destructure multiple properties in a single selector:

```typescript
// ❌ BAD - Causes infinite loops and "getSnapshot should be cached" errors
const { game, messages, chatError, sendMessage } = useStore(s => ({
  game: s.game,
  messages: s.messages,
  chatError: s.chatError,
  sendMessage: s.sendMessage,
}));

// ✅ GOOD - Each selector is independent, prevents unnecessary re-renders
const game = useStore(s => s.game);
const messages = useStore(s => s.messages);
const chatError = useStore(s => s.chatError);
const sendMessage = useStore(s => s.sendMessage);
```

This pattern prevents FormControl and other MUI components from triggering infinite update loops when store values change frequently (e.g., countdown timers, typing indicators).

## Upgrade & Ops Notes
See these docs for deeper details:
- `docs/SECURITY_HARDENING.md`
- `docs/LEGACY_REMOVAL.md`
- Research notes in `research/` for UX and realtime best practices

## Next.js 15.4 Notes
The app runs on Next.js 15.4 Pages Router. Avoid Turbopack and Server Actions (App Router only). Consider optional optimizations in `next.config.js` as documented previously if needed.

## Supabase Configuration & Deployment

### Email Templates
Email templates are stored in `supabase/templates/` and can be pushed to remote using:
```bash
npm run templates:push  # Push email templates via Management API
npm run templates:check # Verify current template configuration
```
These scripts require `SUPABASE_ACCESS_TOKEN` and `PROJECT_REF` in `.env`.

### Configuration Push
To update remote Supabase with local `config.toml` settings:
```bash
npx supabase config push
```
This syncs auth settings, email templates, and other configurations from `supabase/config.toml` to your remote project.

## Supabase Troubleshooting (Quick Reference)
For comprehensive steps, keep using the "Supabase Troubleshooting Playbook" section from earlier revisions. Highlights:
- Prefer the Session Pooler (IPv4) for DB connections.
- Reset locally with `npx supabase@beta db reset --linked --no-seed` when needed.
- Repair migration drift with `supabase migration repair`.
- Grant EXECUTE per function signature when overloads exist.

## Current Status (2025-08-22)
- Unified store + sync strategy in place; legacy hooks/services removed.
- Lint is clean (0 errors); warnings intentionally left.
- Local and online flows are functional; components use `GameService` + unified store.
- Further cleanup and optimization guidance is tracked in docs and research files.

- To get the database types to reflect the correct and up-to-date database, you will: apply       all the migrations to the local supabase, and once thats configured correctly, run npm typegn