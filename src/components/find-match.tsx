import { useState, useEffect } from "react";
import { Box, Button, Typography, CircularProgress, Tooltip } from "@mui/material";
import { PlayArrow, Stop } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { GameService } from "@/services/gameService";
import { MatchmakingService } from "@/services/matchmakingService";
import { useRouter } from "next/router";

function FindMatch() {
    const { queue, matchDetails, handleQueueToggle } = useConnection();
    const { user, session } = useAuth();
    const [hasActiveGames, setHasActiveGames] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkingMatch, setCheckingMatch] = useState(false);
    const router = useRouter();

    // Check for active games that would prevent joining matchmaking
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

    // Handle match detection and game redirection
    useEffect(() => {
        if (matchDetails?.gameId) {

            // RULED IN
            // Small delay to show transition state in UI
            // setCheckingMatch(true);
            const redirectTimeout = setTimeout(() => {
                // router.push(`/game/${matchDetails.gameId}`);
            }, 1000);

            return () => clearTimeout(redirectTimeout);
        }

        return () => { };
    }, [matchDetails, router]);

    // Check matchmaking status on component mount
    useEffect(() => {
        if (session) {
            const checkMatchmakingStatus = async () => {
                try {
                    const statusData = await MatchmakingService.checkStatus(session);

                    // If we have a matched game with a game_id, redirect to it
                    if (statusData.matchFound && statusData.game?.id) {
                        setCheckingMatch(true);
                        router.push(`/game/${statusData.game.id}`);
                    }

                    // Note: The ConnectionContext will handle updating queue status
                    // through its own checkMatchmakingStatus function
                } catch (error) {
                    console.error("Error checking matchmaking status:", error);
                }
            };

            checkMatchmakingStatus();
        }
    }, [session, router]);

    // Listen for game_matched custom event
    useEffect(() => {
        const handleGameMatched = (event: CustomEvent<{ gameId: string, isWhite?: boolean }>) => {
            setCheckingMatch(true);
            // The ConnectionContext will handle the redirection
        };

        window.addEventListener('game_matched', handleGameMatched as EventListener);

        return () => {
            window.removeEventListener('game_matched', handleGameMatched as EventListener);
        };
    }, []);

    const buttonDisabled = hasActiveGames || checking || queue.inQueue || checkingMatch;

    const playButton = (
        <Button
            variant="contained"
            color={queue.inQueue ? "error" : "primary"}
            startIcon={queue.inQueue ? <Stop /> : <PlayArrow />}
            onClick={handleQueueToggle}
            size="large"
            disabled={buttonDisabled && !queue.inQueue}
            sx={{
                minWidth: 200,
                height: 56,
                fontSize: '1.2rem',
                position: 'relative',
                boxShadow: 3
            }}
        >
            {queue.inQueue ? "Cancel" : "Play"}
            {(queue.inQueue || checking || checkingMatch) && (
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

            {checkingMatch && (
                <Typography variant="body2" color="text.secondary">
                    Match found! Setting up game...
                </Typography>
            )}

            {hasActiveGames && !queue.inQueue && !checkingMatch && (
                <Typography variant="body2" color="error">
                    Please finish your active games before starting a new one
                </Typography>
            )}
        </Box>
    );
}

export default FindMatch; 