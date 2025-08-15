import useSound from 'use-sound';
import { Chess } from 'chess.ts';
const CHESS_SOUNDS = {
    move: '/sounds/self-move.wav',
    capture: '/sounds/capture.wav',
    check: '/sounds/check.wav',
    castle: '/sounds/castle.wav',
    promote: '/sounds/promote.wav',
    gameStart: '/sounds/game-start.wav',
    gameEnd: '/sounds/game-end.wav',
    ban: '/sounds/ban.wav',
    opponentMove: '/sounds/opponent-move.wav',
    tenSeconds: '/sounds/ten-seconds.wav',
} as const;
export const useChessSounds = () => {
    const [playMove] = useSound(CHESS_SOUNDS.move);
    const [playCapture] = useSound(CHESS_SOUNDS.capture);
    const [playCheck] = useSound(CHESS_SOUNDS.check);
    const [playCastle] = useSound(CHESS_SOUNDS.castle);
    const [playPromote] = useSound(CHESS_SOUNDS.promote);
    const [playGameStart] = useSound(CHESS_SOUNDS.gameStart);
    const [playGameEnd] = useSound(CHESS_SOUNDS.gameEnd);
    const [playBan] = useSound(CHESS_SOUNDS.ban);
    const [playOpponentMove] = useSound(CHESS_SOUNDS.opponentMove);
    const [playTenSeconds] = useSound(CHESS_SOUNDS.tenSeconds);

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
        playMoveSound,
        playGameStart,
        playGameEnd,
        playBan,
        playOpponentMove,
        playTenSeconds,
        playMove,
        playCapture,
        playCheck,
        playCastle,
        playPromote
    };
}; 