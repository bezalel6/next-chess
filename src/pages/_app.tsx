import { type AppType } from "next/dist/shared/lib/utils";
// these styles must be imported somewhere
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/theme";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Head from "next/head";
import Layout from "@/components/Layout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { HeartbeatProvider } from "@/components/HeartbeatProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import dynamic from "next/dynamic";
import { env } from "@/env.mjs";
import { digital7Mono } from "@/lib/fonts";

export type PageProps = {
  title?: string;
  description?: string;
};

const defaultPageProps: PageProps = {
  description:
    "Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn",
  title: "Ban Chess",
};

// Load RQ Devtools only if explicitly enabled via env and only on client
const ReactQueryDevtools = env.NEXT_PUBLIC_ENABLE_RQ_DEVTOOLS === "1"
  ? dynamic(() => import("@tanstack/react-query-devtools").then(m => m.ReactQueryDevtools), { ssr: false })
  : (() => null as any);

const MyApp: AppType<PageProps> = ({ Component, pageProps }) => {
  useEffect(() => {
    // Only enable react-scan when explicitly toggled via env and in the browser
    if (env.NEXT_PUBLIC_ENABLE_REACT_SCAN === "1" && typeof window !== "undefined") {
      import("react-scan/all-environments").then(({ scan }) => {
        scan({ enabled: true, log: false });
      }).catch(() => {});
    }
  }, []);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 10,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className={digital7Mono.variable}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Head>
              <title>{pageProps.title || defaultPageProps.title}</title>
              <meta
                name="description"
                content={pageProps.description || defaultPageProps.description}
              />
              {/* Open Graph meta tags for social sharing */}
              <meta property="og:type" content="website" />
              <meta property="og:site_name" content="Ban Chess" />
              <meta property="og:image" content="/logo.png" />
              <meta property="og:image:alt" content="Ban Chess Logo" />

              {/* Twitter Card meta tags */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:image" content="/logo.png" />
              <link rel="icon" href="/logo.png" />
            </Head>
            <AuthProvider>
              <NotificationProvider>
                <HeartbeatProvider>
                  <ConnectionProvider>
                    <Layout>
                      <Component {...pageProps} />
                    </Layout>
                  </ConnectionProvider>
                </HeartbeatProvider>
              </NotificationProvider>
            </AuthProvider>
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </ThemeProvider>
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default MyApp;
