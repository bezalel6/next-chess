import { Box, Button, Typography, Paper, CircularProgress } from "@mui/material";
import { Logout, Login as LoginIcon } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import AuthForm from "@/components/auth-form";

function Login() {
    const { user, profile, signOut, isLoading } = useAuth();
    const { isConnected } = useConnection();

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (user) {
        // Use username if available, otherwise fall back to email
        const displayName = profile?.username || user.email;

        return (
            <Paper
                elevation={3}
                sx={{
                    p: 3,
                    maxWidth: '400px',
                    width: '100%',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 2
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Typography variant="h6" color="text.primary">
                        Welcome, {displayName}
                    </Typography>
                    <Typography variant="body2" color={isConnected ? "success.main" : "error.main"}>
                        {isConnected ? "Connected" : "Disconnected"}
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Logout />}
                        onClick={signOut}
                        fullWidth
                        sx={{ mt: 1 }}
                    >
                        Sign Out
                    </Button>
                </Box>
            </Paper>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <AuthForm />
        </Box>
    );
}

export default Login;