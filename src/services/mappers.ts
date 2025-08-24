// Normalization utilities for server <-> client data shapes
import type { Game } from '@/types/game';

// Convert server (possibly snake_case) to client camelCase Game
export function toClientGame(server: Record<string, unknown>): Game {
  if (!server) return server as Game;
  const g = server as Record<string, unknown>;
  return {
    ...server,
    id: g.id,
    pgn: g.pgn ?? g.pgn_text ?? null,
    currentFen: g.currentFen ?? g.current_fen ?? g.fen ?? '',
    turn: g.turn ?? g.current_turn ?? 'white',
    status: g.status ?? g.game_status ?? 'active',
    banningPlayer: g.banningPlayer ?? g.banning_player ?? null,
    currentBannedMove: g.currentBannedMove ?? g.current_banned_move ?? null,
    whitePlayer: g.whitePlayer ?? g.white_player ?? g.white_username ?? null,
    blackPlayer: g.blackPlayer ?? g.black_player ?? g.black_username ?? null,
    whitePlayerId: g.whitePlayerId ?? g.white_player_id ?? null,
    blackPlayerId: g.blackPlayerId ?? g.black_player_id ?? null,
    lastMove: g.lastMove ?? g.last_move ?? null,
    result: g.result ?? null,
    endReason: g.endReason ?? g.end_reason ?? null,
  } as Game;
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
