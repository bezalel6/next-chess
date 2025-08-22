// server.ts
import { createServer } from "http";
import next from "next";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../env";

const dev = env.NODE_ENV !== "production";
const hostname = (process.env.HOST as string) || "0.0.0.0"; // listen on all interfaces by default
const port = Number(process.env.PORT || env.PORT) || 3000;

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
  console.log(`${signal} received, shutting down...`);

  try {
    if (queueChannel) {
      await queueChannel.untrack();
      await supabase.removeChannel(queueChannel);
    }
  } catch (e) {
    console.warn("Error cleaning up realtime channel:", e);
  }

  try {
    await supabase.removeAllChannels();
  } catch (e) {
    console.warn("Error closing supabase client:", e);
  }

  if (server) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("Force exiting after 5s timeout");
        resolve();
      }, 5000);
      server!.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
