import { useGame } from "@/contexts/GameContextV2";
import { Box, Typography } from "@mui/material";
import { useRouter } from 'next/compat/router';
import Head from "next/head";
import { useState } from "react";

import GameBoardV2 from "@/components/GameBoardV2";
import GameLoading from "@/components/GameLoading";
import LoadingScreen from "@/components/LoadingScreen";
import MoveHistory from "@/components/MoveHistory";
import NotFoundScreen from "@/components/NotFoundScreen";

// Left sidebar components
const LeftSidebar = ({ gameId }: { gameId: string }) => (
    <Box sx={{ 
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        width: 280,
        flexShrink: 0,
        gap: 2,
    }}>
        {/* Game info */}
        <Box sx={{
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 0.5,
            p: 2,
        }}>
            <Typography sx={{ color: '#bababa', fontSize: '0.85rem', mb: 1 }}>1+0 • Rated • Bullet</Typography>
            <Typography sx={{ color: '#7a7a7a', fontSize: '0.8rem' }}>right now</Typography>
        </Box>
        
        {/* Chat room */}
        <Box sx={{
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 0.5,
            p: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
        }}>
            <Typography sx={{ color: '#bababa', fontSize: '0.9rem', mb: 2 }}>Chat room</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ color: '#7a7a7a', fontSize: '0.8rem', textAlign: 'center' }}>
                Please be nice in the chat!
            </Typography>
        </Box>
        
        {/* Notes */}
        <Box sx={{
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 0.5,
            p: 2,
        }}>
            <Typography sx={{ color: '#bababa', fontSize: '0.9rem', mb: 1 }}>Notes</Typography>
            <textarea 
                placeholder="Notes" 
                style={{
                    width: '100%',
                    minHeight: 80,
                    background: 'transparent',
                    border: 'none',
                    color: '#bababa',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                }}
            />
        </Box>
    </Box>
);

export default function GamePage() {
    const { game, loading, myColor, playerUsernames, isLocalGame } = useGame();
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
                height: '100%',
                bgcolor: '#161512',
                p: 2,
                gap: 2,
                justifyContent: 'center',
                alignItems: 'flex-start',
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
                        {/* Left sidebar */}
                        <LeftSidebar gameId={id as string} />
                        
                        {/* Center - Game board and scoreboard */}
                        <Box sx={{ 
                            flex: '0 1 auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                        }}>
                            <GameBoardV2 />
                            
                            {/* Scoreboard below board - only show for non-local games */}
                            {!isLocalGame && (
                                <Box sx={{
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    borderRadius: 0.5,
                                    p: 1.5,
                                    display: 'flex',
                                    justifyContent: 'space-around',
                                    width: 560,
                                    maxWidth: '100%',
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>bezalel6</Typography>
                                            <Typography sx={{ color: '#bababa', fontSize: '1.25rem', fontWeight: 600 }}>0</Typography>
                                        </Box>
                                        <Typography sx={{ color: '#666' }}>-</Typography>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>Shantnu_Rajpoot</Typography>
                                            <Typography sx={{ color: '#bababa', fontSize: '1.25rem', fontWeight: 600 }}>0</Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                        
                        {/* Right sidebar - Move history */}
                        <Box sx={{ 
                            width: { xs: '100%', md: 280 },
                            flexShrink: 0,
                        }}>
                            <MoveHistory />
                        </Box>
                    </>
                ) : (
                    <NotFoundScreen message={accessError || "Game not found"} />
                )}
            </Box>
        </>
    );
}
