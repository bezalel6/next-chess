import { useState, useEffect } from "react";
import { Box, Button, Typography, CircularProgress, Tooltip } from "@mui/material";
import { PlayArrow, Stop } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { GameService } from "@/services/gameService";

function FindMatch() {
    const { isConnected, queue, handleQueueToggle } = useConnection();
    const { user } = useAuth();
    const [hasActiveGames, setHasActiveGames] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        async function checkActiveGames() {
            if (!user) {
                setHasActiveGames(false);
                return;
            }

            setChecking(true);
            try {
                const games = await GameService.getUserActiveGames(user.id);
                setHasActiveGames(games.length > 0);
            } catch (error) {
                console.error('Error checking active games:', error);
                setHasActiveGames(false);
            } finally {
                setChecking(false);
            }
        }

        checkActiveGames();
    }, [user]);

    if (!isConnected) {
        return null;
    }

    const buttonDisabled = hasActiveGames || checking || queue.inQueue;
    const playButton = (
        <Button
            variant="contained"
            color={queue.inQueue ? "error" : "primary"}
            startIcon={queue.inQueue ? <Stop /> : <PlayArrow />}
            onClick={handleQueueToggle}
            size="large"
            disabled={hasActiveGames && !queue.inQueue}
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
            {(queue.inQueue || checking) && (
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
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            {hasActiveGames && !queue.inQueue ? (
                <Tooltip title="You must finish your active games before starting a new one">
                    <span>{playButton}</span>
                </Tooltip>
            ) : (
                playButton
            )}
            
            {queue.inQueue && (
                <Typography variant="body2" color="text.secondary">
                    Finding opponent... {queue.position > 0 && `(${queue.position}/${queue.size})`}
                </Typography>
            )}
            
            {hasActiveGames && !queue.inQueue && (
                <Typography variant="body2" color="error">
                    Please finish your active games before starting a new one
                </Typography>
            )}
        </Box>
    );
}

export default FindMatch; 