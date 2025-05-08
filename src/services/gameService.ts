import { supabase } from '../utils/supabase';
import type { Game, ChessMove } from '@/types/game';
import { Chess } from 'chess.ts';

export class GameService {
    static async createGame(whitePlayerId: string, blackPlayerId: string): Promise<Game> {
        const { data: game, error } = await supabase
            .from('games')
            .insert({
                white_player_id: whitePlayerId,
                black_player_id: blackPlayerId,
                status: 'active',
                current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                turn: 'white'
            })
            .select()
            .single();

        if (error) throw error;

        return this.mapGameFromDB(game);
    }

    static async getGame(gameId: string): Promise<Game | null> {
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return this.mapGameFromDB(game);
    }

    static async makeMove(gameId: string, move: ChessMove): Promise<Game> {
        const game = await this.getGame(gameId);
        if (!game) throw new Error('Game not found');

        const chess = new Chess(game.currentFen);
        const result = chess.move(move);
        if (!result) throw new Error('Invalid move');

        const isGameOver = chess.gameOver();
        const status = isGameOver ? 'finished' : 'active';
        const result_ = isGameOver ? (chess.inCheckmate() ? game.turn : 'draw') : null;

        const { data: updatedGame, error } = await supabase
            .from('games')
            .update({
                current_fen: chess.fen(),
                last_move: move,
                turn: game.turn === 'white' ? 'black' : 'white',
                status,
                result: result_
            })
            .eq('id', gameId)
            .select()
            .single();

        if (error) throw error;

        // Record the move
        await supabase
            .from('moves')
            .insert({
                game_id: gameId,
                move
            });

        return this.mapGameFromDB(updatedGame);
    }

    static async subscribeToGame(gameId: string, callback: (game: Game) => void) {
        return supabase
            .channel(`game:${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`
                },
                (payload) => {
                    callback(this.mapGameFromDB(payload.new));
                }
            )
            .subscribe();
    }

    private static mapGameFromDB(dbGame: any): Game {
        return {
            id: dbGame.id,
            whitePlayer: dbGame.white_player_id,
            blackPlayer: dbGame.black_player_id,
            status: dbGame.status,
            result: dbGame.result,
            currentFen: dbGame.current_fen,
            chess: new Chess(dbGame.current_fen),
            lastMove: dbGame.last_move,
            turn: dbGame.turn,
            startTime: new Date(dbGame.created_at).getTime(),
            lastMoveTime: new Date(dbGame.updated_at).getTime()
        };
    }
} 