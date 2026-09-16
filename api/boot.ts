import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { createGoogleOAuthCallbackHandler } from "./google-callback";
import { GOOGLE_CALLBACK_PATH } from "./services/google";
import { crawlerVisitIngestHandler } from "./ingest";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.get(GOOGLE_CALLBACK_PATH, createGoogleOAuthCallbackHandler());
// AI Channel Analytics log-drain ingest (token-authed, outside tRPC).
app.post("/api/ingest/crawler-visit", crawlerVisitIngestHandler);
// Local dev kit — env-gated dev login. OFF unless DEV_LOGIN_KEY is set.
// Mounted before tRPC auth and the /api/* 404 catch-all.
if (process.env.DEV_LOGIN_KEY) {
  const { createDevLoginHandler } = await import("./dev-login");
  app.get("/api/dev-login", createDevLoginHandler());
}
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
