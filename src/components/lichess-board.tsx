'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ComponentProps } from "react";
import { Chess } from 'chess.ts';
import { useChessSounds } from '../hooks/useChessSounds';

const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

interface LichessBoardProps {
    orientation?: 'white' | 'black';
    onMove?: (from: string, to: string) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const LichessBoard = ({
    orientation = 'white',
    onMove,
}: LichessBoardProps) => {
    const { playMoveSound } = useChessSounds();
    const [chess, setChess] = useState(new Chess(INITIAL_FEN));
    const [currentFen, setCurrentFen] = useState(INITIAL_FEN);

    const legalMoves = useMemo(() => {
        return Array.from(chess.moves({ verbose: true }))
            .reduce((map, move) => {
                const from = move.from;
                const to = move.to;
                const dests = map.get(from) || [];
                map.set(from, [...dests, to]);
                return map;
            }, new Map())
    }
        , [chess]);

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
                try {
                    const move = chess.move({ from, to });

                    if (move) {
                        playMoveSound(move, chess);
                        if (onMove) {
                            onMove(from, to);
                        }

                        // Update the FEN after the move
                        const newFen = chess.fen();
                        setCurrentFen(newFen);
                        setChess(new Chess(newFen))
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (error) {
                    // Invalid move, revert the board
                    chess.undo();
                }
            },
        },
    } satisfies ComponentProps<typeof Chessground>['config']), [orientation, onMove, chess, playMoveSound, legalMoves, currentFen]);

    return (
        <Chessground contained config={config} />
    );
};

export default LichessBoard;