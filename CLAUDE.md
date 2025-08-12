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

## Code Change Philosophy

### Minimalist Debugging Approach
When fixing bugs or issues in this codebase:

1. **Targeted Fixes Only**: 
   - Fix EXACTLY what's broken, nothing more
   - Don't refactor adjacent code unless it's the cause
   - Don't add "nice to have" improvements

2. **E2E Test Specific Rules**:
   - Timing issues: Increase by minimum viable amount (100-500ms increments)
   - Never restructure test architecture to fix a simple timing issue
   - Parallel execution is preferred - don't sequentialize unless absolutely necessary

3. **Rate Limit Handling**:
   - Simple delays over complex retry logic
   - One strategic wait over multiple defensive waits
   - If Supabase rate limit: Add ONE delay at auth/setup, not throughout

4. **File Modification Limits**:
   - Bug fix in single component: Touch ONLY that file
   - Cross-component issue: Maximum 2-3 files
   - Architectural change: MUST ask permission first

### Forbidden Patterns (Unless Explicitly Requested)
- Creating new "utility" or "helper" files for one-time fixes
- Adding abstraction layers to "make it cleaner"
- Refactoring working code while fixing unrelated bugs
- Adding comprehensive error handling when fixing a specific error
- Converting simple fixes into complex state machines

## Authentication System

### Auth Routes
- **Catch-all routing**: `/auth/[...mode].tsx` handles all auth routes
- **Supported paths**: 
  - `/auth/login` - Login page
  - `/auth/signup` - Sign up page  
  - `/auth/signin` - Legacy route, redirects to `/auth/login`
  - `/auth` - Base route, redirects to `/auth/login`

### AuthForm Component
- Pure presentation component - no router dependency
- Props:
  - `mode`: 'login' | 'signup' - determines which form to show
  - `onModeChange`: callback for when user toggles between login/signup
  - `redirectOnSuccess`: boolean - whether to redirect after successful auth
- Uses `window.location.href` for redirects instead of Next.js router

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
- **Puppeteer** - E2E testing infrastructure with self-evolving capabilities using incognito mode for isolation

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

## Custom Claude Commands

### Frontend Review Commands
When asked to review a UI screenshot or implementation, automatically perform:

**`/ui-audit`** - Comprehensive positioning and alignment check:
1. First scan for edge-touching elements
2. Check all banners/notifications for center alignment
3. Verify spacing consistency around primary content
4. Look for visual weight imbalances
5. Rate severity of any issues found
6. Suggest specific CSS fixes with exact positioning values

**`/positioning-check`** - Quick positioning verification:
- Identify top 3 most critical positioning issues
- Provide immediate fix recommendations
- Flag any elements that violate spatial hierarchy

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

## Frontend Design Review Standards

### CRITICAL: Positioning and Alignment Analysis

When reviewing UI screenshots or implementing frontend changes, you MUST analyze the following positioning aspects as TOP PRIORITY:

#### 1. **Spatial Hierarchy Violations** (IMMEDIATE RED FLAGS)
- **Banner/Notification Positioning**: Any important notification or action banner (like "Select opponent's move to ban") MUST be:
  - Centered horizontally relative to its context (e.g., above/below the game board)
  - Have consistent margins/padding from adjacent elements
  - NEVER awkwardly touch or overlap primary content areas
  - NEVER be positioned at edges or corners unless explicitly designed as a corner element
- **Overlapping Elements**: Call out ANY elements that inappropriately overlap or touch edges of main content
- **Misaligned Centers**: Flag when elements that should be centered are offset

#### 2. **Visual Weight and Balance**
- Check if UI elements are properly balanced around the visual center
- Identify when heavy elements (like banners) are positioned asymmetrically
- Flag when important CTAs or notifications are pushed to edges instead of prominent positions

#### 3. **Positioning Checklist for Game UIs**
When reviewing chess/game board interfaces specifically:
- [ ] Action banners are centered above/below the board with proper spacing
- [ ] No UI elements awkwardly touch board edges
- [ ] Overlays maintain consistent padding from board boundaries
- [ ] Player information is symmetrically positioned
- [ ] Time displays align with their respective player positions
- [ ] Control buttons have consistent spacing and alignment

