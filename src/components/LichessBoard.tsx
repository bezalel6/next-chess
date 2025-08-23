import { useMemo, useCallback, useRef, useEffect } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useNotification } from "@/contexts/NotificationContext";
import { useChessSounds } from "@/hooks/useChessSounds";
import { GameService } from "@/services/gameService";
import { Chess } from "chess.ts";
import type { Square, PieceSymbol } from "chess.ts/dist/types";
import type { Config } from "chessground/config";
import type { Key } from "chessground/types";
import type { Api } from "chessground/api";
import { Chessground } from "chessground";

interface LichessBoardProps {
  orientation: "white" | "black";
  onBoardApi?: (api: Api) => void;
}

export default function LichessBoard({ 
  orientation, 
  onBoardApi 
}: LichessBoardProps) {
  const { playMoveSound, playBan } = useChessSounds();
  const { notifyError } = useNotification();
  
  // Refs for DOM element and API
  const boardApiRef = useRef<Api | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Minimal selectors - only what's needed for board config
  const game = useUnifiedGameStore((s) => s.game);
  const gameId = useUnifiedGameStore((s) => s.gameId);
  const mode = useUnifiedGameStore((s) => s.mode);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  const phase = useUnifiedGameStore((s) => s.phase);
  const chess = useUnifiedGameStore((s) => s.chess);
  const currentBannedMove = useUnifiedGameStore((s) => s.currentBannedMove);
  const highlightedSquares = useUnifiedGameStore((s) => s.highlightedSquares);
  const selectedSquare = useUnifiedGameStore((s) => s.selectedSquare);
  const possibleMoves = useUnifiedGameStore((s) => s.possibleMoves);
  const optimisticBan = useUnifiedGameStore((s) => s.optimisticBan);
  const optimisticFen = useUnifiedGameStore((s) => s.optimisticFen);
  const pendingOperation = useUnifiedGameStore((s) => s.pendingOperation);
  const navigationFen = useUnifiedGameStore((s) => s.navigationFen);
  const navigationBan = useUnifiedGameStore((s) => s.navigationBan);
  const viewingPly = useUnifiedGameStore((s) => s.viewingPly);

  // Move handler - simplified without nested try/catch
  const makeMove = useCallback(
    async (from: string, to: string, promotion?: PieceSymbol) => {
      const state = useUnifiedGameStore.getState();
      try {
        if (state.mode === "local") {
          // Play sound based on predicted move
          if (state.chess && state.game) {
            const chess = new Chess(state.chess.fen());
            const move = chess.move({
              from: from as Square,
              to: to as Square,
              promotion,
            });
            if (move) playMoveSound(move, chess);
          }
          state.executeMove(from as Square, to as Square, promotion);
          return;
        }
        // Online: optimistic update + server call
        if (state.chess && state.game) {
          const chess = new Chess(state.chess.fen());
          const move = chess.move({
            from: from as Square,
            to: to as Square,
            promotion,
          });
          if (move) playMoveSound(move, chess);
        }
        state.makeMove(from as Square, to as Square, promotion);
        const data = await GameService.makeMove(state.gameId!, {
          from: from as Square,
          to: to as Square,
          promotion: promotion as any,
        });
        useUnifiedGameStore.getState().updateGame(data);
        useUnifiedGameStore.getState().confirmOptimisticUpdate();
      } catch (error: any) {
        useUnifiedGameStore.getState().rollbackOptimisticUpdate();
        notifyError?.(`Move failed: ${error?.message || "unknown error"}`);
      }
    },
    [playMoveSound, notifyError]
  );

  // Ban handler - simplified
  const banMove = useCallback(
    async (from: string, to: string) => {
      const state = useUnifiedGameStore.getState();
      try {
        if (state.mode === "local") {
          playBan();
          state.executeBan(from as Square, to as Square);
          return;
        }
        // Online: optimistic update + server call
        playBan();
        state.banMove(from as Square, to as Square);
        const data = await GameService.banMove(state.gameId!, {
          from: from as Square,
          to: to as Square,
        });
        useUnifiedGameStore.getState().updateGame(data);
        useUnifiedGameStore.getState().confirmOptimisticUpdate();
      } catch (error: any) {
        useUnifiedGameStore.getState().rollbackOptimisticUpdate();
        notifyError?.(`Ban failed: ${error?.message || "unknown error"}`);
      }
    },
    [playBan, notifyError]
  );

  // Computed values
  const canBan = phase === "selecting_ban" && game?.status === "active";
  const canMove = useMemo(() => {
    if (mode === "local") {
      return phase === "making_move" && game?.status === "active";
    }
    const isMyTurn =
      mode !== "spectator" &&
      game?.turn === myColor &&
      game?.status === "active";
    return phase === "making_move" && isMyTurn;
  }, [mode, phase, game?.status, game?.turn, myColor]);

  // Chess instance for current position
  const chessInstance = useMemo(() => {
    if (!game) return null;

    // Determine which FEN to use
    let fenToUse: string;
    if (navigationFen && viewingPly !== null) {
      fenToUse = navigationFen;
    } else if (optimisticFen && pendingOperation === "move") {
      fenToUse = optimisticFen;
    } else {
      fenToUse = game.currentFen;
    }

    return new Chess(fenToUse);
  }, [
    game?.currentFen,
    navigationFen,
    viewingPly,
    optimisticFen,
    pendingOperation,
  ]);

  // Legal moves
  const allLegalMoves = useMemo(() => {
    const activeChess = chessInstance || chess;
    if (!activeChess) return new Map<string, string[]>();

    const moves = new Map<string, string[]>();
    const allMoves = activeChess.moves({ verbose: true });

    allMoves.forEach((move) => {
      // Skip banned moves
      if (
        currentBannedMove &&
        move.from === currentBannedMove.from &&
        move.to === currentBannedMove.to
      ) {
        return;
      }

      const from = move.from;
      const to = move.to;
      const dests = moves.get(from) || [];
      moves.set(from, [...dests, to]);
    });

    return moves;
  }, [chessInstance, chess, currentBannedMove]);

  const legalMoves = useMemo(() => {
    if (selectedSquare && possibleMoves.length > 0) {
      const movesMap = new Map<Key, Key[]>();
      movesMap.set(selectedSquare as Key, possibleMoves as Key[]);
      return movesMap;
    }
    const convertedMoves = new Map<Key, Key[]>();
    allLegalMoves.forEach((dests, orig) => {
      convertedMoves.set(orig as Key, dests as Key[]);
    });
    return convertedMoves;
  }, [selectedSquare, possibleMoves, allLegalMoves]);

  // Last move
  const lastMove = useMemo(() => {
    if (!game?.lastMove) return undefined;
    return [game.lastMove.from, game.lastMove.to] as [Key, Key];
  }, [game?.lastMove]);

  // Check detection
  const check = useMemo(() => {
    const activeChess = chessInstance || chess;
    if (!activeChess || !activeChess.inCheck()) return undefined;
    const turn = activeChess.turn();
    return turn === "w" ? "white" : "black";
  }, [chessInstance, chess]);

  // Shapes for banned moves
  const shapes = useMemo(() => {
    const s: Config["drawable"]["shapes"] = [];
    const bannedToShow =
      viewingPly !== null ? navigationBan : optimisticBan || currentBannedMove;

    if (bannedToShow && !canBan) {
      s.push({
        orig: bannedToShow.from as Key,
        dest: bannedToShow.to as Key,
        brush: "red",
      });
    }

    if (canBan && highlightedSquares.length === 2) {
      s.push({
        orig: highlightedSquares[0] as Key,
        dest: highlightedSquares[1] as Key,
        brush: "yellow",
      });
    }

    return s;
  }, [
    currentBannedMove,
    canBan,
    highlightedSquares,
    viewingPly,
    navigationBan,
    optimisticBan,
  ]);

  // Handle move/ban
  const handleMove = useCallback(
    (from: string, to: string) => {
      if (canBan) {
        banMove(from, to);
      } else if (canMove) {
        makeMove(from, to, "q");
      }
    },
    [canBan, canMove, makeMove, banMove]
  );

  // Chessground configuration - optimized with Lichess-like settings
  const config = useMemo<Config>(
    () => ({
      fen:
        (chessInstance || chess)?.fen() ||
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      orientation,
      turnColor: game?.turn || "white",
      lastMove,
      check,
      coordinates: true,
      animation: {
        enabled: true,
        duration: 180, // Lichess-like snappy animations
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      premovable: {
        enabled: true,
        showDests: true,
        castle: true,
      },
      movable: {
        free: false,
        color: canBan
          ? mode === "local"
            ? game?.turn || undefined
            : myColor === "white"
              ? "black"
              : "white"
          : canMove
            ? mode === "local"
              ? game?.turn || undefined
              : myColor || undefined
            : undefined,
        dests: legalMoves,
        showDests: true,
        rookCastle: true,
      },
      draggable: {
        enabled: canMove || canBan,
        showGhost: true,
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: shapes,
      },
      events: {
        move: handleMove,
      },
    }),
    [
      chessInstance,
      chess,
      orientation,
      game?.turn,
      lastMove,
      check,
      canMove,
      canBan,
      mode,
      myColor,
      legalMoves,
      handleMove,
      shapes,
    ]
  );

  // Initialize Chessground API only once
  useEffect(() => {
    if (!containerRef.current || boardApiRef.current) return;
    
    // Pass the container directly to Chessground - it will create its own wrapper
    const api = Chessground(containerRef.current, {});
    boardApiRef.current = api;
    onBoardApi?.(api);
    
    return () => {
      boardApiRef.current?.destroy();
      boardApiRef.current = null;
    };
  }, []); // Only run once on mount

  // Update config separately without recreating the board
  useEffect(() => {
    if (!boardApiRef.current) return;
    
    // Force redraw after config update to maintain size
    boardApiRef.current.set(config);
    requestAnimationFrame(() => {
      boardApiRef.current?.redrawAll();
    });
  }, [config]);

  // Only mount when we have a valid chess instance
  if (!chessInstance && !chess) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%'
      }}
    />
  );
}
