import { Box, CircularProgress, Typography, Paper } from "@mui/material";
import { useState, useEffect } from "react";

interface GameLoadingProps {
    gameId: string;
    playerColor?: "white" | "black";
    message?: string;
}

const loadingMessages = [
    "Setting up the board...",
    "Arranging the pieces...",
    "Preparing your strategy...",
    "Getting ready for an epic match...",
    "Your opponent is waiting...",
    "The clock is about to start...",
];

export default function GameLoading({ gameId, playerColor, message }: GameLoadingProps) {
    const [loadingMessage, setLoadingMessage] = useState(message || loadingMessages[0]);
    const [progressValue, setProgressValue] = useState(0);

    // Cycle through loading messages
    useEffect(() => {
        if (!message) {
            const messageInterval = setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % loadingMessages.length;
                    return loadingMessages[nextIndex];
                });
            }, 2000);

            return () => clearInterval(messageInterval);
        }
    }, [message]);

    // Animate the progress
    useEffect(() => {
        const progressInterval = setInterval(() => {
            setProgressValue(prev => {
                const newValue = prev + 5;
                return newValue > 100 ? 0 : newValue;
            });
        }, 200);

        return () => clearInterval(progressInterval);
    }, []);

    return (
        <Paper
            elevation={3}
            sx={{
                padding: 4,
                maxWidth: 400,
                margin: "0 auto",
                textAlign: "center",
                borderRadius: 2,
                backgroundColor: (theme) => theme.palette.background.paper,
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Typography variant="h5" gutterBottom>
                    Game Loading
                </Typography>

                <CircularProgress
                    variant="determinate"
                    value={progressValue}
                    size={60}
                    thickness={4}
                    sx={{ color: playerColor === "black" ? "text.primary" : "primary.main" }}
                />

                <Typography variant="body1" color="text.secondary">
                    {loadingMessage}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                    Game ID: {gameId}
                </Typography>

                {playerColor && (
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 'bold',
                            color: playerColor === "white" ? "primary.main" : "text.primary"
                        }}
                    >
                        Playing as {playerColor}
                    </Typography>
                )}
            </Box>
        </Paper>
    );
} 