import { useEffect } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography } from "@mui/material";
import { supabaseBrowser } from "@/utils/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have a session
        const { data: { session }, error } = await supabaseBrowser().auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          router.push("/auth/login?error=auth_failed");
          return;
        }

        if (session) {
          // Wait for profile to be created by the Auth webhook (edge function)
          const userId = session.user.id;
          let attempts = 0;
          const maxAttempts = 10;
          const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

          while (attempts < maxAttempts) {
            const { data: profile, error: profileError } = await supabaseBrowser()
              .from('profiles')
              .select('username')
              .eq('id', userId)
              .maybeSingle();

            if (profile && profile.username) {
              router.push("/");
              return;
            }

            // If there's a query error, break and fallback to home
            if (profileError) {
              console.warn('Profile check error in callback:', profileError);
              break;
            }

            attempts += 1;
            await delay(500);
          }

          // Fallback: proceed to home even if profile isn't found yet
          router.push("/");
        } else {
          // No session, redirect to login
          router.push("/auth/login");
        }
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        router.push("/auth/login?error=unexpected");
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
      }}
    >
      <CircularProgress />
      <Typography variant="h6">Verifying authentication...</Typography>
    </Box>
  );
}