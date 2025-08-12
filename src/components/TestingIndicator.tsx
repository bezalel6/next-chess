import { useEffect, useState } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { Warning, CheckCircle, Error } from "@mui/icons-material";

interface TestStatus {
  testAuthEnabled: boolean;
  serviceRoleAvailable: boolean;
  supabaseUrl: string;
}

export default function TestingIndicator() {
  const [status, setStatus] = useState<TestStatus | null>(null);

  useEffect(() => {
    // Check if test auth is enabled
    const testAuthEnabled = process.env.NEXT_PUBLIC_USE_TEST_AUTH === "true";

    if (testAuthEnabled) {
      // Check service role availability
      fetch("/api/test/status")
        .then((res) => res.json())
        .then((data) => {
          setStatus({
            testAuthEnabled: true,
            serviceRoleAvailable: data.serviceRoleAvailable,
            supabaseUrl: data.supabaseUrl,
          });
        })
        .catch(() => {
          setStatus({
            testAuthEnabled: true,
            serviceRoleAvailable: false,
            supabaseUrl: "unknown",
          });
        });
    }
  }, []);

  // Only show in development/test mode
  if (!status?.testAuthEnabled) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 100,
        right: 16,
        zIndex: 9999,
        bgcolor: "rgba(255, 165, 0, 0.1)",
        border: "2px solid orange",
        borderRadius: 2,
        p: 2,
        maxWidth: 320,
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        opacity: 0.7,
        pointerEvents: "none",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Warning sx={{ color: "orange", mr: 1 }} />
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: "bold", color: "orange" }}
        >
          TEST MODE
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<CheckCircle />}
            label="Test Auth Enabled"
            size="small"
            color="success"
            variant="outlined"
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {status.serviceRoleAvailable ? (
            <Chip
              icon={<CheckCircle />}
              label="Service Role Available"
              size="small"
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              icon={<Error />}
              label="Service Role Missing"
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Box>

        <Typography variant="caption" sx={{ color: "#888", mt: 1 }}>
          • Captcha bypassed for auth operations
          <br />
          • Using test endpoint: /api/test/auth
          <br />• Supabase:{" "}
          {status.supabaseUrl?.replace("https://", "").split(".")[0]}
        </Typography>
        <Typography variant="h5">
          IF YOU ARE SEEING THIS: YOU ARE NOT.
        </Typography>
        <Typography variant="subtitle2">
          but haha lol please contact me like right now
        </Typography>
      </Box>
    </Box>
  );
}
