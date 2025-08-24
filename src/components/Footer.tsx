import { Box, Typography, Link } from "@mui/material";
import { GitHub } from "@mui/icons-material";

const Footer = () => {
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
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "-8px -16px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",
              borderRadius: 3,
              opacity: 0,
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
            },
            "&:hover::before": {
              opacity: 1,
            },
            "&:hover .github-icon": {
              animation: "tilt 0.3s ease-in-out",
            },
            "@keyframes tilt": {
              "0%, 100%": { transform: "rotate(0deg) scale(1)" },
              "50%": { transform: "rotate(15deg) scale(1.05)" },
            },
          }}
        >
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 500,
              fontSize: "0.75rem",
              transition: "all 0.3s ease",
            }}
          >
            Made by{" "}
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 600,
                fontSize: "1em",
              }}
            >
              RNDev
            </Box>
          </Typography>
          <Link
            href="https://github.com/bezalel6/ban-chess"
            target="_blank"
            rel="noopener noreferrer"
            color="text.secondary"
            className="github-icon"
            sx={{
              display: "flex",
              alignItems: "center",
              transition: "color 0.3s ease",
              "&:hover": { 
                color: "primary.main",
              },
            }}
            title="View on GitHub"
          >
            <GitHub fontSize="small" />
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default Footer;
