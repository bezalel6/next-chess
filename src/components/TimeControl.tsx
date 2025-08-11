import { useEffect, useState, useCallback } from 'react';
import type { ComponentType } from 'react';
import { Box, Typography } from '@mui/material';
import { useGame } from '@/contexts/GameContextV2';
import { formatTime } from '@/utils/timeUtils';
import type { PlayerColor, Game } from '@/types/game';
// import { DEFAULT_INITIAL_TIME } from '@/constants/timeControl';

interface TimeControlProps {
    playerColor: PlayerColor;
}

// HOC that ensures components only render when a game is defined and in progress
const withGame = <P extends object>(Component: ComponentType<P>) => {
    const WithGameComponent = (props: P) => {
        const { game } = useGame();

        // Only render when game exists and is in active status
        if (!game || game.status !== 'active') {
            return null;
        }

        return <Component {...props} />;
    };

    WithGameComponent.displayName = `WithGame(${Component.displayName || Component.name || 'Component'})`;
    return WithGameComponent;
};

// Custom hook to manage timer state and logic
// Since we're using withGame HOC, we can assume game is defined and active
const usePlayerTimer = (playerColor: PlayerColor) => {
    const { game } = useGame() as { game: Game }; // Assert game is defined
    const [timeLeft, setTimeLeft] = useState<number>(game.timeControl!.initialTime);
    const [lastTick, setLastTick] = useState<number>(Date.now());

    // Initialize time from game data
    useEffect(() => {
        // Use server-provided time values or default
        const serverTime = playerColor === 'white'
            ? game.whiteTimeRemaining
            : game.blackTimeRemaining;

        // If we have a server time, use it, otherwise use default
        if (serverTime !== undefined) {
            setTimeLeft(serverTime);
        } else {
            setTimeLeft(game.timeControl!.initialTime);
        }
    }, [game, playerColor]);

    // Determine if this player's clock should be running
    const isActivePlayer = useCallback(() => {
        // If a player is banning a move, their clock runs
        if (game.banningPlayer) {
            return game.banningPlayer === playerColor;
        }

        // Otherwise, the player whose turn it is has their clock running
        return game.turn === playerColor;
    }, [game.banningPlayer, game.turn, playerColor]);

    // Timer logic
    useEffect(() => {
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
    }, [game.turn, game.banningPlayer, lastTick, playerColor, isActivePlayer]);

    // Determine text color based on time remaining
    const getTimeColor = useCallback(() => {
        if (!isActivePlayer()) return 'text.secondary';
        if (timeLeft < 10000) return 'error.main';
        if (timeLeft < 30000) return 'warning.main';
        return 'success.main';
    }, [isActivePlayer, timeLeft]);

    return { timeLeft, getTimeColor };
};

const TimeControlBase = ({ playerColor }: TimeControlProps) => {
    const { timeLeft, getTimeColor } = usePlayerTimer(playerColor);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                p: 0.75,
                bgcolor: 'rgba(0,0,0,0.2)',
                width: '100%',
            }}
        >
            <Typography
                sx={{
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    fontSize: '1.1rem',
                    color: timeLeft < 30000 ? '#ff6659' : '#bababa',
                }}
            >
                {formatTime(timeLeft)}
            </Typography>
        </Box>
    );
};

// Set display name for the base component
TimeControlBase.displayName = 'TimeControlBase';

// Apply the HOC to the TimeControl component
const TimeControl = withGame(TimeControlBase);

export default TimeControl; 