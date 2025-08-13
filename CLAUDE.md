# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Real-time multiplayer chess application with a unique "ban move" mechanic. In Ban Chess, before each player makes a move, their opponent selects one legal move to ban, forcing constant adaptation and strategic thinking.

## Ban Chess Rules

- **Continuous Banning**: Opponent bans ONE move before EVERY move throughout the entire game
- **Turn Sequence**: 
  1. Your turn to move → Opponent sees all legal moves
  2. Opponent selects one move to ban
  3. You play any remaining legal move
- **Time Management**: Ban selection counts against the banning player's clock
- **Status**: Core mechanic implemented but not working correctly

## Tech Stack

- **Next.js 14** (Pages Router) with TypeScript
- **Supabase** for database, authentication, and real-time
- **Material-UI** + **Framer Motion** for UI
- **Chess.ts** for game logic
- **Lichess-inspired** UI design

## State Management Architecture

### Current Implementation
- **Single Interface**: Components only use `useGame()` hook from GameContextV2
- **Encapsulated Implementation**: TanStack Query + Zustand working together internally
- **Clear Separation**: Server state (React Query) vs UI state (Zustand)
- **Real-time Updates**: Supabase subscriptions trigger React Query invalidation

### Architecture Rules
1. **Never import `useGameStore` directly in components** - use `useGame()` instead
2. **GameContextV2 is the single source of truth** for all game-related state
3. **Zustand store is internal implementation detail** - not exposed to components

### State Categories
- **Server State** (via React Query): Game data, moves, bans, player info
- **UI State** (via Zustand): Animations, highlights, phase transitions
- **Auth State** (via AuthContext): User session, profile, authentication

## Authentication System

### Test Mode (`NEXT_PUBLIC_USE_TEST_AUTH=true`)
- **Query Parameter Auth**: Navigate with `?auth=username` to authenticate as existing user
- **Guest Authentication**: "Continue as Guest" button for anonymous users
- **Clean Session**: Use `?clean=true` to force logout
- **Color-Based Testing**: Use `?as=white` or `?as=black` to quickly test as specific color:
  - `/game?as=white` - Creates new game, authenticates as white player
  - `/game?as=black` - Creates new game, authenticates as black player
  - `/game/[id]?as=white` - Switches auth to white player of existing game
  - `/game/[id]?as=black` - Switches auth to black player of existing game
  - Board orientation automatically matches the selected color
  - Parameter persists throughout the session (never removed)

## Testing Infrastructure

### Two-Player Debugging Setup
Full two-player debugging with parallel sub-agents for testing multiplayer functionality.

#### Browser Configuration
- **Player 1**: Playwright MCP browser
- **Player 2**: Puppeteer MCP browser with proper window resizing

#### Initialization Process
1. Start dev server with test auth enabled:
   ```bash
   npx dotenv -v NEXT_PUBLIC_USE_TEST_AUTH=true -- bun run dev
   ```

2. Launch two parallel sub-agents using Task tool:
   ```
   Sub-agent 1 (Playwright MCP):
   - Navigate to http://localhost:3000?clean=true
   - Click "Continue as Guest" to authenticate
   - Controls Player 1
   
   Sub-agent 2 (Puppeteer MCP):
   - Navigate with launch options for proper resizing:
     launchOptions: {
       "headless": false,
       "defaultViewport": null,
       "args": ["--window-size=1200,800", "--start-maximized"]
     }
   - Navigate to http://localhost:3000?clean=true
   - Click "Continue as Guest" to authenticate
   - Controls Player 2
   ```

#### Test Agent Communication
- TestAgentComms panel appears at bottom when `NEXT_PUBLIC_USE_TEST_AUTH=true`
- Master/Sub checkboxes for agent identification
- Message channels for coordination between agents
- Messages cleared automatically with `?clean=true` parameter

#### Authentication Flow
1. Use `?clean=true` to force logout and clear sessions
2. Both agents authenticate as guest users independently
3. Each agent gets unique guest username (e.g., user_xxxxx)
4. Agents can now interact as separate players

## Development Commands

```bash
# Development
bun run dev              # Start dev server
bun run build            # Build for production (most important check)

# Package Management
npm install [package]    # Use npm for package management
bun run [script]        # Use bun for running scripts
```

## Key Services & Components

- **GameService**: `src/services/gameService.ts`
- **GameStore**: `src/stores/gameStore.ts` 
- **GameContextV2**: `src/contexts/GameContextV2.tsx`
- **GameBoardV2**: `src/components/GameBoardV2.tsx`

## Important Notes

- Project uses **Pages Router**, not App Router
- TypeScript strict mode is **disabled**
- Supabase Realtime for WebSocket connections
- Source of truth for game state is Supabase database