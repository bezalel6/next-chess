import Head from "next/head";
import styles from "./index.module.css";
import ConnectionStatus from "@/components/connection-status";

export default function Home() {
  return (
    <>
      <Head>
        <title>Chess 2.0</title>
        <meta name="description" content="Play chess online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            Chess<span className={styles.pinkSpan}>2.0</span>
          </h1>
          <ConnectionStatus />
        </div>
      </main>
    </>
  );
}

