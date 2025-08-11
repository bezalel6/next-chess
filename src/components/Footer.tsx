import { Box, Typography, Link, Container } from "@mui/material";
import { GitHub, LinkedIn, Email } from "@mui/icons-material";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 3,
        px: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              © {currentYear} BanChess
            </Typography>
            <Typography variant="body2" color="text.secondary">
              •
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Made with ❤️ by RNDev
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Link
              href="https://github.com/bezalel6/ban-chess"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              sx={{
                display: "flex",
                alignItems: "center",
                "&:hover": { color: "primary.main" },
              }}
            >
              <GitHub fontSize="small" />
            </Link>
            <Link
              href="#"
              color="inherit"
              sx={{
                display: "flex",
                alignItems: "center",
                "&:hover": { color: "primary.main" },
              }}
            >
              <LinkedIn fontSize="small" />
            </Link>
            <Link
              href="mailto:contact@nextchess.com"
              color="inherit"
              sx={{
                display: "flex",
                alignItems: "center",
                "&:hover": { color: "primary.main" },
              }}
            >
              <Email fontSize="small" />
            </Link>
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Link
              href="/privacy"
              color="text.secondary"
              underline="hover"
              variant="body2"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              color="text.secondary"
              underline="hover"
              variant="body2"
            >
              Terms
            </Link>
            <Link
              href="/about"
              color="text.secondary"
              underline="hover"
              variant="body2"
            >
              About
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
