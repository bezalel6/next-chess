import { createServer, Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { Socket } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface GameMove {
    gameId: string;
    move: any; // You might want to define a more specific type for moves
}

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

    // Initialize Socket.IO
    const io = new SocketServer(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
        },
    });

    // Socket.IO connection handling
    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);

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
            // Broadcast the move to all clients in the game room except the sender
            socket.to(gameId).emit('move-made', move);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    server.listen(port, (err?: Error) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});