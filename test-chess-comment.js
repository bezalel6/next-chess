const { Chess } = require('chess.ts');

// Test if setComment works
const chess = new Chess();

// Initial PGN should be empty
console.log('Initial PGN:', chess.pgn());

// Add a comment before any moves
chess.setComment('banning: e2e4');
console.log('After setComment (before moves):', chess.pgn());

// Make a move
chess.move('e4');
console.log('After e4:', chess.pgn());

// Add another comment
chess.setComment('banning: e7e5');
console.log('After second comment:', chess.pgn());

// Make another move
chess.move('d5');
console.log('After d5:', chess.pgn());

// Test with loading existing PGN
console.log('\n--- Test with existing PGN ---');
const chess2 = new Chess();
chess2.loadPgn('1. e4 d5');
console.log('Loaded PGN:', chess2.pgn());

// Add comment to existing game
chess2.setComment('banning: d2d4');
console.log('After adding comment to existing:', chess2.pgn());