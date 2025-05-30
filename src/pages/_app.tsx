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
import Head from "next/head";
import Layout from "@/components/Layout";

export type PageProps = {
  title?: string;
  description?: string;
}

const defaultPageProps: PageProps = {
  description: "Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn",
  title: "Ban Chess"
}
const MyApp: AppType<PageProps> = ({ Component, pageProps }) => {
  return (
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
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ConnectionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default MyApp;
