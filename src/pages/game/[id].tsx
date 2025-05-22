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
    const router = useRouter();
    const { id } = router.query;
    const [accessError, setAccessError] = useState<string | null>(null);

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
