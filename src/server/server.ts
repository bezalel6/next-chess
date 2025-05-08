import { configDotenv } from 'dotenv';
import { createServer, Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import type { QueueStatus, GameMatch, GameMove } from '../types/realtime';
import { env } from '../env.js';

const dev = env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Supabase client
const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QueuedPlayer {
    userId: string;
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

    // Set up Supabase Realtime subscriptions
    const queueChannel = supabase.channel('queue-status');
    const gameChannel = supabase.channel('game-events');

    async function matchPlayers() {
        if (matchmakingQueue.length >= 2) {
            const player1 = matchmakingQueue.shift()!;
            const player2 = matchmakingQueue.shift()!;
            const gameId = uuidv4();

            // Notify both players about the match
            const gameMatch1: GameMatch = { gameId, color: 'white' };
            const gameMatch2: GameMatch = { gameId, color: 'black' };

            await queueChannel.send({
                type: 'broadcast',
                event: 'game-matched',
                payload: gameMatch1
            });

            await queueChannel.send({
                type: 'broadcast',
                event: 'game-matched',
                payload: gameMatch2
            });

            console.log(`Matched players ${player1.userId} and ${player2.userId} in game ${gameId}`);
        }
    }

    // Handle queue events
    queueChannel
        .on('broadcast', { event: 'join-queue' }, async ({ payload }) => {
            const { userId } = payload as { userId: string };
            if (!matchmakingQueue.find(p => p.userId === userId)) {
                matchmakingQueue.push({
                    userId,
                    joinedAt: Date.now()
                });
                console.log(`Player ${userId} joined the queue`);
                const queueStatus: QueueStatus = { position: matchmakingQueue.length };
                await queueChannel.send({
                    type: 'broadcast',
                    event: 'queue-status',
                    payload: queueStatus
                });
                await matchPlayers();
            }
        })
        .on('broadcast', { event: 'leave-queue' }, async ({ payload }) => {
            const { userId } = payload as { userId: string };
            const index = matchmakingQueue.findIndex(p => p.userId === userId);
            if (index !== -1) {
                matchmakingQueue.splice(index, 1);
                console.log(`Player ${userId} left the queue`);
                const queueStatus: QueueStatus = { position: 0 };
                await queueChannel.send({
                    type: 'broadcast',
                    event: 'queue-status',
                    payload: queueStatus
                });
            }
        });

    // Handle game events
    gameChannel
        .on('broadcast', { event: 'make-move' }, async ({ payload }) => {
            const { gameId, move } = payload as GameMove;
            await gameChannel.send({
                type: 'broadcast',
                event: 'move-made',
                payload: move
            });
        });

    // Subscribe to channels
    queueChannel.subscribe();
    gameChannel.subscribe();

    server.listen(port, (err?: Error) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});