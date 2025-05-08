import { configDotenv } from 'dotenv';
import { createServer, Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';
import { MatchmakingService } from '../services/matchmakingService';

const dev = env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Supabase client with service role
const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Set up Supabase Realtime subscriptions for monitoring
    const queueChannel = supabase.channel('queue-system-monitor')
        .on('presence', { event: 'sync' }, async () => {
            try {
                const presenceState = queueChannel.presenceState();
                const queue = Object.values(presenceState).flat() as unknown as Array<{ user_id: string; joined_at: string }>;
                
                // Sort queue by join time
                queue.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

                // Match players in pairs
                for (let i = 0; i < queue.length - 1; i += 2) {
                    const player1 = queue[i];
                    const player2 = queue[i + 1];

                    try {
                        // Use MatchmakingService to handle the match
                        await MatchmakingService.matchPlayers(player1.user_id, player2.user_id, queueChannel);
                    } catch (error) {
                        console.error('Error in matchmaking:', error);
                    }
                }
            } catch (error) {
                console.error('Error processing queue:', error);
            }
        })
        .on('system', { event: 'error' }, (error) => {
            console.error('Queue channel error:', error);
        });

    // Subscribe to the queue channel
    queueChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Queue monitor channel subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
            console.error('Queue monitor channel error');
        }
    });

    server.listen(port, (err?: Error) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});