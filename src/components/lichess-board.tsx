import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ComponentProps,
} from "react";
import { useChessSounds } from "../hooks/useChessSounds";
import { Box, Paper, Button, Typography, Chip } from "@mui/material";
import {
  clr,
  PROMOTION_PIECES,
  type LongColor,
  type PromoteablePieces,
  type ShortColor,
} from "@/types/game";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";
import type { Square } from "chess.ts/dist/types";
import { getBannedMove, isGameOver, isMoveFuzzyEq } from "@/utils/gameUtils";
const Chessground = dynamic(() => import("@react-chess/chessground"), {
  ssr: false,
});

interface LichessBoardProps {
  orientation?: "white" | "black";
}

interface PromotionState {
  from: string;
  to: string;
  color: "white" | "black";
}
type Config = ComponentProps<typeof Chessground>["config"];

const LichessBoard = ({}: LichessBoardProps) => {
  const { game, actions, isMyTurn, myColor, pgn, isLocalGame, localGameOrientation, boardOrientation } = useGame();
  const { playMoveSound } = useChessSounds();
  const [overlay, setOverlay] = useState<React.ReactNode | null>(null);
  const [boardSize, setBoardSize] = useState(512); // Default size in pixels - Lichess standard
  const boardRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startSize = useRef(0);
  
  const isActiveGame = useMemo(() => {
    return game?.status === "active";
  }, [game?.status]);
  // Calculate banned move at component scope
  const bannedMove = useMemo(() => {
    if (game.banningPlayer) return null;
    return getBannedMove(pgn);
  }, [pgn, game.banningPlayer]);

  const legalMoves = useMemo(() => {
    if (!game?.chess || !isActiveGame) return new Map();
    if (pgn !== game.pgn) {
      console.log("viewing an older position");
      return new Map();
    }
    // In local games during ban phase, show opponent's moves
    // In normal games, show moves when it's your turn or you're banning
    if (!isLocalGame && !isMyTurn && !game.banningPlayer) return new Map();
    if (isLocalGame && !game.banningPlayer && game.turn !== myColor) return new Map();

    return Array.from(game.chess.moves({ verbose: true })).reduce(
      (map, move) => {
        const from = move.from;
        const to = move.to;

        if (isMoveFuzzyEq(move, bannedMove)) {
          return map;
        }

        const dests = map.get(from) || [];
        map.set(from, [...dests, to]);
        return map;
      },
      new Map(),
    );
  }, [
    isActiveGame,
    game.chess,
    game.pgn,
    game.banningPlayer,
    pgn,
    isMyTurn,
    bannedMove,
  ]);

  useEffect(() => {
    if (isLocalGame) {
      // For local games, don't show overlay during ban phase
      setOverlay(null);
    } else if (game?.banningPlayer && myColor === game.banningPlayer) {
      setOverlay(null);
    } else if (isActiveGame && game?.banningPlayer) {
      // Simple, non-intrusive message for waiting player
      setOverlay(
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          {game.banningPlayer === "white" ? "White" : "Black"} is banning a move...
        </Typography>,
      );
    } else {
      setOverlay(null);
    }

    document
      .querySelectorAll(`piece.disabled`)
      .forEach((e) => e.classList.remove("disabled"));
    if (game.banningPlayer && (isLocalGame || game.banningPlayer === myColor)) {
      // In local games or when it's your turn to ban, disable your own pieces
      const colorToDisable = isLocalGame ? game.banningPlayer : myColor;
      document
        .querySelectorAll(`piece.${colorToDisable}`)
        .forEach((e) => e.classList.add("disabled"));
    }
  }, [isActiveGame, game?.banningPlayer, myColor, isLocalGame]);

  const handlePromotion = useCallback(
    (piece: PromoteablePieces, promotionState: PromotionState) => {
      if (!promotionState) return;

      actions.makeMove(promotionState.from, promotionState.to, piece);
      setOverlay(null);
    },
    [actions],
  );

  const [fen, lastMove, check] = useMemo(() => {
    const chess = new Chess(game.currentFen);
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    return [
      chess.fen(),
      history[history.length - 1],
      chess.inCheck() ? clr(chess.turn()) : false,
    ];
  }, [pgn, game.currentFen]);
  // Create drawable shapes for banned move
  const drawableShapes = useMemo(() => {
    if (!bannedMove) return [];

    // Extract from and to squares from banned move
    const from = bannedMove.substring(0, 2);
    const to = bannedMove.substring(2, 4);

    return [
      // Circle the from square
      {
        orig: from as Square,
        brush: "red",
      },
      // Circle the to square
      {
        orig: to as Square,
        brush: "red",
      },
      // Draw an arrow from the from square to the to square
      {
        orig: from as Square,
        dest: to as Square,
        brush: "red",
        modifiers: { lineWidth: 8 },
      },
    ] satisfies Config["drawable"]["shapes"];
  }, [bannedMove]);

  // Add state to track if we're in banning mode
  const isBanningMode = useMemo(
    () => isActiveGame && game.banningPlayer && (isLocalGame || game.banningPlayer === myColor),
    [game.banningPlayer, myColor, isActiveGame, isLocalGame],
  );

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startSize.current = boardSize;
    document.body.style.cursor = 'nwse-resize';
  }, [boardSize]);

  // Handle resize move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      
      // Calculate the distance moved diagonally (average of X and Y)
      const deltaX = e.clientX - startX.current;
      const deltaY = e.clientY - startY.current;
      const delta = (deltaX + deltaY) / 2;
      
      // Calculate new size with constraints
      const newSize = Math.min(Math.max(startSize.current + delta, 300), 700);
      setBoardSize(newSize);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const config = useMemo(
    () =>
      ({
        fen,
        orientation: isLocalGame 
          ? (localGameOrientation ?? "white") 
          : (boardOrientation ?? myColor ?? "white"),
        draggable: {
          enabled: true,
        },
        selected: undefined,
        highlight: {
          check: true,
          lastMove: true,
        },
        check,
        lastMove: lastMove
          ? [lastMove.from as Square, lastMove.to as Square]
          : undefined,
        movable: {
          free: false,
          color: "both",
          showDests: true,
          dests: legalMoves,
        },
        drawable: {
          enabled: true,
          visible: true,
          autoShapes: drawableShapes,
          defaultSnapToValidMove: false,
        },
        events: {
          move: (from: string, to: string) => {
            if (!game?.chess || !isActiveGame) return;

            // If it's a ban phase
            if (game.banningPlayer && (isLocalGame || game.banningPlayer === myColor)) {
              // Add visual feedback when banning
              playMoveSound(null, null); // Play a sound to indicate ban action
              actions.banMove(from, to);
              return;
            }

            // Regular move
            if (!isMyTurn) return;

            try {
              const move = game.chess.move({ from, to, promotion: "q" });
              if (move) {
                if (move.promotion) {
                  const promotionState = {
                    from,
                    to,
                    color: clr<LongColor>(move.color),
                  };
                  setOverlay(
                    <PromotionDialog
                      handlePromotion={handlePromotion}
                      promotionState={promotionState}
                    />,
                  );
                  game.chess.undo();
                  return;
                }
                playMoveSound(move, game.chess);
                actions.makeMove(from, to);
              }
            } catch {
              game.chess.undo();
            }
          },
        },
      }) satisfies Config,
    [
      game.chess,
      myColor,
      legalMoves,
      isMyTurn,
      game.banningPlayer,
      playMoveSound,
      actions,
      handlePromotion,
      drawableShapes,
      fen,
      check,
      lastMove,
      isActiveGame,
    ],
  );

  return (
    <Box
      position="relative"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      <Box
        ref={boardRef}
        className={isBanningMode ? "ban-mode-active" : ""}
        sx={{
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          maxWidth: '100%',
          position: "relative",
          ...(isBanningMode && {
            outline: "2px solid",
            outlineColor: "#ff9800",
            outlineOffset: 2,
          }),
        }}
      >
        {/* Ban mode indicator - static, no animations */}
        {isBanningMode && (
          <Chip
            label="🚫 SELECT OPPONENT'S MOVE TO BAN"
            color="warning"
            sx={{
              position: "absolute",
              bottom: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              fontWeight: "bold",
              fontSize: "0.85rem",
              backgroundColor: "rgba(255, 152, 0, 0.95)",
              color: "black",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
          />
        )}
        <Chessground contained config={config} />
        {/* Resize handle */}
        <Box
          onMouseDown={handleResizeStart}
          sx={{
            position: "absolute",
            bottom: -5,
            right: -5,
            width: 24,
            height: 24,
            cursor: "nwse-resize",
            opacity: 0.6,
            transition: "opacity 0.2s",
            "&:hover": {
              opacity: 1,
            },
            "&::before": {
              content: '""',
              position: "absolute",
              bottom: 3,
              right: 3,
              width: 16,
              height: 16,
              borderRight: "2px solid",
              borderBottom: "2px solid",
              borderColor: "rgba(255, 255, 255, 0.7)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: 3,
              right: 8,
              width: 0,
              height: 0,
              borderStyle: "solid",
              borderWidth: "0 0 8px 8px",
              borderColor: "transparent transparent rgba(255, 255, 255, 0.5) transparent",
            },
          }}
        />
      </Box>
      {overlay && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            bgcolor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              alignItems: "center",
            }}
          >
            {overlay}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

function PromotionDialog({
  promotionState,
  handlePromotion,
}: {
  promotionState: PromotionState;
  handlePromotion: (
    p: PromoteablePieces,
    promotionState: PromotionState,
  ) => void;
}) {
  return (
    <>
      {" "}
      <Typography variant="h6" sx={{ color: "primary.main", mb: 1 }}>
        Choose a piece to promote to
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        {(
          Object.entries(PROMOTION_PIECES) as [PromoteablePieces, string][]
        ).map(([piece, symbol]) => (
          <Button
            key={piece}
            onClick={() => handlePromotion(piece, promotionState)}
            variant="contained"
            sx={{
              minWidth: "48px",
              height: "48px",
              fontSize: "48px",
              color: promotionState.color === "white" ? "white" : "black",
              bgcolor:
                promotionState.color === "white" ? "primary.main" : "grey.300",
              "&:hover": {
                bgcolor:
                  promotionState.color === "white"
                    ? "primary.dark"
                    : "grey.400",
              },
            }}
          >
            {symbol}
          </Button>
        ))}
      </Box>
    </>
  );
}
export default LichessBoard;
