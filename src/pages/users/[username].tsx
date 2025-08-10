import { GameService } from "@/services/gameService";
import { UserService, type UserGameStats } from "@/services/userService";
import { FollowService } from "@/services/followService";
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
    Stack,
    Avatar,
    IconButton,
    Tooltip
} from "@mui/material";
import Link from "next/link";
import Image from "next/image";
import { Chess } from "chess.ts";
import dynamic from "next/dynamic";
import UserLink from "@/components/user-link";
import FollowButton from "@/components/FollowButton";
import { useAuth } from "@/contexts/AuthContext";

// Import icons for chess pieces
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import TimelineIcon from '@mui/icons-material/Timeline';

// Dynamically import Chessground to avoid SSR issues
const Chessground = dynamic(() => import('@react-chess/chessground'), {
    ssr: false
});

export default function UserProfile() {
    const router = useRouter();
    const { username } = router.query;
    const { user: currentUser } = useAuth();
    const [userData, setUserData] = useState<"loading" | { error: string } | UserGameStats>("loading");
    const [followStats, setFollowStats] = useState<{ followers_count: number; following_count: number } | null>(null);

    const handleFollowChange = (isFollowing: boolean) => {
        // Update follower count immediately
        if (followStats && userData !== "loading" && !('error' in userData)) {
            setFollowStats({
                ...followStats,
                followers_count: isFollowing 
                    ? followStats.followers_count + 1 
                    : Math.max(0, followStats.followers_count - 1)
            });
        }
    };

    useEffect(() => {
        if (username) {
            // Load user profile
            UserService.getUserProfile(username as string)
                .then(data => {
                    setUserData(data);
                    // Load follow stats if we have user data
                    if ('userId' in data) {
                        FollowService.getFollowStats(data.userId).then(stats => {
                            setFollowStats(stats);
                        });
                    }
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
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                        avatar={
                            <Avatar sx={{ bgcolor: game.playerColor === 'white' ? 'grey.300' : 'grey.800' }}>
                                {game.playerColor === 'white' ? '♔' : '♚'}
                            </Avatar>
                        }
                        label={`Played as ${playerColorLabel}`}
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        icon={<TimelineIcon />}
                        label="Draw"
                        color="info"
                        size="small"
                    />
                </Stack>
            );
        } else if (
            (game.result === "white" && game.playerColor === "white") ||
            (game.result === "black" && game.playerColor === "black")
        ) {
            return (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                        avatar={
                            <Avatar sx={{ bgcolor: game.playerColor === 'white' ? 'grey.300' : 'grey.800' }}>
                                {game.playerColor === 'white' ? '♔' : '♚'}
                            </Avatar>
                        }
                        label={`Played as ${playerColorLabel}`}
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        icon={<EmojiEventsIcon />}
                        label="Won"
                        color="success"
                        size="small"
                    />
                </Stack>
            );
        } else {
            return (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                        avatar={
                            <Avatar sx={{ bgcolor: game.playerColor === 'white' ? 'grey.300' : 'grey.800' }}>
                                {game.playerColor === 'white' ? '♔' : '♚'}
                            </Avatar>
                        }
                        label={`Played as ${playerColorLabel}`}
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        icon={<SportsScoreIcon />}
                        label="Lost"
                        color="error"
                        size="small"
                    />
                </Stack>
            );
        }
    };

    // Create a mini chessboard config for displaying position previews
    const getChessboardConfig = (fen: string) => {
        return {
            fen,
            viewOnly: true,
            coordinates: false,
            resizable: false,
            movable: { free: false },
            draggable: { enabled: false },
            drawable: { enabled: false }
        };
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            {username}&apos;s Profile
                        </Typography>
                        {followStats && (
                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                <Chip 
                                    label={`${followStats.followers_count} Followers`}
                                    variant="outlined"
                                    size="small"
                                />
                                <Chip 
                                    label={`${followStats.following_count} Following`}
                                    variant="outlined"
                                    size="small"
                                />
                            </Box>
                        )}
                    </Box>
                    {'userId' in userData && (
                        <FollowButton 
                            userId={userData.userId}
                            username={username as string}
                            size="large"
                            onFollowChange={handleFollowChange}
                        />
                    )}
                </Box>

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
                                        py: 2,
                                        '&:hover': {
                                            bgcolor: 'action.hover'
                                        }
                                    }}
                                >
                                    <Grid container spacing={2} alignItems="center">
                                        {/* Board preview */}
                                        <Grid item xs={12} sm={3} md={2}>
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    aspectRatio: '1/1',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {typeof window !== 'undefined' && (
                                                    <Chessground
                                                        contained
                                                        config={getChessboardConfig(game.fen)}
                                                    />
                                                )}
                                            </Box>
                                        </Grid>

                                        {/* Game details */}
                                        <Grid item xs={12} sm={9} md={10}>
                                            <Grid container spacing={1}>
                                                {/* Game ID and date */}
                                                <Grid item xs={12}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        Game #{game.id}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Played on {formatDate(game.date_updated)}
                                                    </Typography>
                                                </Grid>

                                                {/* Opponent info */}
                                                <Grid item xs={12} sm={6} display="flex" gap={1} flexDirection={'row'}>
                                                    <Typography variant="body2">
                                                        <strong>Opponent:</strong>
                                                    </Typography>
                                                    <UserLink username={game.opponentUsername} />
                                                </Grid>

                                                {/* Result */}
                                                <Grid item xs={12} sm={6}>
                                                    <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                                                        {getResultDisplay(game)}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </ListItem>
                            </Fragment>
                        ))}
                    </List>
                </Paper>
            )}
        </Box>
    );
}