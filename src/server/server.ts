// server.ts
import { createServer, Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';
import { MatchmakingService } from '../services/matchmakingService';

const dev = env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(env.PORT) || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Supabase client with service role and ws for Node.js
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
);

app.prepare().then(async () => {
  // Set up Supabase Realtime subscriptions for monitoring
  const queueChannel = supabase
    .channel('queue-system', {
      config: {
        presence: {
          key: 'user_id', // Use a unique key for presence tracking
        },
      },
    })
    .on('presence', { event: 'sync' }, async () => {
      try {
        const presenceState = queueChannel.presenceState();
        const queue = Object.values(presenceState).flat() as unknown as Array<{
          user_id: string;
          joined_at: string;
        }>;

        // Filter out the server's presence entry
        const filteredQueue = queue.filter(entry => entry.user_id !== 'server');

        console.debug('[Server Queue] Sync event:', {
          queueSize: filteredQueue.length,
          queueState: presenceState,
        });

        // Sort queue by join time
        filteredQueue.sort(
          (a, b) =>
            new Date(a.joined_at).getTime() -
            new Date(b.joined_at).getTime()
        );

        // Match players in pairs
        let currentQueue = [...filteredQueue];
        for (let i = 0; i < currentQueue.length - 1; i += 2) {
          const player1 = currentQueue[i];
          const player2 = currentQueue[i + 1];

          console.debug('[Server Queue] Attempting to match players:', {
            player1: player1.user_id,
            player2: player2.user_id,
            player1JoinedAt: player1.joined_at,
            player2JoinedAt: player2.joined_at,
          });

          try {
            // Use MatchmakingService to handle the match
            await MatchmakingService.matchPlayers(
              player1.user_id,
              player2.user_id,
              queueChannel
            );
            console.debug('[Server Queue] Successfully matched players:', {
              player1: player1.user_id,
              player2: player2.user_id,
            });
            
            // Remove matched players from current queue
            currentQueue = currentQueue.filter(
              player => player.user_id !== player1.user_id && player.user_id !== player2.user_id
            );
            i -= 2; // Adjust index since we removed two players
          } catch (error) {
            console.error('[Server Queue] Error in matchmaking:', {
              player1: player1.user_id,
              player2: player2.user_id,
              error,
            });
          }
        }

        // Log remaining players if any
        if (currentQueue.length % 2 !== 0) {
          const remainingPlayer = currentQueue[currentQueue.length - 1];
          console.debug('[Server Queue] Player waiting for match:', {
            player: remainingPlayer.user_id,
            joinedAt: remainingPlayer.joined_at,
            waitTime:
              new Date().getTime() -
              new Date(remainingPlayer.joined_at).getTime(),
          });
        }
      } catch (error) {
        console.error('[Server Queue] Error processing queue:', error);
      }
    })
    .on('system', { event: 'error' }, (error) => {
      console.error('[Server Queue] Channel error:', error);
    });

  // Subscribe to the queue channel and track presence
  await queueChannel.subscribe((status,err) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Server Queue] Monitor channel subscribed successfully');
      // Track presence for this server instance
      queueChannel.track({
        user_id: 'server', // Use a unique id for the server
        joined_at: new Date().toISOString(),
      });
    } else if (status === 'CHANNEL_ERROR') {
      console.error('[Server Queue] Monitor channel error');
    }
    if (err) {
      console.error('[Server Queue] Error subscribing to channel:', err);
    }
  });
  queueChannel
  .on('presence', { event: 'join' }, (payload) => {
    console.log('[Server Queue] Presence join:', payload);
  })
  .on('presence', { event: 'leave' }, (payload) => {
    console.log('[Server Queue] Presence leave:', payload);
  })



  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(port,(err?: Error) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  }) 

});
