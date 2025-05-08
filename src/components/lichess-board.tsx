import dynamic from 'next/dynamic';
import { useMemo, useState, type ComponentProps } from "react";
import { Chess } from 'chess.ts';
import { useChessSounds } from '../hooks/useChessSounds';
import { Box, Paper, Button } from '@mui/material';
import { clr } from '@/types/game';
const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

interface LichessBoardProps {
    orientation?: 'white' | 'black';
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface PromotionState {
    from: string;
    to: string;
    color: 'white' | 'black';
}

const PROMOTION_PIECES = {
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞'
} as const;

const LichessBoard = ({
    orientation = 'white',
}: LichessBoardProps) => {
    const { playMoveSound } = useChessSounds();
    const [chess, setChess] = useState(new Chess(INITIAL_FEN));
    const [currentFen, setCurrentFen] = useState(INITIAL_FEN);
    const [promotionState, setPromotionState] = useState<PromotionState | null>(null);

    const legalMoves = useMemo(() => {
        return Array.from(chess.moves({ verbose: true }))
            .reduce((map, move) => {
                const from = move.from;
                const to = move.to;
                const dests = map.get(from) || [];
                map.set(from, [...dests, to]);
                return map;
            }, new Map())
    }, [chess]);

    const handlePromotion = (piece: 'q' | 'r' | 'b' | 'n') => {
        if (!promotionState) return;

        try {
            const move = chess.move({
                from: promotionState.from,
                to: promotionState.to,
                promotion: piece
            });

            if (move) {
                playMoveSound(move, chess);
                const newFen = chess.fen();
                setCurrentFen(newFen);
                setChess(new Chess(newFen));
            }
        } catch (error) {
            chess.undo();
        } finally {
            setPromotionState(null);
        }
    };

    const config = useMemo(() => ({
        fen: currentFen,
        orientation,
        draggable: {
            enabled: true,
        },
        movable: {
            free: false,
            color: 'both',
            showDests: true,
            dests: legalMoves,
        },
        events: {
            move: (from: string, to: string) => {
                // Check if this is a pawn promotion
                try {
                    const move = chess.move({ from, to, promotion: 'q' });
                    if (move) {
                        if (move.promotion) {
                            setPromotionState({
                                ...move,
                                color: clr(move.color)
                            })
                            chess.undo();
                            return
                        }
                        playMoveSound(move, chess);
                        const newFen = chess.fen();
                        setCurrentFen(newFen);
                        setChess(new Chess(newFen));
                    }
                } catch (error) {
                    chess.undo();
                }
            },
        },
    } satisfies ComponentProps<typeof Chessground>['config']), [orientation, chess, playMoveSound, legalMoves, currentFen]);
    return (
        <>
            <Chessground contained config={config} />
            {promotionState && (
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
                            gap: 1,
                        }}
                    >
                        {(Object.entries(PROMOTION_PIECES) as [keyof typeof PROMOTION_PIECES, string][]).map(([piece, symbol]) => (
                            <Button
                                key={piece}
                                onClick={() => handlePromotion(piece)}
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
                    </Paper>
                </Box>
            )}
        </>
    );
};

export default LichessBoard;