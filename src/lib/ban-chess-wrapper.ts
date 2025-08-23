// Wrapper to fix ban-chess.ts import issues
const BanChessModule = require('ban-chess.ts/dist/BanChess.js');

export const BanChess = BanChessModule.BanChess || BanChessModule.default || BanChessModule;