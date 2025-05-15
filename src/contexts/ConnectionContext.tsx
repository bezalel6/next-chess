import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { QueueStatus, GameMatch } from "../types/realtime";
import { GameProvider } from "./GameContext";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "./AuthContext";
import { gameService, matchmakingService } from '@/utils/serviceTransition';
import { useRouter } from "next/router";

interface QueueState {
    inQueue: boolean;
    position: number;
    size: number;
}

interface Stats {
    activeUsers: number;
    activeGames: number;
    log: Array<{
        timestamp: string;
        message: string;
    }>;
}

interface ConnectionContextType {
    isConnected: boolean;
    transport: string;
    queue: QueueState;
    matchDetails: GameMatch | null;
    stats: Stats;
    handleQueueToggle: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [queue, setQueue] = useState<QueueState>({ inQueue: false, position: 0, size: 0 });
    const [matchDetails, setMatchDetails] = useState<GameMatch | null>(null);
    const [queueChannel, setQueueChannel] = useState<RealtimeChannel | null>(null);
    const [queueSubscribed, setQueueSubscribed] = useState(false);
    const [stats, setStats] = useState<Stats>({
        activeUsers: 0,
        activeGames: 0,
        log: []
    });
    const router = useRouter();

    const addLogEntry = (message: string) => {
        setStats(prev => ({
            ...prev,
            log: [...prev.log, {
                timestamp: new Date().toISOString(),
                message
            }].slice(-50)
        }));
    };

    // Handle presence and connection status
    useEffect(() => {
        if (!session?.user) {
            setIsConnected(false);
            setTransport("N/A");
            addLogEntry("User disconnected: No active session");
            return;
        }

        const channel = supabase.channel('online-users', {
            config: {
                broadcast: { self: true },
                presence: { key: session.user.id }
            }
        })
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const activeUsers = Object.keys(presenceState).length;
                const wasConnected = isConnected;
                setIsConnected(activeUsers > 0);
                setTransport('supabase');

                if (activeUsers > 0 && !wasConnected) {
                    addLogEntry(`Connected to realtime service (${activeUsers} active users)`);
                } else if (activeUsers === 0 && wasConnected) {
                    addLogEntry("Disconnected from realtime service");
                }

                setStats(prev => ({
                    ...prev,
                    activeUsers
                }));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
                    addLogEntry("Successfully subscribed to presence channel");

                    // Check for active matches on connection
                    // checkActiveMatch();  
                }
            });

        return () => {
            channel.unsubscribe();
            addLogEntry("Unsubscribed from presence channel");
        };
    }, [session, isConnected]);

    // Check for active matches that need redirection
    const checkActiveMatch = async () => {
        if (!session?.user) return;

        try {
            const activeGameId = await matchmakingService.checkActiveMatch(session.user.id);
            if (activeGameId) {
                addLogEntry(`Found active match: ${activeGameId}, redirecting...`);
                await matchmakingService.joinGame(activeGameId, router);
            }
        } catch (error) {
            console.error("Error checking active match:", error);
        }
    };

    // Setup queue channel
    useEffect(() => {
        if (!session?.user) {
            setQueue({ inQueue: false, position: 0, size: 0 });
            setMatchDetails(null);
            setQueueChannel(null);
            setQueueSubscribed(false);
            addLogEntry("Queue system reset: No active session");
            return;
        }

        // Create the channel without subscribing
        const channel = supabase.channel('queue-system')
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState<{ user_id: string; joined_at: string }>();
                const queueUsers = Object.values(presenceState).flat();
                const position = queueUsers.findIndex(user => user.user_id === session.user.id) + 1;
                const oldPosition = queue.position;

                setQueue({
                    inQueue: position > 0,
                    position,
                    size: queueUsers.length
                });

                if (position !== oldPosition) {
                    if (position > 0) {
                        addLogEntry(`Queue position updated: ${position}/${queueUsers.length}`);
                    } else if (oldPosition > 0) {
                        addLogEntry("Left queue");
                    }
                }
            });

        // Set up match listener using the secured matchmaking service
        matchmakingService.setupMatchListener(channel, router, (gameId, isWhite) => {
            setMatchDetails({ gameId, isWhite });
            setQueue({ inQueue: false, position: 0, size: 0 });
            addLogEntry(`Game matched! Game ID: ${gameId}, playing as ${isWhite ? 'white' : 'black'}`);

            // In case the router navigation in setupMatchListener fails
            setTimeout(() => {
                const currentPath = router.pathname;
                if (!currentPath.includes(`/game/${gameId}`)) {
                    addLogEntry(`Ensuring redirection to game ${gameId}`);
                    router.push(`/game/${gameId}`);
                }
            }, 2000);
        });

        setQueueChannel(channel);

        // Subscribe to the channel immediately
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                setQueueSubscribed(true);
                addLogEntry("Queue channel subscribed successfully");
            }
        });

        return () => {
            // Clean up - unsubscribe and untrack
            if (channel) {
                try {
                    // Only attempt to untrack if we're in the queue
                    if (queue.inQueue) {
                        channel.untrack();
                    }
                    channel.unsubscribe();
                    setQueueSubscribed(false);
                } catch (error) {
                    console.error("Error cleaning up queue channel:", error);
                }
                addLogEntry("Queue channel cleanup complete");
            }
        };
        // needs to stay without the queue deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, router]);

    const handleQueueToggle = async () => {
        if (!session?.user || !queueChannel) return;

        try {
            if (queue.inQueue) {
                // Leave queue using the secure matchmaking service
                await matchmakingService.leaveQueue(session, queueChannel);
                setQueue({ inQueue: false, position: 0, size: 0 });
                addLogEntry("Manually left queue");
            } else {
                // Join queue - first check if user has active games
                if (!queueSubscribed) {
                    addLogEntry("Queue channel not yet subscribed, please try again in a moment");
                    return;
                }

                // First check for active matches
                try {
                    const activeGameId = await matchmakingService.checkActiveMatch(session.user.id);
                    if (activeGameId) {
                        addLogEntry(`Found active match: ${activeGameId}, redirecting...`);
                        await matchmakingService.joinGame(activeGameId, router);
                        return;
                    }
                } catch (error) {
                    console.error("Error checking active match:", error);
                    addLogEntry(`Error checking active matches: ${error.message || "Unknown error"}`);
                }

                // Check for active games before joining queue
                try {
                    const activeGames = await gameService.getUserActiveGames(session.user.id);

                    if (activeGames.length > 0) {
                        addLogEntry("Cannot join queue: You have unfinished games");
                        return;
                    }
                } catch (error) {
                    console.error('Error checking active games:', error);
                    addLogEntry(`Error checking active games: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return;
                }

                // Join the queue using the secure matchmaking service with the existing channel
                try {
                    await matchmakingService.joinQueue(session, queueChannel);
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
        isConnected,
        transport,
        queue,
        matchDetails,
        stats,
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

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error('useConnection must be used within a ConnectionProvider');
    }
    return context;
}