import { Box, Fade } from "@mui/material";
import Header from "./Header";
import Footer from "./Footer";
import DevelopmentNotice from "./DevelopmentNotice";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background pattern overlay */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -2,
          opacity: 0.03,
          backgroundImage: `
                        radial-gradient(circle at 25% 25%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 70%)
                    `,
          animation: "float 20s ease-in-out infinite",
          "@keyframes float": {
            "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
            "50%": { transform: "translateY(-20px) rotate(180deg)" },
          },
        }}
      />

      <Header />

      <Fade in={mounted} timeout={600}>
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            position: "relative",
            // Enhanced scrollbar styling
            "&::-webkit-scrollbar": {
              width: "12px",
            },
            "&::-webkit-scrollbar-track": {
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              border: "2px solid transparent",
              backgroundClip: "padding-box",
              transition: "all 0.3s ease",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "rgba(255, 255, 255, 0.2)",
            },
            // Smooth scroll physics
            scrollBehavior: "smooth",
          }}
        >
          {children}
        </Box>
      </Fade>
      <DevelopmentNotice />
      <Footer />
    </Box>
  );
};

export default Layout;
