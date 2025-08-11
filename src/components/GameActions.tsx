import { Box, Typography, Stack, Button, Tooltip } from "@mui/material";
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from "react";
import { useGame } from "@/contexts/GameContextV2";

// Draw offer buttons component
const DrawButtons = () => {
    const { game, myColor, actions } = useGame();

    if (!game || !myColor) return null;

    const opponentColor = myColor === 'white' ? 'black' : 'white';

    if (game.drawOfferedBy === myColor) {
        return (
            <Typography variant="body2" sx={{ color: 'white', fontStyle: 'italic', alignSelf: 'center' }}>
                Draw offer sent
            </Typography>
        );
    }

    if (game.drawOfferedBy === opponentColor) {
        return (
            <>
                <Tooltip title="Accept Draw Offer" arrow>
                    <Button
                        variant="outlined"
                        color="success"
                        size="small"
                        onClick={actions.acceptDraw}
                        startIcon={<CheckCircleIcon />}
                    >
                        Accept Draw
                    </Button>
                </Tooltip>
                <Tooltip title="Decline Draw Offer" arrow>
                    <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={actions.declineDraw}
                        startIcon={<CancelIcon />}
                    >
                        Decline
                    </Button>
                </Tooltip>
            </>
        );
    }

    return (
        <Tooltip title="Offer Draw" arrow>
            <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={actions.offerDraw}
                startIcon={<HandshakeIcon />}
            >
                Offer Draw
            </Button>
        </Tooltip>
    );
};

// Game actions component
const GameActions = () => {
    const [showResignConfirm, setShowResignConfirm] = useState(false);
    const { game, myColor, actions } = useGame();

    if (!game || game.status !== 'active' || !myColor) return null;

    const handleResignClick = () => {
        if (showResignConfirm) {
            actions.resign();
            setShowResignConfirm(false);
        } else {
            setShowResignConfirm(true);
        }
    };

    const handleCancelResign = () => {
        setShowResignConfirm(false);
    };

    return (
        <Box sx={{
            width: '100%',
            maxWidth: 800,
            mt: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {/* Draw buttons */}
                <DrawButtons />
                {/* Resignation button with confirmation */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={showResignConfirm ? "Click again to confirm" : "Resign Game"} arrow>
                        <Button
                            variant={showResignConfirm ? "contained" : "outlined"}
                            color="error"
                            size="small"
                            onClick={handleResignClick}
                            startIcon={<FlagIcon />}
                            sx={showResignConfirm ? { fontWeight: 'bold' } : {}}
                        >
                            Resign
                        </Button>
                    </Tooltip>

                    {showResignConfirm && (
                        <Tooltip title="Cancel" arrow>
                            <Button
                                sx={{ ml: 0.5 }}
                                variant="text"
                                color="inherit"
                                size="small"
                                onClick={handleCancelResign}
                            >
                                <CancelIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    )}
                </Box>
            </Stack>
        </Box>
    );
};

export { GameActions, DrawButtons }; 