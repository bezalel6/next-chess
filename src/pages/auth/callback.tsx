import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";
import { supabaseBrowser } from "@/utils/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "creating" | "error">(
    "verifying"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const sb = supabaseBrowser();

        // 1) Handle possible parameters from both query (?code=...) and hash (#access_token=...)
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const type = searchParams.get("type"); // e.g., signup, recovery, magiclink
        const tokenHash = searchParams.get("token_hash") || searchParams.get("token");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");

        if (errorDesc) {
          console.error("Auth provider returned error:", errorDesc);
          setStatus("error");
          setErrorMessage("Authentication was cancelled or failed. Please try again.");
          setTimeout(() => router.push("/auth/login?error=provider_error"), 2000);
          return;
        }

        // 2) Establish a session based on what we received
        // First preference: if a PKCE code exists and we have a verifier, exchange it (even if `type` is present).
        const hasPkceVerifier = (() => {
          try {
            if (typeof window === 'undefined') return false;
            return !!(localStorage.getItem('sb-pkce-code-verifier') || document.cookie.includes('sb-pkce-code-verifier='));
          } catch {
            return false;
          }
        })();

        if (code && hasPkceVerifier) {
          const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Code exchange error:", exchangeError);
            setStatus("error");
            setErrorMessage("Authentication failed. Please try again.");
            setTimeout(() => router.push("/auth/login?error=auth_failed"), 2000);
            return;
          }
        } else if ((type === 'signup' || type === 'magiclink') && tokenHash && !accessToken) {
          // Email confirmation or magic link redirect with token hash (no tokens in hash)
          const { error: verifyError } = await sb.auth.verifyOtp({
            type: type === 'signup' ? 'signup' : 'magiclink',
            token_hash: tokenHash,
          });
          if (verifyError) {
            console.error("verifyOtp failed:", verifyError);
            setStatus("error");
            setErrorMessage("Verification failed. Please try again.");
            setTimeout(() => router.push("/auth/login?error=verify_failed"), 2000);
            return;
          }
        } else if (accessToken && refreshToken) {
          // Magic link / email confirmation flow delivers tokens in the URL hash
          const { error: setError } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setError) {
            console.error("Setting session from hash failed:", setError);
            setStatus("error");
            setErrorMessage("Failed to establish session. Please try again.");
            setTimeout(() => router.push("/auth/login?error=session_set_failed"), 2000);
            return;
          }
        }

        // 3) Now confirm we actually have a session
        const {
          data: { session },
          error: sessionError,
        } = await sb.auth.getSession();

        // Clean the URL only after we have attempted to set a session
        if (window.location.search || window.location.hash) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        if (sessionError || !session) {
          console.error("Session error:", sessionError);
          setStatus("error");
          setErrorMessage("Failed to establish session. Please try again.");
          setTimeout(() => router.push("/auth/login?error=session_failed"), 2000);
          return;
        }

        // 5) Ensure a profile exists (webhook usually creates it; this is a safety net)
        const userId = session.user.id;
        const { data: profile, error: profileError } = await sb
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          console.warn("Profile check error (non-fatal):", profileError);
        }

        if (!profile) {
          setStatus("creating");

          const username =
            (session.user.user_metadata as Record<string, unknown>)?.username as string ||
            session.user.email?.split("@")[0] ||
            `user_${userId.slice(0, 8)}`;

          const { error: upsertError } = await sb
            .from("profiles")
            .upsert(
              {
                id: userId,
                username: username,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id', ignoreDuplicates: true }
            );

          if (upsertError) {
            // If a conflict happens on unique username, webhook likely created it already; proceed
            console.warn("Profile upsert warning (may be harmless):", upsertError);
          }
        }

        // 6) Success - redirect to home
        router.push("/");
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
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
      {status === "error" ? (
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
            {status === "creating"
              ? "Setting up your profile..."
              : "Verifying authentication..."}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait a moment
          </Typography>
        </>
      )}
    </Box>
  );
}
