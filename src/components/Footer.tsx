import { Box, Typography, Link } from "@mui/material";
import { GitHub } from "@mui/icons-material";

const Footer = () => {
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        py: 2,
        px: 2,
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Made with ❤️ by RNDev
          </Typography>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Link
            href="https://github.com/bezalel6/ban-chess"
            target="_blank"
            rel="noopener noreferrer"
            color="text.secondary"
            sx={{
              display: "flex",
              alignItems: "center",
              "&:hover": { color: "primary.main" },
            }}
          >
            <GitHub fontSize="small" />
          </Link>
        </Box>
        {process.env.BUILD_TIMESTAMP && (
          <Typography variant="caption" color="text.disabled">
            Deployed: {formatTimestamp(process.env.BUILD_TIMESTAMP)}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default Footer;
