import Head from "next/head";
import styles from "./index.module.css";
import LichessBoard from "@/components/lichess-board";

export default function Home() {
  return (
    <>
      <Head>
        <title>Next Chess</title>
        <meta name="description" content="Play chess online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            Next<span className={styles.pinkSpan}>Chess</span>
          </h1>
          <div className={styles.chessContainer}>
            <LichessBoard />
          </div>
        </div>
      </main>
    </>
  );
}

