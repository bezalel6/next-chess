import { Box, Typography, Button, Stack, Paper, Fade, Divider } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useGameActions } from "@/hooks/useGameActions";
import { useMemo, useState, useEffect } from "react";
import UserLink from '@/components/user-link';
import HomeIcon from '@mui/icons-material/Home';
import ReplayIcon from '@mui/icons-material/Replay';

const GameOverDetails = () => {
    const game = useUnifiedGameStore(s => s.game);
    const myColor = useUnifiedGameStore(s => s.myColor);
    const playerUsernames = useUnifiedGameStore(s => s.playerUsernames);
    const actions = useGameActions();

    // Animate in on mount and auto-dismiss
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    
    useEffect(() => {
        if (game?.status === 'finished' && !dismissed) {
            setShow(true);
            // Auto-dismiss after 2 seconds
            const timer = setTimeout(() => {
                setShow(false);
                setDismissed(true);
            }, 2000);
            
            return () => clearTimeout(timer);
        } else if (game?.status !== 'finished') {
            setShow(false);
            setDismissed(false);
        }
    }, [game?.status, dismissed]);

    // Generate the game result message and icon
    const gameResultInfo = useMemo(() => {
        if (!game || game.status !== 'finished') return null;

        let resultHeader = '';
        let resultDetail = '';
        let personalMessage = '';
        let resultType: 'win' | 'draw' | 'lose' = 'draw';

        if (game.result === 'white') {
            resultHeader = `${playerUsernames.white} won`;
            if (game.endReason === 'checkmate') {
                resultDetail = 'by checkmate';
            } else if (game.endReason === 'timeout') {
                resultDetail = 'on time';
            } else {
                resultDetail = 'by resignation';
            }
            if (myColor === 'white') resultType = 'win';
            else if (myColor === 'black') resultType = 'lose';
        } else if (game.result === 'black') {
            resultHeader = `${playerUsernames.black} won`;
            if (game.endReason === 'checkmate') {
                resultDetail = 'by checkmate';
            } else if (game.endReason === 'timeout') {
                resultDetail = 'on time';
            } else {
                resultDetail = 'by resignation';
            }
            if (myColor === 'black') resultType = 'win';
            else if (myColor === 'white') resultType = 'lose';
        } else {
            resultHeader = 'Game drawn';
            resultType = 'draw';
            if (game.endReason === 'stalemate') {
                resultDetail = 'by stalemate';
            } else if (game.endReason === 'insufficient_material') {
                resultDetail = 'by insufficient material';
            } else if (game.endReason === 'threefold_repetition') {
                resultDetail = 'by threefold repetition';
            } else if (game.endReason === 'fifty_move_rule') {
                resultDetail = 'by 50-move rule';
            } else if (game.endReason === 'draw_agreement') {
                resultDetail = 'by agreement';
            } else {
                resultDetail = '';
            }
        }

        if (myColor) {
            const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
            const isWinner = (myColor === 'white' && game.result === 'white') ||
                (myColor === 'black' && game.result === 'black');

            if (isWinner) {
                personalMessage = `Congratulations! You defeated ${opponentName}.`;
            } else if (game.result === 'draw') {
                personalMessage = `The game ended in a draw between you and ${opponentName}.`;
            } else {
                personalMessage = `Better luck next time against ${opponentName}!`;
            }
        } else {
            personalMessage = `Game between ${playerUsernames.white} and ${playerUsernames.black} has ended.`;
        }

        return { resultHeader, resultDetail, personalMessage, resultType };
    }, [game, myColor, playerUsernames]);

    // Function to render rematch buttons
    const RematchButtons = () => {
        if (!game || !myColor) return null;
        const opponentColor = myColor === 'white' ? 'black' : 'white';
        if (!game.rematchOfferedBy) {
            return (
                <Button
                    variant="contained"
                    startIcon={<ReplayIcon />}
                    onClick={actions.offerRematch}
                    sx={{ 
                        bgcolor: 'rgba(76, 175, 80, 0.9)',
                        color: 'white',
                        '&:hover': {
                            bgcolor: 'rgba(76, 175, 80, 1)',
                        }
                    }}
                >
                    Rematch
                </Button>
            );
        }
        if (game.rematchOfferedBy === myColor) {
            return (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                    Rematch offered
                </Typography>
            );
        }
        if (game.rematchOfferedBy === opponentColor) {
            return (
                <Stack direction="row" spacing={1} justifyContent="center">
                    <Button
                        variant="contained"
                        onClick={actions.acceptRematch}
                        sx={{ 
                            bgcolor: 'rgba(76, 175, 80, 0.9)',
                            color: 'white',
                            '&:hover': {
                                bgcolor: 'rgba(76, 175, 80, 1)',
                            }
                        }}
                    >
                        Accept
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={actions.declineRematch}
                        sx={{ 
                            borderColor: 'rgba(244, 67, 54, 0.5)',
                            color: 'rgba(244, 67, 54, 0.9)',
                            '&:hover': {
                                borderColor: 'rgba(244, 67, 54, 0.8)',
                                bgcolor: 'rgba(244, 67, 54, 0.05)',
                            }
                        }}
                    >
                        Decline
                    </Button>
                </Stack>
            );
        }
        return null;
    };

    if (!gameResultInfo) return null;

    // For spectators, show a simple score instead of personalized icon/message
    if (!myColor) {
        let score = '';
        if (game.result === 'white') score = '1 - 0';
        else if (game.result === 'black') score = '0 - 1';
        else if (game.result === 'draw') score = '½ - ½';
        
        return (
            <Fade in={show} timeout={500}>
                <Paper elevation={8}
                    sx={{
                        width: '100%',
                        maxWidth: 420,
                        mx: 'auto',
                        overflow: 'hidden',
                        borderRadius: 2,
                        background: 'linear-gradient(145deg, rgba(18, 18, 18, 0.98) 0%, rgba(28, 28, 28, 0.95) 100%)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 80px rgba(0,0,0,0.2)',
                    }}
                >
                    {/* Result Header */}
                    <Box sx={{ 
                        p: 3,
                        background: 'linear-gradient(135deg, rgba(255,255,255, 0.05) 0%, rgba(255,255,255, 0.02) 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <Typography 
                            variant="h4" 
                            sx={{ 
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: 700,
                                textAlign: 'center',
                                letterSpacing: 3,
                                mb: 0.5,
                            }}
                        >
                            {score}
                        </Typography>
                        {gameResultInfo.resultDetail && (
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    color: 'rgba(255,255,255,0.6)',
                                    textAlign: 'center',
                                    textTransform: 'capitalize',
                                    letterSpacing: 0.5,
                                }}
                            >
                                {gameResultInfo.resultDetail}
                            </Typography>
                        )}
                    </Box>

                    {/* Players Info */}
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                        }}>
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>
                                    {game.result === 'white' ? 'WINNER' : game.result === 'black' ? 'LOSER' : 'PLAYER'}
                                </Typography>
                                <UserLink username={playerUsernames.white} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
                                    White
                                </Typography>
                            </Box>
                            
                            <Typography 
                                variant="h6" 
                                sx={{ 
                                    color: 'rgba(255,255,255,0.3)',
                                    mx: 2,
                                    fontWeight: 300,
                                }}
                            >
                                vs
                            </Typography>
                            
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>
                                    {game.result === 'black' ? 'WINNER' : game.result === 'white' ? 'LOSER' : 'PLAYER'}
                                </Typography>
                                <UserLink username={playerUsernames.black} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
                                    Black
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2 }} />

                        {/* Action Button */}
                        <Stack direction="row" spacing={2} justifyContent="center">
                            <Button
                                variant="outlined"
                                startIcon={<HomeIcon />}
                                onClick={actions.resetGame}
                                sx={{ 
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    color: 'rgba(255,255,255,0.8)',
                                    '&:hover': {
                                        borderColor: 'rgba(255,255,255,0.4)',
                                        bgcolor: 'rgba(255,255,255,0.05)',
                                    }
                                }}
                            >
                                Home
                            </Button>
                        </Stack>
                    </Box>
                </Paper>
            </Fade>
        );
    }

    // Determine result colors and styling
    const resultColor = gameResultInfo.resultType === 'win' ? '#4caf50' : 
                       gameResultInfo.resultType === 'lose' ? '#f44336' : '#ffc107';
    
    const resultBgGradient = gameResultInfo.resultType === 'win' 
        ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)'
        : gameResultInfo.resultType === 'lose'
        ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)'
        : 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%)';

    return (
        <Fade in={show} timeout={500}>
            <Paper elevation={8}
                sx={{
                    width: '100%',
                    maxWidth: 420,
                    mx: 'auto',
                    overflow: 'hidden',
                    borderRadius: 2,
                    background: 'linear-gradient(145deg, rgba(18, 18, 18, 0.98) 0%, rgba(28, 28, 28, 0.95) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 80px rgba(0,0,0,0.2)',
                }}
            >
                {/* Result Header */}
                <Box sx={{ 
                    p: 3,
                    background: resultBgGradient,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            color: resultColor,
                            fontWeight: 700,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            mb: 0.5,
                        }}
                    >
                        {gameResultInfo.resultType === 'win' ? 'Victory' : 
                         gameResultInfo.resultType === 'lose' ? 'Defeat' : 'Draw'}
                    </Typography>
                    {gameResultInfo.resultDetail && (
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                color: 'rgba(255,255,255,0.7)',
                                textAlign: 'center',
                                textTransform: 'capitalize',
                                letterSpacing: 0.5,
                            }}
                        >
                            {gameResultInfo.resultDetail}
                        </Typography>
                    )}
                </Box>

                {/* Players Info */}
                <Box sx={{ p: 3 }}>
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                    }}>
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>
                                {game.result === 'white' ? 'WINNER' : game.result === 'black' ? 'LOSER' : 'PLAYER'}
                            </Typography>
                            <UserLink username={playerUsernames.white} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
                                White
                            </Typography>
                        </Box>
                        
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                color: 'rgba(255,255,255,0.3)',
                                mx: 2,
                                fontWeight: 300,
                            }}
                        >
                            vs
                        </Typography>
                        
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>
                                {game.result === 'black' ? 'WINNER' : game.result === 'white' ? 'LOSER' : 'PLAYER'}
                            </Typography>
                            <UserLink username={playerUsernames.black} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
                                Black
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2 }} />

                    {/* Action Buttons */}
                    <Stack direction="row" spacing={2} justifyContent="center">
                        {myColor && <RematchButtons />}
                        <Button
                            variant="outlined"
                            startIcon={<HomeIcon />}
                            onClick={actions.resetGame}
                            sx={{ 
                                borderColor: 'rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.8)',
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.4)',
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                }
                            }}
                        >
                            Home
                        </Button>
                    </Stack>
                </Box>
            </Paper>
        </Fade>
    );
};

export default GameOverDetails; 