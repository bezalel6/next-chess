/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Chess, type Move } from 'chess.ts';
import { Chessboard } from 'react-chessboard';
import { useState, useCallback } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import { MoveHistory } from './move-history';
import CapturedPieces from './captured-pieces';

interface GameState {
    game: Chess;
    capturedPieces: { white: string[]; black: string[] };
    moveHistory: string[];
    status: string;
}

export default function Board() {
    const [gameState, setGameState] = useState<GameState>({
        game: new Chess(),
        capturedPieces: { white: [], black: [] },
        moveHistory: [],
        status: 'White to move'
    });

    const updateGameState = useCallback((move: Move | null) => {
        if (!move) return;

        const capturedPieces = { ...gameState.capturedPieces };
        if (move.captured) {
            const piece = move.captured.toUpperCase();
            if (move.color === 'w') {
                capturedPieces.white.push(piece);
            } else {
                capturedPieces.black.push(piece);
            }
        }

        const moveHistory = [...gameState.moveHistory];
        moveHistory.push(move.san);

        let status = gameState.game.turn() === 'w' ? 'White to move' : 'Black to move';
        if (gameState.game.inCheckmate()) {
            status = `Checkmate! ${gameState.game.turn() === 'w' ? 'Black' : 'White'} wins`;
        } else if (gameState.game.inCheck()) {
            status = 'Check!';
        } else if (gameState.game.inDraw()) {
            status = 'Draw!';
        }

        setGameState(prevState => ({
            ...prevState,
            capturedPieces,
            moveHistory,
            status
        }));
    }, [gameState]);

    function onDrop(sourceSquare: string, targetSquare: string) {
        try {
            const move = gameState.game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q'
            });
            if (move) {
                updateGameState(move);
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box sx={{ flex: 1 }}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <Chessboard
                            position={gameState.game.fen()}
                            onPieceDrop={onDrop}
                            boardWidth={600}
                            showBoardNotation={true}
                            animationDuration={200}
                        />
                        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
                            {gameState.status}
                        </Typography>
                    </Paper>
                </Box>

                <Box sx={{ width: { xs: '100%', md: 300 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <MoveHistory moves={gameState.moveHistory} />
                        <CapturedPieces
                            whitePieces={gameState.capturedPieces.white}
                            blackPieces={gameState.capturedPieces.black}
                        />
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}
