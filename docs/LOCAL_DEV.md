# Local Development Guide (Windows)

Run the full AI Search IQ app — React frontend **and** API — on your PC with a
disposable local database. No Kimi OAuth or platform network access needed.

> **Source of truth:** the preview/version card on kimi.com remains the
> deployed source of truth. Your local database is a disposable sandbox —
> break it, drop it, recreate it freely. **`npm run db:push` must NEVER be
> pointed at the platform `DATABASE_URL`** (the `*.privatelink.aliyuncs.com`
> host in the shared `.env`). `scripts/local-db-setup.ts` hard-refuses that
> host, but `drizzle-kit` commands do not — always check which `.env` you are
> running against before any `db:*` command.

---

## 1. Install Node 20 LTS

Download and install **Node.js 20 LTS** from <https://nodejs.org/en/download>
(use the Windows Installer `.msi`, 64-bit). Verify in a new PowerShell window:

```powershell
node -v   # v20.x.x
npm -v
```

## 2. Install MySQL 8

1. Download **MySQL Installer for Windows** from
   <https://dev.mysql.com/downloads/installer/> (the smaller *web* installer is fine).
2. Choose **"Server only"** or **"Developer Default"** — you only need *MySQL Server 8.x*.
3. During configuration, set a **root password** (e.g. `root`) and keep the
   default port **3306**. Install it as a Windows Service so it auto-starts.
4. Create nothing else — the setup script creates the database and tables.

**Alternative — TiDB Cloud Serverless (free, no local install):** create a
free Serverless cluster at <https://tidbcloud.com/>, copy the `mysql://…`
connection string (keep the TLS query parameters it gives you), use it as your
`DATABASE_URL` in step 5, and run the setup script in step 6 with
`--allow-remote`:

```powershell
npx tsx scripts/local-db-setup.ts --allow-remote
```

## 3. Clone the repo

```powershell
git clone <repo-url> aisearchiq
cd aisearchiq
```

## 4. Install dependencies

```powershell
npm install
```

## 5. Create your local `.env`

```powershell
copy .env.local.example .env
```

Then open `.env` and fill in:

- `DATABASE_URL` — `mysql://root:<your-root-password>@localhost:3306/aisearchiq`
  (or your TiDB Cloud Serverless string).
- `DEV_LOGIN_KEY` — any password you like; this becomes your local login key.
- `APP_SECRET` — any random string (used to sign session cookies locally).

Everything else can stay at the template defaults. **Do not paste real
platform secrets into your local `.env`.**

## 6. Bootstrap the local database

```powershell
npx tsx scripts/local-db-setup.ts
```

This creates the database, pushes the full schema (`drizzle-kit push`), seeds
the owner user + the **Northwind Advisory** demo tenant (plan `growth`, with an
ingest token), and loads ~90 days of AI-crawler visit fixtures.

Optional — for the full demo dataset (13 scans, mentions heatmap, alerts,
action plan, monthly reports):

```powershell
npx tsx db/seed.ts
```

## 7. Start the app

```powershell
npm run dev
```

That is the whole dev flow — **one command, one port**. `vite.config.ts` runs
the Hono API in-process via `@hono/vite-dev-server`, so both the frontend and
`/api/*` are served at <http://localhost:3000>. Vite hot-reloads the frontend;
API file changes restart the in-process API automatically.

Production-like alternative (two steps, same port):

```powershell
npm run build   # vite build → dist/public, esbuild api/boot.ts → dist/boot.js
npm start       # serves frontend + API at http://localhost:3000
```

## 8. Sign in

1. Open <http://localhost:3000/dev-login>.
2. Enter the value of `DEV_LOGIN_KEY` from your `.env`.
3. You are redirected to `/app`, signed in as the owner (admin) on the
   **Northwind Advisory** tenant.

The real "Sign in with Kimi" button (`/login`) does not work locally — Kimi
OAuth only accepts allow-listed redirect URLs, and localhost is not one of
them. Dev login replaces it and is **off unless `DEV_LOGIN_KEY` is set**.

---

## Troubleshooting

**`ECONNREFUSED` / "Connection refused" during `local-db-setup`**
The MySQL service is not running. Open *Services* (`Win+R` → `services.msc`),
find **MySQL80**, and start it — or check the port matches your `DATABASE_URL`.

**Dev login redirects back to `/login` in a loop**
The key you typed does not match `DEV_LOGIN_KEY` on the server (the route
returns 404 and the SPA falls back to the login page). Re-check `.env`, and
restart `npm run dev` after editing `.env` — env vars are read at boot.

**`/api/dev-login` returns `{"error":"Not Found"}` even with the right key**
`DEV_LOGIN_KEY` was not set when the dev server started, or has trailing
quotes/whitespace. Fix `.env`, restart, retry.

**Port 3000 already in use**
Something else is bound to 3000. Either stop it, or run the dev server on
another port:

```powershell
npx vite --port 3001
```

**`scripts/local-db-setup.ts` refuses to run**
It only runs against `localhost`/`127.0.0.1` by design. For a TiDB Cloud
Serverless sandbox, re-run with `--allow-remote`. It **always** refuses the
platform DB (`*.privatelink.aliyuncs.com`) — that is intentional; never work
around it.

**Want a clean slate?**
Drop and recreate the sandbox:

```powershell
mysql -u root -p -e "DROP DATABASE aisearchiq;"
npx tsx scripts/local-db-setup.ts
```
