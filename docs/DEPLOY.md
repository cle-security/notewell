# Deploying Notewell

Notewell runs as two containers on a single Linux VM:

- **`app`** — the Fastify API (internal, port 3000). SQLite database and uploaded files live
  on a persistent `/data` volume.
- **`caddy`** — terminates TLS, serves the built Vue SPA, and reverse-proxies `/api/*` to `app`.

Both are defined in [`docker-compose.yml`](../docker-compose.yml).

## Prerequisites

- A small Linux VM (1 vCPU / 1–2 GB RAM is plenty) with Docker Engine + the Compose plugin.
- A DNS `A`/`AAAA` record for your domain pointing at the VM's public IP.
- Ports **80** and **443** reachable from the internet.

## First deploy

```bash
git clone https://github.com/<owner>/notewell.git
cd notewell

# 1. Secrets
cp deploy/.env.example deploy/.env
#    edit deploy/.env -> set SESSION_SECRET   (openssl rand -base64 48)

# 2. Tell Caddy your domain so it provisions a certificate automatically
export NOTEWELL_DOMAIN=notewell.app

# 3. Build + start
docker compose up -d --build
```

Caddy fetches a Let's Encrypt certificate on first start — watch it with
`docker compose logs -f caddy`. Database migrations run automatically every time the `app`
container starts (see [`deploy/docker-entrypoint.sh`](../deploy/docker-entrypoint.sh)).

### Grant yourself admin

Sign-up is open, so register your account through the UI, then promote it once:

```bash
echo "UPDATE User SET role = 'admin' WHERE email = 'you@notewell.app';" \
  | docker compose exec -T app node_modules/.bin/prisma db execute \
      --schema=prisma/schema.prisma --stdin
```

## Data & backups

All state lives in the `notewell_data` volume: the SQLite database (`/data/app.db`) and the
uploads directory (`/data/uploads`). For a consistent nightly snapshot, pause the app briefly
and archive the volume:

```bash
docker compose stop app
docker run --rm -v notewell_data:/data -v "$PWD":/out alpine \
  tar czf /out/notewell-backup-$(date +%F).tgz -C /data .
docker compose start app
```

Copy the resulting archive off the box (object storage, a second host, …).

## Updating

```bash
git pull
docker compose up -d --build      # migrations apply on app startup
```

## Local smoke test (no domain, plain HTTP)

```bash
cp deploy/.env.example deploy/.env     # set any SESSION_SECRET (>= 32 chars)
docker compose up --build              # NOTEWELL_DOMAIN unset -> Caddy serves :80
curl http://localhost/api/health       # -> {"ok":true}
```
