import { useState } from "react";
import { Box, Paper, TextField, Button, Typography, Alert, Divider } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthForm() {
    const { signIn, signUp, signInAsGuest } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isSignUp) {
                await signUp(email, password);
            } else {
                await signIn(email, password);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuestSignIn = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await signInAsGuest();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Paper
            elevation={2}
            sx={{
                p: 3,
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
            }}
        >
            <Typography variant="h5" component="h2" align="center">
                {isSignUp ? "Create Account" : "Sign In"}
            </Typography>

            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                />
                <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                />
                <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={isLoading}
                >
                    {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
                </Button>
                <Button
                    variant="text"
                    onClick={() => setIsSignUp(!isSignUp)}
                    disabled={isLoading}
                >
                    {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
                </Button>
                
                <Divider sx={{ my: 1 }}>or</Divider>
                
                <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleGuestSignIn}
                    disabled={isLoading}
                >
                    Continue as Guest
                </Button>
            </Box>
        </Paper>
    );
}