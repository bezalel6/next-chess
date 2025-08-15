import { Box, Typography, Button, Stack, Paper, Fade } from "@mui/material";
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useGame } from "@/contexts/GameProvider";
import { useMemo, useState, useEffect } from "react";
import UserLink from '@/components/user-link';

const GameOverDetails = () => {
    const {
        game,
        myColor,
        playerUsernames,
        actions
    } = useGame();

    // Animate in on mount
    const [show, setShow] = useState(false);
    useEffect(() => {
        if (game?.status === 'finished') setShow(true);
        else setShow(false);
    }, [game?.status]);

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
                    color="secondary"
                    size="small"
                    onClick={actions.offerRematch}
                    sx={{ textTransform: 'none', minWidth: 0 }}
                >
                    Rematch
                </Button>
            );
        }
        if (game.rematchOfferedBy === myColor) {
            return (
                <Typography variant="caption" sx={{ color: 'white', fontStyle: 'italic' }}>
                    Rematch offer sent
                </Typography>
            );
        }
        if (game.rematchOfferedBy === opponentColor) {
            return (
                <Stack direction="row" spacing={1} justifyContent="center">
                    <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={actions.acceptRematch}
                        sx={{ textTransform: 'none', minWidth: 0 }}
                    >
                        Accept
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={actions.declineRematch}
                        sx={{ textTransform: 'none', minWidth: 0 }}
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
            <Fade in={show} timeout={350}>
                <Paper elevation={3}
                    sx={{
                        width: '100%',
                        maxWidth: 340,
                        mx: 'auto',
                        mt: 2,
                        p: 2,
                        borderRadius: 2,
                        textAlign: 'center',
                        background: 'rgba(30, 34, 44, 0.85)',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 16px 0 rgba(0,0,0,0.18)',
                        border: '1px solid rgba(255,255,255,0.10)',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>
                            {score}
                        </Typography>
                        {gameResultInfo.resultDetail && (
                            <Typography variant="subtitle1" sx={{ color: '#ffd700', fontWeight: 400, ml: 1 }}>
                                {gameResultInfo.resultDetail}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ color: 'white', mb: 1, opacity: 0.92, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" component="span">Game between</Typography>
                        <UserLink username={playerUsernames.white} />
                        <Typography variant="body2" component="span">and</Typography>
                        <UserLink username={playerUsernames.black} />
                        <Typography variant="body2" component="span">has ended.</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={actions.resetGame}
                            sx={{ textTransform: 'none', minWidth: 0 }}
                        >
                            Home
                        </Button>
                    </Stack>
                </Paper>
            </Fade>
        );
    }

    // Choose icon
    let icon = <HandshakeIcon sx={{ fontSize: 32, color: '#ffd700', mr: 1 }} />;
    if (gameResultInfo.resultType === 'win') icon = <EmojiEventsIcon sx={{ fontSize: 36, color: '#ffd700', mr: 1 }} />;
    else if (gameResultInfo.resultType === 'lose') icon = <SentimentDissatisfiedIcon sx={{ fontSize: 34, color: '#90caf9', mr: 1 }} />;

    return (
        <Fade in={show} timeout={350}>
            <Paper elevation={3}
                sx={{
                    width: '100%',
                    maxWidth: 340,
                    mx: 'auto',
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    textAlign: 'center',
                    background: 'rgba(30, 34, 44, 0.85)',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 4px 16px 0 rgba(0,0,0,0.18)',
                    border: '1px solid rgba(255,255,255,0.10)',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    {icon}
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>
                        {gameResultInfo.resultHeader}
                    </Typography>
                    {gameResultInfo.resultDetail && (
                        <Typography variant="subtitle1" sx={{ color: '#ffd700', fontWeight: 400, ml: 1 }}>
                            {gameResultInfo.resultDetail}
                        </Typography>
                    )}
                </Box>
                <Typography variant="body2" sx={{ color: 'white', mb: 1, opacity: 0.92 }}>
                    {gameResultInfo.personalMessage}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                    {myColor && <RematchButtons />}
                    <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={actions.resetGame}
                        sx={{ textTransform: 'none', minWidth: 0 }}
                    >
                        Home
                    </Button>
                </Stack>
            </Paper>
        </Fade>
    );
};

export default GameOverDetails; 