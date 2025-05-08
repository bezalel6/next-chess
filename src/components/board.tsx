/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Chess, type Move, type PieceSymbol, SQUARES } from 'chess.ts';
import { Chessboard } from 'react-chessboard';
import { useState, useCallback } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import { MoveHistory } from './MoveHistory';
import CapturedPieces from './CapturedPieces';
import type { Square } from 'chess.ts/dist/types';
import type { CustomSquareStyles } from 'react-chessboard/dist/chessboard/types';
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
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);

    const updateGameState = useCallback((newGame: Chess, move: Move | null) => {
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

        let status = newGame.turn() === 'w' ? 'White to move' : 'Black to move';
        if (newGame.inCheckmate()) {
            status = `Checkmate! ${newGame.turn() === 'w' ? 'Black' : 'White'} wins`;
        } else if (newGame.inCheck()) {
            status = 'Check!';
        } else if (newGame.inDraw()) {
            status = 'Draw!';
        }

        setGameState({
            game: newGame,
            capturedPieces,
            moveHistory,
            status
        });
    }, [gameState]);

    function makeAMove(move: { from: Square; to: Square; promotion?: PieceSymbol }) {
        const gameCopy = new Chess(gameState.game.fen());
        try {
            const result = gameCopy.move(move);
            if (result) {
                updateGameState(gameCopy, result);
            }
            return result;
        } catch (error) {
            return null;
        }
    }

    function onDrop(sourceSquare: string, targetSquare: string) {
        const move = makeAMove({
            from: sourceSquare as Square,
            to: targetSquare as Square,
            promotion: 'q' as PieceSymbol,
        });

        if (move === null) return false;
        return true;
    }

    function onSquareClick(square: Square) {
        // If no square is selected, and the clicked square has a piece of the current turn's color
        if (!selectedSquare) {
            const piece = gameState.game.get(square);
            if (piece && piece.color === gameState.game.turn()) {
                const moves = gameState.game.moves({ square, verbose: true });
                const possibleSquares = moves.map(move => move.to as Square);
                setSelectedSquare(square);
                setPossibleMoves(possibleSquares);
            }
            return;
        }

        // If a square is already selected
        if (selectedSquare) {
            // If clicking the same square, deselect it
            if (square === selectedSquare) {
                setSelectedSquare(null);
                setPossibleMoves([]);
                return;
            }

            // Try to make the move
            const move = makeAMove({
                from: selectedSquare,
                to: square,
                promotion: 'q' as PieceSymbol,
            });

            // Clear the selection regardless of whether the move was successful
            setSelectedSquare(null);
            setPossibleMoves([]);
        }
    }

    function onSquareRightClick(square: Square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
    }

    function onPieceDragBegin(piece: string, sourceSquare: Square) {
        const moves = gameState.game.moves({ square: sourceSquare, verbose: true });
        const possibleSquares = moves.map(move => move.to as Square);
        setSelectedSquare(sourceSquare);
        setPossibleMoves(possibleSquares);
    }

    function onPieceDragEnd() {
        setSelectedSquare(null);
        setPossibleMoves([]);
    }

    function customSquareStyles() {
        const styles = {} as CustomSquareStyles;

        if (selectedSquare) {
            styles[selectedSquare] = {
                backgroundColor: 'rgba(255, 255, 0, 0.4)',
                borderRadius: '50%'
            };
        }

        possibleMoves.forEach(square => {
            styles[square] = {
                background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
                borderRadius: '50%'
            };
        });

        return styles;
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box sx={{ flex: 1 }}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <Chessboard
                            position={gameState.game.fen()}
                            onPieceDrop={onDrop}
                            onSquareClick={onSquareClick}
                            onSquareRightClick={onSquareRightClick}
                            onPieceDragBegin={onPieceDragBegin}
                            onPieceDragEnd={onPieceDragEnd}
                            customSquareStyles={customSquareStyles()}
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
