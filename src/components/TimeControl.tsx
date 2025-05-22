import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useGame } from '@/contexts/GameContext';
import { formatTime } from '@/utils/timeUtils';
import type { PlayerColor } from '@/types/game';
import { DEFAULT_INITIAL_TIME } from '@/constants/timeControl';

interface TimeControlProps {
    playerColor: PlayerColor;
}

const TimeControl = ({ playerColor }: TimeControlProps) => {
    const { game } = useGame();
    const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_INITIAL_TIME);
    const [lastTick, setLastTick] = useState<number>(Date.now());

    // Initialize time from game data
    useEffect(() => {
        if (!game) return;

        // Use server-provided time values or default
        const serverTime = playerColor === 'white'
            ? game.whiteTimeRemaining
            : game.blackTimeRemaining;

        // If we have a server time, use it, otherwise use default
        if (serverTime !== undefined) {
            setTimeLeft(serverTime);
        } else {
            setTimeLeft(DEFAULT_INITIAL_TIME);
        }
    }, [game, playerColor]);

    // Determine if this player's clock should be running
    const isActivePlayer = () => {
        if (!game || game.status !== 'active') return false;

        // If a player is banning a move, their clock runs
        if (game.banningPlayer) {
            return game.banningPlayer === playerColor;
        }

        // Otherwise, the player whose turn it is has their clock running
        return game.turn === playerColor;
    };

    // Timer logic
    useEffect(() => {
        if (!game || game.status !== 'active') return;

        // Only run timer for active player (considering banning phase)
        if (isActivePlayer()) {
            const timer = setInterval(() => {
                const now = Date.now();
                const elapsed = now - lastTick;
                setLastTick(now);
                setTimeLeft(prev => Math.max(0, prev - elapsed));
            }, 100);

            return () => clearInterval(timer);
        } else {
            setLastTick(Date.now());
        }
    }, [game?.turn, game?.banningPlayer, game?.status, lastTick, playerColor]);

    // Determine text color based on time remaining
    const getTimeColor = () => {
        if (!game || !isActivePlayer()) return 'text.secondary';
        if (timeLeft < 10000) return 'error.main';
        if (timeLeft < 30000) return 'warning.main';
        return 'success.main';
    };

    return (
        <Box
            sx={{
                p: 1,
                m: 1,
                display: 'flex',
                justifyContent: playerColor === 'white' ? 'flex-start' : 'flex-end',
                bgcolor: 'background.paper',
                borderRadius: 1,
                boxShadow: 1,
                width: '100%',
                maxWidth: 800
            }}
        >
            <Typography
                variant="h4"
                sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: getTimeColor()
                }}
            >
                {formatTime(timeLeft)}
            </Typography>
        </Box>
    );
};

export default TimeControl; 