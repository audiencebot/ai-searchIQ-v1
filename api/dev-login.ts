import crypto from "node:crypto";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { asc } from "drizzle-orm";
import { users } from "@db/schema";
import { Session } from "@contracts/constants";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { signSessionToken } from "./kimi/session";
import { getDb } from "./queries/connection";
import { findUserByUnionId } from "./queries/users";

/**
 * LOCAL DEV KIT — env-gated dev login (OFF by default).
 *
 * Active ONLY when process.env.DEV_LOGIN_KEY is set; GET /api/dev-login?key=<key>
 * must match it exactly (constant-time compare). Every mismatch returns 404 —
 * never 403 — so the route's existence is not revealed when disabled or probed.
 * Never set DEV_LOGIN_KEY on the deployed platform.
 *
 * On match, signs a normal session JWT (same shape as the Kimi OAuth callback)
 * for the owner user and redirects into the portal. ?tenant=<id> is accepted
 * for forward compatibility and echoed in the audit log; the session itself is
 * user-scoped and the tenant is resolved via tenant_members as usual.
 */

/** Constant-time key compare; sha256 digests normalize length so timingSafeEqual never throws. */
function keyMatches(provided: string, configured: string): boolean {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(configured).digest();
  return crypto.timingSafeEqual(a, b);
}

export interface DevLoginDeps {
  /** Resolve the local user to sign in as. Injectable for in-process smoke tests. */
  findLoginUser?: () => Promise<{ unionId: string } | undefined>;
}

/** Owner user (OWNER_UNION_ID) first; falls back to the first user in the DB. */
async function defaultFindLoginUser() {
  if (env.ownerUnionId) {
    const owner = await findUserByUnionId(env.ownerUnionId);
    if (owner) return owner;
  }
  const rows = await getDb().select().from(users).orderBy(asc(users.id)).limit(1);
  return rows.at(0);
}

export function createDevLoginHandler(deps: DevLoginDeps = {}) {
  const findLoginUser = deps.findLoginUser ?? defaultFindLoginUser;
  return async (c: Context) => {
    const configured = process.env.DEV_LOGIN_KEY;
    const provided = c.req.queries("key") ?? [];

    // Exactly one key param, exact (constant-time) match — anything else 404s.
    if (!configured || provided.length !== 1 || !keyMatches(provided[0], configured)) {
      return c.json({ error: "Not Found" }, 404);
    }

    const user = await findLoginUser();
    if (!user) {
      console.error(
        "[dev-login] Key matched but the local DB has no users — run `npx tsx scripts/local-db-setup.ts` first.",
      );
      return c.json({ error: "No users in local database" }, 500);
    }

    const token = await signSessionToken({
      unionId: user.unionId,
      clientId: env.appId,
    });
    const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
    setCookie(c, Session.cookieName, token, {
      ...cookieOpts,
      maxAge: Session.maxAgeMs / 1000,
    });

    const tenant = c.req.query("tenant");
    console.warn(
      `[dev-login] Issued dev session for unionId=${user.unionId}${tenant ? ` (tenant=${tenant})` : ""} — DEV ONLY, never enable in production.`,
    );
    return c.redirect("/app", 302);
  };
}
