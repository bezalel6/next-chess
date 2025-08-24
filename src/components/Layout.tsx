import { Box, Fade } from "@mui/material";
import Header from "./Header";
import Footer from "./Footer";
import DevelopmentNotice from "./DevelopmentNotice";
import ConnectionIndicator from "./ConnectionIndicator";
import { BugReportButton, type BugReportButtonRef } from "./BugReportButton";
import { ErrorToast, useErrorToast } from "./ErrorToast";
import type { ReactNode } from "react";
import { useEffect, useState, useRef } from "react";

// ErrorDetails type
interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [mounted, setMounted] = useState(false);
  const bugReportRef = useRef<BugReportButtonRef>(null);
  const { error, hideError } = useErrorToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleReportBug = (errorDetails: unknown) => {
    // Type guard and conversion for error details
    const formattedError: ErrorDetails = {
      message: typeof errorDetails === 'object' && errorDetails !== null && 'message' in errorDetails 
        ? String((errorDetails as { message: unknown }).message)
        : String(errorDetails),
      stack: typeof errorDetails === 'object' && errorDetails !== null && 'stack' in errorDetails 
        ? String((errorDetails as { stack: unknown }).stack)
        : undefined,
      componentStack: typeof errorDetails === 'object' && errorDetails !== null && 'componentStack' in errorDetails 
        ? String((errorDetails as { componentStack: unknown }).componentStack)
        : undefined,
      timestamp: new Date().toISOString(),
    };
    
    bugReportRef.current?.openWithError(formattedError);
    hideError();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        position: "relative",
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
      <ConnectionIndicator position="top-left" />

      <Fade in={mounted} timeout={600}>
        <Box
          component="main"
          sx={{
            flex: "1 0 auto",
            width: "100%",
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
      <BugReportButton ref={bugReportRef} />
      <ErrorToast 
        error={error}
        onClose={hideError}
        onReportBug={handleReportBug}
      />
    </Box>
  );
};

export default Layout;
