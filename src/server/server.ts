import { createServer, Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { ClientToServerEvents, ServerToClientEvents, GameMove, QueueStatus, GameMatch } from '../types/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface QueuedPlayer {
    socketId: string;
    joinedAt: number;
}

// Queue management
const matchmakingQueue: QueuedPlayer[] = [];

app.prepare().then(() => {
    const server: HttpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    // Initialize Socket.IO with type declarations
    const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
        },
    });

    function matchPlayers() {
        if (matchmakingQueue.length >= 2) {
            const player1 = matchmakingQueue.shift()!;
            const player2 = matchmakingQueue.shift()!;
            const gameId = uuidv4();

            // Notify both players about the match
            const gameMatch1: GameMatch = { gameId, color: 'white' };
            const gameMatch2: GameMatch = { gameId, color: 'black' };

            io.to(player1.socketId).emit('game-matched', gameMatch1);
            io.to(player2.socketId).emit('game-matched', gameMatch2);

            console.log(`Matched players ${player1.socketId} and ${player2.socketId} in game ${gameId}`);
        }
    }

    // Socket.IO connection handling
    io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
        console.log('Client connected:', socket.id);

        // Queue management
        socket.on('join-queue', () => {
            if (!matchmakingQueue.find(p => p.socketId === socket.id)) {
                matchmakingQueue.push({
                    socketId: socket.id,
                    joinedAt: Date.now()
                });
                console.log(`Player ${socket.id} joined the queue`);
                const queueStatus: QueueStatus = { position: matchmakingQueue.length };
                socket.emit('queue-status', queueStatus);
                matchPlayers();
            }
        });

        socket.on('leave-queue', () => {
            const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                matchmakingQueue.splice(index, 1);
                console.log(`Player ${socket.id} left the queue`);
                const queueStatus: QueueStatus = { position: 0 };
                socket.emit('queue-status', queueStatus);
            }
        });

        // Handle game-related events
        socket.on('join-game', (gameId: string) => {
            socket.join(gameId);
            console.log(`Client ${socket.id} joined game ${gameId}`);
        });

        socket.on('leave-game', (gameId: string) => {
            socket.leave(gameId);
            console.log(`Client ${socket.id} left game ${gameId}`);
        });

        socket.on('make-move', ({ gameId, move }: GameMove) => {
            socket.to(gameId).emit('move-made', move);
        });

        socket.on('disconnect', () => {
            // Remove from queue if they were in it
            const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                matchmakingQueue.splice(index, 1);
            }
            console.log('Client disconnected:', socket.id);
        });
    });

    server.listen(port, (err?: Error) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});