import { useEffect, useState } from "react";
import Head from "next/head";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useRouter } from 'next/compat/router';

import { useAuth } from "@/contexts/AuthContext";
import GameBoard from "@/components/GameBoard";
import MoveHistory from "@/components/MoveHistory";
import LoadingScreen from "@/components/LoadingScreen";
import NotFoundScreen from "@/components/NotFoundScreen";
import GameLoading from "@/components/GameLoading";
import { GameService } from "@/services/gameService";

export default function GamePage() {
    const { game, loading, myColor } = useGame();
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;
    const [accessChecked, setAccessChecked] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);

    // Verify the user has permission to view this game
    useEffect(() => {
        async function checkGameAccess() {
            // Don't check if we don't have a user or game ID yet
            if (!user || !id || typeof id !== 'string') return;

            // Don't check again if the game is already loaded
            if (game) {
                setAccessChecked(true);
                return;
            }

            try {
                const gameData = await GameService.getGame(id);

                if (!gameData) {
                    console.error('Game not found');
                    setAccessError('Game not found');
                    // Wait a bit before redirecting to show the error
                    setTimeout(() => router.replace('/'), 2000);
                    return;
                }

                // Check if user is a player in this game
                const isPlayerInGame =
                    gameData.whitePlayer === user.id ||
                    gameData.blackPlayer === user.id;

                if (!isPlayerInGame) {
                    console.error('User is not authorized to view this game');
                    setAccessError('You are not authorized to view this game');
                    // Wait a bit before redirecting to show the error
                    setTimeout(() => router.replace('/'), 2000);
                    return;
                }

                setAccessChecked(true);
            } catch (error) {
                console.error('Error checking game access:', error);
                setAccessError('Error loading game');
                // Wait a bit before redirecting to show the error
                setTimeout(() => router.replace('/'), 2000);
            }
        }

        checkGameAccess();
    }, [user, id, game, router]);

    // Title based on game state
    const pageTitle = game
        ? `Chess Game: ${game.whitePlayer.substring(0, 6)} vs ${game.blackPlayer.substring(0, 6)}`
        : 'Chess Game';

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
            </Head>
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                minHeight: { xs: 'auto', md: '100%' },
                height: { xs: 'auto', md: '100%' },
                p: { xs: 2, md: 3 },
                gap: 3,
                justifyContent: 'center',
                position: 'relative',
                pb: { xs: 5, md: 3 }
            }}>
                {loading ? (
                    id && typeof id === 'string' ? (
                        <GameLoading
                            gameId={id}
                            playerColor={myColor || undefined}
                            message={accessError || undefined}
                        />
                    ) : (
                        <LoadingScreen />
                    )
                ) : game ? (
                    <>
                        <GameBoard />
                        <MoveHistory />
                    </>
                ) : (
                    <NotFoundScreen message={accessError || "Game not found"} />
                )}
            </Box>
        </>
    );
}
