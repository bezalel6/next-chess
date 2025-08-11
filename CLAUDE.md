# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time multiplayer chess application with a unique "ban move" mechanic, inspired by Lichess's design and functionality. In Ban Chess, before each player makes a move, their opponent selects one legal move to ban, forcing constant adaptation and strategic thinking.

## ⚠️ CRITICAL ISSUES IDENTIFIED AND SOLUTIONS

### 1. **Fundamental Game Flow Misunderstanding (FIXED)**
**Issue**: The junior developer misunderstood Ban Chess as having an "initial ban phase" where each player bans one move at the start, then plays normal chess. This is completely wrong.

**Correct Implementation**: Ban Chess requires the opponent to ban ONE move before EVERY single move throughout the entire game:
- White's turn → Black bans one of White's moves → White plays
- Black's turn → White bans one of Black's moves → Black plays
- This continues until checkmate/draw

**Solution Implemented**:
- Updated game flow to properly implement continuous banning
- Fixed `banning_player` field to correctly alternate after each move
- Added `current_banned_move` to track the banned move for each turn
- Created `ban_history` table for proper tracking

### 2. **Inconsistent Local vs Online Games**
**Issue**: Local games had a different implementation (two initial bans only) vs online games (accidentally closer to correct).

**Solution**: Unified game logic - both modes now use the same continuous ban-move cycle.

### 3. **Poor State Management**
**Issue**: Game state scattered across database, PGN comments, and local state. Banned moves stored as PGN comments (hacky, not queryable).

**Solution Implemented**:
- Added Zustand store for UI state (`src/stores/gameStore.ts`)
- Added TanStack Query for server state management
- Moved banned moves to proper database columns (`current_banned_move`, `ban_history`)
- Clear phase tracking: `waiting_for_ban`, `selecting_ban`, `waiting_for_move`, `making_move`

### 4. **Confusing UX for Ban Phase**
**Issue**: Unclear visual feedback, no ban timeline, confusing state transitions.

**Solution Implemented**:
- `BanPhaseOverlay` component with clear indicators
- `BanTimeline` component showing ban history
- Framer Motion animations for smooth transitions
- Different sound effects for bans vs moves
- Red outline on board during ban selection

## Modern Architecture Stack

### Core Technologies
- **Next.js 14** (Pages Router) with TypeScript
- **Supabase** for database, authentication, and real-time functionality
- **Material-UI** for component styling
- **Chess.ts** for chess logic
- **WebSockets** via Supabase Realtime for live game updates

### New Additions for Production Quality
- **TanStack Query** - Server state management with optimistic updates
- **Zustand** - Client-side state management for UI
- **Framer Motion** - Smooth animations and transitions
- **Puppeteer** - E2E testing infrastructure

### Ban Chess Mechanic - Core Rules
- **Dynamic Ban System**: Before EVERY move, the opponent bans one of your legal moves
- **Turn Sequence**:
  1. It's your turn to move (e.g., White's turn)
  2. Opponent (Black) sees all your legal moves
  3. Opponent selects ONE move to ban
  4. You must play any remaining legal move (except the banned one)
- **Continuous Throughout Game**: This happens before every single move, not just at the beginning
- **Strategic Depth**: Players must constantly decide which opponent move is most dangerous to prevent
- **Psychological Element**: Predicting what your opponent wants to play becomes crucial
- **Time Management**: Both banning phase and moving phase consume clock time

## Essential Commands

### Development
```bash
npm run dev              # Start server with production env vars
npm run dev:local        # Start server with local env vars
npm run supabase:start   # Start local Supabase instance
```

### Code Quality
```bash
npm run check            # Run both lint and typecheck
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run typecheck        # TypeScript type checking
npm run format:check     # Check Prettier formatting
npm run format:write     # Auto-format with Prettier
```

### Build & Deploy
```bash
npm run build            # Build for production
npm run start            # Start production server
npm run preview          # Build and start preview
```