#### 4. **Required Callouts**
You MUST immediately flag these positioning issues:
- Elements touching edges when they should float
- Off-center positioning of centered elements
- Inconsistent margins between related elements
- Overlapping that obscures important information
- Banners/notifications in corners when they should be prominent
- Any element that "feels" awkwardly placed even if technically functional

#### 5. **Severity Levels for Positioning Issues**
- **CRITICAL**: Banners/CTAs in wrong positions (like edge-touching instead of centered)
- **HIGH**: Misaligned primary elements, broken visual hierarchy
- **MEDIUM**: Inconsistent spacing, minor alignment issues
- **LOW**: Pixel-perfect adjustments, micro-spacing issues

### Example of What to Flag
**BAD** (Must be called out immediately):
- "Select opponent's move to ban" banner positioned at top-right edge of board
- Banner touching/overlapping board boundary
- Important action UI pushed to corner instead of centered

**GOOD** (Proper positioning):
- Banner centered horizontally above board
- Consistent 20-30px margin from board top
- Clear visual separation from board content
- Maintains visual hierarchy with proper prominence

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

### Testing Infrastructure (PARALLEL AGENT-BASED, NOT SCRIPT-BASED)

⚠️ **CRITICAL ARCHITECTURE CLARIFICATION**: The testing system uses **TWO PARALLEL SUB-AGENTS coordinating via messaging**, NOT one agent controlling another!

- **NO TEST SCRIPTS**: Tests are executed by live agents using MCP tools in real-time
- **PARALLEL EXECUTION**: Both agents are technically sub-agents running concurrently
- **COORDINATION NOT CONTROL**: The "master" agent coordinates with (not controls) the "sub" agent via messaging
- **MCP PUPPETEER TOOLS**: Each agent uses `mcp__puppeteer__puppeteer_*` tools independently
- **INCOGNITO MODE**: Each agent launches its own Puppeteer with incognito context for complete isolation
- **MESSAGING-BASED SYNC**: Agents coordinate actions through JSON file messaging, not direct control
- **SELF-EVOLVING**: Agents learn from failures and update selector strategies in real-time
- **`NEXT_PUBLIC_USE_TEST_AUTH=true`**: Enables test authentication features

### How Testing Actually Works (PARALLEL AGENTS WITH COORDINATION!)

**THIS IS PARALLEL AGENT COORDINATION - NOT ONE AGENT CONTROLLING ANOTHER:**

1. **"Master" Agent (Player 1)** - A sub-agent that:
   - Starts the dev server
   - Controls Player 1's browser using MCP tools
   - Sends coordination messages via `window.sendMasterMessage()`
   - Waits for responses from the other agent
   ```
   mcp__puppeteer__puppeteer_navigate({ 
     url: 'http://localhost:3000',
     launchOptions: { headless: false, args: ['--incognito'] }
   })
   mcp__puppeteer__puppeteer_evaluate({ 
     script: 'window.sendMasterMessage("READY_TO_START")'
   })
   ```

2. **"Sub" Agent (Player 2)** - Another sub-agent running IN PARALLEL that:
   - Runs concurrently via Task tool (NOT controlled by master)
   - Has its own independent Puppeteer instance
   - Makes its own decisions based on received messages
   - Sends status updates via `window.sendSubMessage()`
   - Acts autonomously while coordinating with master

3. **Real-Time Learning**: When an action fails, agents immediately:
   - Try alternative selectors
   - Update success rates in memory
   - Discover new selector patterns
   - Share learnings via testing-memory.json

### Key Distinction: Coordination vs Control

**CRITICAL UNDERSTANDING**: The "master" agent doesn't control the "sub" agent!

- **❌ WRONG**: Master agent controls sub-agent's actions directly
- **✅ RIGHT**: Both agents run in parallel, coordinating via messages

**How it really works**:
1. Both agents are launched as independent sub-agents
2. They communicate through JSON file messaging (`/public/master-messages.json` and `/public/sub-messages.json`)
3. The "master" sends coordination signals like "READY_TO_QUEUE" or "YOUR_TURN_TO_BAN"
4. The "sub" agent independently decides how to respond to these signals
5. Neither agent waits for the other unless explicitly coordinating a game action

