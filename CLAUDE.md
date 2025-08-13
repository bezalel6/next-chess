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
- `src/contexts/GameContextV2.tsx` - State management  
- `src/components/GameBoardV2.tsx` - Board UI
- `supabase/functions/_shared/game-handlers.ts` - Server logic

## Development
```bash
bun run dev     # Start dev server
bun run build   # Build for production
```

## Important Notes
- TypeScript strict mode disabled
- Supabase is source of truth
- Move/ban validation happens server-side