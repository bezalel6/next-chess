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


const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Head>
        {/* Open Graph meta tags for social sharing */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ban Chess" />
        <meta property="og:image" content="/logo.png" />
        <meta property="og:image:alt" content="Ban Chess Logo" />

        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/logo.png" />
      </Head>
      <AuthProvider>
        <ConnectionProvider>
          <div className={''}>
            <Component {...pageProps} />
          </div>
        </ConnectionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default MyApp;
