/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack cache for development
    if (dev && !isServer) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [import.meta.url]
        },
        // Reduce memory overhead by using smaller cache chunks
        compression: 'gzip',
        // Store cache entries more efficiently
        maxMemoryGenerations: 1,
        // Use a more efficient serialization strategy
        memoryCacheUnaffected: true,
        name: 'next-chess-client-dev',
        // Reduce the threshold for what's considered "big"
        // This helps webpack use more efficient serialization
        store: 'pack',
        version: '1.0.0'
      };
    }
    return config;
  },

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  async rewrites() {
    return [
      {
        source: "/@:username",
        destination: "/users/:username",
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com http://127.0.0.1:54321 ws://127.0.0.1:54321 http://localhost:54321 ws://localhost:54321",
              "frame-src 'self' https://challenges.cloudflare.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          }
        ]
      }
    ];
  },
};

export default config;