### Self-Evolving Testing System (Agent-Driven)
The testing infrastructure continuously improves through agent learning:

#### Memory Persistence (`e2e/testing-memory.json`)
```json
{
  "selectors": {
    "continue_as_guest": {
      "successful": [
        { "selector": "[data-testid='guest-auth-button']", "context": "auth_page", "timestamp": "2025-01-12T10:30:00Z", "success_rate": 0.95 },
        { "selector": "button:has-text('Continue as Guest')", "context": "auth_page", "timestamp": "2025-01-12T11:00:00Z", "success_rate": 0.88 }
      ],
      "failed": [
        { "selector": "#guest-button", "context": "auth_page", "error": "Element not found", "timestamp": "2025-01-12T09:00:00Z" }
      ]
    },
    "play_now": {
      "successful": [
        { "selector": "[data-testid='queue-button']", "context": "home_page", "success_rate": 0.92 }
      ]
    }
  },
  "flows": {
    "authentication": {
      "guest_login": {
        "successful_sequences": [
          {
            "steps": ["wait_for_page_load", "check_auth_status", "click_guest_button", "wait_for_redirect"],
            "success_rate": 0.89,
            "avg_duration_ms": 2300
          }
        ]
      }
    }
  },
  "timing_adjustments": {
    "auth_delay": { "min": 1000, "optimal": 2000, "max": 3000 },
    "queue_delay": { "min": 500, "optimal": 1500, "max": 2500 }
  }
}
```

#### Selector Evolution Strategy
1. **Primary Strategy**: Use highest success rate selector from memory
2. **Fallback Chain**: Try alternative selectors in descending success rate order
3. **Discovery Mode**: If all fail, attempt new selector patterns and record results
4. **Learning**: Update success rates after each test run

#### How Parallel Agents Use the Evolving Selector System

**IMPORTANT**: Both agents independently access and update the shared memory system:

```typescript
// EXAMPLE: How an agent would use evolving selectors with MCP tools
// This code shows the LOGIC agents follow, NOT a script they run!

// 1. Agent checks memory for best selector
const memory = JSON.parse(await mcp__filesystem__read_file({ path: 'e2e/testing-memory.json' }));
const bestSelector = memory.selectors.continue_as_guest.successful[0];

// 2. Agent tries to use the selector via MCP Puppeteer tool
try {
  await mcp__puppeteer__puppeteer_click({ 
    selector: bestSelector.selector
  });
  // 3. Agent updates success in memory
  bestSelector.successes++;
  bestSelector.success_rate = bestSelector.successes / bestSelector.attempts;
} catch (error) {
  // 4. Agent tries fallback selectors
  for (const fallback of memory.selectors.continue_as_guest.successful.slice(1)) {
    try {
      await mcp__puppeteer__puppeteer_click({ selector: fallback.selector });
      break;
    } catch (e) {
      continue;
    }
  }
}
```

#### Memory Updates After Each Test
```typescript
// Automatically called after each test run
async function updateTestMemory(testResults: TestResults) {
  const memory = await loadTestMemory();
  
  // Update selector success rates
  for (const action of testResults.actions) {
    if (action.successful) {
      memory.incrementSuccessRate(action.selector, action.context);
    } else {
      memory.decrementSuccessRate(action.selector, action.context);
      memory.recordError(action.selector, action.error);
    }
  }
  
  // Optimize timing based on results
  if (testResults.timingIssues) {
    memory.adjustTiming(testResults.timingIssues);
  }
  
  // Save evolved memory
  await saveTestMemory(memory);
}
```

#### Exponential Improvement
- **Week 1**: 60% test success rate, manual selector fixes needed
- **Week 2**: 75% success rate, fallback selectors working
- **Week 3**: 85% success rate, timing optimized
- **Week 4**: 95% success rate, fully autonomous testing
- **Ongoing**: 98%+ success rate, self-healing tests

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
- **E2E Testing (AGENT-BASED, NOT SCRIPT-BASED)**: 
  - Master agent starts dev server: `NEXT_PUBLIC_USE_TEST_AUTH=true bun run dev` (background)
  - Master agent controls Player 1 using MCP Puppeteer tools with incognito mode
  - Sub-agent (via Task) controls Player 2 concurrently with separate incognito instance
  - NO TEST SCRIPTS - agents use MCP tools directly
  - Agents learn from failures and update `e2e/testing-memory.json`

