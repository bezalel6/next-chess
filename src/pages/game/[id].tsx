import { useEffect } from "react";
import Head from "next/head";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useRouter } from 'next/compat/router';

import { useAuth } from "@/contexts/AuthContext";
import { GameService } from "@/services/gameService";
import GameBoard from "@/components/GameBoard";
import MoveHistory from "@/components/MoveHistory";
import LoadingScreen from "@/components/LoadingScreen";
import NotFoundScreen from "@/components/NotFoundScreen";

export default function GamePage() {
    const { game, loading, playerUsernames } = useGame();
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    // We're removing the game access check to allow spectating
    // The GameContext will automatically set isSpectator based on the user

    return (
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
            <Head>
                <title>
                    {game ? `Chess Game - ${playerUsernames.white} vs ${playerUsernames.black}` : 'Chess Game'}
                </title>
            </Head>
            {loading ? (
                <LoadingScreen />
            ) : game ? (
                <>
                    <GameBoard />
                    <MoveHistory />
                </>
            ) : (
                <NotFoundScreen />
            )}
        </Box>
    );
}
