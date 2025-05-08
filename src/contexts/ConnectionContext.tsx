import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { socket } from "../pages/socket";
import type { QueueStatus, ServerToClientEvents, GameMatch } from "../types/socket";
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
        if (socket.connected) {
            onConnect();
        }

        function onConnect() {
            setIsConnected(true);
            setTransport(socket.io.engine.transport.name);

            socket.io.engine.on("upgrade", (transport) => {
                setTransport(transport.name);
            });
        }

        function onDisconnect() {
            setIsConnected(false);
            setTransport("N/A");
            setInQueue(false);
            setQueuePosition(0);
        }

        // Connection event handlers
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        const eventHandlers = {
            "queue-status": (data: QueueStatus) => {
                setQueuePosition(data.position);
                setInQueue(data.position > 0);
            },
            "game-matched": (data: GameMatch) => {
                setMatchDetails(data);
                setInQueue(false);
                setQueuePosition(0);
            }
        }

        // Subscribe to all server events
        Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.on(event as keyof ServerToClientEvents, handler);
        });

        return () => {
            // Clean up connection event listeners
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);

            // Clean up server event listeners
            Object.entries(eventHandlers).forEach(([event, handler]) => {
                socket.off(event as keyof ServerToClientEvents, handler);
            });
        };
    }, []);

    const handleQueueToggle = () => {
        if (inQueue) {
            socket.emit("leave-queue");
        } else {
            socket.emit("join-queue");
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
            <GameProvider socket={socket}>
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