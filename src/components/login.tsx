import { Box, Button, Typography, Paper, CircularProgress, Alert } from "@mui/material";
import { Logout, Login as LoginIcon } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import AuthForm from "@/components/auth-form";
import { useState } from "react";

function Login() {
    const { user, profile, signOut, isLoading } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);

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
                    <Typography variant="body2" color={"success.main"}>
                        {"Connected"}
                    </Typography>
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>
                            {error}
                        </Alert>
                    )}
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={signingOut ? <CircularProgress size={20} color="inherit" /> : <Logout />}
                        onClick={async () => {
                            setError(null);
                            setSigningOut(true);
                            try {
                                await signOut();
                            } catch (err) {
                                console.error('Sign out error:', err);
                                // Don't show error to user since we're clearing state anyway
                            } finally {
                                setSigningOut(false);
                            }
                        }}
                        disabled={signingOut}
                        fullWidth
                        sx={{ mt: 1 }}
                    >
                        {signingOut ? 'Signing Out...' : 'Sign Out'}
                    </Button>
                </Box>
            </Paper>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <AuthForm redirectOnSuccess={false} />
        </Box>
    );
}

export default Login;