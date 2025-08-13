import { useGame } from "@/contexts/GameContextV2";
import { Box, Typography } from "@mui/material";
import { useRouter } from 'next/compat/router';
import Head from "next/head";
import { useState, useEffect } from "react";

import GameBoardV2 from "@/components/GameBoardV2";
import GameLoading from "@/components/GameLoading";
import LoadingScreen from "@/components/LoadingScreen";
import RightSidebar from "@/components/RightSidebar";
import NotFoundScreen from "@/components/NotFoundScreen";
import BoardMoveInput from "@/components/BoardMoveInput";

// Left sidebar components
const LeftSidebar = () => {
    const { game } = useGame();
    
    // Calculate time ago
    const getTimeAgo = () => {
        if (!game?.startTime) return 'just now';
        const created = new Date(game.startTime);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins === 1) return '1 minute ago';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour ago';
        if (diffHours < 24) return `${diffHours} hours ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return '1 day ago';
        return `${diffDays} days ago`;
    };
    
    // Get time control format (e.g., "10+0" for 10 minutes, no increment)
    const getTimeControl = () => {
        if (!game) return '10+0';
        
        // Check for time control in game object
        const initialTime = game.timeControl?.initialTime || 600000; // Default 10 minutes
        const increment = game.timeControl?.increment || 0;
        
        const minutes = Math.floor(initialTime / 60000);
        return `${minutes}+${increment}`;
    };
    
    // Determine game speed category
    const getGameSpeed = () => {
        const timeControl = getTimeControl();
        const [minutes] = timeControl.split('+').map(Number);
        
        if (minutes < 3) return 'Bullet';
        if (minutes < 8) return 'Blitz';
        if (minutes < 15) return 'Rapid';
        return 'Classical';
    };
    
    return (
        <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            width: 240,
            flexShrink: 0,
        }}>
            {/* Game info */}
            <Box sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: 0.5,
                p: 2,
            }}>
                <Typography sx={{ color: '#bababa', fontSize: '0.85rem', mb: 0.5 }}>
                    {getTimeControl()} • Casual • {getGameSpeed()}
                </Typography>
                <Typography sx={{ color: '#7a7a7a', fontSize: '0.8rem' }}>
                    {getTimeAgo()}
                </Typography>
            </Box>
        </Box>
    );
};

export default function GamePage() {
    const { 
        game, 
        loading, 
        myColor, 
        playerUsernames, 
        isLocalGame,
        localGameOrientation,
        canMove,
        makeMove,
        currentBannedMove
    } = useGame();
    const router = useRouter();
    const { id, as: asParam } = router.query;
    const [accessError, setAccessError] = useState<string | null>(null);
    const [boardFlipped, setBoardFlipped] = useState(false);

    // Handle board orientation based on player color
    useEffect(() => {
        if (myColor) {
            setBoardFlipped(myColor === 'black');
        }
    }, [myColor]);

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
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                bgcolor: '#161512',
                p: 2,
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
                    // Main game container - centered and constrained
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 2,
                        maxWidth: 1400,
                        width: '100%',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}>
                        {/* Left sidebar */}
                        {!isLocalGame && <LeftSidebar />}
                        
                        {/* Center container - Board and controls */}
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                        }}>
                            <GameBoardV2 
                                orientation={boardFlipped 
                                    ? (localGameOrientation === 'white' ? 'black' : 'white')
                                    : localGameOrientation
                                }
                            />
                            <BoardMoveInput />
                        </Box>
                        
                        {/* Right sidebar */}
                        <RightSidebar 
                            boardFlipped={boardFlipped}
                            onFlipBoard={() => setBoardFlipped(!boardFlipped)}
                        />
                    </Box>
                ) : (
                    <NotFoundScreen />
                )}
            </Box>
        </>
    );
}