import { useEffect, useState } from "react";
import { socket } from "../pages/socket";
import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import { WifiOff, Wifi, PlayArrow, Stop } from "@mui/icons-material";
import type { QueueStatus, GameMatch, ChessMove } from "../types/socket";
import { GameProvider } from "@/contexts/GameContext";
import type { ReactNode } from "react";

interface ConnectionProps {
    children: ReactNode;
}

export default function Connection({ children }: ConnectionProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [inQueue, setInQueue] = useState(false);
    const [queuePosition, setQueuePosition] = useState(0);

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

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("queue-status", (data: QueueStatus) => {
            setQueuePosition(data.position);
            setInQueue(data.position > 0);
        });

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("queue-status");
        };
    }, []);

    const handleQueueToggle = () => {
        if (inQueue) {
            socket.emit("leave-queue");
        } else {
            socket.emit("join-queue");
        }
    };

    const handleSendMove = (gameId: string, move: ChessMove) => {
        socket.emit('make-move', { gameId, move });
    };

    const handleGameEvent = (event: 'join' | 'leave', gameId: string) => {
        socket.emit(`${event}-game`, gameId);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
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
                {isConnected && (
                    <Button
                        variant="contained"
                        color={inQueue ? "error" : "primary"}
                        startIcon={inQueue ? <Stop /> : <PlayArrow />}
                        onClick={handleQueueToggle}
                    >
                        {inQueue ? `Leave Queue (${queuePosition})` : "Join Queue"}
                    </Button>
                )}
            </Paper>
            <GameProvider onSendMove={handleSendMove} onGameEvent={handleGameEvent}>
                {children}
            </GameProvider>
        </Box>
    );
}