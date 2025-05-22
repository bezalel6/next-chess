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
    transport: string;
    queue: QueueState;
    matchDetails: GameMatch | null;
    stats: {
        latency: number;
        messageCount: number;
        log: { timestamp: number, message: string }[];
    };
    handleQueueToggle: () => Promise<void>;
}

const initialConnectionState: ConnectionState = {
    transport: '',
    queue: {
        inQueue: false,
        position: 0,
        size: 0
    },
    matchDetails: null,
    stats: {
        latency: 0,
        messageCount: 0,
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
    const [transport, setTransport] = useState('');
    const [queue, setQueue] = useState<QueueState>({ inQueue: false, position: 0, size: 0 });
    const [matchDetails, setMatchDetails] = useState<GameMatch | null>(null);
    const [stats, setStats] = useState({ latency: 0, messageCount: 0 });

    // Channel management
    const [queueChannel, setQueueChannel] = useState<RealtimeChannel | null>(null);
    const [queueSubscribed, setQueueSubscribed] = useState(false);

    // Debug logging
    const [log, setLog] = useState<ConnectionState['stats']['log']>([]);
    const addLogEntry = (entry: string) => {
        setLog(prev => [
            ...prev.slice(0, 19),
            { message: entry, timestamp: new Date().getTime() },
        ]);
        console.log(`[ConnectionContext] ${entry}`);
    };

    // Handle player authentication and queue setup
    useEffect(() => {
        if (!session?.user) {
            addLogEntry("No authenticated user, skipping queue setup");
            setQueueChannel(null);
            setQueueSubscribed(false);
            return;
        }

        addLogEntry(`Setting up queue for user ${session.user.id}`);

        // Create a channel directly
        const channel = supabase.channel(`matchmaking:${session.user.id}`, {
            config: {
                broadcast: { self: true },
                presence: { key: session.user.id },
            }
        });

        // Set up match listener using the matchmaking service
        MatchmakingService.setupMatchListener(channel, router, (gameId, isWhite) => {
            setMatchDetails({ gameId, isWhite });
            setQueue({ inQueue: false, position: 0, size: 0 });
            addLogEntry(`Game matched! Game ID: ${gameId}, Playing as white: ${isWhite}`);

            // In case the router navigation in setupMatchListener fails
            setTimeout(() => {
                const currentPath = router.pathname;
                if (!currentPath.includes(`/game/${gameId}`)) {
                    addLogEntry(`Ensuring redirection to game ${gameId}`);
                    router.push(`/game/${gameId}`);
                }
            }, 2000);
        });

        // Listen for custom game_matched event from the player-specific channel
        const handleGameMatched = (event: CustomEvent<{ gameId: string, isWhite?: boolean, opponentId?: string }>) => {
            const { gameId, isWhite, opponentId } = event.detail;
            addLogEntry(`Custom game_matched event! Game ID: ${gameId}, Playing as white: ${isWhite}, Opponent: ${opponentId}`);
            setMatchDetails({ gameId, isWhite, opponentId });
            setQueue({ inQueue: false, position: 0, size: 0 });

            // Navigate to the game
            router.push(`/game/${gameId}`);
        };

        window.addEventListener('game_matched', handleGameMatched as EventListener);

        // Setup player-specific channel via MatchmakingService
        MatchmakingService.setupPlayerChannel(session.user.id);

        setQueueChannel(channel);

        // Subscribe to the channel immediately
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                setQueueSubscribed(true);
                addLogEntry("Queue channel subscribed successfully");
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
                console.log("matchmaking system:", data)
                if (data) {
                    if (data.status === 'waiting') {
                        setQueue(prev => ({ ...prev, inQueue: true }));
                        addLogEntry("Detected existing queue entry");
                    } else if (data.status === 'matched' && data.game_id) {
                        setQueue(prev => ({ ...prev, inQueue: false }))
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
            // Clean up - unsubscribe and untrack
            window.removeEventListener('game_matched', handleGameMatched as EventListener);

            if (channel) {
                try {
                    channel.unsubscribe();
                    setQueueSubscribed(false);
                    addLogEntry("Queue channel unsubscribed");
                } catch (error) {
                    console.error("Error cleaning up queue channel:", error);
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
                    await MatchmakingService.leaveQueue(session, queueChannel || undefined);
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

                // Join the queue using the matchmaking service with the existing channel
                try {
                    await MatchmakingService.joinQueue(session, queueChannel || undefined);
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
        transport,
        queue,
        matchDetails,
        stats: { ...stats, log },
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