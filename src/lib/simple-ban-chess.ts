import { Chess } from 'chess.js';

export class BanChess {
  private chess: Chess;
  private bannedMove: { from: string; to: string } | null = null;
  private actionCount: number = 0;
  
  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }
  
  // Returns 'w' or 'b'
  get turn(): 'w' | 'b' {
    return this.chess.turn();
  }
  
  // Returns 'ban' or 'move' based on action count
  nextActionType(): 'ban' | 'move' {
    // First action is always a ban (Black bans White's first move)
    if (this.actionCount === 0) return 'ban';
    // Then alternates: move, ban, move, ban...
    return this.actionCount % 2 === 0 ? 'ban' : 'move';
  }
  
  // Play either a ban or a move
  play(action: { ban?: { from: string; to: string }, move?: { from: string; to: string; promotion?: string } }) {
    if (action.ban) {
      this.bannedMove = action.ban;
      this.actionCount++;
    } else if (action.move) {
      // Check if move is banned
      if (this.bannedMove && 
          this.bannedMove.from === action.move.from && 
          this.bannedMove.to === action.move.to) {
        throw new Error('Move is banned');
      }
      
      // Make the move
      this.chess.move({
        from: action.move.from,
        to: action.move.to,
        promotion: action.move.promotion as any
      });
      
      this.bannedMove = null; // Clear ban after move
      this.actionCount++;
    }
  }
  
  // Get legal moves (excluding banned move)
  legalMoves(): Array<{ from: string; to: string }> {
    const moves = this.chess.moves({ verbose: true });
    return moves
      .filter(m => {
        if (this.bannedMove) {
          return !(m.from === this.bannedMove.from && m.to === this.bannedMove.to);
        }
        return true;
      })
      .map(m => ({ from: m.from, to: m.to }));
  }
  
  // Get legal bans (all opponent's possible moves)
  legalBans(): Array<{ from: string; to: string }> {
    // Temporarily switch turns to get opponent's moves
    const fen = this.chess.fen();
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    const tempChess = new Chess(parts.join(' '));
    
    const moves = tempChess.moves({ verbose: true });
    return moves.map(m => ({ from: m.from, to: m.to }));
  }
  
  // Get FEN
  fen(): string {
    return this.chess.fen();
  }
  
  // Check if game is over
  gameOver(): boolean {
    return this.chess.isGameOver();
  }
  
  // Get PGN
  pgn(): string {
    return this.chess.pgn();
  }
  
  // Get history
  history(): any[] {
    return this.chess.history({ verbose: true });
  }
}