import { type AppType } from "next/dist/shared/lib/utils";
// these styles must be imported somewhere
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "@/styles/globals.css";
import type { AppProps } from 'next/app';
import { ConnectionProvider } from '@/contexts/ConnectionContext';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { AuthProvider } from "@/contexts/AuthContext";
import { GameProvider } from "@/contexts/GameContextV2";
import Head from "next/head";
import Layout from "@/components/Layout";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export type PageProps = {
  title?: string;
  description?: string;
}

const defaultPageProps: PageProps = {
  description: "Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn",
  title: "Ban Chess"
}
const MyApp: AppType<PageProps> = ({ Component, pageProps }) => {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 10, // 10 seconds
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Head>
        <title>{pageProps.title || defaultPageProps.title}</title>
        <meta name="description" content={pageProps.description || defaultPageProps.description} />
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
        <ConnectionProvider>
          <GameProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </GameProvider>
        </ConnectionProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </ThemeProvider>
    </QueryClientProvider>
  );
};

export default MyApp;
