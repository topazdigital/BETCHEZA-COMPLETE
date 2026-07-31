# Betcheza Sports Data Proxy — Cloudflare Worker

This worker bypasses IP-level blocks from SofaScore, ESPN, FotMob, and other
sports data providers by routing requests through Cloudflare's clean edge IPs.

## One-time deploy (takes ~3 minutes)

### Step 1 — Install Wrangler

```bash
npm install -g wrangler
```

### Step 2 — Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window to authorize. You need a free Cloudflare account
(sign up at https://cloudflare.com if you don't have one).

### Step 3 — Deploy the worker

```bash
cd cloudflare-worker
wrangler deploy
```

After deploy you'll see output like:
```
Published betcheza-proxy (0.12 sec)
  https://betcheza-proxy.<your-subdomain>.workers.dev
```

Copy that URL.

### Step 4 — Add secrets to Replit

In Replit, go to **Secrets** (the lock icon in the sidebar) and add:

| Key | Value |
|-----|-------|
| `CF_WORKER_URL` | `https://betcheza-proxy.<your-subdomain>.workers.dev` |
| `CF_WORKER_SECRET` | any random string (optional but recommended) |

If you set `CF_WORKER_SECRET`, also add it as a Cloudflare Worker env var:

```bash
wrangler secret put CF_WORKER_SECRET
```

### Step 5 — Restart the app

After adding the secrets, restart the "Start application" workflow in Replit.
You should immediately see log lines like:
```
[FotMob] fetched 800 matches across 11 days
[ESPN] fetched 245 events for soccer/eng.1
[SofaScore] fetched 1200 matches across 35 sports
```

## How it works

```
Replit app  →  proxyFetch(url)  →  CF Worker  →  SofaScore / ESPN / FotMob
                 (when CF_WORKER_URL set)       (clean Cloudflare edge IP)
```

When `CF_WORKER_URL` is **not** set, `proxyFetch` falls back to a direct fetch
so the app still works on VPS/local environments that aren't IP-blocked.

## Allowed upstream hosts

- api.sofascore.com
- site.api.espn.com
- site.web.api.espn.com
- www.fotmob.com
- api.football-data.org
- api.the-odds-api.com
- www.thesportsdb.com

## Cloudflare free tier limits

- 100,000 requests/day
- 10ms CPU per request
- No cold starts (edge deployments are always warm)

Betcheza's typical usage is ~5,000–20,000 requests/day, well within the free tier.
