import { GameService } from "@/services/gameService";
import { UserService, type UserGameStats } from "@/services/userService";
import { useRouter } from "next/router";
import { useEffect, useState, Fragment } from "react";
import {
    Box,
    Typography,
    CircularProgress,
    Paper,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Divider,
    Chip,
    Stack
} from "@mui/material";
import Link from "next/link";
import Image from "next/image";

export default function UserProfile() {
    const router = useRouter();
    const { username } = router.query;
    const [userData, setUserData] = useState<"loading" | { error: string } | UserGameStats>("loading");

    useEffect(() => {
        if (username) {
            UserService.getUserProfile(username as string)
                .then(data => {
                    setUserData(data);
                }).catch(e => {
                    if (e instanceof Error)
                        setUserData({ error: e.message });
                    else {
                        setUserData({ error: "Unknown Error" });
                    }
                    console.error(e);
                });
        }
    }, [username]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getResultDisplay = (game: UserGameStats['games'][0]) => {
        const playerColorLabel = game.playerColor === 'white' ? 'White' : 'Black';

        if (game.result === "draw") {
            return (
                <Stack direction="row" spacing={1}>
                    <Chip label={`Played as ${playerColorLabel}`} variant="outlined" size="small" />
                    <Chip label="Draw" color="info" size="small" />
                </Stack>
            );
        } else if (
            (game.result === "white" && game.playerColor === "white") ||
            (game.result === "black" && game.playerColor === "black")
        ) {
            return (
                <Stack direction="row" spacing={1}>
                    <Chip label={`Played as ${playerColorLabel}`} variant="outlined" size="small" />
                    <Chip label="Won" color="success" size="small" />
                </Stack>
            );
        } else {
            return (
                <Stack direction="row" spacing={1}>
                    <Chip label={`Played as ${playerColorLabel}`} variant="outlined" size="small" />
                    <Chip label="Lost" color="error" size="small" />
                </Stack>
            );
        }
    };

    if (userData === "loading") {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if ('error' in userData) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h5" color="error" gutterBottom>
                    Error Loading Profile
                </Typography>
                <Typography>{userData.error}</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    {username}&apos;s Profile
                </Typography>

                <Grid container spacing={3} sx={{ mt: 2 }}>
                    <Grid item xs={12} sm={3}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h6">Total Games</Typography>
                                <Typography variant="h4">{userData.totalGames}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center', color: 'success.main' }}>
                                <Typography variant="h6">Wins</Typography>
                                <Typography variant="h4">{userData.wins}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center', color: 'error.main' }}>
                                <Typography variant="h6">Losses</Typography>
                                <Typography variant="h4">{userData.losses}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center', color: 'info.main' }}>
                                <Typography variant="h6">Win Rate</Typography>
                                <Typography variant="h4">{userData.winRate.toFixed(1)}%</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>

            <Typography variant="h5" gutterBottom>
                Game History
            </Typography>

            {userData.games.length === 0 ? (
                <Typography variant="body1">No games played yet.</Typography>
            ) : (
                <Paper elevation={2}>
                    <List>
                        {userData.games.map((game, index) => (
                            <Fragment key={game.id}>
                                {index > 0 && <Divider />}
                                <ListItem
                                    component={Link}
                                    href={`/game/${game.id}`}
                                    sx={{
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        '&:hover': {
                                            bgcolor: 'action.hover'
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <ListItemText
                                                primary={`Game #${game.id.substring(0, 8)}...`}
                                                secondary={formatDate(game.date_updated)}
                                            />
                                        </Box>
                                        <Box>
                                            {getResultDisplay(game)}
                                        </Box>
                                    </Box>
                                </ListItem>
                            </Fragment>
                        ))}
                    </List>
                </Paper>
            )}
        </Box>
    );
}