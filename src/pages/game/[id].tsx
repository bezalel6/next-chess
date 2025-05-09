import Head from "next/head";
import styles from "../index.module.css";
import LichessBoard from "@/components/lichess-board";
import { useGame } from "@/contexts/GameContext";
import { CircularProgress, Box, Typography, Paper, Divider } from "@mui/material";
import AccessTimeIcon from '@mui/icons-material/AccessTime';

export default function GamePage() {
    const { game, loading, myColor } = useGame();

    return (
        <>
            <Head>
                <title>Chess 2.0 - Game</title>
                <meta name="description" content="Play chess online" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main style={{ padding: 0, height: '100vh', width: '100%', overflow: 'hidden' }}>
                <Box sx={{ 
                    width: '100%', 
                    height: '100vh',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '70% 30%' },
                    gridTemplateRows: 'auto 1fr auto',
                    gridTemplateAreas: {
                        xs: `
                            "header"
                            "board"
                            "info"
                        `,
                        md: `
                            "header header"
                            "board info"
                            "board info"
                        `
                    }
                }}>
                    {/* Header */}
                    <Box sx={{ 
                        gridArea: 'header',
                        p: 1, 
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: 'rgba(0,0,0,0.9)'
                    }}>
                        <Typography className={styles.title} sx={{ fontSize: '1.5rem', m: 0 }}>
                            Chess<span className={styles.pinkSpan}>2.0</span>
                        </Typography>
                        {game && !loading && (
                            <Typography variant="body2" sx={{ color: 'white' }}>
                                Playing as: {myColor || 'Spectator'}
                            </Typography>
                        )}
                    </Box>
                    
                    {/* Main board area */}
                    <Box sx={{ 
                        gridArea: 'board',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        bgcolor: 'rgba(0,0,0,0.8)'
                    }}>
                        {loading ? (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '100%',
                                height: '100%'
                            }}>
                                <CircularProgress />
                                <Typography variant="body1" sx={{ mt: 2, color: 'white' }}>
                                    Loading game...
                                </Typography>
                            </Box>
                        ) : game ? (
                            <Box sx={{ 
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative'
                            }}>
                                {/* Top player info */}
                                <Box sx={{ 
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    bgcolor: 'rgba(0,0,0,0.3)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ 
                                            color: 'white', 
                                            fontWeight: 'bold', 
                                            fontSize: '1.1rem'
                                        }}>
                                            {myColor === 'white' ? 'Opponent' : 'Player 1'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        bgcolor: game.turn === 'black' ? 'rgba(255,165,0,0.2)' : 'transparent',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <AccessTimeIcon sx={{ color: 'white', mr: 1 }} />
                                        <Typography sx={{ color: 'white' }}>
                                            10:00
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                {/* Chessboard */}
                                <Box sx={{ 
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    flex: 1,
                                    p: { xs: 1, sm: 2, md: 3 },
                                    maxHeight: 'calc(100vh - 150px)'
                                }}>
                                    <Box sx={{ 
                                        width: '100%', 
                                        maxWidth: 'min(80vh, 100%)',
                                        aspectRatio: '1/1',
                                        position: 'relative'
                                    }}>
                                        <LichessBoard />
                                    </Box>
                                </Box>
                                
                                {/* Bottom player info */}
                                <Box sx={{ 
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    bgcolor: 'rgba(0,0,0,0.3)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ 
                                            color: 'white', 
                                            fontWeight: 'bold', 
                                            fontSize: '1.1rem'
                                        }}>
                                            {myColor === 'black' ? 'Opponent' : 'Player 2'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        bgcolor: game.turn === 'white' ? 'rgba(255,165,0,0.2)' : 'transparent',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <AccessTimeIcon sx={{ color: 'white', mr: 1 }} />
                                        <Typography sx={{ color: 'white' }}>
                                            10:00
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ color: 'white' }}>
                                    Game not found or has been completed.
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    
                    {/* Right sidebar */}
                    <Box sx={{ 
                        gridArea: 'info',
                        display: { xs: 'block', md: 'flex' },
                        flexDirection: 'column',
                        borderLeft: { xs: 'none', md: '1px solid rgba(255,255,255,0.1)' },
                        bgcolor: 'rgba(0,0,0,0.85)',
                        height: '100%',
                        overflow: 'auto'
                    }}>
                        {game && !loading && (
                            <>
                                {/* Tabs for different sections */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    bgcolor: 'rgba(0,0,0,0.3)'
                                }}>
                                    <Box sx={{ 
                                        py: 1.5, 
                                        px: 2, 
                                        borderBottom: '2px solid #fff',
                                        color: 'white'
                                    }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            Moves
                                        </Typography>
                                    </Box>
                                    <Box sx={{ 
                                        py: 1.5, 
                                        px: 2,
                                        color: 'rgba(255,255,255,0.6)'
                                    }}>
                                        <Typography variant="body2">
                                            Chat
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                {/* Game move list */}
                                <Box sx={{ p: 2, flex: 1 }}>
                                    <Paper sx={{ 
                                        p: 2, 
                                        mb: 2, 
                                        bgcolor: 'rgba(255,255,255,0.05)', 
                                        color: 'white' 
                                    }}>
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            <strong>Game information</strong>
                                        </Typography>
                                        <Divider sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            <strong>Playing as:</strong> {myColor || 'Spectator'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            <strong>Game ID:</strong> {game.id}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Status:</strong> {game.status}
                                        </Typography>
                                    </Paper>
                                    
                                    {/* Move list */}
                                    <Paper sx={{ 
                                        p: 2, 
                                        bgcolor: 'rgba(255,255,255,0.05)', 
                                        color: 'white',
                                        minHeight: '200px'
                                    }}>
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            <strong>Moves</strong>
                                        </Typography>
                                        <Divider sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                            {/* This would be populated with actual moves */}
                                            <Typography variant="body2" sx={{ 
                                                color: 'rgba(255,255,255,0.8)',
                                                width: '50%',
                                                py: 0.5
                                            }}>
                                                1. e4
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                                color: 'rgba(255,255,255,0.8)',
                                                width: '50%',
                                                py: 0.5
                                            }}>
                                                1... e5
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                            </>
                        )}
                    </Box>
                </Box>
            </main>
        </>
    );
}