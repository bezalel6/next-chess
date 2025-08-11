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
  type SignUpStatus,
  UsernameExistsError,
} from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { z } from "zod";
import { debounce } from "lodash";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// Zod schema for username validation
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username cannot exceed 20 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens",
  );

export type AuthFormProps = {
  redirectOnSuccess?: boolean;
};

export default function AuthForm({ redirectOnSuccess = true }: AuthFormProps) {
  const {
    signIn,
    signUp,
    signInAsGuest,
    signInWithGoogle,
    checkUsernameExists,
  } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState<
    "signin" | "signup" | "guest" | null
  >(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const router = useRouter();

  useEffect(() => {
    // Clear messages when changing auth mode
    return () => {
      setError(null);
      setSuccess(null);
      setUsernameError(null);
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    };
  }, [isSignUp]);

  // Debounced function to check if username exists
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Validate username with Zod when it changes
  useEffect(() => {
    if (username && isSignUp) {
      try {
        usernameSchema.parse(username);
        setUsernameError(null);

        // After basic validation passes, check if the username is unique
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

    // Cleanup function for debounce
    return () => {
      debouncedUsernameCheck.cancel();
    };
  }, [username, isSignUp, debouncedUsernameCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setSubmitAction(isSignUp ? "signup" : "signin");

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

        if (!captchaToken) {
          setError("Please complete the captcha verification");
          setIsLoading(false);
          return;
        }

        const result = await signUp(email, password, username, captchaToken);

        if (result.confirmEmail) {
          setSuccess(result.message);
          // Do not redirect if email confirmation is required
        } else {
          setSuccess(result.message);
          // Only redirect if no email confirmation is required
          redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
        }
      } else {
        if (!captchaToken) {
          setError("Please complete the captcha verification");
          setIsLoading(false);
          return;
        }

        await signIn(loginUsername, password, captchaToken);
        setSuccess("Sign in successful! Redirecting...");
        // Redirect after successful signin
        redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
      }
    } catch (err) {
      if (err instanceof UsernameExistsError) {
        setError("Username already taken. Please choose another username.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setIsLoading(false);
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setSubmitAction("guest");

    try {
      await signInAsGuest();
      setSuccess("Signed in as guest! Redirecting...");
      // Redirect after successful guest signin
      redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
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

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setSuccess(null);
    setUsernameError(null);
    setCaptchaToken(null);
    captchaRef.current?.resetCaptcha();
    // Clear username when switching to sign in
    if (isSignUp) {
      setUsername("");
    }
  };

  const getButtonText = () => {
    if (isLoading) {
      switch (submitAction) {
        case "signin":
          return "Signing in...";
        case "signup":
          return "Creating account...";
        case "guest":
          return "Continuing as guest...";
        default:
          return "Loading...";
      }
    }
    return isSignUp ? "Sign Up" : "Sign In";
  };

  const isFormValid = () => {
    if (isSignUp) {
      return (
        email &&
        password &&
        username &&
        !usernameError &&
        !checkingUsername &&
        captchaToken
      );
    }
    return loginUsername && password && captchaToken;
  };

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
  };

  const handleCaptchaError = () => {
    setCaptchaToken(null);
    setError("Captcha verification failed. Please try again.");
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
          {process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                my: 2,
                overflow: "hidden",
                "& > div": {
                  transform: "scale(0.88)",
                  transformOrigin: "center",
                  maxWidth: "100%",
                },
              }}
            >
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
                onVerify={handleCaptchaVerify}
                onExpire={handleCaptchaExpire}
                onError={handleCaptchaError}
                size="normal"
              />
            </Box>
          )}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading || !isFormValid()}
            startIcon={
              isLoading && submitAction !== "guest" ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {getButtonText()}
          </Button>
          <Button variant="text" onClick={toggleSignUp} disabled={isLoading}>
            {isSignUp
              ? "Already have an account? Sign In"
              : "Need an account? Sign Up"}
          </Button>

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
            startIcon={
              isLoading && submitAction === "guest" ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {submitAction === "guest" && isLoading
              ? "Continuing..."
              : "Continue as Guest"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
