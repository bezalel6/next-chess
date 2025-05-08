import { supabase } from '@/utils/supabase';
import { GameService } from './gameService';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface QueueUser {
    user_id: string;
    joined_at: string;
}

export class MatchmakingService {
    static async joinQueue(userId: string) {
        const channel = supabase.channel('queue-system', {
            config: {
                broadcast: { self: true },
                presence: { key: userId }
            }
        });

        await channel.track({ user_id: userId, joined_at: new Date().toISOString() });
        return channel;
    }

    static async matchPlayers(player1Id: string, player2Id: string, channel: RealtimeChannel) {
        try {
            // Create a new game
            const game = await GameService.createGame(player1Id, player2Id);

            // Notify both players
            await channel.send({
                type: 'broadcast',
                event: 'game-matched',
                payload: {
                    gameId: game.id,
                    color: 'white'
                }
            });

            await channel.send({
                type: 'broadcast',
                event: 'game-matched',
                payload: {
                    gameId: game.id,
                    color: 'black'
                }
            });

            // Remove matched players from queue
            await channel.untrack({ user_id: player1Id });
            await channel.untrack({ user_id: player2Id });

            console.log(`Matched players ${player1Id} and ${player2Id} in game ${game.id}`);
            return game;
        } catch (error) {
            console.error('Error matching players:', error);
            throw error;
        }
    }

    static async leaveQueue(userId: string, channel: any) {
        await channel.untrack({ user_id: userId });
        await channel.unsubscribe();
    }

    static async getQueuePosition(userId: string): Promise<number> {
        const { data: presenceState } = await supabase
            .channel('queue-system')
            .presenceState();

        if (!presenceState) return 0;

        const queue = Object.values(presenceState).flat() as unknown as QueueUser[];
        queue.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
        
        return queue.findIndex(user => user.user_id === userId) + 1;
    }
} 