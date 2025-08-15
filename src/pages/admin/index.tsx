import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  People as PeopleIcon,
  SportsEsports as GamesIcon,
  TrendingUp as TrendingUpIcon,
  Block as BlockIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  PersonOff as BanIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Timer as TimerIcon,
  CheckCircle,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { supabase } from "@/utils/supabase";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import RealtimeMonitor from "@/components/admin/RealtimeMonitor";
import GameChart from "@/components/admin/GameChart";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalGames: number;
  activeGames: number;
  gamesLast24h: number;
  avgGameDuration: number;
  totalMoves: number;
  totalBans: number;
}

interface GameData {
  id: string;
  white_player_id: string;
  black_player_id: string;
  white_username?: string;
  black_username?: string;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
  total_moves?: number;
  total_bans?: number;
}

interface UserData {
  id: string;
  email?: string;
  username: string;
  created_at: string;
  last_sign_in_at?: string;
  games_played: number;
  games_won: number;
  games_drawn: number;
  is_banned?: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [games, setGames] = useState<GameData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      router.push("/");
      return;
    }

    try {
      // Check if user is admin by querying the admins table
      const { data: adminRecord, error: adminError } = await (supabase as any)
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // User is admin if they have a record in the admins table
      const userIsAdmin = !!adminRecord && !adminError;

      if (!userIsAdmin) {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      await loadDashboardData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadStats(),
        loadRecentGames(),
        loadUsers(),
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get user stats
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get active users (logged in within last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeUsersData } = await supabase
        .from("profiles")
        .select("id")
        .gte("last_sign_in_at", oneDayAgo);

      // Get game stats
      const { count: totalGames } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true });

      const { count: activeGames } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { count: gamesLast24h } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      // Get moves and bans count
      const { count: totalMoves } = await supabase
        .from("moves")
        .select("*", { count: "exact", head: true });

      const { count: totalBans } = await supabase
        .from("moves")
        .select("*", { count: "exact", head: true })
        .not("banned_from", "is", null);

      // Calculate average game duration
      const { data: finishedGames } = await supabase
        .from("games")
        .select("created_at, updated_at")
        .eq("status", "finished")
        .limit(100);

      let avgDuration = 0;
      if (finishedGames && finishedGames.length > 0) {
        const totalDuration = finishedGames.reduce((acc, game) => {
          const duration = new Date(game.updated_at).getTime() - new Date(game.created_at).getTime();
          return acc + duration;
        }, 0);
        avgDuration = Math.round(totalDuration / finishedGames.length / 60000); // in minutes
      }

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsersData?.length || 0,
        totalGames: totalGames || 0,
        activeGames: activeGames || 0,
        gamesLast24h: gamesLast24h || 0,
        avgGameDuration: avgDuration,
        totalMoves: totalMoves || 0,
        totalBans: totalBans || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadRecentGames = async () => {
    try {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (gamesData) {
        // Get move counts for each game
        const gamesWithStats = await Promise.all(
          gamesData.map(async (game) => {
            const { count: moveCount } = await supabase
              .from("moves")
              .select("*", { count: "exact", head: true })
              .eq("game_id", game.id);

            const { count: banCount } = await supabase
              .from("moves")
              .select("*", { count: "exact", head: true })
              .eq("game_id", game.id)
              .not("banned_from", "is", null);

            // Fetch usernames separately
            const { data: whiteProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", game.white_player_id)
              .single();
            
            const { data: blackProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", game.black_player_id)
              .single();

            return {
              ...game,
              white_username: whiteProfile?.username || "Unknown",
              black_username: blackProfile?.username || "Unknown",
              total_moves: moveCount || 0,
              total_bans: banCount || 0,
            };
          })
        );

        setGames(gamesWithStats);
      }
    } catch (error) {
      console.error("Error loading games:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, username, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (usersData) {
        // Get game stats for each user
        const usersWithStats = await Promise.all(
          usersData.map(async (user) => {
            const { count: totalGames } = await supabase
              .from("games")
              .select("*", { count: "exact", head: true })
              .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`);

            const { count: wonGames } = await supabase
              .from("games")
              .select("*", { count: "exact", head: true })
              .eq("status", "finished")
              .or(
                `and(white_player_id.eq.${user.id},result.eq.white),and(black_player_id.eq.${user.id},result.eq.black)`
              );

            const { count: drawnGames } = await supabase
              .from("games")
              .select("*", { count: "exact", head: true })
              .eq("status", "finished")
              .eq("result", "draw")
              .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`);

            return {
              ...user,
              games_played: totalGames || 0,
              games_won: wonGames || 0,
              games_drawn: drawnGames || 0,
            };
          })
        );

        setUsers(usersWithStats);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleViewGame = (gameId: string) => {
    router.push(`/game/${gameId}?spectate=true`);
  };

  const handleBanUser = async (userId: string) => {
    // Implement user ban logic
    console.log("Ban user:", userId);
  };

  const getStatusChip = (status: string) => {
    const color = status === "active" ? "success" : "default";
    const icon = status === "active" ? <ActiveIcon /> : <CheckCircle />;
    return <Chip label={status} color={color} size="small" icon={icon} />;
  };

  const getResultChip = (result: string | null) => {
    if (!result) return <Chip label="In Progress" size="small" />;
    const color = result === "draw" ? "warning" : "primary";
    return <Chip label={result} color={color} size="small" />;
  };

  const filteredGames = games.filter(
    (game) =>
      game.white_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.black_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Container>
        <Alert severity="error">You do not have admin access.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Admin Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadDashboardData}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </Box>

      {/* Activity Chart and Real-time Monitor */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} lg={8}>
          <GameChart />
        </Grid>
        <Grid item xs={12} lg={4}>
          <RealtimeMonitor />
        </Grid>
      </Grid>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">{stats?.totalUsers || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.activeUsers || 0} active today
                  </Typography>
                </Box>
                <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Games
                  </Typography>
                  <Typography variant="h4">{stats?.totalGames || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.activeGames || 0} active
                  </Typography>
                </Box>
                <GamesIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Games Today
                  </Typography>
                  <Typography variant="h4">{stats?.gamesLast24h || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg {stats?.avgGameDuration || 0} min/game
                  </Typography>
                </Box>
                <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Moves
                  </Typography>
                  <Typography variant="h4">{stats?.totalMoves || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.totalBans || 0} bans
                  </Typography>
                </Box>
                <BlockIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for Games and Users */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Recent Games" />
          <Tab label="Users" />
          <Tab label="Active Games" />
        </Tabs>
      </Paper>

      {/* Search Bar */}
      <Box mb={2}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={tabValue === 1 ? "Search users..." : "Search games..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Recent Games Tab */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game ID</TableCell>
                <TableCell>White Player</TableCell>
                <TableCell>Black Player</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Moves</TableCell>
                <TableCell>Bans</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGames.map((game) => (
                <TableRow key={game.id}>
                  <TableCell>{game.id}</TableCell>
                  <TableCell>{game.white_username || "Unknown"}</TableCell>
                  <TableCell>{game.black_username || "Unknown"}</TableCell>
                  <TableCell>{getStatusChip(game.status)}</TableCell>
                  <TableCell>{getResultChip(game.result)}</TableCell>
                  <TableCell>{game.total_moves}</TableCell>
                  <TableCell>{game.total_bans}</TableCell>
                  <TableCell>
                    {format(new Date(game.created_at), "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Game">
                      <IconButton size="small" onClick={() => handleViewGame(game.id)}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Users Tab */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Games</TableCell>
                <TableCell>Won</TableCell>
                <TableCell>Drawn</TableCell>
                <TableCell>Win Rate</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username || "No username"}</TableCell>
                  <TableCell>{user.email || "N/A"}</TableCell>
                  <TableCell>{user.games_played}</TableCell>
                  <TableCell>{user.games_won}</TableCell>
                  <TableCell>{user.games_drawn}</TableCell>
                  <TableCell>
                    {user.games_played > 0
                      ? `${Math.round((user.games_won / user.games_played) * 100)}%`
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at
                      ? format(new Date(user.last_sign_in_at), "MMM d, HH:mm")
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Ban User">
                      <IconButton
                        size="small"
                        onClick={() => handleBanUser(user.id)}
                        disabled={user.is_banned}
                      >
                        <BanIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Active Games Tab */}
      {tabValue === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game ID</TableCell>
                <TableCell>White Player</TableCell>
                <TableCell>Black Player</TableCell>
                <TableCell>Turn</TableCell>
                <TableCell>Moves</TableCell>
                <TableCell>Bans</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGames
                .filter((game) => game.status === "active")
                .map((game) => {
                  const duration = Math.round(
                    (Date.now() - new Date(game.created_at).getTime()) / 60000
                  );
                  return (
                    <TableRow key={game.id}>
                      <TableCell>{game.id}</TableCell>
                      <TableCell>{game.white_username || "Unknown"}</TableCell>
                      <TableCell>{game.black_username || "Unknown"}</TableCell>
                      <TableCell>
                        <Chip
                          label={game.status === "active" ? "Active" : "Waiting"}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>{game.total_moves}</TableCell>
                      <TableCell>{game.total_bans}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <TimerIcon fontSize="small" sx={{ mr: 0.5 }} />
                          {duration} min
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Game">
                          <IconButton
                            size="small"
                            onClick={() => handleViewGame(game.id)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}