### Test Authentication System
When `NEXT_PUBLIC_USE_TEST_AUTH=true` is set, the application provides several authentication mechanisms for testing:

#### Query Parameter Authentication (`?auth=username`)
- **Purpose**: Allows instant authentication as any existing user via URL query parameter
- **Usage**: Navigate to any page with `?auth=username` (e.g., `/game/abc123?auth=user_4dff0w`)
- **Behavior**: 
  - Authenticates as the specified user if they exist
  - Returns 404 error if user doesn't exist (no auto-creation)
  - Removes the query parameter from URL after authentication
  - Works even if already authenticated (allows switching users)
- **Implementation**:
  - `useTestAuthQuery` hook detects and processes the auth parameter
  - `TestAuthHandler` component provides visual feedback
  - Uses test auth API endpoint to bypass captcha/email verification

### Clean Session Parameter (`?clean=true`)
- **Purpose**: Forces logout to ensure clean authentication state for testing
- **Usage**: Navigate to any page with `?clean=true` (e.g., `http://localhost:3000?clean=true`)
- **Behavior**:
  - Immediately signs out any existing session
  - Removes the `clean` parameter from URL
  - Leaves browser in unauthenticated state
- **Test Usage**: Both agents should start with clean incognito contexts:
  ```javascript
  // Master agent:
  mcp__puppeteer__puppeteer_navigate({ 
    url: 'http://localhost:3000',
    launchOptions: { headless: false, args: ['--incognito'] }
  })
  
  // Sub-agent (in Task):
  mcp__puppeteer__puppeteer_navigate({ 
    url: 'http://localhost:3000',
    launchOptions: { headless: false, args: ['--incognito'] }
  })
  ```

#### Guest Authentication
- **"Continue as Guest" Button**: Visible only in test mode on the auth form
- **Creates anonymous users** without requiring email/password
- **Guest users get assigned test emails** (`username@test.local`) for compatibility

#### Test API Endpoints
- **`/api/test/auth`**: Handles all test authentication
  - `action: 'signup'` - Create new user (bypasses captcha)
  - `action: 'signin'` - Sign in existing user
  - `action: 'guest'` - Create anonymous user
  - `action: 'query-auth'` - Authenticate by username (for query param auth)

#### Key Features
- **Board orientation**: Correctly adjusts based on authenticated player color (black sees black at bottom)
- **Username display**: Shows usernames instead of user IDs throughout the interface
- **Session persistence**: Authentication persists across page navigation
- **No email requirement**: Guest users and query auth work without email addresses

### Key Refactor Notes
- **DO NOT** trust old comments about "initial ban phase" - they're wrong
- The game uses continuous banning throughout, not just at start
- `banning_player` field indicates who must ban next (not who is currently banning)
- After each move, `banning_player` is set to the player who just moved
- Banned moves should be stored in database, not PGN comments
- Use the V2 components (`GameBoardV2`, `GameContextV2`) for the refactored version
- use es module syntax when working with e2e tests
- By default you will run the dev server in a background shell if it is not running already
- Always use dotenv when you want to have an env variable set for a session, to ensure platform compatibility
- before commiting a package.json update that involved a dependency modification, make sure to get package-lock.json updated as well
- If writing a script for gui tests and automation, we are using puppeteer with incognito mode. note: these scripts should be designed as singular parts that can be interwoven concurrently by a running agent
- authenticating as any user from any point on the website when testing can be done setting an auth search query  parameter with the value being the target username. when the page to reloads without the auth parameter authentication is complete
- maintain documentation of the testing configurations. most importantly are when agents manually work the gui to observe the current state of the code and game flow, and have immediate reactivity as it fixes the codebase
- TO HAVE DIFFERENT USERS CONTROLED ON THE SAME TESTING MACHINE, DIFFERENT BROWSERS WITH DIFFERENT CONTEXT ARE REQUIRED. DO NOT ATTEMPT USING DIFFERENT TABS
- Using ?auth=username login when testing requires a wait until the page gets reloaded without the auth search query

