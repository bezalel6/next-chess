import { useEffect, useState } from "react";
import { socket } from "../pages/socket";
import { Box, Paper, Typography, Chip } from "@mui/material";
import { WifiOff, Wifi } from "@mui/icons-material";

export default function Connection() {
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");

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
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, []);

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
        </Paper>
    );
}