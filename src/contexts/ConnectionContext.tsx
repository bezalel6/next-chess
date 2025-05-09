import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { QueueStatus, GameMatch } from "../types/realtime";
import { GameProvider } from "./GameContext";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "./AuthContext";

interface ConnectionContextType {
    isConnected: boolean;
    transport: string;
    inQueue: boolean;
    queuePosition: number;
    queueSize: number;
    matchDetails: GameMatch | null;
    handleQueueToggle: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [inQueue, setInQueue] = useState(false);
    const [queuePosition, setQueuePosition] = useState(0);
    const [queueSize, setQueueSize] = useState(0);
    const [matchDetails, setMatchDetails] = useState<GameMatch | null>(null);
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
    const [queueChannel, setQueueChannel] = useState<RealtimeChannel | null>(null);

    // Handle presence and connection status
    useEffect(() => {
        if (!session?.user) {
            setIsConnected(false);
            setTransport("N/A");
            return;
        }

        const channel = supabase.channel('online-users', {
            config: {
                broadcast: { self: true },
                presence: { key: session.user.id }
            }
        })
        .on('presence', { event: 'sync' }, () => {
            try {
                const presenceState = channel.presenceState();
                setIsConnected(Object.keys(presenceState).length > 0);
                setTransport('supabase');
            } catch (error) {
                console.error('Error in presence sync:', error);
                setIsConnected(false);
            }
        })
        .on('system', { event: 'error' }, (error) => {
            console.error('Presence channel error:', error);
            setIsConnected(false);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
                } catch (error) {
                    console.error('Error tracking presence:', error);
                }
            } else if (status === 'CHANNEL_ERROR') {
                console.error('Presence channel error');
                setIsConnected(false);
            }
        });

        setPresenceChannel(channel);

        return () => {
            channel.unsubscribe();
        };
    }, [session]);

    // Handle queue and matchmaking
    useEffect(() => {
        if (!session?.user) {
            setInQueue(false);
            setQueuePosition(0);
            setQueueSize(0);
            setMatchDetails(null);
            return;
        }

        const channel = supabase.channel('queue-system')
            .on('presence', { event: 'sync' }, () => {
                try {
                    const presenceState = channel.presenceState();
                    const queue = Object.values(presenceState).flat() as unknown as Array<{ user_id: string; joined_at: string }>;
                    const position = queue.findIndex(user => user.user_id === session.user.id) + 1;
                    console.debug('[Queue] Sync event:', {
                        queueSize: queue.length,
                        userPosition: position,
                        queueState: presenceState
                    });
                    setQueuePosition(position);
                    setQueueSize(queue.length);
                    setInQueue(position > 0);
                } catch (error) {
                    console.error('Error in queue sync:', error);
                    setInQueue(false);
                    setQueuePosition(0);
                    setQueueSize(0);
                }
            })
            .on('broadcast', { event: 'game-matched' }, ({ payload }) => {
                try {
                    const data = payload as GameMatch;
                    console.debug('[Queue] Game matched:', data);
                    setMatchDetails(data);
                    setInQueue(false);
                    setQueuePosition(0);
                    setQueueSize(0);
                } catch (error) {
                    console.error('Error handling game match:', error);
                }
            })
            .on('system', { event: 'error' }, (error) => {
                console.error('Queue channel error:', error);
                setInQueue(false);
                setQueuePosition(0);
                setQueueSize(0);
            });

        setQueueChannel(channel);

        return () => {
            channel.unsubscribe();
        };
    }, [session]);

    const handleQueueToggle = async () => {
        if (!session?.user || !queueChannel) return;

        try {
            if (inQueue) {
                console.debug('[Queue] User leaving queue');
                await queueChannel.untrack();
                setInQueue(false);
                setQueuePosition(0);
                setQueueSize(0);
            } else {
                console.debug('[Queue] User joining queue');
                await queueChannel.subscribe();
                await queueChannel.track({ user_id: session.user.id, joined_at: new Date().toISOString() });
                setInQueue(true);
            }
        } catch (error) {
            console.error('Error toggling queue:', error);
        }
    };

    const value = {
        isConnected,
        transport,
        inQueue,
        queuePosition,
        queueSize,
        matchDetails,
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