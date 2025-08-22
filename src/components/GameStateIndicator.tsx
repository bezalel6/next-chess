import { Box, Chip, Fade } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useMemo } from "react";
import CircleIcon from '@mui/icons-material/Circle';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HandshakeIcon from '@mui/icons-material/Handshake';

type ChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

const GameStateIndicator = () => {
    const game = useUnifiedGameStore(s => s.game);
    const phase = useUnifiedGameStore(s => s.phase);
    const myColor = useUnifiedGameStore(s => s.myColor);
    const playerUsernames = useUnifiedGameStore(s => s.playerUsernames);
    const currentTurn = useUnifiedGameStore(s => s.currentTurn);
    const canBan = useUnifiedGameStore(s => s.canBan());
    const chess = useUnifiedGameStore(s => s.chess);
    
    const stateInfo = useMemo(() => {
        if (!game) return null;
        
        // Game over states
        if (game.status === 'finished') {
            let icon = <EmojiEventsIcon sx={{ fontSize: 14 }} />;
            let text = '';
            let color: ChipColor = 'default';
            
            if (game.result === 'draw') {
                icon = <HandshakeIcon sx={{ fontSize: 14 }} />;
                text = 'Draw';
                color = 'default';
            } else {
                const winner = game.result === 'white' ? playerUsernames.white : playerUsernames.black;
                const isWinner = myColor && game.result === myColor;
                text = `${winner} won`;
                color = isWinner ? 'success' : 'default';
            }
            
            return { icon, text, color, pulse: false };
        }
        
        // Active game states
        if (game.status === 'active') {
            // Check state - use chess.ts to check for check
            if (chess && chess.inCheck()) {
                return {
                    icon: <CheckIcon sx={{ fontSize: 14, color: '#ff9800' }} />,
                    text: 'Check!',
                    color: 'warning' as ChipColor,
                    pulse: true
                };
            }
            
            // Ban phase
            if (phase === 'selecting_ban' || phase === 'waiting_for_ban') {
                const isBanning = canBan;
                return {
                    icon: <BlockIcon sx={{ fontSize: 14, color: isBanning ? '#2196f3' : 'inherit' }} />,
                    text: isBanning ? 'Your ban' : `${playerUsernames[currentTurn]} banning`,
                    color: (isBanning ? 'primary' : 'default') as ChipColor,
                    pulse: isBanning
                };
            }
            
            // Move phase
            const isMyTurn = myColor === currentTurn;
            const turnPlayer = playerUsernames[currentTurn];
            
            return {
                icon: <CircleIcon sx={{ 
                    fontSize: 10, 
                    color: currentTurn === 'white' ? '#fff' : '#000',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%'
                }} />,
                text: isMyTurn ? 'Your move' : `${turnPlayer}'s move`,
                color: (isMyTurn ? 'primary' : 'default') as ChipColor,
                pulse: isMyTurn
            };
        }
        
        // Waiting state - game can be abandoned too
        if (game.status === 'abandoned') {
            return {
                icon: <CircleIcon sx={{ fontSize: 10, color: '#666' }} />,
                text: 'Game abandoned',
                color: 'default' as ChipColor,
                pulse: false
            };
        }
        
        return null;
    }, [game, phase, myColor, playerUsernames, currentTurn, canBan, chess]);
    
    if (!stateInfo) return null;
    
    return (
        <Fade in timeout={300}>
            <Box sx={{ 
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                pointerEvents: 'none'
            }}>
                <Chip
                    icon={stateInfo.icon}
                    label={stateInfo.text}
                    size="small"
                    color={stateInfo.color}
                    sx={{
                        backdropFilter: 'blur(12px)',
                        background: 'rgba(18, 18, 18, 0.85)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        letterSpacing: 0.5,
                        px: 1,
                        animation: stateInfo.pulse ? 'pulse 2s infinite' : 'none',
                        '@keyframes pulse': {
                            '0%': {
                                boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.4)',
                            },
                            '70%': {
                                boxShadow: '0 0 0 6px rgba(33, 150, 243, 0)',
                            },
                            '100%': {
                                boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)',
                            },
                        },
                        '& .MuiChip-icon': {
                            marginLeft: '6px',
                            marginRight: '-2px'
                        }
                    }}
                />
            </Box>
        </Fade>
    );
};

export default GameStateIndicator;