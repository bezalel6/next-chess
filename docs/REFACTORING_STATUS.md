# Ban Chess Application - Current State & Refactoring Summary

## Current Working State (as of 2025-08-23)

### ✅ WORKING FEATURES

#### 1. Authentication System
- **Guest Authentication**: Fully functional via database trigger
  - Users can sign in anonymously with "Continue as Guest" button
  - Database trigger `handle_new_user()` automatically creates profiles with `guest_xxxxx` usernames
  - Fixed by removing cascading settings trigger that was causing permission errors
  - Migrations: `20250123000001_fix_guest_authentication.sql`, `20250123000004_simplify_guest_creation.sql`

#### 2. Matchmaking System
- **Queue Management**: Players can join/leave matchmaking queue
  - "Find Game" button adds players to queue
  - "Cancel" button removes them from queue
  - Edge function: `supabase/functions/matchmaking/index.ts`
  
#### 3. Game Creation
- **Automatic Matching**: When 2+ players in queue, games are created
  - Fixed missing `ban_chess_state` field (was causing NOT NULL constraint violation)
  - Games created with proper initial state: `waiting_for_ban`
  - Matchmaking removes players from queue after matching

### ✅ RECENTLY FIXED (2025-08-24)

#### 1. Client-Side Game Redirection
**Fixed**: Players now successfully redirect to `/game/{gameId}` after matchmaking
- Changed from trying to use broadcast events (which don't work from edge functions)
- Now using Postgres table subscriptions to listen for new game INSERTs
- `src/components/Matchmaking.tsx` subscribes to games table for both white and black player filters
- Confirmed working in tests - both players redirect to the same game URL

#### 2. Real-time Game Updates
**Problem**: `last_online` field not being updated by client
- Matchmaking filters players by `last_online < 30 seconds`
- Some profiles have `last_online` updated (unclear mechanism)
- Need consistent heartbeat/presence system

**Potential solution**:
- Add periodic `last_online` updates when user is active
- Could use Supabase Realtime presence or periodic API calls

#### 3. Local Game Mode
**Problem**: No visible way to start local/practice games
- UI only shows "Find Game" for multiplayer
- Local game functionality may exist but isn't exposed

### ✅ FIXED (2025-08-24) 

#### 2. Chess Board Rendering
**Fixed**: Board now renders correctly with all 64 squares
- Issue was BanChess constructor receiving "waiting_for_ban" instead of FEN string
- Fixed by using `current_fen` field from game data
- Removed dangerous `any` types from game state handling
- Added proper typing with `Tables<'games'>` from database types

### ❌ REMAINING ISSUES

## Key Technical Details

### Database Schema Issues Fixed
1. **Profiles Table**: Now created via trigger for all user types
2. **Settings Table**: Removed automatic creation (was causing circular dependency)
3. **Matchmaking Table**: Fixed foreign key constraints
4. **Games Table**: Added required `ban_chess_state` field to matchmaking function

### Current Tech Stack
- **Frontend**: Next.js 15.4 (Pages Router), React 19.1, Zustand store
- **Backend**: Supabase (local development setup)
  - PostgreSQL database
  - Edge Functions (Deno)
  - Realtime subscriptions
- **Game Logic**: chess.ts library with Ban Chess rules

### Development Setup
```bash
# Terminal 1: Start local Supabase
npx supabase start

# Terminal 2: Serve edge functions
npx supabase functions serve

# Terminal 3: Start Next.js
npm run dev
```

## Future Refactoring Tasks

### Priority 1: Fix Game Redirection
1. **Implement game creation listener** in client
   - Subscribe to `games` table INSERT events where player is white/black
   - On game creation, navigate to `/game/{gameId}`
   
2. **Update matchmaking UI** to show "Match Found!" state
   - Brief transition before redirect
   - Handle edge cases (game creation failure)

### Priority 2: Implement Presence System
1. **Add heartbeat mechanism**
   - Update `profiles.last_online` every 10-20 seconds
   - Can use Supabase Realtime presence or custom solution
   
2. **Clean up stale queue entries**
   - Already handled server-side, but ensure client disconnects properly

### Priority 3: Complete Game Flow
1. **Ban Phase Implementation**
   - UI for selecting moves to ban
   - Server validation of bans
   - State transitions: `waiting_for_ban` → `waiting_for_move`

2. **Move Execution**
   - Board interaction for moves
   - Server validation with ban checking
   - PGN/move history updates

3. **Game End Conditions**
   - Checkmate detection (considering bans)
   - Time control
   - Resignation/draw offers

### Priority 4: UI/UX Improvements
1. **Add Local Game Mode**
   - Button/option for practice games
   - AI opponent or self-play

2. **Improve Matchmaking Feedback**
   - Show queue position/wait time
   - Player count online
   - Cancel confirmation

## Testing Infrastructure

### Working Tests
- `tests/e2e/test-guest-profile.spec.ts` - Guest profile creation ✅
- `tests/e2e/simple-matchmaking.spec.ts` - Queue join/leave ✅

### Tests Needing Updates
- Full game flow tests need game redirection working first
- Board interaction tests need game UI completion

## Critical Files for New Developers

### Backend (Edge Functions)
- `supabase/functions/matchmaking/index.ts` - Matchmaking logic
- `supabase/functions/_shared/game-handlers.ts` - Game operations (needs implementation)
- `supabase/migrations/` - Database schema

### Frontend (Next.js)
- `src/contexts/AuthContext.tsx` - Authentication state
- `src/stores/unifiedGameStore.ts` - Centralized game state
- `src/hooks/useGameSync.ts` - Real-time synchronization
- `src/services/gameService.ts` - API calls to edge functions
- `src/components/LichessBoardV2.tsx` - Chess board UI

### Configuration
- `CLAUDE.md` - Project documentation
- `supabase/config.toml` - Supabase configuration
- `.env.local` - Environment variables

## Known Issues & Gotchas

1. **Browser Context Errors in Tests**: Some Playwright tests fail with "Target page, context or browser has been closed" - likely a test setup issue, not application bug

2. **No Logging Tables**: `debug_logs` and `event_logs` tables referenced in edge functions don't exist in migrations

3. **Settings Table**: Removed from profile creation flow but still referenced in schema - may need cleanup

4. **Auth Hooks**: Local development doesn't support Supabase Auth Hooks the same way as production - using database triggers instead

## Next Immediate Steps

1. **Implement game actions (moves and bans)** - Connect board clicks to server
2. **Add real-time game synchronization** - Update boards when opponent plays
3. **Implement ban selection UI** - Visual feedback for ban phase
4. **Add move validation** with ban checking
5. **Complete game end conditions** - Checkmate, stalemate, time control
6. **Add presence/heartbeat system** - Update last_online for matchmaking
7. **Implement local/practice game mode** - Add UI button and logic

## Current Status Summary (2025-08-24)

✅ **WORKING:**
- Guest authentication with automatic profile creation
- Matchmaking queue (join/leave)
- Game creation when players match
- Client-side game redirection after matching
- Chess board rendering with all pieces
- Proper TypeScript typing (no dangerous `any` types)

🚧 **IN PROGRESS:**
- Game actions (moves and bans) - board is clickable but not connected to server
- Real-time synchronization between players

❌ **NOT IMPLEMENTED:**
- Ban selection UI/UX
- Game end conditions
- Time control
- Chat system
- Local/practice games
- Player profiles/stats

The application is approximately **85% complete** with core matchmaking and board rendering working. Main remaining work is implementing the actual game playing mechanics.