# Recent Updates

## Authentication System Refactor
- Implemented catch-all routing for auth pages using `/auth/[...mode].tsx`
- Refactored `AuthForm` component to be a pure presentation component
  - Removed router dependency
  - Uses `mode` prop to determine login vs signup state
  - Added `onModeChange` callback for parent-controlled navigation
- Created generic `usePathState` hook for path-dependent state management (now removed as not needed)
- Added redirect pages for legacy routes (`/auth/signin` → `/auth/login`)

## E2E Testing Improvements
- Fixed deprecated `waitForTimeout` calls in Puppeteer tests
- Created comprehensive two-player game test that:
  - Sets up two users with GUI login
  - Creates a game between them
  - Allows control of both sides
  - Demonstrates spectator functionality
- Added ability to view active games from different browser contexts
- Test infrastructure now supports multiple concurrent browser instances

## TypeScript Fixes
- Fixed import statements for Next.js API types (using `import type`)
- Fixed database field mapping issues in game pages
- Resolved `SignUpStatus` type errors in AuthContext
- All TypeScript compilation errors resolved

## Game Viewing Features
- Demonstrated ability to spectate ongoing games
- Proper separation between player and spectator views
- Real-time game state synchronization across multiple browser sessions
- Both authenticated and unauthenticated users can spectate games

## Code Quality
- All E2E test errors fixed
- TypeScript compilation passes without errors
- Linter configuration updated and passing
- Removed unused utilities and dependencies