## ⚠️ CRITICAL TESTING INSTRUCTIONS - AGENT-BASED, NOT SCRIPT-BASED!

### Testing = Concurrent Agents Using MCP Tools (NOT SCRIPTS!)

**ABSOLUTELY CRITICAL**: 
- ❌ **NO TEST SCRIPTS ARE RUN**
- ✅ **AGENTS USE MCP PUPPETEER TOOLS DIRECTLY**
- ✅ **MULTIPLE AGENTS RUN CONCURRENTLY**
- ✅ **EACH AGENT HAS ITS OWN INCOGNITO BROWSER CONTEXT**

### Browser Context Isolation Strategy with Puppeteer

#### How Each Agent Gets a Clean, Isolated Browser:

1. **Master Agent (Player 1)**:
   ```javascript
   // Navigate with incognito mode - creates isolated browser instance
   mcp__puppeteer__puppeteer_navigate({ 
     url: 'http://localhost:3000',
     launchOptions: { 
       headless: false,  // Show browser for debugging
       args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
     }
   })
   // Now has a clean incognito browser with no auth/cookies
   ```

2. **Sub-Agent (Player 2 via Task tool)**:
   - Sub-agent launches its own Puppeteer with separate incognito context
   - Each agent's Puppeteer MCP maintains completely isolated browser instances
   - No shared cookies, localStorage, or authentication state
   - Incognito mode ensures clean slate for each agent

#### Why Puppeteer Incognito Works Better:
- **True Isolation**: Incognito mode prevents any cookie/cache sharing
- **Concurrent Support**: Multiple incognito instances can run simultaneously
- **No Profile Conflicts**: Each incognito context is ephemeral
- **Clean State Guaranteed**: Every navigation starts with zero stored data

### The ONLY Correct Way to Test Two-Player Games (Via Agents):

1. **Start Development Server in Background**
   ```bash
   # Run in background shell (Bash tool with run_in_background: true)
   NEXT_PUBLIC_USE_TEST_AUTH=true bun run dev
   ```

