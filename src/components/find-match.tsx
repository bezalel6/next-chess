import { useState, useEffect } from "react";
import { Box, Button, Typography, CircularProgress, Tooltip, List, ListItem, Collapse } from "@mui/material";
import { PlayArrow, Stop, SportsEsports, ExpandMore, ExpandLess } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { GameService } from "@/services/gameService";
import { MatchmakingService } from "@/services/matchmakingService";
import { useRouter } from "next/router";
import { UserService } from "@/services/userService";
import type { Game } from "@/types/game";
import UserLink from "@/components/user-link";

interface GameWithOpponent extends Game {
    opponentName: string;
}

function FindMatch() {
    const { queue, matchDetails, handleQueueToggle } = useConnection();
    const { user, session } = useAuth();
    const [activeGames, setActiveGames] = useState<GameWithOpponent[]>([]);
    const [hasActiveGames, setHasActiveGames] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkingMatch, setCheckingMatch] = useState(false);
    const [showActiveGames, setShowActiveGames] = useState(false);
    const router = useRouter();

    // Check for active games that would prevent joining matchmaking
    useEffect(() => {
        async function checkActiveGames() {
            if (!user) {
                setHasActiveGames(false);
                setActiveGames([]);
                return;
            }

            setChecking(true);
            try {
                const games = await GameService.getUserActiveGames(user.id);
                setHasActiveGames(games.length > 0);

                if (games.length > 0) {
                    // Get opponent usernames
                    const opponentIds = games.map(game =>
                        game.whitePlayer === user.id ? game.blackPlayer : game.whitePlayer
                    );

                    const usernames = await UserService.getUsernamesByIds(opponentIds);

                    // Add opponent names to game objects
                    const gamesWithOpponents = games.map(game => {
                        const opponentId = game.whitePlayer === user.id ? game.blackPlayer : game.whitePlayer;
                        return {
                            ...game,
                            opponentName: usernames[opponentId] || "Unknown Player"
                        };
                    });

                    setActiveGames(gamesWithOpponents);
                }
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

            // Small delay to show transition state in UI
            setCheckingMatch(true);
            const redirectTimeout = setTimeout(() => {
                router.push(`/game/${matchDetails.gameId}`);
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
        const handleGameMatched = () => {
            setCheckingMatch(true);
            // The ConnectionContext will handle the redirection
        };

        window.addEventListener('game_matched', handleGameMatched as EventListener);

        return () => {
            window.removeEventListener('game_matched', handleGameMatched as EventListener);
        };
    }, []);

    const handleJoinGame = (gameId: string) => {
        router.push(`/game/${gameId}`);
    };

    const toggleActiveGames = () => {
        setShowActiveGames(prev => !prev);
    };

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', width: '100%' }}>
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
                <Box sx={{ width: '100%', mt: 2 }}>
                    <Button
                        variant="outlined"
                        color="warning"
                        fullWidth
                        onClick={toggleActiveGames}
                        endIcon={showActiveGames ? <ExpandLess /> : <ExpandMore />}
                        sx={{ mb: 1 }}
                    >
                        You have {activeGames.length} active game{activeGames.length !== 1 ? 's' : ''}
                    </Button>

                    <Collapse in={showActiveGames}>
                        <List sx={{
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mt: 1,
                            maxHeight: '300px',
                            overflow: 'auto'
                        }}>
                            {activeGames.map(game => {
                                const isWhite = game.whitePlayer === user?.id;
                                const colorPlaying = isWhite ? 'white' : 'black';
                                const opponentTurn = game.turn !== colorPlaying;

                                return (
                                    <ListItem
                                        key={game.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: opponentTurn ? 'background.default' : 'action.hover',
                                            '&:last-child': {
                                                borderBottom: 'none'
                                            }
                                        }}
                                    >
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography variant="body2" fontWeight={500}>
                                                    vs.
                                                </Typography>
                                                <UserLink username={game.opponentName} />
                                            </Box>
                                            <Typography
                                                variant="caption"
                                                color={opponentTurn ? "text.secondary" : "primary"}
                                            >
                                                {opponentTurn ? `${game.opponentName}'s turn` : "Your turn"} • {colorPlaying}
                                            </Typography>
                                        </Box>
                                        <Button
                                            variant="contained"
                                            color={opponentTurn ? "primary" : "success"}
                                            size="small"
                                            startIcon={<SportsEsports />}
                                            onClick={() => handleJoinGame(game.id)}
                                        >
                                            Resume
                                        </Button>
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Collapse>
                </Box>
            )}
        </Box>
    );
}

export default FindMatch; 