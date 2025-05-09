import { Box, Paper, Typography, Chip, Button } from "@mui/material";
import { WifiOff, Wifi, PlayArrow, Stop, Logout } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { withAuth } from "./with-auth";

function ConnectionStatus() {
    const { isConnected, transport, inQueue, queuePosition, queueSize, matchDetails, handleQueueToggle } = useConnection();
    const { signOut } = useAuth();

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
                    <>
                        <Button
                            variant="contained"
                            color={inQueue ? "error" : "primary"}
                            startIcon={inQueue ? <Stop /> : <PlayArrow />}
                            onClick={handleQueueToggle}
                        >
                            {inQueue ? `Leave Queue (${queuePosition}/${queueSize})` : "Join Queue"}
                        </Button>
                        {inQueue && (
                            <Typography variant="body2" color="text.secondary">
                                Queue Size: {queueSize}
                            </Typography>
                        )}
                    </>
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
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Logout />}
                    onClick={signOut}
                >
                    Sign Out
                </Button>
            </Paper>
        </Box>
    );
}

export default withAuth(ConnectionStatus);