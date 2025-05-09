import { useEffect } from "react";
import Head from "next/head";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { GameService } from "@/services/gameService";
import GameHeader from "@/components/GameHeader";
import GameBoard from "@/components/GameBoard";
import MoveHistory from "@/components/MoveHistory";
import LoadingScreen from "@/components/LoadingScreen";
import NotFoundScreen from "@/components/NotFoundScreen";

export default function GamePage() {
    const { game, loading } = useGame();
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    // Verify the user has permission to view this game
    useEffect(() => {
        async function checkGameAccess() {
            // Don't check if we don't have a user or game ID yet
            if (!user || !id || typeof id !== 'string') return;
            
            // Don't check again if the game is already loaded
            if (game) return;
            
            try {
                const gameData = await GameService.getGame(id);
                
                if (!gameData) {
                    console.error('Game not found');
                    router.replace('/');
                    return;
                }
                
                // Check if user is a player in this game
                const isPlayerInGame = 
                    gameData.whitePlayer === user.id || 
                    gameData.blackPlayer === user.id;
                
                if (!isPlayerInGame) {
                    console.error('User is not authorized to view this game');
                    router.replace('/');
                }
            } catch (error) {
                console.error('Error checking game access:', error);
                router.replace('/');
            }
        }
        
        checkGameAccess();
    }, [user, id, game, router]);

    return (
        <>
            <Head>
                <title>Chess 2.0 - Game</title>
                <meta name="description" content="Play chess online" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main style={{ height: '100vh', width: '100%', overflow: 'hidden', backgroundColor: '#121212' }}>
                {/* Header */}
                <GameHeader />
                
                {/* Content area */}
                <Box sx={{ 
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    height: 'calc(100vh - 56px)',
                    p: { xs: 2, md: 3 },
                    gap: 3,
                    justifyContent: 'center',
                    position: 'relative'
                }}>
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
            </main>
        </>
    );
}