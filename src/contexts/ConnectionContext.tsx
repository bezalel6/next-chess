import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { QueueStatus, GameMatch } from "../types/realtime";
import { GameProvider } from "./GameContext";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "./AuthContext";

interface QueueState {
    inQueue: boolean;
    position: number;
    size: number;
}

interface ConnectionContextType {
    isConnected: boolean;
    transport: string;
    queue: QueueState;
    matchDetails: GameMatch | null;
    handleQueueToggle: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [queue, setQueue] = useState<QueueState>({ inQueue: false, position: 0, size: 0 });
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
            const presenceState = channel.presenceState();
            setIsConnected(Object.keys(presenceState).length > 0);
            setTransport('supabase');
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
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
            setQueue({ inQueue: false, position: 0, size: 0 });
            setMatchDetails(null);
            return;
        }

        const channel = supabase.channel('queue-system')
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState<{ user_id: string; joined_at: string }>();
                const queueUsers = Object.values(presenceState).flat()
                const position = queueUsers.findIndex(user => user.user_id === session.user.id) + 1;
                
                setQueue({
                    inQueue: position > 0,
                    position,
                    size: queueUsers.length
                });
            })
            .on('broadcast', { event: 'game-matched' }, ({ payload }) => {
                const data = payload as GameMatch;
                setMatchDetails(data);
                setQueue({ inQueue: false, position: 0, size: 0 });
            });

        setQueueChannel(channel);
        return () => {
            channel.unsubscribe();
        };
    }, [session]);

    const handleQueueToggle = async () => {
        if (!session?.user || !queueChannel) return;

        try {
            if (queue.inQueue) {
                await queueChannel.untrack();
                setQueue({ inQueue: false, position: 0, size: 0 });
            } else {
                await queueChannel.subscribe();
                await queueChannel.track({ user_id: session.user.id, joined_at: new Date().toISOString() });
                setQueue(prev => ({ ...prev, inQueue: true }));
            }
        } catch (error) {
            console.error('Error toggling queue:', error);
        }
    };

    const value = {
        isConnected,
        transport,
        queue,
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