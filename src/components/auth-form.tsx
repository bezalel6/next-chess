import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  CircularProgress,
} from "@mui/material";
import { Google } from "@mui/icons-material";
import {
  useAuth,
  UsernameExistsError,
} from "@/contexts/AuthContext";
import { z } from "zod";
import { debounce } from "lodash";
import { validateUsername } from "@/utils/usernameFilter";

// Enhanced Zod schema for username validation with filtering
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username cannot exceed 20 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens",
  )
  .refine((username) => {
    const result = validateUsername(username);
    return result.isValid;
  }, {
    message: "Username is not allowed"
  });

export type AuthFormProps = {
  redirectOnSuccess?: boolean;
  mode?: 'login' | 'signup';
  onModeChange?: (newMode: 'login' | 'signup') => void;
};

export default function AuthForm({ redirectOnSuccess = true, mode = 'login', onModeChange }: AuthFormProps) {
  const {
    signIn,
    signUp,
    signInAsGuest,
    signInWithGoogle,
    signInWithMagicLink,
    checkUsernameExists,
  } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");

  useEffect(() => {
    setIsSignUp(mode === 'signup');
  }, [mode]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setUsernameError(null);
  }, [isSignUp]);

  // Debounced function to check if username exists
  const debouncedUsernameCheck = useCallback(
    debounce(async (username: string) => {
      try {
        const exists = await checkUsernameExists(username);
        if (exists) {
          setUsernameError("Username already taken");
        }
        setCheckingUsername(false);
      } catch (err) {
        console.error("Error checking username:", err);
        setCheckingUsername(false);
      }
    }, 500),
    [checkUsernameExists],
  );

  // Validate username with enhanced filtering when it changes
  useEffect(() => {
    if (username && isSignUp) {
      // First check our custom validation for better error messages
      const filterResult = validateUsername(username);
      if (!filterResult.isValid) {
        setUsernameError(filterResult.reason || "Username is not allowed");
        return;
      }
      
      // Then run Zod validation for format checks
      try {
        usernameSchema.parse(username);
        setUsernameError(null);
        setCheckingUsername(true);
        debouncedUsernameCheck(username);
      } catch (err) {
        if (err instanceof z.ZodError) {
          setUsernameError(err.errors[0].message);
        }
      }
    } else {
      setUsernameError(null);
    }

    return () => {
      debouncedUsernameCheck.cancel();
    };
  }, [username, isSignUp, debouncedUsernameCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Validate username before submitting
        try {
          usernameSchema.parse(username);
        } catch (err) {
          if (err instanceof z.ZodError) {
            setError(err.errors[0].message);
            setIsLoading(false);
            return;
          }
        }

        const result = await signUp(email, password, username);
        if (result.confirmEmail) {
          setSuccess(result.message);
        } else {
          setSuccess(result.message);
          redirectOnSuccess && setTimeout(() => window.location.href = "/", 1500);
        }
      } else {
        await signIn(loginUsername, password);
        setSuccess("Sign in successful! Redirecting...");
        redirectOnSuccess && setTimeout(() => window.location.href = "/", 1500);
      }
    } catch (err) {
      if (err instanceof UsernameExistsError) {
        setError("Username already taken. Please choose another username.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await signInAsGuest();
      setSuccess("Signed in as guest! Redirecting...");
      redirectOnSuccess && setTimeout(() => window.location.href = "/", 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await signInWithGoogle();
      // Google OAuth will redirect, so no need to handle success here
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      await signInWithMagicLink(magicLinkEmail);
      setSuccess("Magic link sent! Check your email to sign in.");
      setShowMagicLink(false);
      setMagicLinkEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSignUp = () => {
    const newIsSignUp = !isSignUp;
    setIsSignUp(newIsSignUp);
    setError(null);
    setSuccess(null);
    setUsernameError(null);
    if (isSignUp) {
      setUsername("");
    }
    
    if (onModeChange) {
      onModeChange(newIsSignUp ? 'signup' : 'login');
    }
  };

  const isFormValid = () => {
    if (isSignUp) {
      return email && password && username && !usernameError && !checkingUsername;
    }
    return loginUsername && password;
  };

  return (
    <Box
      sx={{
        minHeight: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: 3,
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
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

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {showMagicLink && !isSignUp ? (
          <Box
            component="form"
            onSubmit={handleMagicLinkSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TextField
              label="Email"
              type="email"
              value={magicLinkEmail}
              onChange={(e) => setMagicLinkEmail(e.target.value.toLowerCase())}
              required
              fullWidth
              disabled={isLoading}
              helperText="We'll send you a sign-in link to this email"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isLoading || !magicLinkEmail}
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {isLoading ? "Sending link..." : "Send Magic Link"}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setShowMagicLink(false);
                setMagicLinkEmail("");
                setError(null);
                setSuccess(null);
              }}
              disabled={isLoading}
            >
              Back to sign in
            </Button>
          </Box>
        ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {isSignUp && (
            <TextField
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              fullWidth
              disabled={isLoading}
              error={!!usernameError}
              helperText={
                checkingUsername
                  ? "Checking username availability..."
                  : usernameError ||
                    "3-20 characters, letters, numbers, _ and - only"
              }
              InputProps={{
                endAdornment: checkingUsername && (
                  <CircularProgress size={20} color="inherit" />
                ),
              }}
            />
          )}
          {isSignUp ? (
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              required
              fullWidth
              disabled={isLoading}
            />
          ) : (
            <TextField
              label="Username"
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value.toLowerCase())}
              required
              fullWidth
              disabled={isLoading}
              helperText="Enter your username to sign in"
            />
          )}
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={isLoading}
            helperText={
              isSignUp ? "Password must be at least 6 characters" : ""
            }
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading || !isFormValid()}
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {isLoading 
              ? (isSignUp ? "Creating account..." : "Signing in...")
              : (isSignUp ? "Sign Up" : "Sign In")}
          </Button>
          <Button 
            variant="text" 
            onClick={toggleSignUp} 
            disabled={isLoading}
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Need an account? Sign Up"}
          </Button>

          {!isSignUp && (
            <Button
              variant="text"
              onClick={() => setShowMagicLink(!showMagicLink)}
              disabled={isLoading}
              sx={{ mt: -1, mb: 1 }}
            >
              Sign in with email link instead
            </Button>
          )}

          <Divider sx={{ my: 1 }}>or</Divider>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            startIcon={<Google />}
            sx={{ mb: 1 }}
          >
            Continue with Google
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleGuestSignIn}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {isLoading ? "Continuing..." : "Continue as Guest"}
          </Button>
        </Box>
        )}
      </Paper>
    </Box>
  );
}