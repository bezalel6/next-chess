import { Box, Button, Typography, CircularProgress } from "@mui/material";
import { PlayArrow, Stop } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";

function FindMatch() {
    const { isConnected, queue, handleQueueToggle } = useConnection();

    if (!isConnected) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <Button
                variant="contained"
                color={queue.inQueue ? "error" : "primary"}
                startIcon={queue.inQueue ? <Stop /> : <PlayArrow />}
                onClick={handleQueueToggle}
                size="large"
                sx={{
                    minWidth: 200,
                    height: 56,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1.2rem',
                    position: 'relative'
                }}
            >
                {queue.inQueue ? "Cancel" : "Play"}
                {queue.inQueue && (
                    <CircularProgress
                        size={24}
                        sx={{
                            position: 'absolute',
                            right: 16,
                            color: 'white'
                        }}
                    />
                )}
            </Button>
            {queue.inQueue && (
                <Typography variant="body2" color="text.secondary">
                    Finding opponent... {queue.position > 0 && `(${queue.position}/${queue.size})`}
                </Typography>
            )}
        </Box>
    );
}

export default FindMatch; 