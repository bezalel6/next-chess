import dynamic from 'next/dynamic';
import { useMemo, type ComponentProps } from "react";
import { Chess } from 'chess.ts';
import { useChessSounds } from '../hooks/useChessSounds';

const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

interface LichessBoardProps {
    fen?: string;
    orientation?: 'white' | 'black';
    onMove?: (from: string, to: string) => void;
}

const LichessBoard = ({
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation = 'white',
    onMove,
}: LichessBoardProps) => {
    const { playMoveSound } = useChessSounds();
    const chess = useMemo(() => new Chess(fen), [fen]);

    const config = useMemo(() => ({
        fen,
        orientation,
        draggable: {
            enabled: true,
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
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (error) {
                    // Invalid move, revert the board
                    chess.undo();
                }
            },
        },
    } satisfies ComponentProps<typeof Chessground>['config']), [fen, orientation, onMove, chess, playMoveSound]);

    return (
        <Chessground contained config={config} />
    );
};

export default LichessBoard;