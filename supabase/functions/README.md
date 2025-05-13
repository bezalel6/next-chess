# Supabase Edge Functions for Next Chess

This directory contains Edge Functions that provide secure server-side operations for the Next Chess application. These functions handle game operations and matchmaking to ensure secure and validated updates to the database.

## Functions Overview

1. **game-operations** - Handles all game-related operations:

   - Making moves
   - Banning moves
   - Draw/rematch offers
   - Resignations

2. **matchmaking** - Handles matchmaking and queue operations:
   - Joining/leaving queue
   - Creating matches
   - Queue management

## Deployment

To deploy these functions to your Supabase project:

1. Install Supabase CLI:

   ```bash
   npm install -g supabase
   ```

2. Link to your Supabase project:

   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   ```

3. Deploy the functions:
   ```bash
   supabase functions deploy game-operations
   supabase functions deploy matchmaking
   ```

## Environment Variables

The Edge Functions require the following environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

Set these in the Supabase dashboard under Settings > API > Functions.

## Security Considerations

- These functions use the service role key to bypass RLS policies, so they must validate user permissions internally.
- All requests require authentication through a valid JWT token.
- Each operation validates that the user has permission to perform the requested action.

## Local Development

To run the functions locally:

1. Start the local dev server:

   ```bash
   supabase functions serve
   ```

2. Set local environment variables:
   ```bash
   supabase functions env set SUPABASE_URL=your-project-url
   supabase functions env set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Switching to Edge Functions

To migrate from direct database access to using these secure Edge Functions:

1. Replace imports of the regular services with the secure versions:

   ```typescript
   // From:
   import { GameService } from "@/services/gameService";
   // To:
   import { SecureGameService } from "@/services/secureGameService";
   ```

2. Replace all method calls accordingly:
   ```typescript
   // From:
   await GameService.makeMove(gameId, move);
   // To:
   await SecureGameService.makeMove(gameId, move);
   ```

## RLS Policies

While Edge Functions bypass RLS policies using the service role key, you should still have proper RLS policies in place as a defense-in-depth strategy:

```sql
-- Example policy to allow players to view only their own games
CREATE POLICY "Players can view their own games" ON games
  FOR SELECT
  USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);
```
