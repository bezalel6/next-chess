// server.ts
import { createServer } from "http";
import next from "next";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../env";
import { spawn } from "child_process";

const dev = env.NODE_ENV !== "production";
const hostname = (process.env.HOST as string) || "0.0.0.0"; // listen on all interfaces by default
const port = Number(process.env.PORT || env.PORT) || 3000;

// Track if we're already shutting down to prevent multiple shutdown attempts
let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

// Polyfill WebSocket for Node.js runtime (required by supabase-js realtime)
// If ws isn't installed, this import will fail at build/runtime.
(globalThis as any).WebSocket = WebSocket as any;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Supabase client with service role
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
);

let server: ReturnType<typeof createServer> | undefined;
let queueChannel: RealtimeChannel | undefined;

async function start() {
  await app.prepare();

  queueChannel = supabase.channel("queue-system", {
    config: { presence: { key: "user_id" } },
  });

  queueChannel
    .on("presence", { event: "sync" }, () => {
      try {
        const presenceState = queueChannel!.presenceState();
        const queue = Object.values(presenceState).flat() as unknown as Array<{
          user_id: string;
          joined_at: string;
        }>;

        const filteredQueue = queue.filter((e) => e.user_id !== "server");
        filteredQueue.sort(
          (a, b) =>
            new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
        );

        console.debug("[Server Queue] Sync", {
          queueSize: filteredQueue.length,
        });
      } catch (error) {
        console.error("[Server Queue] Error processing queue:", error);
      }
    })
    .on("presence", { event: "join" }, (payload) => {
      console.log("[Server Queue] Presence join:", payload);
    })
    .on("presence", { event: "leave" }, (payload) => {
      console.log("[Server Queue] Presence leave:", payload);
    })
    .on("system", { event: "error" }, (error) => {
      console.error("[Server Queue] Channel error:", error);
    });

  await queueChannel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.log("[Server Queue] Subscribed");
      queueChannel!.track({
        user_id: "server",
        joined_at: new Date().toISOString(),
      });
    } else if (status === "CHANNEL_ERROR") {
      console.error("[Server Queue] Channel error");
    }
    if (err) {
      console.error("[Server Queue] Subscribe error:", err);
    }
  });

  server = createServer((req, res) => {
    // Let Next.js parse the URL itself to avoid edge cases with absolute URLs
    handle(req, res);
  });

  // Optional: tune keep-alive to avoid ECONNRESET on deploy restarts
  server.keepAliveTimeout = 75_000;
  server.headersTimeout = 76_000;

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

async function shutdown(signal: string) {
  // Prevent multiple simultaneous shutdowns
  if (isShuttingDown) {
    console.log(`Already shutting down, ignoring ${signal}`);
    return shutdownPromise;
  }
  
  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  shutdownPromise = (async () => {
    // Step 1: Stop accepting new connections immediately
    if (server) {
      try {
        server.close();
        server.closeAllConnections();
      } catch (e) {
        console.warn("Error closing server:", e);
      }
    }

    // Step 2: Clean up Supabase channels
    try {
      if (queueChannel) {
        await queueChannel.untrack();
        await supabase.removeChannel(queueChannel);
      }
      await supabase.removeAllChannels();
    } catch (e) {
      console.warn("Error cleaning up realtime channels:", e);
    }

    // Step 3: Close Next.js app
    try {
      await app.close();
    } catch (e) {
      console.warn("Error closing Next.js app:", e);
    }

    // Step 4: Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 5: Force kill any remaining child processes on Windows
    if (process.platform === 'win32') {
      try {
        // Kill all child processes spawned by this process
        const { execSync } = require('child_process');
        execSync(`wmic process where "ParentProcessId=${process.pid}" delete`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore errors, this is best effort
      }
    }

    // Step 6: Exit with appropriate code
    process.exit(0);
  })();

  // Set a hard timeout for shutdown
  setTimeout(() => {
    console.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 3000);

  return shutdownPromise;
}

// Handle all termination signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

// Handle Windows-specific signals
if (process.platform === "win32") {
  // Windows doesn't have SIGTERM/SIGINT in the same way
  // But we can catch the console close event
  process.on("SIGBREAK", () => shutdown("SIGBREAK"));
  
  // Also handle uncaught exceptions more aggressively
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    shutdown("UNCAUGHT_EXCEPTION");
  });
}

// Prevent orphaned processes when parent dies
process.on("disconnect", () => {
  console.log("Parent process disconnected, shutting down...");
  shutdown("DISCONNECT");
});

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
