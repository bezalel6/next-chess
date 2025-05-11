export interface QueueStatus {
  position: number;
}

export interface GameMatch {
  gameId: string;
}

export interface GameMove {
  gameId: string;
  move: {
    from: string;
    to: string;
    promotion?: "q" | "r" | "b" | "n";
  };
}

export interface ChessMove {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}
