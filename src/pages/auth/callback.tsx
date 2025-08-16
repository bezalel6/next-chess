import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";
import { supabaseBrowser } from "@/utils/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'creating' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have a code in the URL (OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          // Exchange the code for a session (OAuth flow)
          const { error: exchangeError } = await supabaseBrowser().auth.exchangeCodeForSession(window.location.href);
          
          if (exchangeError) {
            console.error("Code exchange error:", exchangeError);
            setStatus('error');
            setErrorMessage('Authentication failed. Please try again.');
            setTimeout(() => router.push("/auth/login?error=auth_failed"), 2000);
            return;
          }
        }

        // Get the session (works for both OAuth and email confirmation)
        const { data: { session }, error: sessionError } = await supabaseBrowser().auth.getSession();
        
        if (sessionError || !session) {
          console.error("Session error:", sessionError);
          setStatus('error');
          setErrorMessage('Failed to establish session. Please try again.');
          setTimeout(() => router.push("/auth/login?error=session_failed"), 2000);
          return;
        }

        // Check if profile exists
        const userId = session.user.id;
        const { data: profile, error: profileError } = await supabaseBrowser()
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Profile check error:", profileError);
          // Non-critical error, proceed anyway
        }

        if (!profile) {
          // Profile doesn't exist, create it
          setStatus('creating');
          
          // Get username from metadata or email
          const username = session.user.user_metadata?.username || 
                          session.user.email?.split('@')[0] || 
                          `user_${userId.slice(0, 8)}`;
          
          // Create the profile
          const { error: createError } = await supabaseBrowser()
            .from('profiles')
            .insert({
              id: userId,
              username: username,
              email: session.user.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (createError) {
            // Profile might already exist (race condition) or other error
            console.warn("Profile creation error (may be harmless):", createError);
            // Continue anyway - the webhook might have created it
          }
        }

        // Success - redirect to home
        router.push("/");
        
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
        setTimeout(() => router.push("/auth/login?error=unexpected"), 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 2,
        padding: 2,
      }}
    >
      {status === 'error' ? (
        <>
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            {errorMessage}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Redirecting to login...
          </Typography>
        </>
      ) : (
        <>
          <CircularProgress />
          <Typography variant="h6">
            {status === 'creating' ? 'Setting up your profile...' : 'Verifying authentication...'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait a moment
          </Typography>
        </>
      )}
    </Box>
  );
}