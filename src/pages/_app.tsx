import { type AppType } from "next/dist/shared/lib/utils";
import { Geist } from "next/font/google";
// these styles must be imported somewhere
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "@/styles/globals.css";
import { GameProvider } from "@/contexts/GameContext";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={geist.className}>
      <GameProvider>
        <Component {...pageProps} />
      </GameProvider>
    </div>
  );
};

export default MyApp;
