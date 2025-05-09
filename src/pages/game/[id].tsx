import Head from "next/head";
import styles from "../index.module.css";
import LichessBoard from "@/components/lichess-board";
import { useGame } from "@/contexts/GameContext";
import { CircularProgress, Box, Typography, Button } from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import type { ChessMove } from "@/types/game";
import { Chess } from "chess.ts";

interface MoveRecord {
    id: string;
    game_id: string;
    move: ChessMove;
    created_at: string;
}

interface FormattedMove {
    number: number;
    white: string;
    black: string;
}

export default function GamePage() {
    const { game, loading, myColor, resetGame } = useGame();
    const [moveHistory, setMoveHistory] = useState<FormattedMove[]>([]);
    
    // Fetch initial move history when game loads
    useEffect(() => {
        if (!game) return;
        
        const fetchMoveHistory = async () => {
            try {
                const { data, error } = await supabase
                    .from('moves')
                    .select('*')
                    .eq('game_id', game.id)
                    .order('created_at', { ascending: true });
                
                if (error) {
                    console.error('Error fetching move history:', error);
                    return;
                }
                
                if (data) {
                    // Convert raw moves to formatted moves
                    formatMoveHistory(data);
                }
            } catch (error) {
                console.error('Error in fetchMoveHistory:', error);
            }
        };
        
        fetchMoveHistory();
    }, [game]);
    
    // Subscribe to move updates
    useEffect(() => {
        if (!game) return;
        
        const movesSubscription = supabase
            .channel(`moves:${game.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'moves',
                    filter: `game_id=eq.${game.id}`
                },
                async (payload) => {
                    console.log('New move received:', payload);
                    
                    // Fetch all moves to ensure consistency
                    const { data, error } = await supabase
                        .from('moves')
                        .select('*')
                        .eq('game_id', game.id)
                        .order('created_at', { ascending: true });
                    
                    if (error) {
                        console.error('Error fetching updated moves:', error);
                        return;
                    }
                    
                    if (data) {
                        formatMoveHistory(data);
                    }
                }
            )
            .subscribe();
            
        console.log(`Subscribed to moves for game ${game.id}`);
        
        return () => {
            console.log(`Unsubscribing from moves for game ${game.id}`);
            movesSubscription.unsubscribe();
        };
    }, [game?.id]);
    
    // Helper function to format moves into white/black pairs
    const formatMoveHistory = (moves: MoveRecord[]) => {
        if (!game || !moves.length) {
            setMoveHistory([]);
            return;
        }
        
        // We need to replay the game to get the SAN notation for each move
        const chess = new Chess();
        
        // Group moves by number (white and black)
        const formattedMoves: FormattedMove[] = [];
        
        let moveNumber = 1;
        let currentPair: { white: string, black: string } = { white: "", black: "" };
        
        moves.forEach((moveRecord, index) => {
            // Make the move on our chess instance to get SAN notation
            const result = chess.move(moveRecord.move);
            const sanNotation = result?.san || "";
            
            if (index % 2 === 0) {
                // White's move
                currentPair = { white: sanNotation, black: "" };
                
                // If this is the last move and it's white's, add it now
                if (index === moves.length - 1) {
                    formattedMoves.push({
                        number: moveNumber,
                        white: currentPair.white,
                        black: currentPair.black
                    });
                }
            } else {
                // Black's move - complete the pair and add to formatted moves
                currentPair.black = sanNotation;
                formattedMoves.push({
                    number: moveNumber,
                    white: currentPair.white,
                    black: currentPair.black
                });
                moveNumber++;
            }
        });
        
        setMoveHistory(formattedMoves);
    };

    // Generate the game result message based on result and player's color
    const gameResultInfo = useMemo(() => {
        if (!game || game.status !== 'finished') return null;
        
        let resultHeader = '';
        let resultDetail = '';
        let personalMessage = '';
        
        // Determine the result header (objective statement)
        if (game.result === 'white') {
            resultHeader = 'White won';
            resultDetail = game.chess.inCheckmate() ? 'by checkmate' : 'by resignation';
        } else if (game.result === 'black') {
            resultHeader = 'Black won';
            resultDetail = game.chess.inCheckmate() ? 'by checkmate' : 'by resignation';
        } else {
            resultHeader = 'Game drawn';
            if (game.chess.inStalemate()) {
                resultDetail = 'by stalemate';
            } else if (game.chess.insufficientMaterial()) {
                resultDetail = 'by insufficient material';
            } else if (game.chess.inThreefoldRepetition()) {
                resultDetail = 'by threefold repetition';
            } else if (game.chess.inDraw()) {
                resultDetail = 'by 50-move rule';
            } else {
                resultDetail = 'by agreement';
            }
        }
        
        // Determine the personal message based on player's color and result
        if (myColor) {
            const isWinner = (myColor === 'white' && game.result === 'white') || 
                            (myColor === 'black' && game.result === 'black');
            
            if (isWinner) {
                personalMessage = 'Congratulations! You won the game.';
            } else if (game.result === 'draw') {
                personalMessage = 'The game ended in a draw.';
            } else {
                personalMessage = 'Better luck next time!';
            }
        } else {
            // Message for spectators
            personalMessage = 'Game has ended.';
        }
        
        return { resultHeader, resultDetail, personalMessage };
    }, [game, myColor]);

    return (
        <>
            <Head>
                <title>Chess 2.0 - Game</title>
                <meta name="description" content="Play chess online" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main style={{ height: '100vh', width: '100%', overflow: 'hidden', backgroundColor: '#121212' }}>
                {/* Simple header */}
                <Box sx={{ 
                    p: 1.5, 
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <Typography className={styles.title} sx={{ fontSize: '1.5rem', m: 0 }}>
                        Chess<span className={styles.pinkSpan}>2.0</span>
                    </Typography>
                    {game && !loading && (
                        <Typography variant="body2" sx={{ color: 'white' }}>
                            {myColor || 'Spectator'}
                        </Typography>
                    )}
                </Box>
                
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
                        <>
                            {/* Board container */}
                            <Box sx={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1
                            }}>
                                {/* Opponent info */}
                                <Box sx={{ 
                                    width: '100%',
                                    maxWidth: 800,
                                    mb: 2,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <Typography sx={{ color: 'white' }}>
                                        {myColor === 'white' ? 'Opponent' : 'Player 1'}
                                    </Typography>
                                </Box>
                                
                                {/* Chess board */}
                                <Box sx={{ 
                                    width: '80%',
                                    maxWidth: 600,
                                    aspectRatio: '1/1',
                                    position: 'relative'
                                }}>
                                    <LichessBoard />
                                    
                                    {/* Game over overlay */}
                                    {game.status === 'finished' && gameResultInfo && (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            borderRadius: 2,
                                            padding: 3,
                                            textAlign: 'center',
                                            backdropFilter: 'blur(4px)',
                                            zIndex:100,
                                        }}>
                                            <Typography variant="h4" sx={{ 
                                                color: 'white', 
                                                fontWeight: 'bold',
                                                mb: 1 
                                            }}>
                                                Game Over
                                            </Typography>
                                            
                                            <Typography variant="h6" sx={{ 
                                                color: 'white',
                                                mb: 1
                                            }}>
                                                {gameResultInfo.resultHeader} {gameResultInfo.resultDetail}
                                            </Typography>
                                            
                                            <Typography variant="body1" sx={{ 
                                                color: 'white',
                                                mb: 3,
                                                opacity: 0.9
                                            }}>
                                                {gameResultInfo.personalMessage}
                                            </Typography>
                                            
                                            <Button 
                                                variant="contained" 
                                                color="primary"
                                                onClick={resetGame}
                                                sx={{ 
                                                    mt: 2,
                                                    textTransform: 'none'
                                                }}
                                            >
                                                Return Home
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                                
                                {/* Player info */}
                                <Box sx={{ 
                                    width: '100%',
                                    maxWidth: 800,
                                    mt: 2,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <Typography sx={{ color: 'white' }}>
                                        {myColor === 'black' ? 'Opponent' : 'Player 2'}
                                    </Typography>
                                </Box>
                                
                                {/* Game Status */}
                                <Box sx={{
                                    width: '100%',
                                    maxWidth: 800,
                                    mt: 3,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    p: 1,
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 1
                                }}>
                                    <Typography sx={{ color: 'white' }}>
                                        Status: {game.status} • Turn: {game.turn} 
                                    </Typography>
                                </Box>
                            </Box>
                            
                            {/* Compact move list - using standard chess notation */}
                            <Box sx={{ 
                                width: { xs: '100%', md: '200px' },
                                height: { xs: 'auto', md: 'min(500px, 60vh)' },
                                bgcolor: 'rgba(10,10,10,0.8)',
                                borderRadius: 1,
                                alignSelf: 'center',
                                overflow: 'auto',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                {/* Header */}
                                <Box sx={{
                                    p: 1,
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 1
                                }}>
                                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                                        Moves
                                    </Typography>
                                </Box>
                                
                                {/* Move table */}
                                <Box sx={{ width: '100%', display: 'table', borderCollapse: 'collapse' }}>
                                    {/* Table header */}
                                    <Box sx={{ display: 'table-row', bgcolor: 'rgba(0,0,0,0.2)' }}>
                                        <Box sx={{ display: 'table-cell', p: 1, width: '20%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
                                            #
                                        </Box>
                                        <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
                                            White
                                        </Box>
                                        <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
                                            Black
                                        </Box>
                                    </Box>
                                    
                                    {/* Game moves */}
                                    {moveHistory.map((move) => (
                                        <Box 
                                            key={move.number} 
                                            sx={{ 
                                                display: 'table-row',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                            }}
                                        >
                                            <Box sx={{ 
                                                display: 'table-cell', 
                                                p: 1, 
                                                color: 'rgba(255,255,255,0.5)', 
                                                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                fontSize: '0.75rem',
                                                textAlign: 'center'
                                            }}>
                                                {move.number}
                                            </Box>
                                            <Box sx={{ 
                                                display: 'table-cell', 
                                                p: 1, 
                                                color: 'white', 
                                                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                fontSize: '0.8rem',
                                                textAlign: 'center'
                                            }}>
                                                {move.white}
                                            </Box>
                                            <Box sx={{ 
                                                display: 'table-cell', 
                                                p: 1, 
                                                color: 'white', 
                                                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                fontSize: '0.8rem',
                                                textAlign: 'center'
                                            }}>
                                                {move.black}
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <Typography variant="body1" sx={{ color: 'white' }}>
                                Game not found or has been completed.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </main>
        </>
    );
}