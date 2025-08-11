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
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { TURNSTILE_CONFIG } from "@/config/turnstile";

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
    signInWithMagicLink,
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
    "signin" | "signup" | "guest" | "magiclink" | null
  >(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const router = useRouter();
  
  // Refs for input elements to detect autofill
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const loginUsernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const magicLinkEmailInputRef = useRef<HTMLInputElement>(null);
  const [shrinkStates, setShrinkStates] = useState({
    username: false,
    email: false,
    loginUsername: false,
    password: false,
    magicLinkEmail: false,
  });

  useEffect(() => {
    // Check for autofill on mount and periodically
    const checkAutofill = () => {
      const refs = {
        username: usernameInputRef.current,
        email: emailInputRef.current,
        loginUsername: loginUsernameInputRef.current,
        password: passwordInputRef.current,
        magicLinkEmail: magicLinkEmailInputRef.current,
      };

      const newShrinkStates = { ...shrinkStates };
      let hasChanges = false;

      Object.entries(refs).forEach(([key, ref]) => {
        if (ref) {
          const isAutofilled = ref.matches?.(':-webkit-autofill') || 
                              ref.matches?.(':autofill') ||
                              ref.value !== '';
          if (newShrinkStates[key as keyof typeof shrinkStates] !== isAutofilled) {
            newShrinkStates[key as keyof typeof shrinkStates] = isAutofilled;
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        setShrinkStates(newShrinkStates);
      }
    };

    // Check immediately and then periodically for a short time
    checkAutofill();
    const interval = setInterval(checkAutofill, 200);
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSignUp, showMagicLink]);

  useEffect(() => {
    // Clear messages when changing auth mode
    setError(null);
    setSuccess(null);
    setUsernameError(null);
    // Don't reset captcha when just switching modes
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
          setError("Please wait for security verification to complete");
          setIsLoading(false);
          return;
        }

        const result = await signUp(email, password, username, captchaToken);

        if (result.confirmEmail) {
          setSuccess(result.message);
        } else {
          setSuccess(result.message);
          redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
        }
      } else {
        if (!captchaToken) {
          setError("Please wait for security verification to complete");
          setIsLoading(false);
          return;
        }

        await signIn(loginUsername, password, captchaToken);
        setSuccess("Sign in successful! Redirecting...");
        redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
      }
    } catch (err) {
      if (err instanceof UsernameExistsError) {
        setError("Username already taken. Please choose another username.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      // Reset captcha on error
      setCaptchaToken(null);
      setCaptchaLoading(true);
      turnstileRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setSubmitAction("guest");

    try {
      if (!captchaToken) {
        setError("Please wait for security verification to complete");
        setIsLoading(false);
        return;
      }
      
      await signInAsGuest(captchaToken);
      setSuccess("Signed in as guest! Redirecting...");
      // Redirect after successful guest signin
      redirectOnSuccess && setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      // Reset captcha on error
      setCaptchaToken(null);
      setCaptchaLoading(true);
      turnstileRef.current?.reset();
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
    setSubmitAction("magiclink");
    
    try {
      if (!captchaToken) {
        setError("Please wait for security verification to complete");
        setIsLoading(false);
        return;
      }

      await signInWithMagicLink(magicLinkEmail, captchaToken);
      setSuccess("Magic link sent! Check your email to sign in.");
      setShowMagicLink(false);
      setMagicLinkEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      // Reset captcha on error
      setCaptchaToken(null);
      setCaptchaLoading(true);
      turnstileRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setSuccess(null);
    setUsernameError(null);
    // Don't reset captcha when just toggling sign up/sign in
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
    if (captchaLoading && isFormValid()) {
      return isSignUp ? "Verifying..." : "Verifying...";
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
        !checkingUsername
      );
    }
    return loginUsername && password;
  };

  const handleTurnstileVerify = (token: string) => {
    setCaptchaToken(token);
    setCaptchaLoading(false);
  };

  const handleTurnstileExpire = () => {
    // Token expired, need to re-verify
    setCaptchaToken(null);
    setCaptchaLoading(true);
    // Turnstile will automatically refresh with refreshExpired: 'auto'
  };

  const handleTurnstileError = (error?: Error | string) => {
    console.error('Turnstile error:', error);
    setCaptchaToken(null);
    setCaptchaLoading(false);
    
    // Error 110200 means domain not configured properly
    if (error?.toString().includes('110200')) {
      setError("Captcha configuration error. Please check domain settings in Cloudflare dashboard.");
    } else {
      setError("Captcha verification failed. Please try again.");
    }
  };

  // Check if Turnstile is configured
  useEffect(() => {
    if (!TURNSTILE_CONFIG.isEnabled()) {
      console.warn('Turnstile not configured properly');
      setCaptchaLoading(false);
      setCaptchaToken('bypass'); // Allow form submission without captcha in dev
    }
  }, []);

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

        {/* Single Turnstile widget for all auth methods */}
        {TURNSTILE_CONFIG.isEnabled() && (
          <Box sx={{ 
            display: "flex", 
            justifyContent: "center",
            height: 0,
            overflow: "hidden"
          }}>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_CONFIG.siteKey}
              onSuccess={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
              options={TURNSTILE_CONFIG.options}
            />
          </Box>
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
              inputRef={magicLinkEmailInputRef}
              InputLabelProps={{
                shrink: shrinkStates.magicLinkEmail || !!magicLinkEmail,
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isLoading || !magicLinkEmail || !captchaToken}
              startIcon={
                (isLoading && submitAction === "magiclink") || (captchaLoading && magicLinkEmail) ? (
                  <CircularProgress size={18} color="inherit" />
                ) : null
              }
              sx={{
                opacity: captchaLoading && magicLinkEmail && !isLoading ? 0.8 : 1,
              }}
            >
              {isLoading && submitAction === "magiclink"
                ? "Sending link..."
                : captchaLoading && magicLinkEmail
                ? "Verifying..."
                : "Send Magic Link"}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setShowMagicLink(false);
                setMagicLinkEmail("");
                setError(null);
                setSuccess(null);
                // Don't reset captcha when just closing magic link form
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
              inputRef={usernameInputRef}
              InputProps={{
                endAdornment: checkingUsername && (
                  <CircularProgress size={20} color="inherit" />
                ),
              }}
              InputLabelProps={{
                shrink: shrinkStates.username || !!username,
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
              inputRef={emailInputRef}
              InputLabelProps={{
                shrink: shrinkStates.email || !!email,
              }}
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
              inputRef={loginUsernameInputRef}
              InputLabelProps={{
                shrink: shrinkStates.loginUsername || !!loginUsername,
              }}
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
            inputRef={passwordInputRef}
            InputLabelProps={{
              shrink: shrinkStates.password || !!password,
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading || !isFormValid() || !captchaToken}
            startIcon={
              (isLoading && submitAction !== "guest") || (captchaLoading && isFormValid()) ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
            sx={{
              opacity: captchaLoading && isFormValid() && !isLoading ? 0.8 : 1,
            }}
          >
            {getButtonText()}
          </Button>
          <Button variant="text" onClick={toggleSignUp} disabled={isLoading}>
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
            disabled={isLoading || !captchaToken}
            startIcon={
              (isLoading && submitAction === "guest") || captchaLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
            sx={{
              opacity: captchaLoading && !isLoading ? 0.8 : 1,
            }}
          >
            {submitAction === "guest" && isLoading
              ? "Continuing..."
              : captchaLoading
              ? "Verifying..."
              : "Continue as Guest"}
          </Button>
        </Box>
        )}
      </Paper>
    </Box>
  );
}
