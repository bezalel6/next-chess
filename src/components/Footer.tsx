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
    </Box>
  );
};

export default Footer;
