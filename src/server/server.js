// server.js - Compiled production server
// This file should be generated from server.ts during build
const { createServer } = require("http");
const next = require("next");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

// Load environment variables
require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

// Track if we're already shutting down to prevent multiple shutdown attempts
let isShuttingDown = false;
let shutdownPromise = null;

// Polyfill WebSocket for Node.js runtime
global.WebSocket = WebSocket;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let server;
let queueChannel;

async function start() {
  await app.prepare();

  queueChannel = supabase.channel("queue-system", {
    config: { presence: { key: "user_id" } },
  });

  queueChannel
    .on("presence", { event: "sync" }, () => {
      try {
        const presenceState = queueChannel.presenceState();
        const queue = Object.values(presenceState).flat();

        const filteredQueue = queue.filter((e) => e.user_id !== "server");
        const queueSize = filteredQueue.length;
        console.log("[Server Queue] Sync", { queueSize });
      } catch (error) {
        console.error("[Server Queue] Error syncing presence:", error);
      }
    })
    .on("presence", { event: "join" }, (payload) => {
      console.log("[Server Queue] Presence join:", payload);
    })
    .on("presence", { event: "leave" }, (payload) => {
      console.log("[Server Queue] Presence leave:", payload);
    });

  await queueChannel.subscribe((status) => {
    console.log("[Server Queue] Subscribed");
  });

  // Track ourselves in the server presence
  await queueChannel.track({
    user_id: "server",
    online_at: new Date().toISOString(),
  });

  server = createServer((req, res) => {
    handle(req, res);
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Set up cleanup handlers
  setupCleanupHandlers();
}

function setupCleanupHandlers() {
  const cleanup = async (signal) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
      return shutdownPromise;
    }

    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
    isShuttingDown = true;

    shutdownPromise = (async () => {
      try {
        // Untrack from queue presence
        if (queueChannel) {
          console.log("[Shutdown] Untracking from queue presence...");
          await queueChannel.untrack();
          await queueChannel.unsubscribe();
        }

        // Close HTTP server
        if (server) {
          console.log("[Shutdown] Closing HTTP server...");
          await new Promise((resolve, reject) => {
            server.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }

        console.log("[Shutdown] Cleanup complete");
        process.exit(0);
      } catch (error) {
        console.error("[Shutdown] Error during cleanup:", error);
        process.exit(1);
      }
    })();

    return shutdownPromise;
  };

  // Handle various termination signals
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGUSR2", () => cleanup("SIGUSR2")); // Nodemon restart

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[Server] Uncaught exception:", error);
    cleanup("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Server] Unhandled rejection at:", promise, "reason:", reason);
    cleanup("unhandledRejection");
  });
}

// Start the server
start().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});