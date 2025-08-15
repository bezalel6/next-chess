# CLAUDE.md

## Project Overview
Real-time multiplayer chess with Ban Chess variant - Black bans one of White's moves before every turn.

## Tech Stack
- Next.js 14 (Pages Router) + TypeScript
- Supabase (database, auth, realtime)
- Material-UI + Framer Motion
- Chess.ts for game logic

## Ban Chess Rules
1. Black bans one of White's possible first moves
2. White makes first move (avoiding the ban)  
3. White bans one of Black's possible moves
4. Black makes their move (avoiding the ban)
5. Pattern continues: After each move, the player who just moved bans opponent's next move

## Key Files
- `src/services/gameService.ts` - Game operations
- `src/stores/unifiedGameStore.ts` - State management (Zustand)
- `src/components/GameBoardV2.tsx` - Board UI
- `supabase/functions/_shared/game-handlers.ts` - Server logic

## Development
```bash
bun run dev     # Start dev server
bun run build   # Build for production
```

## Testing
### Quick Test Game Creation
Navigate to `/test/new-game?player=white` or `/test/new-game?player=black` to:
- Automatically create test users
- Create a new game
- Authenticate as the selected player  
- Redirect to the game page

This eliminates the need for manual sign-up/login during development.

## Important Notes
- TypeScript strict mode disabled
- Supabase is source of truth
- Move/ban validation happens server-side

## Current Status (2025-08-15)

### Row Level Security (RLS) Fix - COMPLETED ✅
**Problem**: Database operations were failing with "permission denied" errors (403 Forbidden)

**Root Cause**: 
- Conflicting RLS policies from multiple migrations
- Overly restrictive policies blocking edge functions despite using service_role
- Policies not properly configured for different roles (anon, authenticated, service_role)

**Solution Applied**: 
Created comprehensive RLS migration (`20251218_comprehensive_rls_fix.sql`) that:
1. Drops all existing conflicting policies to start fresh
2. Creates clean, simple policies for each role:
   - `service_role`: Full bypass of RLS (admin access)
   - `authenticated`: Full CRUD for local development
   - `anon`: Read-only access
3. Grants proper database-level permissions to each role
4. Sets default privileges for future tables

**To Run Services**:
```bash
# Start Supabase (if not running)
npx supabase start

# Start edge functions
npx supabase functions serve

# Start dev server (kills existing process on port 3000)
npm run dev:local
```

**Test Commands**:
```bash
# Create test user and get token
curl -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'

# Test with authenticated token
curl -X POST "http://127.0.0.1:54321/functions/v1/matchmaking" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"operation":"joinQueue"}'
```

## Current Status (2025-08-15)

### Ban Move Updates Issue - FIXED ✅
**Problem**: Banned moves weren't appearing in the moves list when they occurred

#### The Debugging Journey & Wrong Turns:
1. **Initial Misdiagnosis**: Thought the issue was that the store's `game` object wasn't being updated with PGN
   - Added `store.updateGame(data)` to ban mutation's onSuccess handler
   - Added PGN to ban broadcast payload
   - This partially worked but wasn't the real issue

2. **Discovery of Root Cause**: 
   - The MoveHistoryV2 component was fetching from the `moves` table via RPC
   - Ban records were NOT being inserted into the `moves` table when bans occurred
   - They were only inserted when an actual chess move was made (with the ban info attached)

3. **PGN vs Database Approach**:
   - Original MoveHistory component parsed PGN strings (inefficient, doesn't scale)
   - MoveHistoryV2 uses database queries (much more performant)
   - But MoveHistoryV2 wasn't getting ban data because bans weren't in the database

#### Final Solution:
1. **Edge Function (`supabase/functions/_shared/game-handlers.ts`)**:
   - Modified `handleBanMove` to insert a ban record into `moves` table immediately
   - Ban-only records have empty move fields but populated ban fields

2. **MoveHistoryV2 Component**:
   - Updated to handle ban-only records (no SAN, but has banned_from/banned_to)
   - Displays them with special formatting: "e2e4 banned" with red icon
   - Uses Map for efficient move pairing by move number

3. **BoardMoveInput Component**:
   - Enhanced to accept both formats: "e2e4" and "e2 e4"
   - More flexible input handling for better UX

#### Performance Benefits:
- **Before**: Parsing PGN strings on every update (O(n) string operations)
- **After**: Direct database queries with indexed lookups (O(1) fetches)
- Real-time updates via Postgres triggers instead of string manipulation
- Structured data instead of regex parsing

### Local Game - BROKEN
**Problem**: Local game board renders but clicking doesn't work
**Root Cause**: Incomplete refactoring from old structure to unified store

**Missing Functions** (referenced but not implemented):
- `getLocalPossibleMoves`
- `isLocalMoveBanned` 
- `getLocalGameStatusMessage`
- `selectLocalBan` (exists but references old `localGame` object)
- `makeLocalMove` (exists but references old structure)
- `resetLocalGame`

**Status**: Local game needs complete reimplementation of game logic functions in unified store

### Files Recently Modified
- `src/hooks/useGameQueries.ts` - Fixed hooks ordering, added store updates
- `src/components/MoveHistory.tsx` - Added null safety, improved PGN parsing
- `src/stores/unifiedGameStore.ts` - Added logging, updated local game init
- `src/components/LocalGameBoard.tsx` - Attempted fix but functions missing
- `src/components/LocalMoveHistory.tsx` - Simplified to use MoveHistory component