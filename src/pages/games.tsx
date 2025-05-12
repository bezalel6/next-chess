import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
    Container,
    Typography,
    Tabs,
    Tab,
    Box,
    Paper,
    List,
    ListItem,
    ListItemText,
    Button,
    Divider,
    CircularProgress,
    Grid
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { GameService } from '@/services/gameService';
import { UserService } from '@/services/userService';
import type { Game } from '@/types/game';

export default function GamesPage() {
    const [tab, setTab] = useState(0);
    const [activeGames, setActiveGames] = useState<Game[]>([]);
    const [completedGames, setCompletedGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [usernames, setUsernames] = useState<Record<string, string>>({});
    const router = useRouter();
    const { user } = useAuth();

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

    useEffect(() => {
        const fetchGames = async () => {
            setLoading(true);
            try {
                // Load both active and completed games
                const [active, completed] = await Promise.all([
                    GameService.getActiveGames(20, 0),
                    GameService.getCompletedGames(20, 0)
                ]);

                setActiveGames(active);
                setCompletedGames(completed);

                // Get unique player IDs from both lists
                const playerIds = new Set<string>();
                [...active, ...completed].forEach(game => {
                    playerIds.add(game.whitePlayer);
                    playerIds.add(game.blackPlayer);
                });

                // Fetch usernames for all players
                const usernamesMap = await UserService.getUsernamesByIds(Array.from(playerIds));
                setUsernames(usernamesMap);
            } catch (error) {
                console.error('Error fetching games:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, []);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const getGameResult = (game: Game) => {
        if (game.status !== 'finished') return 'In Progress';

        switch (game.result) {
            case 'white':
                return `White won by ${game.endReason === 'resignation' ? 'resignation' : 'checkmate'}`;
            case 'black':
                return `Black won by ${game.endReason === 'resignation' ? 'resignation' : 'checkmate'}`;
            case 'draw':
                return `Draw by ${game.endReason || 'agreement'}`;
            default:
                return 'Unknown result';
        }
    };

    const renderGameList = (games: Game[]) => {
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (games.length === 0) {
            return (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        No games found
                    </Typography>
                </Box>
            );
        }

        return (
            <List>
                {games.map((game) => (
                    <Paper key={game.id} elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
                        <ListItem
                            secondaryAction={
                                <Button
                                    variant="contained"
                                    onClick={() => router.push(`/game/${game.id}`)}
                                >
                                    {game.status === 'active' ? 'Watch Live' : 'View Game'}
                                </Button>
                            }
                            sx={{ p: 2 }}
                        >
                            <ListItemText
                                primary={
                                    <Typography variant="h6">
                                        {usernames[game.whitePlayer] || 'White Player'} vs {usernames[game.blackPlayer] || 'Black Player'}
                                    </Typography>
                                }
                                secondary={
                                    <Grid container spacing={1} sx={{ mt: 0.5 }}>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2">Status: {game.status === 'active' ? 'In Progress' : getGameResult(game)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2">
                                                {game.status === 'active' ? 'Started' : 'Finished'}: {formatDate(game.status === 'active' ? game.startTime : game.lastMoveTime)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                }
                            />
                        </ListItem>
                    </Paper>
                ))}
            </List>
        );
    };

    return (
        <Container maxWidth="lg">
            <Head>
                <title>Chess Games | Spectate & Replay</title>
                <meta name="description" content="Watch live chess games or review completed games" />
            </Head>

            <Box sx={{ pt: 4, pb: 6 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Chess Games
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Watch live games in progress or review completed games
                </Typography>

                <Paper sx={{ width: '100%', mb: 2 }}>
                    <Tabs
                        value={tab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                    >
                        <Tab label="Live Games" />
                        <Tab label="Completed Games" />
                    </Tabs>

                    <Box sx={{ p: 2 }}>
                        {tab === 0 ? renderGameList(activeGames) : renderGameList(completedGames)}
                    </Box>
                </Paper>

                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Button
                        variant="outlined"
                        component={Link}
                        href="/"
                    >
                        Back to Home
                    </Button>
                </Box>
            </Box>
        </Container>
    );
} 