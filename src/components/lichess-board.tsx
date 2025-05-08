import dynamic from 'next/dynamic';
import { useMemo, type ComponentProps } from "react";

const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

interface LichessBoardProps {
    fen?: string;
    orientation?: 'white' | 'black';
    width?: number;
    height?: number;
    onMove?: (from: string, to: string) => void;
}

const LichessBoard = ({
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation = 'white',
    onMove,
}: LichessBoardProps) => {
    const config = useMemo(() => ({
        fen,
        orientation,
        draggable: {
            enabled: true,
        },
        events: {
            move: (from: string, to: string) => {
                if (onMove) {
                    onMove(from, to);
                }
            },
        },
    } satisfies ComponentProps<typeof Chessground>['config']), [fen, orientation, onMove]);

    return (
        <Chessground contained config={config} />
    );
};
export default LichessBoard