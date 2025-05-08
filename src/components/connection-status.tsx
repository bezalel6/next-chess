import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import { WifiOff, Wifi, PlayArrow, Stop } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";

export default function ConnectionStatus() {
    const { isConnected, transport, inQueue, queuePosition, matchDetails, handleQueueToggle } = useConnection();

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