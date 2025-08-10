import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
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
  const { game, actions, isMyTurn, myColor, pgn } = useGame();
  const { playMoveSound } = useChessSounds();
  const [overlay, setOverlay] = useState<React.ReactNode | null>(null);
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
    if (!isMyTurn && !game.banningPlayer) return new Map();

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
    if (game?.banningPlayer && myColor === game.banningPlayer) {
      setOverlay(null);
    } else if (isActiveGame && game?.banningPlayer) {
      setOverlay(
        <Typography variant="h6">
          Please wait for {game.banningPlayer} to ban a move
        </Typography>,
      );
    } else {
      setOverlay(null);
    }

    document
      .querySelectorAll(`piece.disabled`)
      .forEach((e) => e.classList.remove("disabled"));
    if (game.banningPlayer === myColor) {
      document
        .querySelectorAll(`piece.${myColor}`)
        .forEach((e) => e.classList.add("disabled"));
    }
  }, [isActiveGame, game?.banningPlayer, myColor]);

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
    () => isActiveGame && game.banningPlayer === myColor,
    [game.banningPlayer, myColor, isActiveGame],
  );

  const config = useMemo(
    () =>
      ({
        fen,
        orientation: myColor ?? "white",
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

            // If it's my turn to ban a move
            if (game.banningPlayer === myColor) {
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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
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
      {isBanningMode && (
        <Box
          sx={{
            position: "absolute",
            bottom: "-50px",
            left: "0",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <Chip
            label="BAN MODE - SELECT OPPONENT'S MOVE TO BAN"
            color="warning"
            sx={{
              fontWeight: "bold",
              padding: "10px",
              animation: "pulse 1.5s infinite",
              "@keyframes pulse": {
                "0%": { boxShadow: "0 0 0 0 rgba(255, 152, 0, 0.4)" },
                "70%": { boxShadow: "0 0 0 10px rgba(255, 152, 0, 0)" },
                "100%": { boxShadow: "0 0 0 0 rgba(255, 152, 0, 0)" },
              },
              height: "auto",
              minHeight: "32px",
              "& .MuiChip-label": {
                whiteSpace: "normal",
                textAlign: "center",
                lineHeight: 1.2,
                padding: "6px 0",
                display: "block",
                maxWidth: "100%",
              },
            }}
          />
        </Box>
      )}
      <Box
        sx={{
          width: "80%",
          maxWidth: 600,
          aspectRatio: "1/1",
          margin: "0 auto",
          position: "relative",
        }}
      >
        <Chessground contained config={config} />
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
