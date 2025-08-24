# Changelog

All notable changes to Ban Chess will be documented in this file.

## [2025-08-24]

### Added
- **User Profile Pages** (`/u/username`)
  - Reddit-style routing for user profiles
  - Display user statistics: games played, wins, losses, draws, win rate
  - Member since date and avatar display
  - Located at `src/pages/u/[username].tsx`

- **Unified Logout Routes**
  - Added `/auth/logout` and `/auth/signout` pages
  - Both routes use the same signOut logic from AuthContext
  - Show loading spinner during logout process

- **Enhanced Matchmaking Error Handling**
  - Display "Go to Game" button when user has an active game
  - Added "Resign Game" option to clear stuck games
  - Better error messaging for matchmaking conflicts

### Fixed
- **Before User Created Hook Authentication**
  - Resolved "Hook requires authorization token" error
  - Root cause: Kong API gateway blocking Auth->EdgeFunction communication
  - Solution: Serve Edge Functions with `--no-verify-jwt` flag for local development
  - Documented fix in `docs/HOOK_AUTHENTICATION_FIX.md`

- **Profile Creation RLS Violations**
  - Removed client-side profile creation from AuthContext
  - Profiles now created automatically by `handle_new_user()` database trigger
  - Fixed "new row violates row-level security policy" errors
  - Client no longer attempts to insert profiles (only SELECT and UPDATE allowed)

- **Double Header on Profile Page**
  - Removed redundant Layout wrapper from profile page
  - Pages are already wrapped by Layout in `_app.tsx`

### Changed
- **Profile Route Pattern**
  - Migrated from `/@username` to `/u/username` (Reddit-style)
  - Removed complex rewrite rules from `next.config.mjs`
  - Simplified routing with standard Next.js dynamic routes

### Technical Details
- **Auth Hook Configuration**: Webhook headers sent by Supabase Auth don't include Authorization header, only webhook-signature, webhook-id, and webhook-timestamp
- **Profile Creation Flow**: auth.users trigger → handle_new_user() function → automatic profile insertion with SECURITY DEFINER
- **Edge Functions Local Setup**: Must use `--no-verify-jwt` and `--env-file supabase/functions/.env` flags

## [2025-08-23]

### Added
- Unified game store with centralized state management
- Server-authoritative game architecture

### Removed
- Legacy hooks and services (see `docs/LEGACY_REMOVAL.md`)
- LocalGamePanel component
- React Query game queries

### Fixed
- Guest authentication with automatic username generation
- Matchmaking queue functionality