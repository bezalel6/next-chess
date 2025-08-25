// Normalization utilities for server <-> client data shapes
import type { Game } from '@/types/game';
import type { BanChess } from 'ban-chess.ts';

// Convert server (possibly snake_case) to client camelCase Game
export function toClientGame(server: Record<string, unknown>): Game {
  if (!server) return server as unknown as Game;
  const g = server as Record<string, unknown>;
  
  // Create a properly typed Game object with default values
  const gameBase = {
    id: String(g.id || ''),
    pgn: (g.pgn ?? g.pgn_text ?? null) as string | null,
    currentFen: String(g.currentFen ?? g.current_fen ?? g.fen ?? ''),
    turn: (g.turn ?? g.current_turn ?? 'white') as 'white' | 'black',
    status: (g.status ?? g.game_status ?? 'active') as 'active' | 'completed' | 'abandoned',
    banningPlayer: (g.banningPlayer ?? g.banning_player ?? null) as 'white' | 'black' | null,
    currentBannedMove: g.currentBannedMove ?? g.current_banned_move ?? null,
    whitePlayer: (g.whitePlayer ?? g.white_player ?? g.white_username ?? null) as string | null,
    blackPlayer: (g.blackPlayer ?? g.black_player ?? g.black_username ?? null) as string | null,
    whitePlayerId: String(g.whitePlayerId ?? g.white_player_id ?? ''),
    blackPlayerId: String(g.blackPlayerId ?? g.black_player_id ?? ''),
    lastMove: g.lastMove ?? g.last_move ?? null,
    result: (g.result ?? null) as 'white' | 'black' | 'draw' | null,
    endReason: (g.endReason ?? g.end_reason ?? null) as string | null,
    // Add required Game properties with defaults
    engine: null as BanChess | null, // BanChess engine - will be set by the calling code
    lastAction: null as any,
    startTime: Date.now(),
    lastMoveTime: Date.now(),
    drawOfferedBy: null as string | null,
    rematchOfferedBy: null as string | null,
    parentGameId: null as string | null
  };
  
  return { ...server, ...gameBase } as unknown as Game;
}

export function toClientMove(server: Record<string, unknown>) {
  if (!server) return server;
  const m = server as Record<string, unknown>;
  return {
    from: m.from,
    to: m.to,
    san: m.san,
    fen: m.fen ?? m.currentFen ?? m.current_fen,
    ply: m.ply ?? 0,
    bannedMove: m.bannedMove ?? m.banned_move ?? undefined,
  };
}

export function toClientBan(server: Record<string, unknown>) {
  if (!server) return server;
  const b = server as Record<string, unknown>;
  return {
    from: b.from,
    to: b.to,
    byPlayer: b.byPlayer ?? b.by_player,
    atMoveNumber: b.atMoveNumber ?? b.at_move_number,
  };
}
