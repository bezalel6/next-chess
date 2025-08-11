# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time multiplayer chess application with a unique "ban move" mechanic, inspired by Lichess's design and functionality. In Ban Chess, before each player makes a move, their opponent selects one legal move to ban, forcing constant adaptation and strategic thinking.

### Core Technologies
- **Next.js 14** (Pages Router) with TypeScript
- **Supabase** for database, authentication, and real-time functionality
- **Material-UI** for component styling
- **Chess.ts** for chess logic
- **WebSockets** via Supabase Realtime for live game updates

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

### Game Flow
1. **Matchmaking**: Players join queue and get paired
2. **Game Start**: Standard chess position
3. **Each Turn Cycle**:
   - **Active Player's Turn**: Player to move waits
   - **Opponent Bans**: Opponent reviews all legal moves and selects one to ban
   - **Move Execution**: Active player plays from remaining legal moves
   - **Switch Sides**: Roles reverse for next turn
4. **Continuous Play**: Ban-then-move cycle continues until game end
5. **Game End**: Checkmate/stalemate/draw with rematch option

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
- Use `npm run dev` for development with hot reload
- Always run `npm run typecheck` before committing
- Check `npm run lint` for code quality
- Test ban mechanics for every move in local game mode first
- Verify ban selection UI appears before each move
- Ensure banned moves are properly disabled for that turn only
- Verify UI matches Lichess design patterns
- Ensure scoreboard visibility rules (online only)
- Test board flip toggle state persistence