### Database
```bash
npm run typegen          # Generate TypeScript types from Supabase schema
npm run db:remote-reset  # Reset remote database (use with caution)
```

## UI/UX Design Philosophy

### Lichess-Inspired Layout
The application follows Lichess's proven design patterns:
- **Dark theme**: #161512 background for reduced eye strain
- **Three-column layout**: Left sidebar (game info/chat), center board, right sidebar (move history)
- **Compact move history**: Fixed height (~400px) with scrollable content
- **Player cards**: Show username, rating, and live time display above/below board
- **Board controls**: Flip (rotate icon with toggle state), analysis, and share buttons below board

### Layout Specifics
- **Board size**: 560px width with responsive scaling
- **Board container**: Dark background with rounded corners
- **Sidebars**: 280px width on desktop, hidden on mobile
- **Move history height**: 400px max, shorter than board (60vh max)
- **Color scheme**: 
  - Background: #161512
  - Secondary bg: rgba(255,255,255,0.03)
  - Text primary: #bababa
  - Text secondary: #888
  - Highlight: rgba(255,204,0,0.25) for selected moves
  - Active toggle: rgba(255,255,255,0.1) background

### Game Modes
- **Online games**: Full UI with scoreboards (below board), chat, and spectator features
- **Local games**: Simplified UI without scoreboards or online features
- **Spectator mode**: View-only access with both players' information displayed

## Architecture

### Core Structure
- **Pages Router**: Using Next.js Pages Router (not App Router)
- **Custom Server**: `src/server/server.ts` handles Next.js + Supabase Realtime
- **Realtime System**: Supabase channels for game state, presence, and matchmaking
- **Edge Functions**: Supabase functions in `/supabase/functions/` for game operations

### Key Services
- **GameService** (`src/services/gameService.ts`): Game state management
- **MatchmakingService** (`src/services/matchmakingService.ts`): Player matching
- **UserService** (`src/services/userService.ts`): User management

### State Management
- **React Contexts**:
  - `AuthContext`: User authentication state
  - `ConnectionContext`: WebSocket connection status
  - `GameContext`: Current game state and moves

### Database Schema
- Uses Supabase (PostgreSQL) with migrations in `/supabase/migrations/`
- Types auto-generated to `src/types/database.ts`
- Shared types copied to `supabase/functions/_shared/database-types.ts`

### Real-time Features
- **Game Updates**: Live move broadcasting
- **Presence**: Online player tracking
- **Matchmaking Queue**: Real-time queue management
- **Time Controls**: Server-managed chess clocks

## New Components Created

### State Management
- **`src/stores/gameStore.ts`** - Zustand store for game UI state
- **`src/contexts/GameContextV2.tsx`** - Simplified game context using TanStack Query
- **`src/hooks/useGameActions.ts`** - Game actions with optimistic updates

### UI Components  
- **`src/components/BanPhaseOverlay.tsx`** - Clear ban phase indicators
- **`src/components/BanTimeline.tsx`** - Visual ban history timeline
- **`src/components/GameBoardV2.tsx`** - Refactored game board
- **`src/components/LichessBoardV2.tsx`** - Simplified board with proper ban logic

### Testing Infrastructure
- **`e2e/`** - Complete E2E testing setup with Puppeteer
- **`NEXT_PUBLIC_DISABLE_CAPTCHA=true`** - Environment variable for testing

## Development Guidelines

### TypeScript Configuration
- Strict mode is **disabled** - type safety is relaxed
- Path alias: `@/*` maps to `./src/*`
- Module resolution: ESNext with Bundler

