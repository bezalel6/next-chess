/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.mjs";

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  // Add dev-only page extension to exclude test routes from prod
  pageExtensions: isDev ? ["ts", "tsx", "js", "jsx", "dev.tsx"] : ["ts", "tsx", "js", "jsx"],
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  // Turbopack configuration (for when using --turbo)
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  webpack: (config, { dev, isServer }) => {
    // Suppress all webpack warnings and verbose logging
    config.infrastructureLogging = {
      level: 'error',  // Only show errors, not warnings or verbose logs
    };
    
    // Minimal stats - suppress warnings and stack traces
    config.stats = {
      ...config.stats,
      logging: 'error',      // Only log errors
      loggingTrace: false,   // Disable stack traces
      errorStack: false,     // Hide error stack traces
      errorDetails: false,   // Hide error details
      warnings: false,       // Don't show warnings
      moduleTrace: false,    // Hide module trace
      performance: false,    // Hide performance warnings
    };
    
    // Disable performance hints
    config.performance = {
      ...config.performance,
      hints: false,  // Disable performance warnings
    };
    
    // Optimize webpack cache for development & prefer fastest devtool
    if (dev && !isServer) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: { config: ['./next.config.mjs'] },
        compression: false, // Disable compression to avoid serialization warnings
        maxMemoryGenerations: 1,
        memoryCacheUnaffected: true,
        name: 'next-chess-client-dev',
        store: 'pack',
        version: '1.0.0',
        // Increase the size limit for serialization warnings
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        profile: false,
        allowCollectingMemory: true
      };
      // Use eval-based source maps for fastest incremental builds
      config.devtool = 'eval';
    }
    
    // For production builds, optimize serialization
    if (!dev) {
      config.cache = {
        type: 'filesystem',
        compression: false, // Avoid serialization warnings
        store: 'pack',
        buildDependencies: {
          config: ['./next.config.mjs'],
        },
      };
    }
    
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.uploadthing.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'accounts.google.com' },
    ],
  },

  // Use modularizeImports at the top-level to avoid invalid experimental warnings in Next 15
  modularizeImports: {
    lodash: { transform: 'lodash/{{member}}' },
    'date-fns': { transform: 'date-fns/{{member}}' },
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
    const isDev = process.env.NODE_ENV !== 'production';
    const connectSrc = [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://challenges.cloudflare.com",
      // Local Supabase (Dev)
      "http://127.0.0.1:54321",
      "ws://127.0.0.1:54321",
      "http://localhost:54321",
      "ws://localhost:54321",
      // Google OAuth endpoints (some SDKs use XHR)
      "https://accounts.google.com",
      "https://*.googleusercontent.com",
      // UploadThing
      "https://*.ingest.uploadthing.com",
      "https://api.uploadthing.com",
    ];
    if (isDev) {
      connectSrc.push("ws://localhost:3000", "ws://127.0.0.1:3000");
    }

    // Scripts: in production, remove unsafe-inline/eval; allow required third-parties
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cdn.jsdelivr.net"
      : "script-src 'self' https://challenges.cloudflare.com https://cdn.jsdelivr.net";

    // Styles: keep 'unsafe-inline' for MUI in both envs (can be tightened later with nonces)
    const styleSrc = "style-src 'self' 'unsafe-inline' https://fonts.cdnfonts.com";

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              styleSrc,
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.cdnfonts.com https://fonts.gstatic.com",
              `connect-src ${connectSrc.join(' ')}`,
              // Allow Google OAuth iframing/popups
              "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://*.googleusercontent.com",
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
