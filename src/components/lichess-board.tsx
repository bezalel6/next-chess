import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useChessSounds } from '../hooks/useChessSounds';
import { Box, Paper, Button, Typography } from '@mui/material';
import { clr, PROMOTION_PIECES, type LongColor, type PromoteablePieces, type ShortColor } from '@/types/game';
import { useGame } from '@/contexts/GameContext';
import { Chess } from 'chess.ts';
import type { Square } from 'chess.ts/dist/types';
const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

interface LichessBoardProps {
    orientation?: 'white' | 'black';
}

interface PromotionState {
    from: string;
    to: string;
    color: 'white' | 'black';
}

const LichessBoard = ({ }: LichessBoardProps) => {
    const { game, makeMove, banMove, isMyTurn, myColor, pgn } = useGame();
    const { playMoveSound } = useChessSounds();
    const [overlay, setOverlay] = useState<React.ReactNode | null>(null)
    const legalMoves = useMemo(() => {
        if (!game?.chess || (!isMyTurn && !game.banningPlayer)) return new Map();
        return Array.from(game.chess.moves({ verbose: true }))
            .reduce((map, move) => {
                const from = move.from;
                const to = move.to;
                const dests = map.get(from) || [];
                map.set(from, [...dests, to]);
                return map;
            }, new Map())
    }, [game?.chess, game?.banningPlayer, isMyTurn]);

    useEffect(() => {
        if (game?.banningPlayer && myColor === game.banningPlayer) {
            setOverlay(<Typography variant="h6">Select a move to ban</Typography>);
        } else if (game?.banningPlayer) {
            setOverlay(<Typography variant="h6">Please wait for {game.banningPlayer} to ban a move</Typography>);
        } else {
            setOverlay(null);
        }
    }, [game?.banningPlayer, myColor]);

    const handlePromotion = useCallback((piece: PromoteablePieces, promotionState: PromotionState) => {
        if (!promotionState) return;

        makeMove(promotionState.from, promotionState.to, piece);
        setOverlay(null);
    }, [makeMove])

    const [fen, lastMove, check] = useMemo(() => {
        const chess = new Chess()
        chess.loadPgn(pgn);
        const history = chess.history({ verbose: true })
        return [chess.fen(), history[history.length - 1], chess.inCheck() ? clr(chess.turn()) : false]
    }, [pgn])

    const config = useMemo(() => ({
        fen,
        orientation: myColor ?? 'white',
        draggable: {
            enabled: true
        },
        highlight: {
            check: true,
            lastMove: true
        },
        check,
        lastMove: lastMove ? [lastMove.from as Square, lastMove.to as Square] : undefined,
        movable: {
            free: false,
            color: 'both',
            showDests: true,
            dests: legalMoves,
        },
        events: {
            move: (from: string, to: string) => {
                if (!game?.chess) return;

                // If it's my turn to ban a move
                if (game.banningPlayer === myColor) {
                    banMove(from, to);
                    return;
                }

                // Regular move
                if (!isMyTurn) return;

                try {
                    const move = game.chess.move({ from, to, promotion: 'q' });
                    if (move) {
                        if (move.promotion) {
                            const promotionState = {
                                from,
                                to,
                                color: clr<LongColor>(move.color)
                            }
                            setOverlay(<PromotionDialog handlePromotion={handlePromotion} promotionState={promotionState} />)
                            game.chess.undo();
                            return;
                        }
                        playMoveSound(move, game.chess);
                        makeMove(from, to);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (error) {
                    game.chess.undo();
                }
            },
        },
    } satisfies ComponentProps<typeof Chessground>['config']), [game?.currentFen, game.lastMove, game.chess, myColor, legalMoves, isMyTurn, game?.banningPlayer, playMoveSound, makeMove, banMove, handlePromotion]);

    return (
        <>
            <Chessground contained config={config} />
            {overlay && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                    }}
                >
                    <Paper
                        elevation={3}
                        sx={{
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            alignItems: 'center',
                        }}
                    >
                        {overlay}
                    </Paper>
                </Box>
            )}
        </>
    );
};

function PromotionDialog({ promotionState, handlePromotion }: { promotionState: PromotionState, handlePromotion: (p: PromoteablePieces, promotionState: PromotionState) => void }) {
    return <> <Typography variant="h6" sx={{ color: 'primary.main', mb: 1 }}>
        Choose a piece to promote to
    </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
            {(Object.entries(PROMOTION_PIECES) as [PromoteablePieces, string][]).map(([piece, symbol]) => (
                <Button
                    key={piece}
                    onClick={() => handlePromotion(piece, promotionState)}
                    variant="contained"
                    sx={{
                        minWidth: '48px',
                        height: '48px',
                        fontSize: '48px',
                        color: promotionState.color === 'white' ? 'white' : 'black',
                        bgcolor: promotionState.color === 'white' ? 'primary.main' : 'grey.300',
                        '&:hover': {
                            bgcolor: promotionState.color === 'white' ? 'primary.dark' : 'grey.400',
                        },
                    }}
                >
                    {symbol}
                </Button>
            ))}
        </Box></>
}
export default LichessBoard;