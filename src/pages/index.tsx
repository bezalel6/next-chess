import Head from "next/head";
import styles from "./index.module.css";
import Board from "../components/board";

export default function Home() {
  return (
    <>
      <Head>
        <title>Next Chess</title>
        <meta name="description" content="Play chess online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <Board />
      </main >
    </>
  );
}
