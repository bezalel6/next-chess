import Head from "next/head";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import GameHeader from "@/components/GameHeader";
import GameBoard from "@/components/GameBoard";
import MoveHistory from "@/components/MoveHistory";
import LoadingScreen from "@/components/LoadingScreen";
import NotFoundScreen from "@/components/NotFoundScreen";

export default function GamePage() {
    const { game, loading } = useGame();

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