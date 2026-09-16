/**
 * Local smoke test for GET /api/dev-login — exercises the Hono handler
 * in-process (no DB needed: the user lookup is stubbed).
 *
 * Run: npx tsx scripts/smoke-dev-login.ts
 *
 * Covers the gating contract:
 *   1. DEV_LOGIN_KEY unset            → 404 (route does not reveal itself)
 *   2. wrong key / missing key        → 404 (never 403)
 *   3. correct key                    → 302 to /app + signed kimi_sid cookie
 *   4. the issued cookie verifies as a normal session for the stubbed user
 */
import { Hono } from "hono";
import { Session } from "@contracts/constants";
import { createDevLoginHandler } from "../api/dev-login";
import { verifySessionToken } from "../api/kimi/session";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

const STUB_USER = { unionId: "smoke-owner" };

function testApp() {
  // Mirrors the boot.ts wiring: conditional mount + /api/* 404 catch-all.
  const app = new Hono();
  if (process.env.DEV_LOGIN_KEY) {
    app.get("/api/dev-login", createDevLoginHandler({ findLoginUser: async () => STUB_USER }));
  }
  app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));
  return app;
}

async function main() {
  const savedKey = process.env.DEV_LOGIN_KEY;

  // 1. DEV_LOGIN_KEY unset → route not mounted → 404 from the catch-all.
  delete process.env.DEV_LOGIN_KEY;
  let res = await testApp().fetch(new Request("http://localhost/api/dev-login?key=anything"));
  ok(res.status === 404, `DEV_LOGIN_KEY unset → 404 (got ${res.status})`);

  // Also 404 if a build mounted the route unconditionally: handler re-checks env.
  {
    const app = new Hono();
    app.get("/api/dev-login", createDevLoginHandler({ findLoginUser: async () => STUB_USER }));
    res = await app.fetch(new Request("http://localhost/api/dev-login?key=anything"));
    ok(res.status === 404, `handler with env unset → 404 (got ${res.status})`);
  }

  // 2. Wrong / missing key → 404.
  process.env.DEV_LOGIN_KEY = "smoke-secret-key";
  res = await testApp().fetch(new Request("http://localhost/api/dev-login?key=wrong"));
  ok(res.status === 404, `wrong key → 404 (got ${res.status})`);
  res = await testApp().fetch(new Request("http://localhost/api/dev-login"));
  ok(res.status === 404, `missing key → 404 (got ${res.status})`);
  res = await testApp().fetch(new Request("http://localhost/api/dev-login?key=smoke-secret-key&key=wrong"));
  ok(res.status !== 302, `duplicate key params never authenticate (got ${res.status})`);

  // 3. Correct key → 302 + session cookie.
  res = await testApp().fetch(new Request("http://localhost/api/dev-login?key=smoke-secret-key"));
  ok(res.status === 302, `correct key → 302 (got ${res.status})`);
  ok(res.headers.get("location") === "/app", `redirect → /app (got ${res.headers.get("location")})`);
  const setCookieHeader = res.headers.get("set-cookie") ?? "";
  ok(setCookieHeader.startsWith(`${Session.cookieName}=`), `sets ${Session.cookieName} cookie`);
  ok(/httponly/i.test(setCookieHeader), "cookie is HttpOnly");

  // 4. Issued token verifies as a normal session for the stubbed user.
  const token = setCookieHeader.split(";")[0]?.slice(`${Session.cookieName}=`.length);
  const claim = token ? await verifySessionToken(token) : null;
  ok(claim?.unionId === STUB_USER.unionId, `session token verifies for unionId=${STUB_USER.unionId}`);

  if (savedKey === undefined) delete process.env.DEV_LOGIN_KEY;
  else process.env.DEV_LOGIN_KEY = savedKey;

  if (failures) {
    console.error(`\n${failures} dev-login check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll dev-login checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
