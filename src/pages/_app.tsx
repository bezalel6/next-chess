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


const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConnectionProvider>
        <div className={''}>
          <Component {...pageProps} />
        </div>
      </ConnectionProvider>
    </ThemeProvider>
  );
};

export default MyApp;
