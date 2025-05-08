import { useEffect, useState } from "react";
import { socket } from "../pages/socket";
import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import { WifiOff, Wifi, PlayArrow, Stop } from "@mui/icons-material";
import type { QueueStatus, GameMatch } from "../types/socket";

export default function Connection() {
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
        socket.on("game-matched", (data: GameMatch) => {
            setInQueue(false);
            setQueuePosition(0);
            // TODO: Handle game start
            console.log(`Game matched! ID: ${data.gameId}, Color: ${data.color}`);
        });

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("queue-status");
            socket.off("game-matched");
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
    );
}