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

## Testing Infrastructure

### Dual-Agent System
- Uses **Playwright MCP** (and potentially other browser automation MCPs)
- Master agent controls Player 1 and coordinates the game
- Sub-agent controls Player 2 based on master's instructions
- Both run as concurrent sub-agents after dev server is confirmed running

### Running Tests
1. Start dev server: `NEXT_PUBLIC_USE_TEST_AUTH=true bun run dev`
2. Master agent launches and controls game flow
3. Sub-agent follows master's coordination signals

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