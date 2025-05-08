import useSound from 'use-sound';
import { Chess } from 'chess.ts';
const CHESS_SOUNDS = {
    move: '/sounds/self-move.wav',
    capture: '/sounds/capture.wav',
    check: '/sounds/check.wav',
    castle: '/sounds/castle.wav',
    promote: '/sounds/promote.wav',
} as const;
export const useChessSounds = () => {
    const [playMove] = useSound(CHESS_SOUNDS.move);
    const [playCapture] = useSound(CHESS_SOUNDS.capture);
    const [playCheck] = useSound(CHESS_SOUNDS.check);
    const [playCastle] = useSound(CHESS_SOUNDS.castle);
    const [playPromote] = useSound(CHESS_SOUNDS.promote);

    const playMoveSound = (move: ReturnType<Chess['move']>, chess: Chess) => {
        if (!move) return;

        // Play appropriate sound based on move type
        if (move.flags.match(/[ce]/)) {
            playCapture();
        } else if (move.flags.includes('k') || move.flags.includes('q')) {
            playCastle();
        } else if (move.flags.includes('p')) {
            playPromote();
        } else {
            playMove();
        }

        // Play check sound if the move results in check
        if (chess.inCheck()) {
            playCheck();
        }
    };

    return {
        playMoveSound
    };
}; 