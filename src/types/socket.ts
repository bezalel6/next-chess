import { Socket } from 'socket.io-client';

// Client to Server Events
export interface ClientToServerEvents {
    'join-queue': () => void;
    'leave-queue': () => void;
    'join-game': (gameId: string) => void;
    'leave-game': (gameId: string) => void;
    'make-move': (data: GameMove) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
    'queue-status': (data: QueueStatus) => void;
    'game-matched': (data: GameMatch) => void;
    'move-made': (move: ChessMove) => void;
}

// Event Payload Types
export interface QueueStatus {
    position: number;
}

export interface GameMatch {
    gameId: string;
    color: 'white' | 'black';
}

export interface GameMove {
    gameId: string;
    move: ChessMove;
}

// Chess-specific types
export interface ChessMove {
    from: string;
    to: string;
    promotion?: 'q' | 'r' | 'b' | 'n';
}

// Socket type with our custom events
export type CustomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;