import { Chess, type Move } from 'chess.ts';
import { Chessboard } from 'react-chessboard';
import type { Square, Arrow } from 'react-chessboard/dist/chessboard/types';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Container, Paper, Typography, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import CapturedPieces from './captured-pieces';
import MoveHistory from './move-history';
import useSound from 'use-sound';

interface GameState {
    capturedPieces: { white: string[]; black: string[] };
    moveHistory: string[];
    status: string;
    lastMove: { from: Square; to: Square } | null;
}

type LegalMoves = Record<Square, Square[]>;

export default function Board() {
    // Use a ref for the chess game instance to avoid unnecessary re-renders
    const gameRef = useRef(new Chess());

    const [gameState, setGameState] = useState<GameState>({
        capturedPieces: { white: [], black: [] },
        moveHistory: [],
        status: 'White to move',
        lastMove: null
    });

    // Store position as separate state to minimize re-renders
    const [position, setPosition] = useState(gameRef.current.fen());

    const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square } | null>(null);
    const [legalMoves, setLegalMoves] = useState<LegalMoves>({} as LegalMoves);

    // Sound effects
    const [playMove] = useSound('/sounds/self-move.wav', { volume: 0.5 });
    const [playCapture] = useSound('/sounds/capture.wav', { volume: 0.5 });
    const [playCheck] = useSound('/sounds/check.wav', { volume: 0.5 });

    // Calculate legal moves once when component mounts
    useEffect(() => {
        const newLegalMoves: LegalMoves = {} as LegalMoves;
        gameRef.current.moves({ verbose: true }).forEach((move) => {
            const from = move.from as Square;
            const to = move.to as Square;
            newLegalMoves[from] ??= [];
            newLegalMoves[from].push(to);
        });
        setLegalMoves(newLegalMoves);
    }, []);

    const updateGameState = useCallback((move: Move | null) => {
        if (!move) return;

        const game = gameRef.current;

        setGameState(prevState => {
            const capturedPieces = { ...prevState.capturedPieces };
            if (move.captured) {
                const piece = move.captured.toUpperCase();
                if (move.color === 'w') {
                    capturedPieces.white.push(piece);
                } else {
                    capturedPieces.black.push(piece);
                }
                playCapture();
            } else {
                playMove();
            }

            const moveHistory = [...prevState.moveHistory, move.san];

            let status = game.turn() === 'w' ? 'White to move' : 'Black to move';
            if (game.inCheckmate()) {
                status = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins`;
            } else if (game.inCheck()) {
                status = 'Check!';
                playCheck();
            } else if (game.inDraw()) {
                status = 'Draw!';
            }

            return {
                capturedPieces,
                moveHistory,
                status,
                lastMove: { from: move.from as Square, to: move.to as Square }
            };
        });

        // Update position separately
        setPosition(game.fen());

        // Update legal moves for the next turn
        const newLegalMoves: LegalMoves = {} as LegalMoves;
        game.moves({ verbose: true }).forEach((move) => {
            const from = move.from as Square;
            const to = move.to as Square;
            newLegalMoves[from] ??= [];
            newLegalMoves[from].push(to);
        });
        setLegalMoves(newLegalMoves);
    }, [playMove, playCapture, playCheck]);

    const handlePromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
        if (!pendingMove) return;

        try {
            const move = gameRef.current.move({
                from: pendingMove.from,
                to: pendingMove.to,
                promotion: piece
            });

            if (move) {
                updateGameState(move);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Invalid promotion move:', error.message);
            }
        }

        setShowPromotionDialog(false);
        setPendingMove(null);
    }, [pendingMove, updateGameState]);

    const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
        try {
            const move = gameRef.current.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q' // Default promotion to queen
            });

            if (move) {
                // If it's a pawn promotion, show the promotion dialog
                if (move.promotion) {
                    setPendingMove({ from: sourceSquare, to: targetSquare });
                    setShowPromotionDialog(true);
                    return false;
                }

                updateGameState(move);
                return true;
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Invalid move:', error.message);
            }
            return false;
        }
        return false;
    }, [updateGameState]);

    const onSquareClick = useCallback((square: Square) => {
        // If a square is already selected, try to move to the clicked square
        const possibleMoves = legalMoves[square];
        if (possibleMoves?.length === 1) {
            const targetSquare = possibleMoves[0];
            if (targetSquare) {
                onDrop(square, targetSquare);
            }
        }
    }, [legalMoves, onDrop]);

    const resetGame = useCallback(() => {
        gameRef.current = new Chess();
        setPosition(gameRef.current.fen());
        setGameState({
            capturedPieces: { white: [], black: [] },
            moveHistory: [],
            status: 'White to move',
            lastMove: null
        });

        // Reset legal moves
        const newLegalMoves: LegalMoves = {} as LegalMoves;
        gameRef.current.moves({ verbose: true }).forEach((move) => {
            const from = move.from as Square;
            const to = move.to as Square;
            newLegalMoves[from] ??= [];
            newLegalMoves[from].push(to);
        });
        setLegalMoves(newLegalMoves);
    }, []);

    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (event.key === 'r') {
            resetGame();
        } else if (event.key === 'f') {
            setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
        }
    }, [resetGame]);

    // Add keyboard event listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    // Optimize square styles calculation
    const customSquareStyles = useMemo(() => {
        if (!gameState.lastMove) return {};
        return {
            [gameState.lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
            [gameState.lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
        };
    }, [gameState.lastMove]);

    // Empty arrows array - optimized to avoid unnecessary renders
    const customArrows = useMemo<Arrow[]>(() => [], []);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'center' }}>
                <Box sx={{ flex: '0 0 auto' }}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
                            >
                                Flip Board
                            </Button>
                            <Button variant="outlined" onClick={resetGame}>
                                Reset Game
                            </Button>
                        </Box>
                        <Chessboard
                            position={position}
                            onPieceDrop={onDrop}
                            onSquareClick={onSquareClick}
                            boardWidth={600}
                            showBoardNotation={true}
                            animationDuration={200}
                            boardOrientation={boardOrientation}
                            customSquareStyles={customSquareStyles}
                            customArrows={customArrows}
                        />
                        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
                            {gameState.status}
                        </Typography>
                    </Paper>
                </Box>

                <Box sx={{ flex: '0 0 300px' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <MoveHistory moves={gameState.moveHistory} />
                        <CapturedPieces
                            whitePieces={gameState.capturedPieces.white}
                            blackPieces={gameState.capturedPieces.black}
                        />
                    </Box>
                </Box>
            </Box>

            <Dialog open={showPromotionDialog} onClose={() => setShowPromotionDialog(false)}>
                <DialogTitle>Choose Promotion</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                        {['q', 'r', 'b', 'n'].map((piece) => (
                            <Button
                                key={piece}
                                variant="outlined"
                                onClick={() => handlePromotion(piece as 'q' | 'r' | 'b' | 'n')}
                                sx={{ fontSize: '2rem', minWidth: '60px' }}
                            >
                                {piece.toUpperCase()}
                            </Button>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>
        </Container>
    );
}