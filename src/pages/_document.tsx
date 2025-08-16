import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnect to font CDN for faster loading */}
        <link rel="preconnect" href="https://fonts.cdnfonts.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://fonts.cdnfonts.com" />
        
        {/* Preload actual font file */}
        <link
          rel="preload"
          href="https://fonts.cdnfonts.com/s/17796/digital-7 (mono).woff"
          as="font"
          type="font/woff"
          crossOrigin=""
        />
        
        {/* Load CSS with proper non-blocking technique */}
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/digital-7-mono"
          media="print"
          onLoad={(e) => { (e.currentTarget as HTMLLinkElement).media = 'all'; }}
        />
        <noscript>
          <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/digital-7-mono" />
        </noscript>
        
        {/* Inline critical font CSS with proper sources */}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --font-digital-7-mono: 'Digital-7 Mono', 'Courier New', monospace;
            }
            /* Optimized @font-face with proper fallback */
            @font-face {
              font-family: 'Digital-7 Mono';
              font-style: normal;
              font-weight: 400;
              font-display: swap;
              src: local('Digital-7 Mono'),
                   url('https://fonts.cdnfonts.com/s/17796/digital-7 (mono).woff') format('woff');
            }
          `
        }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}