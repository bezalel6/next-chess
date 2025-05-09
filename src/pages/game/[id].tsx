import Head from "next/head";
import styles from "../index.module.css";
import LichessBoard from "@/components/lichess-board";
import { useGame } from "@/contexts/GameContext";
import { CircularProgress, Box, Typography } from "@mui/material";

export default function GamePage() {
    const { game, loading, myColor } = useGame();

    return (
        <>
            <Head>
                <title>Chess 2.0 - Game</title>
                <meta name="description" content="Play chess online" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className={styles.main}>
                <div className={styles.container}>
                    <h1 className={styles.title}>
                        Chess<span className={styles.pinkSpan}>2.0</span>
                    </h1>
                    <div className={styles.chessContainer} style={{ position: 'relative' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <CircularProgress />
                                <Typography variant="body1" sx={{ mt: 2 }}>
                                    Loading game...
                                </Typography>
                            </Box>
                        ) : game ? (
                            <>
                                <Box sx={{ position: 'absolute', top: 0, left: 0, zIndex: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '0 0 4px 0' }}>
                                    <Typography variant="body2">
                                        Playing as: {myColor || 'Spectator'}
                                    </Typography>
                                </Box>
                                <LichessBoard />
                            </>
                        ) : (
                            <Typography variant="body1">
                                Game not found or has been completed.
                            </Typography>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}