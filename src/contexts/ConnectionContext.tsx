import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { QueueStatus, GameMatch } from "../types/realtime";
import { GameProvider } from "./GameContext";

interface ConnectionContextType {
    isConnected: boolean;
    transport: string;
    inQueue: boolean;
    queuePosition: number;
    matchDetails: GameMatch | null;
    handleQueueToggle: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [inQueue, setInQueue] = useState(false);
    const [queuePosition, setQueuePosition] = useState(0);
    const [matchDetails, setMatchDetails] = useState<GameMatch | null>(null);

    useEffect(() => {
        // Subscribe to connection status changes
        const channel = supabase.channel('connection-status');
        
        // Subscribe to queue status changes
        const queueChannel = supabase.channel('queue-status')
            .on('broadcast', { event: 'queue-status' }, ({ payload }) => {
                const data = payload as QueueStatus;
                setQueuePosition(data.position);
                setInQueue(data.position > 0);
            })
            .on('broadcast', { event: 'game-matched' }, ({ payload }) => {
                const data = payload as GameMatch;
                setMatchDetails(data);
                setInQueue(false);
                setQueuePosition(0);
            });

        // Subscribe to connection status
        supabase.auth.onAuthStateChange((event, session) => {
            setIsConnected(!!session);
            setTransport(session ? 'supabase' : 'N/A');
        });

        // Initial connection check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsConnected(!!session);
            setTransport(session ? 'supabase' : 'N/A');
        });

        return () => {
            channel.unsubscribe();
            queueChannel.unsubscribe();
        };
    }, []);

    const handleQueueToggle = async () => {
        if (!isConnected) return;

        if (inQueue) {
            await supabase.channel('queue-status').send({
                type: 'broadcast',
                event: 'leave-queue',
                payload: { userId: (await supabase.auth.getUser()).data.user?.id }
            });
        } else {
            await supabase.channel('queue-status').send({
                type: 'broadcast',
                event: 'join-queue',
                payload: { userId: (await supabase.auth.getUser()).data.user?.id }
            });
        }
    };

    const value = {
        isConnected,
        transport,
        inQueue,
        queuePosition,
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