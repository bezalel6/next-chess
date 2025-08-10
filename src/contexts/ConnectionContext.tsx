import { MatchmakingService } from '@/services/matchmakingService';
import { supabase } from "@/utils/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GameMatch } from "../types/realtime";
import { useAuth } from "./AuthContext";
import { GameProvider } from "./GameContext";

interface QueueState {
    inQueue: boolean;
    position: number;
    size: number;
}

interface ConnectionState {
    queue: QueueState;
    matchDetails: GameMatch | null;
    stats: {
        activeUsers: number;
        log: { timestamp: number, message: string }[];
    };
    handleQueueToggle: () => Promise<void>;
}

const initialConnectionState: ConnectionState = {
    queue: {
        inQueue: false,
        position: 0,
        size: 0
    },
    matchDetails: null,
    stats: {
        activeUsers: 0,
        log: []
    },
    handleQueueToggle: async () => { }
};

const ConnectionContext = createContext<ConnectionState>(initialConnectionState);

export function useConnection() {
    return useContext(ConnectionContext);
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const router = useRouter();
    const [queue, setQueue] = useState<QueueState>({ inQueue: false, position: 0, size: 0 });
    const [matchDetails, setMatchDetails] = useState<GameMatch | null>(null);

    // Channel management
    const [playerChannel, setPlayerChannel] = useState<RealtimeChannel | null>(null);
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
    const [activeUsers, setActiveUsers] = useState(0);

    // Debug logging
    const [log, setLog] = useState<ConnectionState['stats']['log']>([]);
    const addLogEntry = (entry: string) => {
        setLog(prev => [
            ...prev.slice(0, 19),
            { message: entry, timestamp: new Date().getTime() },
        ]);
        console.log(`[ConnectionContext] ${entry}`);
    };

    // Track active users with presence
    useEffect(() => {
        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: session?.user?.id || 'anonymous-' + Math.random().toString(36).substr(2, 9),
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userCount = Object.keys(state).length;
                setActiveUsers(userCount);
                addLogEntry(`Active users: ${userCount}`);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                addLogEntry(`User joined: ${key}`);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                addLogEntry(`User left: ${key}`);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: session?.user?.id || 'anonymous',
                        online_at: new Date().toISOString(),
                    });
                }
            });

        setPresenceChannel(channel);

        return () => {
            channel.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);

    // Handle player authentication and channel setup
    useEffect(() => {
        if (!session?.user) {
            addLogEntry("No authenticated user, skipping channel setup");
            setPlayerChannel(null);
            return;
        }

        addLogEntry(`Setting up player channel for user ${session.user.id}`);

        // Create a player channel that matches the server's notification channel
        const channel = supabase.channel(`player:${session.user.id}`, {
            config: {
                broadcast: { self: true },
                presence: { key: session.user.id },
            }
        });

        // Listen for game_matched events from the server
        channel.on('broadcast', { event: 'game_matched' }, (payload) => {
            const { gameId, isWhite, opponentId } = payload.payload;
            addLogEntry(`Game matched! Game ID: ${gameId}, Playing as white: ${isWhite}, Opponent: ${opponentId}`);
            setMatchDetails({ gameId, isWhite, opponentId });
            setQueue({ inQueue: false, position: 0, size: 0 });

            // Navigate to the game
            router.push(`/game/${gameId}`);
        });

        setPlayerChannel(channel);

        // Subscribe to the channel immediately
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                addLogEntry("Player channel subscribed successfully");
            }
        });

        // Check matchmaking status right after connecting
        const checkMatchmakingStatus = async () => {
            try {
                // Check if we're already in the matchmaking system
                const { data } = await supabase
                    .from('matchmaking')
                    .select('status, game_id')
                    .eq('player_id', session.user.id)
                    .maybeSingle();

                if (data) {
                    if (data.status === 'waiting') {
                        setQueue(prev => ({ ...prev, inQueue: true }));
                        addLogEntry("Detected existing queue entry");
                    } else if (data.status === 'matched' && data.game_id) {
                        setQueue(prev => ({ ...prev, inQueue: false }));
                        addLogEntry(`Detected matched game: ${data.game_id}`);
                        router.push(`/game/${data.game_id}`);
                    }
                }
            } catch (error) {
                console.error("Error checking matchmaking status:", error);
            }
        };

        checkMatchmakingStatus();

        return () => {
            // Clean up - unsubscribe
            if (channel) {
                try {
                    channel.unsubscribe();
                    addLogEntry("Player channel unsubscribed");
                } catch (error) {
                    console.error("Error cleaning up player channel:", error);
                }
            }
        };
        // needs to stay without the queue deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, router]);

    const handleQueueToggle = async () => {
        try {
            if (!session) {
                console.error("Cannot toggle queue without a session");
                addLogEntry("Error: No authenticated session");
                return;
            }

            if (queue.inQueue) {
                // Leave the queue
                addLogEntry("Attempting to leave matchmaking queue");
                try {
                    await MatchmakingService.leaveQueue(session);
                    setQueue(prev => ({ ...prev, inQueue: false }));
                    addLogEntry("Left matchmaking queue");
                } catch (error) {
                    console.error('Error leaving queue:', error);
                    addLogEntry(`Error leaving queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                // Check if we're already in a game
                addLogEntry("Checking for active games before joining queue");

                try {
                    const { data: activeGames } = await supabase
                        .from('games')
                        .select('id')
                        .or(`white_player_id.eq.${session.user.id},black_player_id.eq.${session.user.id}`)
                        .eq('status', 'active')
                        .limit(1);

                    if (activeGames && activeGames.length > 0) {
                        addLogEntry(`Already in an active game: ${activeGames[0].id}`);
                        router.push(`/game/${activeGames[0].id}`);
                        return;
                    }
                } catch (error) {
                    console.error('Error checking active games:', error);
                    addLogEntry(`Error checking active games: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }

                // Join the queue using the matchmaking service
                try {
                    await MatchmakingService.joinQueue(session);
                    setQueue(prev => ({ ...prev, inQueue: true }));
                    addLogEntry("Joined matchmaking queue");
                } catch (error) {
                    console.error('Error joining queue:', error);
                    addLogEntry(`Error joining queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error('Error toggling queue:', error);
            addLogEntry(`Error toggling queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const value = {
        queue,
        matchDetails,
        stats: { activeUsers, log },
        handleQueueToggle
    };

    return (
        <ConnectionContext.Provider value={value}>
            <GameProvider>
                {children}
            </GameProvider>
        </ConnectionContext.Provider>
    );
}