import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>{/* All fonts are self-hosted via next/font/local */}</Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
