import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/compat/router";
import type {
  Game,
  PromoteablePieces,
  PlayerColor,
  GameEndReason,
  GameResult,
  GameStatus,
  GameContextType,
} from "@/types/game";
import type { GameMatch } from "@/types/realtime";
import { useChessSounds } from "@/hooks/useChessSounds";
import { GameService } from "@/services/gameService";
import { useAuth } from "./AuthContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Square } from "chess.ts/dist/types";
import { Chess } from "chess.ts";
import { UserService } from "@/services/userService";
import { supabase } from "@/utils/supabase";

interface GameProviderProps {
  children: ReactNode;
}

// Create the context with a proper initial null value
const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: GameProviderProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [pgn, setPgn] = useState<string>("");
  const [myColor, setMyColor] = useState<"white" | "black" | null>(null);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [playerUsernames, setPlayerUsernames] = useState<{
    white: string;
    black: string;
  }>({
    white: "White Player",
    black: "Black Player",
  });
  const [isLocalGame, setIsLocalGame] = useState<boolean>(false);
  const [localGameOrientation, setLocalGameOrientation] = useState<
    "white" | "black"
  >("white");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black" | null>(null);
  const { playGameStart, playGameEnd } = useChessSounds();
  const router = useRouter();
  const { user, session } = useAuth();
  const { id: gameId } = router.query;
  const currentGameId = useRef<string | null>(null);

  // Load game when the game ID is in the URL
  useEffect(() => {
    if (!gameId || typeof gameId !== "string") return;

    const loadGame = async () => {
      try {
        setLoading(true);
        const loadedGame = await GameService.getGame(gameId);
        if (loadedGame) {
          setGame(loadedGame);
          setPgn(loadedGame.pgn || "");
          // Color will be set in the useEffect below that handles myColor
        } else {
          console.error("Game not found:", gameId);
          router.replace("/");
        }
      } catch (error) {
        console.error("Error loading game:", error);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId, router]);

  // Clean up subscription when component unmounts or when game changes
  const cleanupSubscription = useCallback(() => {
    if (subscription) {
      console.log("Cleaning up subscription");
      subscription.unsubscribe();
      setSubscription(null);
    }
  }, [subscription]);

  // Set up game subscription - completely rewritten to prevent loops
  useEffect(() => {
    // Don't do anything if we don't have a game ID
    if (!game?.id) return;

    // Check if we're already subscribed to this game
    if (currentGameId.current === game.id && subscription) {
      console.log(
        "Already subscribed to this game, skipping subscription setup",
      );
      return;
    }

    // Clean up existing subscription
    if (subscription) {
      console.log("Cleaning up existing subscription before creating new one");
      subscription.unsubscribe();
      setSubscription(null);
    }

    // Update current game ID reference
    currentGameId.current = game.id;

    // Set up new subscription
    console.log(`Setting up subscription for game ${game.id}`);
    const setupSubscription = async () => {
      try {
        const newSubscription = GameService.subscribeToGame(
          game.id,
          // Define a stable callback
          (updatedGame) => {
            console.log(
              `Game update received: ${updatedGame.id}, turn: ${updatedGame.turn}`,
            );
            // Only update if this is the current game we're viewing
            if (currentGameId.current === updatedGame.id) {
              setGame(updatedGame);

              setPgn(updatedGame.pgn || "");
              if (updatedGame.status === "finished") {
                playGameEnd();
              }
            }
          },
        );
        setSubscription(newSubscription);
      } catch (error) {
        console.error("Error setting up game subscription:", error);
      }
    };

    setupSubscription();

    // Clean up on unmount or game change
    return () => {
      if (subscription) {
        console.log("Cleaning up subscription on unmount or game change");
        subscription.unsubscribe();
      }
    };
  }, [game?.id, playGameEnd, subscription]);

  const makeMove = useCallback(
    async (from: string, to: string, promotion?: PromoteablePieces) => {
      if (
        !game ||
        game.status !== "active" ||
        game.turn !== myColor ||
        !user ||
        !session
      )
        return;

      try {
        const move = { from: from as Square, to: to as Square, promotion };

        // Optimistically update the PGN
        const tempChess = new Chess(game.currentFen);
        if (pgn) {
          tempChess.loadPgn(pgn);
        }

        // Try the move locally to generate the new PGN
        const result = tempChess.move(move);
        if (result) {
          // Update only the PGN state optimistically
          setPgn(tempChess.pgn());
        }

        // Proceed with the actual server update
        const updatedGame = await GameService.makeMove(game.id, move);
        setGame(updatedGame);
        setPgn(updatedGame.pgn || "");
      } catch (error) {
        console.error("Invalid move:", error);
      }
    },
    [game, pgn, myColor, user, session],
  );

  // Ban move for local games
  const banLocalGameMove = useCallback(
    (from: string, to: string) => {
      if (!game || !isLocalGame || game.status !== "active" || !game.banningPlayer) return;

      // Create a new chess instance to manipulate PGN
      const chess = new Chess();
      if (game.pgn) {
        chess.loadPgn(game.pgn);
      }
      
      // Add ban to PGN as comment
      chess.setComment(`banning: ${from}${to}`);
      const newPgn = chess.pgn();
      
      // Switch to next ban phase or start regular play
      const nextBanningPlayer = game.banningPlayer === "white" ? "black" : null;
      
      const updatedGame: Game = {
        ...game,
        pgn: newPgn,
        banningPlayer: nextBanningPlayer,
        chess: chess,
      };
      
      setGame(updatedGame);
      setPgn(newPgn);
      
      // Update orientation for next phase
      if (nextBanningPlayer === "black") {
        // Switch to black's perspective for their ban
        setMyColor("black");
        setLocalGameOrientation("black");
      } else if (nextBanningPlayer === null) {
        // Both bans complete, start regular play from white's perspective
        setMyColor("white");
        setLocalGameOrientation("white");
      }
    },
    [game, isLocalGame],
  );

  const banMove = useCallback(
    async (from: string, to: string) => {
      if (isLocalGame) {
        banLocalGameMove(from, to);
        return;
      }
      
      if (!game || game.status !== "active" || !user || !session) return;

      try {
        const move = { from: from as Square, to: to as Square };

        // Call the service to ban the move
        const updatedGame = await GameService.banMove(game.id, move);
        setGame(updatedGame);
        setPgn(updatedGame.pgn || "");
      } catch (error) {
        console.error("Error banning move:", error);
      }
    },
    [game, user, session, isLocalGame, banLocalGameMove],
  );

  const resetGame = useCallback(async () => {
    // Make sure to clean up subscription before resetting game state
    cleanupSubscription();
    setGame(null);
    setPgn("");
    setMyColor(null);
    router.replace("/", undefined, { shallow: true });
  }, [router, cleanupSubscription]);

  // Set myColor whenever game or user changes
  useEffect(() => {
    if (!game || !user) {
      setMyColor(null);
      return;
    }

    if (game.whitePlayer === user.id) {
      setMyColor("white");
    } else if (game.blackPlayer === user.id) {
      setMyColor("black");
    } else {
      setMyColor(null); // Spectator
    }
  }, [game, user]);

  // Play game start sound when game becomes active
  useEffect(() => {
    if (game?.status === "active") {
      playGameStart();
    }
  }, [game?.status, playGameStart]);

  // Fetch player usernames when game data changes
  useEffect(() => {
    if (!game) return;

    const fetchUsernames = async () => {
      try {
        const usernames = await UserService.getUsernamesByIds([
          game.whitePlayer,
          game.blackPlayer,
        ]);

        setPlayerUsernames({
          white: usernames[game.whitePlayer] || "White Player",
          black: usernames[game.blackPlayer] || "Black Player",
        });
      } catch (error) {
        console.error("Error fetching player usernames:", error);
      }
    };

    fetchUsernames();
  }, [game?.whitePlayer, game?.blackPlayer]);

  // New function to offer a draw
  const offerDraw = useCallback(async () => {
    if (!game || game.status !== "active" || !myColor || !user || !session)
      return;

    try {
      const updatedGame = await GameService.offerDraw(game.id, myColor);
      setGame(updatedGame);
    } catch (error) {
      console.error("Error offering draw:", error);
    }
  }, [game, myColor, user, session]);

  // New function to accept a draw
  const acceptDraw = useCallback(async () => {
    if (!game || game.status !== "active" || !user || !session) return;

    try {
      const updatedGame = await GameService.acceptDraw(game.id);
      setGame(updatedGame);
      setPgn(updatedGame.pgn || "");
      playGameEnd();
    } catch (error) {
      console.error("Error accepting draw:", error);
    }
  }, [game, user, session, playGameEnd]);

  // New function to decline a draw
  const declineDraw = useCallback(async () => {
    if (!game || game.status !== "active" || !user || !session) return;

    try {
      const updatedGame = await GameService.declineDraw(game.id);
      setGame(updatedGame);
    } catch (error) {
      console.error("Error declining draw:", error);
    }
  }, [game, user, session]);

  // New function to resign
  const resign = useCallback(async () => {
    if (!game || game.status !== "active" || !myColor || !user || !session)
      return;

    try {
      const updatedGame = await GameService.resign(game.id, myColor);
      setGame(updatedGame);
      setPgn(updatedGame.pgn || "");
      playGameEnd();
    } catch (error) {
      console.error("Error resigning:", error);
    }
  }, [game, myColor, user, session, playGameEnd]);

  // New function to offer a rematch
  const offerRematch = useCallback(async () => {
    if (!game || game.status !== "finished" || !myColor || !user || !session)
      return;

    try {
      const updatedGame = await GameService.offerRematch(game.id, myColor);
      setGame(updatedGame);
    } catch (error) {
      console.error("Error offering rematch:", error);
    }
  }, [game, myColor, user, session]);

  // New function to accept a rematch
  const acceptRematch = useCallback(async () => {
    if (!game || game.status !== "finished" || !user || !session) return;

    try {
      // First clear the rematch offer from the current game
      // This prevents errors if the accepting player refreshes
      await GameService.declineRematch(game.id);

      // Create the new game with swapped colors
      const newGame = await GameService.acceptRematch(game.id);

      // Update the local state for the current game
      setGame({
        ...game,
        rematchOfferedBy: null,
      });

      // Notify players via realtime channel that a rematch has been created
      // This will be picked up by all connected clients still viewing the original game
      await supabase.channel("game_rematch").send({
        type: "broadcast",
        event: "rematch_accepted",
        payload: {
          originalGameId: game.id,
          newGameId: newGame.id,
        },
      });

      // Navigate to the new game
      router.push(`/game/${newGame.id}`);
    } catch (error) {
      console.error("Error accepting rematch:", error);
    }
  }, [game, user, session, router]);

  // New function to decline a rematch
  const declineRematch = useCallback(async () => {
    if (!game || game.status !== "finished" || !user || !session) return;

    try {
      const updatedGame = await GameService.declineRematch(game.id);
      setGame(updatedGame);
    } catch (error) {
      console.error("Error declining rematch:", error);
    }
  }, [game, user, session]);

  // Listen for rematch broadcasts to redirect both players
  useEffect(() => {
    if (!game?.id) return;

    const rematchChannel = supabase
      .channel("game_rematch")
      .on("broadcast", { event: "rematch_accepted" }, (payload) => {
        // Check if this broadcast is relevant to the current game
        if (payload.payload.originalGameId === game.id) {
          console.log(
            "Rematch accepted, redirecting to new game:",
            payload.payload.newGameId,
          );
          // Navigate to the new game
          router.push(`/game/${payload.payload.newGameId}`);
        }
      })
      .subscribe();

    return () => {
      rematchChannel.unsubscribe();
    };
  }, [game?.id, router]);

  // Start local game mode
  const startLocalGame = useCallback(() => {
    // Create a local game state for local game
    const chess = new Chess();
    const localGame: Game = {
      id: "local-game-" + Date.now(),
      whitePlayer: user?.id || "local",
      blackPlayer: user?.id || "local",
      status: "active",
      result: null,
      currentFen: chess.fen(),
      pgn: "",
      chess: chess,
      lastMove: null,
      turn: "white",
      startTime: Date.now(),
      lastMoveTime: Date.now(),
      banningPlayer: "black", // Start with black banning a move for white
      drawOfferedBy: null,
      endReason: null,
      rematchOfferedBy: null,
      parentGameId: null,
    };

    setGame(localGame);
    setPgn("");
    setIsLocalGame(true);
    setLocalGameOrientation("white");
    setMyColor("white");

    // Clear any existing subscriptions since this is local play
    cleanupSubscription();

    // Navigate to local game route
    router.push("/local-game", undefined, { shallow: true });
  }, [user, router, cleanupSubscription]);

  // Make move in local game mode (no automatic orientation switch)
  const makeLocalGameMove = useCallback(
    async (from: string, to: string, promotion?: PromoteablePieces) => {
      if (!game || !isLocalGame || game.status !== "active") return;

      try {
        const move = { from: from as Square, to: to as Square, promotion };
        const chess = game.chess;

        // Try the move
        const result = chess.move(move);
        if (result) {
          const newPgn = chess.pgn();
          const newTurn = chess.turn() === "w" ? "white" : "black";

          // Update game state
          const updatedGame: Game = {
            ...game,
            currentFen: chess.fen(),
            pgn: newPgn,
            lastMove: move,
            turn: newTurn,
            lastMoveTime: Date.now(),
          };

          // Check for game ending conditions
          if (chess.inCheckmate()) {
            updatedGame.status = "finished";
            updatedGame.result = newTurn === "white" ? "black" : "white";
            updatedGame.endReason = "checkmate";
            playGameEnd();
          } else if (chess.inDraw()) {
            updatedGame.status = "finished";
            updatedGame.result = "draw";
            if (chess.inStalemate()) {
              updatedGame.endReason = "stalemate";
            } else if (chess.insufficientMaterial()) {
              updatedGame.endReason = "insufficient_material";
            } else if (chess.inThreefoldRepetition()) {
              updatedGame.endReason = "threefold_repetition";
            } else {
              updatedGame.endReason = "fifty_move_rule";
            }
            playGameEnd();
          }

          setGame(updatedGame);
          setPgn(newPgn);

          // Update current turn but don't auto-flip board
          if (updatedGame.status === "active") {
            setMyColor(newTurn);
          }
        }
      } catch (error) {
        console.error("Invalid move:", error);
      }
    },
    [game, isLocalGame, playGameEnd],
  );

  // Flip board orientation
  const flipBoardOrientation = useCallback(() => {
    if (isLocalGame) {
      setLocalGameOrientation(prev => prev === "white" ? "black" : "white");
    } else {
      setBoardOrientation(prev => {
        if (prev === null) {
          return myColor === "white" ? "black" : "white";
        }
        return prev === "white" ? "black" : "white";
      });
    }
  }, [isLocalGame, myColor]);

  const value: GameContextType = {
    game,
    setGame,
    pgn,
    setPgn,
    isMyTurn: isLocalGame
      ? true
      : game?.status === "active" && game?.turn === myColor,
    myColor: isLocalGame ? myColor : myColor,
    loading,
    playerUsernames,
    isLocalGame,
    localGameOrientation,
    boardOrientation,
    actions: {
      makeMove: isLocalGame ? makeLocalGameMove : makeMove,
      banMove,
      resetGame,
      offerDraw,
      acceptDraw,
      declineDraw,
      resign,
      offerRematch,
      acceptRematch,
      declineRematch,
      startLocalGame,
      flipBoardOrientation,
    },
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