2. **Launch Second Player Agent in Parallel**
   - Use the Task tool to launch another sub-agent that will:
     - Run CONCURRENTLY as an independent agent (not controlled!)
     - Control its own Puppeteer browser instance with incognito mode
     - Make autonomous decisions based on coordination messages
     - Sign in as a different guest user independently
     - Queue for a game when it sees the coordination signal
     - Send status updates back via the messaging system
   
   Example Task invocation:
   ```javascript
   await Task({
     description: 'Control second player',
     subagent_type: 'general-purpose',
     prompt: `
       You are controlling the second player. IMPORTANT:
       1. Launch Puppeteer with incognito mode using mcp__puppeteer__puppeteer_navigate
       2. Navigate to http://localhost:3000 with launchOptions: { headless: false, args: ['--incognito'] }
       3. Sign in as guest (you'll get a different username)
       4. Send status updates via mcp__puppeteer__puppeteer_evaluate with window.sendSubMessage()
       5. Queue for game and wait for match
       6. Play the game following Ban Chess rules
       7. Use the testing memory system to select best known selectors
     `
   });
   ```

3. **First Agent ("Master") Coordinates with Second Agent**
   - After launching the parallel agent, the first agent:
     - Launches its own Puppeteer instance with incognito mode
     - Signs in as a guest user
     - Sends coordination messages to synchronize actions
     - Queues for a game when both agents are ready
     - Plays against the other agent with message-based coordination

### Agent Communication Protocol (Peer-to-Peer Coordination):
- **Agent 1 → Agent 2**: Messages appear in green "MASTER AGENT" scroll area
- **Agent 2 → Agent 1**: Messages appear in blue "SUB AGENT" scroll area
- **Send messages via**: `window.sendMasterMessage()` or `window.sendSubMessage()`
- **Messages stored in**: `/public/master-messages.json` and `/public/sub-messages.json`
- **Real-time sync**: Messages poll every 500ms for updates
- **Coordination, not control**: Messages are signals for coordination, not commands
- **Autonomous responses**: Each agent decides independently how to respond

#### Example Communication:
```javascript
// Master agent:
await mcp__puppeteer__puppeteer_evaluate({ 
  script: 'window.sendMasterMessage("Master: Ready, queuing now")'
});

// Sub agent (in concurrent Task):
await mcp__puppeteer__puppeteer_evaluate({ 
  script: 'window.sendSubMessage("Sub: Authenticated as user_xyz")'
});
await mcp__puppeteer__puppeteer_evaluate({ 
  script: 'window.sendSubMessage("Sub: In queue")'
});
```

### Why This Parallel Architecture Works:
- **TRUE CONCURRENCY**: Both agents run as independent parallel processes
- **NO BLOCKING**: Neither agent blocks the other - they run simultaneously
- **SEPARATE CONTEXTS**: Each agent has its own browser (no auth conflicts)
- **MESSAGE-BASED COORDINATION**: Agents sync via JSON files, not direct control
- **AUTONOMOUS OPERATION**: Each agent makes its own decisions based on messages
- **PEER-TO-PEER**: Despite "master/sub" naming, they're equal parallel agents

### Common Mistakes to Avoid:
❌ **NEVER use tabs** - They share authentication state
❌ **NEVER control both players sequentially** - Use parallel Tasks
❌ **NEVER use same browser context** - Each agent needs its own
❌ **NEVER attempt local game mode** - Returns 404
❌ **NEVER use localStorage for agent comms** - Doesn't sync between contexts
❌ **NEVER think one agent controls the other** - They coordinate as peers
❌ **NEVER wait for direct responses** - Use polling for message updates

## Clean Context Testing Procedure (CRITICAL FOR REPRODUCIBLE TESTS)

### Overview
This procedure ensures completely clean, controlled testing with two concurrent agents playing Ban Chess against each other. Both agents start with NO pre-saved authentication and coordinate via messaging.

### Pre-Test Requirements
1. **Dev Server**: Must be running with `NEXT_PUBLIC_USE_TEST_AUTH=true`
2. **No Cached Auth**: Both agents MUST start with clean browser contexts
3. **Communication System**: Agent messaging via JSON files must be functional

### Step-by-Step Clean Context Test Run

#### 1. Initial Setup (Master Agent)
```javascript
// Kill any existing dev servers and browsers
await killAllChrome();
await killBash('all');

// Start fresh dev server in background
await bash('NEXT_PUBLIC_USE_TEST_AUTH=true bun run dev', { run_in_background: true });

// Wait for server ready
await waitForServerReady();

// Clear any existing messages
await clearAgentMessages();
```

#### 2. Launch Parallel Agent with Coordination Protocol
```javascript
await Task({
  description: 'Second player agent - coordinate with first',
  subagent_type: 'general-purpose',
  prompt: `
    CRITICAL: You are an independent agent coordinating with another agent for chess testing.
    
    1. VERIFY CLEAN CONTEXT:
       - Navigate to http://localhost:3000
       - Check that you are NOT authenticated
       - If you see a username in header, THROW ERROR immediately
       - Send: "Sub: Clean context confirmed"
    
    2. MONITOR FOR COORDINATION SIGNALS:
       - Watch the green MASTER AGENT panel for coordination messages
       - These are NOT commands - they are coordination signals
       - You decide independently how to respond
       - Acknowledge signals to maintain sync
    
    3. COORDINATE ACTIONS (not commanded!):
       - When you see "READY_TO_LOGIN" → Decide to click "Continue as Guest"
       - When you see "READY_TO_QUEUE" → Decide to click "Play Now"
       - When you see "YOUR_TURN_TO_BAN" → Analyze board and ban a move
       - When you see "YOUR_TURN_TO_MOVE" → Analyze board and make a move
    
    4. REPORT YOUR DECISIONS:
       - Send status after each action YOU decide to take
       - Include username once authenticated
       - Report game ID when matched
       - Report all moves you choose to make/ban
       - You are an autonomous agent making your own decisions!
  `
});
```

#### 3. First Agent Coordination Flow (PARALLEL AGENT #1)
```javascript
// THIS IS WHAT THE FIRST PARALLEL AGENT DOES - NOT CONTROLLING THE OTHER!

// 1. Navigate to app with incognito mode
mcp__puppeteer__puppeteer_navigate({ 
  url: 'http://localhost:3000',
  launchOptions: { 
    headless: false,
    args: ['--incognito', '--no-sandbox']
  }
})

// 2. Take screenshot to see current state
mcp__puppeteer__puppeteer_screenshot({ 
  name: 'initial-state',
  encoded: true
})

// 3. Click guest login button
mcp__puppeteer__puppeteer_click({ 
  selector: '[data-testid="guest-auth-button"]'
})

// 4. Wait for authentication to complete
await new Promise(resolve => setTimeout(resolve, 2000));

// 5. Take screenshot to verify auth
mcp__puppeteer__puppeteer_screenshot({ 
  name: 'after-auth',
  encoded: true  
})

// 6. Click Play Now to queue
mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="queue-button"]'
})

// 7. Send message to sub-agent
mcp__puppeteer__puppeteer_evaluate({
  script: 'window.sendMasterMessage("Master: In queue")'
})

// 8. Command sub-agent to login and queue
// (Sub-agent does similar steps in parallel)
```

#### 4. Game Play Coordination

##### Ban Phase (When Opponent Can Ban)
```javascript
// Master (playing White) waits for Black to ban
await waitForBanPhase();
await sendMasterMessage("Master: Waiting for ban");

// Sub (playing Black) bans a move
await enterMoveInTestInput("e4");  // Ban e2-e4
await sendSubMessage("Sub: Banned e4");
```

##### Move Phase
```javascript
// Master makes move (White)
await enterMoveInTestInput("d4");  // Play d2-d4
await sendMasterMessage("Master: Played d4");

// Sub makes move (Black)
await enterMoveInTestInput("d5");  // Play d7-d5
await sendSubMessage("Sub: Played d5");
```

### Test Input Usage (CRITICAL)

The test input field accepts **ONLY algebraic notation**:
- ✅ Valid: `e4`, `Nf3`, `Bxc6`, `O-O`, `Qd8+`
- ❌ Invalid: `e2e4`, `e2-e4`, `e2 e4`

#### Input Behavior:
1. **Visual Feedback**: Red border for ban phase, green for move phase
2. **Error Handling**: Input flashes red if move is invalid/illegal
3. **Auto-clear**: Input clears after successful move/ban
4. **Placeholder Text**: Shows context-appropriate hints

#### How Agents Enter Moves (Using MCP Tools):
```javascript
// AGENTS USE MCP TOOLS, NOT PUPPETEER API DIRECTLY!

// 1. Take screenshot to see board state
mcp__puppeteer__puppeteer_screenshot({ 
  name: 'board-state',
  encoded: true
})

// 2. Type move in test input
mcp__puppeteer__puppeteer_fill({
  selector: 'input[data-testid="board-test-input"]',
  value: 'e4'
})

// 3. Submit the move by pressing Enter
mcp__puppeteer__puppeteer_evaluate({
  script: `
    const input = document.querySelector('input[data-testid="board-test-input"]');
    const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13 });
    input.dispatchEvent(event);
  `
})

// 4. Verify move was made with screenshot
mcp__puppeteer__puppeteer_screenshot({ 
  name: 'after-move',
  encoded: true
})
```

### Validation Checklist

Before starting any test run:
- [ ] Both agents report "Clean context confirmed"
- [ ] No usernames visible before login
- [ ] Dev server running with test auth enabled
- [ ] Agent message files cleared
- [ ] No Chrome processes from previous tests

During test run:
- [ ] Agents sign in sequentially (not simultaneously)
- [ ] Different usernames assigned to each agent
- [ ] Game matches within 5 seconds of both queuing
- [ ] Ban phase shows red border on input
- [ ] Move phase shows green border on input
- [ ] All moves use algebraic notation
- [ ] Messages appear in correct panels (green/blue)

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Same username for both agents | Agents signed in too quickly - add 2-3 second delay |
| "User not found" error | Using cached auth - need clean context |
| Moves not registering | Not using algebraic notation - check format |
| Game not starting | Both agents not in queue - check status messages |
| Input not working | Wrong selector or event - use KeyboardEvent with 'Enter' |

### What DOESN'T Work (Common Mistakes)
- ❌ Using browser tabs for different users
- ❌ Trying to use local game mode
- ❌ Switching users in the same browser context
- ❌ Assuming the second player will automatically join