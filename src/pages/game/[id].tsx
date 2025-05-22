import { useGame } from "@/contexts/GameContext";
import { Box } from "@mui/material";
import { useRouter } from 'next/compat/router';
import Head from "next/head";
import { useState } from "react";

import GameBoard from "@/components/GameBoard";
import GameLoading from "@/components/GameLoading";
import LoadingScreen from "@/components/LoadingScreen";
import MoveHistory from "@/components/MoveHistory";
import NotFoundScreen from "@/components/NotFoundScreen";

export default function GamePage() {
    const { game, loading, myColor, playerUsernames } = useGame();
    const router = useRouter();
    const { id } = router.query;
    const [accessError, setAccessError] = useState<string | null>(null);

    // Title based on game state
    const pageTitle = game
        ? `${playerUsernames.white} vs ${playerUsernames.black}`
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
