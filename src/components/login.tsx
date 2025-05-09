import { Box, Button, Typography, Paper } from "@mui/material";
import { Logout, Login as LoginIcon } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import AuthForm from "@/components/auth-form";

function Login() {
    const { user, signOut, isLoading } = useAuth();
    const { isConnected } = useConnection();

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    if (user) {
        return (
            <Paper elevation={2} sx={{ p: 3, maxWidth: '400px', width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Typography variant="h6" color="text.primary">
                        Welcome, {user.email}
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