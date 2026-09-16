import { useState } from "react";
import type { FormEvent } from "react";

/**
 * LOCAL DEV KIT — dev login page.
 *
 * Submits the dev key to GET /api/dev-login, which only exists when the server
 * was started with DEV_LOGIN_KEY set (see docs/LOCAL_DEV.md). A wrong or unset
 * key returns a plain 404 — the route never reveals itself.
 */
export default function DevLogin() {
  const [key, setKey] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!key) return;
    window.location.assign(`/api/dev-login?key=${encodeURIComponent(key)}`);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#07161D] px-4">
      <div className="w-full max-w-sm rounded-[2px] border border-[#BDEAFF]/20 bg-[#07161D] p-8 shadow-[0_0_60px_rgba(189,234,255,0.06)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#BDEAFF]/70">
          AI Search IQ · Local Dev Kit
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#BDEAFF]">
          Developer sign-in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#BDEAFF]/60">
          Enter the dev key to sign in locally as the owner and land in the
          Northwind Advisory portal.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#BDEAFF]/70">
              Dev key
            </span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              placeholder="DEV_LOGIN_KEY"
              className="w-full rounded-[2px] border border-[#BDEAFF]/25 bg-transparent px-3 py-2.5 text-sm text-[#BDEAFF] placeholder:text-[#BDEAFF]/30 focus:border-[#BDEAFF] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!key}
            className="w-full rounded-[2px] bg-[#BDEAFF] px-4 py-2.5 text-sm font-semibold text-[#07161D] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sign in to portal
          </button>
        </form>

        <p className="mt-6 border-t border-[#BDEAFF]/10 pt-4 text-xs leading-relaxed text-[#BDEAFF]/45">
          This page only works when <code className="text-[#BDEAFF]/70">DEV_LOGIN_KEY</code>{" "}
          is configured on the server — it is for local development and must
          never be enabled on the deployed platform.
        </p>
      </div>
    </div>
  );
}
