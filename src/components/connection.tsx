import { useEffect, useState } from "react";
import { socket } from "../pages/socket";
import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import { WifiOff, Wifi, PlayArrow, Stop } from "@mui/icons-material";
import type { QueueStatus, ServerToClientEvents, GameMatch } from "../types/socket";
import { GameProvider } from "@/contexts/GameContext";
import type { ReactNode } from "react";

interface ConnectionProps {
    children: ReactNode;
}
export type ConnectionRelatedEvents = Pick<ServerToClientEvents, "queue-status" | "game-matched">

export default function Connection({ children }: ConnectionProps) {
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

        const eventHandlers: ConnectionRelatedEvents = {
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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <GameProvider socket={socket}>
                {children}
            </GameProvider>
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    maxWidth: 'fit-content'
                }}
            >
                <Chip
                    icon={isConnected ? <Wifi /> : <WifiOff />}
                    label={isConnected ? "Connected" : "Disconnected"}
                    color={isConnected ? "success" : "error"}
                    variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                    Transport: {transport}
                </Typography>
                {isConnected && !matchDetails && (
                    <Button
                        variant="contained"
                        color={inQueue ? "error" : "primary"}
                        startIcon={inQueue ? <Stop /> : <PlayArrow />}
                        onClick={handleQueueToggle}
                    >
                        {inQueue ? `Leave Queue (${queuePosition})` : "Join Queue"}
                    </Button>
                )}
                {matchDetails && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            label={`Game ID: ${matchDetails.gameId}`}
                            color="info"
                            variant="outlined"
                        />
                        <Chip
                            label={`Playing as: ${matchDetails.color}`}
                            color={matchDetails.color === 'white' ? 'default' : 'primary'}
                            variant="outlined"
                        />
                    </Box>
                )}
            </Paper>
        </Box>
    );
}