### Environment Variables
Required in `.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side only)

### Testing Approach
No test framework is currently configured. Verify changes by:
1. Running type checking: `npm run typecheck`
2. Running linting: `npm run lint`
3. Manual testing in development environment

### Key Patterns
- **Server Components**: Not used (Pages Router)
- **API Routes**: Located in `src/pages/api/`
- **Supabase Client**: Different instances for client/server contexts
- **Chess Logic**: Uses chess.ts library for move validation
- **Sound Effects**: Located in `/public/sounds/`
- **Time Controls**: Server-managed for fairness
- **Game state**: Source of truth in Supabase database
- **WebSocket reconnection**: Critical for user experience

### Component Patterns
- **Player Cards**: Integrated time display with username and rating (1956 default)
- **Move History**: Table format with move numbers, highlights selected moves with golden background
- **Board Controls**: Toggle buttons with active state indication (CachedIcon for flip)
- **Ban Phase UI**: Shows when opponent is selecting a move to ban, displays which move was banned
- **Game Over Overlay**: Modal-style display over the board
- **Left Sidebar**: Game info, chat room placeholder, and notes textarea
- **Scoreboard**: Only shown for online games, positioned below board

### State Management Patterns
- **GameContext**: Centralized game state with actions
- **Local vs Online**: `isLocalGame` flag determines UI features
- **Board Orientation**: Toggleable with visual feedback (active state when flipped)
- **Move Navigation**: Keyboard shortcuts (arrows) for move history traversal
- **Ban Move Display**: Visual indicators showing which moves were banned each turn

## Important Notes

### Technical Constraints
- The project uses **Pages Router**, not App Router - avoid App Router patterns
- TypeScript strict mode is **disabled** - type safety is relaxed
- Supabase Realtime requires careful connection management
- WebSocket reconnection logic is critical for user experience

### Correct Game Flow (IMPORTANT - This was previously wrong!)
1. **Matchmaking**: Players join queue and get paired
2. **Game Start**: 
   - Initial state: `turn=white`, `banning_player=black`
   - Black must ban one of White's opening moves
3. **Each Turn Cycle**:
   - **Ban Phase**: Opponent of current turn player selects one move to ban
   - **Move Phase**: Current turn player makes any remaining legal move
   - **State Update**: After move, `banning_player` is set to the player who just moved
   - **Repeat**: Other player now faces a ban before their move
4. **Example Sequence**:
   - Black bans e2e4 → White plays d2d4 → `banning_player=white`
   - White bans d7d5 → Black plays e7e6 → `banning_player=black`
   - Black bans Ng1f3 → White plays Nb1c3 → continues...
5. **Game End**: Checkmate/stalemate/draw (including if only banned move remains)

### Ban Phase Details
- **Visual Feedback**: Banned moves are grayed out/disabled on the board
- **Time Pressure**: Ban selection counts against opponent's clock
- **UI State**: Clear indication when in "waiting for ban" vs "your turn to ban" vs "your turn to move"
- **Move Preview**: When banning, opponent can hover over pieces to see legal moves
- **Ban Confirmation**: Selected ban must be confirmed before taking effect

### UI Behavior
- **Responsive**: Desktop-first with mobile adaptations
- **Real-time updates**: Immediate move reflection via WebSockets
- **Smooth animations**: Board uses lichess-board component
- **Accessibility**: Keyboard navigation for move history
- **Visual feedback**: Active states for toggles and selections
- **Scroll behavior**: Move history auto-scrolls to latest move
- **Time format**: MM:SS display in monospace font

### Development Workflow
- Use `bun run dev` for development with hot reload
- Always run `bun run typecheck` before committing
- Check `bun run lint` for code quality
- **E2E Testing**: `NEXT_PUBLIC_DISABLE_CAPTCHA=true bun run test:e2e`
- **Debug E2E**: `HEADLESS=false SLOW_MO=100 bun run test:e2e:debug`

### Key Refactor Notes
- **DO NOT** trust old comments about "initial ban phase" - they're wrong
- The game uses continuous banning throughout, not just at start
- `banning_player` field indicates who must ban next (not who is currently banning)
- After each move, `banning_player` is set to the player who just moved
- Banned moves should be stored in database, not PGN comments
- Use the V2 components (`GameBoardV2`, `GameContextV2`) for the refactored version