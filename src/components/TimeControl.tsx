import { useEffect, useState, useCallback } from 'react';
import type { ComponentType } from 'react';
import { Typography } from '@mui/material';
import { useGame } from '@/contexts/GameContextV2';
import { formatTime } from '@/utils/timeUtils';
import type { PlayerColor, Game } from '@/types/game';

interface TimeControlProps {
    playerColor: PlayerColor;
}

// HOC that ensures components only render when a game is defined and in progress
const withGame = <P extends object>(Component: ComponentType<P>) => {
    const WithGameComponent = (props: P) => {
        const { game } = useGame();

        // Only render when game exists and is in active status
        if (!game || game.status !== 'active') {
            // Show default time for inactive games
            return (
                <Typography
                    sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '1.8rem',
                        color: '#bababa',
                        textAlign: 'center',
                        width: '100%',
                    }}
                >
                    10:00
                </Typography>
            );
        }

        return <Component {...props} />;
    };

    WithGameComponent.displayName = `WithGame(${Component.displayName || Component.name || 'Component'})`;
    return WithGameComponent;
};

// Custom hook to manage timer state and logic
// Since we're using withGame HOC, we can assume game is defined and active
const usePlayerTimer = (playerColor: PlayerColor) => {
    const { game } = useGame() as { game: Game & any }; // Assert game is defined with DB fields
    const [timeLeft, setTimeLeft] = useState<number>(600000); // Default 10 minutes
    const [lastTick, setLastTick] = useState<number>(Date.now());

    // Initialize time from game data
    useEffect(() => {
        // Use server-provided time values from database
        // Check both camelCase and snake_case field names
        const serverTime = playerColor === 'white'
            ? (game.whiteTimeRemaining ?? game.white_time_remaining)
            : (game.blackTimeRemaining ?? game.black_time_remaining);

        // If we have a server time, use it, otherwise use default (10 minutes)
        if (serverTime !== undefined && serverTime !== null) {
            setTimeLeft(serverTime);
        } else if (game.timeControl?.initialTime) {
            setTimeLeft(game.timeControl.initialTime);
        } else {
            setTimeLeft(600000); // Default 10 minutes
        }
    }, [game, playerColor]);

    // Determine if this player's clock should be running
    const isActivePlayer = useCallback(() => {
        // If a player is banning a move, their clock runs
        if (game.banningPlayer || game.banning_player) {
            const banningPlayer = game.banningPlayer || game.banning_player;
            return banningPlayer === playerColor;
        }

        // Otherwise, the player whose turn it is has their clock running
        return game.turn === playerColor;
    }, [game, playerColor]);

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
    }, [game.turn, game.banningPlayer, game.banning_player, lastTick, playerColor, isActivePlayer]);

    return { timeLeft, isActivePlayer };
};

const TimeControlBase = ({ playerColor }: TimeControlProps) => {
    const { timeLeft, isActivePlayer } = usePlayerTimer(playerColor);
    const isActive = isActivePlayer();

    return (
        <Typography
            sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '1.8rem',
                color: isActive 
                    ? (timeLeft < 30000 ? '#ff6659' : '#6bc46d')
                    : '#bababa',
                textAlign: 'center',
                width: '100%',
            }}
        >
            {formatTime(timeLeft)}
        </Typography>
    );
};

// Set display name for the base component
TimeControlBase.displayName = 'TimeControlBase';

// Apply the HOC to the TimeControl component
const TimeControl = withGame(TimeControlBase);

export default TimeControl;