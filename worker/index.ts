/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getCitySnapshot } from "../lib/city-data";
import type { RealtimeMessage, RealtimeMetricUpdate } from "../lib/types";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  REPORTS: R2Bucket;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const realtimeClients = new Set<WebSocket>();

export function broadcastRealtime(message: RealtimeMessage) {
  const serialized = JSON.stringify(message);
  for (const client of realtimeClients) {
    try {
      if (client.readyState === 1) client.send(serialized);
      else realtimeClients.delete(client);
    } catch {
      realtimeClients.delete(client);
    }
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/realtime") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return Response.json({ error: "Expected WebSocket upgrade" }, { status: 426 });
      }

      // `vinext start` runs in Node where Cloudflare's WebSocketPair is absent.
      // The client then intentionally falls back to the 5-second HTTP poller.
      if (typeof WebSocketPair === "undefined") {
        return Response.json({ error: "Realtime unavailable; use snapshot polling" }, { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      realtimeClients.add(server);
      const send = (message: RealtimeMessage) => {
        if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify(message));
      };
      ctx.waitUntil(
        getCitySnapshot()
          .then((snapshot) => send({ type: "snapshot", payload: snapshot }))
          .catch(() => server.close(1011, "Snapshot unavailable")),
      );
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", payload: { at: new Date().toISOString() } });
      }, 20_000);
      server.addEventListener("message", (event) => {
        if (event.data === "ping") send({ type: "heartbeat", payload: { at: new Date().toISOString() } });
      });
      const cleanup = () => {
        clearInterval(heartbeat);
        realtimeClients.delete(server);
      };
      server.addEventListener("close", cleanup);
      server.addEventListener("error", cleanup);
      return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const scenarioRun = request.method === "POST" ? url.pathname.match(/^\/api\/scenarios\/([^/]+)\/run$/) : null;
    if (scenarioRun) {
      broadcastRealtime({ type: "scenario.progress", payload: { scenarioId: scenarioRun[1], progress: 10 } });
    }

    const response = await handler.fetch(request, env, ctx);
    if (response.ok && request.method !== "GET") {
      ctx.waitUntil((async () => {
        try {
          const body = await response.clone().json() as Record<string, unknown>;
          if (url.pathname === "/api/admin/metrics" && body.metric) {
            broadcastRealtime({ type: "metric.update", payload: body.metric as RealtimeMetricUpdate });
          }
          if (url.pathname === "/api/admin/events" && body.event && request.method === "POST") {
            const event = body.event as Extract<RealtimeMessage, { type: "event.created" }>["payload"];
            broadcastRealtime({ type: "event.created", payload: { ...event, updatedAt: event.updatedAt ?? new Date().toISOString() } });
          }
          if (scenarioRun) {
            broadcastRealtime({ type: "scenario.progress", payload: { scenarioId: scenarioRun[1], progress: 100 } });
          }
        } catch {
          // A failed notification never affects the primary API response.
        }
      })());
    }
    return response;
  },
};

export default worker;
