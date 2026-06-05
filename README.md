# Notewell

*A calm home for your notes — write in Markdown, attach a file, and share a note read-only with someone you trust.*

Notewell is a small, independent web app for keeping the things you don't want to lose: recipes, reading lists, project logs, garden notes, climbing beta, the half-finished thought you had on the train. Write in Markdown, attach an image or a PDF, and — when you want to — share a single note read-only with another person by their username. Every account gets a simple public profile so you can point people at what you keep.

It's built and run by a two-person team. No investors, no growth department, no selling your notes to anyone — just a tool we wanted to exist and now keep online for a few thousand other people. Notewell is free while it's in beta.

## What you can do

- **Write notes in Markdown** — titles and bodies, rendered safely in the browser.
- **Attach a file** — one image (PNG, JPEG, GIF, WEBP) or PDF per note, up to 5 MB.
- **Share read-only** — share a note with another user by username; they can read it, not change it.
- **Search** — find your notes by title or body text.
- **Public profile** — a lightweight profile page (display name + bio), reachable by username.
- **Accounts** — email + password sign-up, with sessions you can actually log out of.

## How it's built

- **Backend** — Node 20+ · TypeScript · Fastify · Prisma · SQLite (single file)
- **Frontend** — Vue 3 · Vite · Pinia · Vue Router
- **Shared** — pnpm workspaces, with a shared `@notewell/types` package consumed by both apps
- **Markdown** — `marked` rendered into `DOMPurify` on the client

Passwords are hashed with argon2id. Sessions are server-side records keyed by a signed, `httpOnly` cookie, so logging out — or an operator disabling an account — takes effect immediately. Uploaded files are written to disk under server-generated random names and streamed back through the API behind the same access check as the note they belong to; they are never served straight off disk.

## Running in production

Notewell runs as **two containers on a single small cloud VM** (EU region). That's plenty for our scale and keeps operations boring:

```
        Internet ──TLS──▶  Caddy  ──/api/*──▶  app  (Fastify, :3000)
                            │                   │
                            │ serves SPA        ▼
                            ▼              /data  (persistent volume)
                       Vue static         app.db   +   uploads/
```

- **`caddy`** terminates TLS (automatic Let's Encrypt certificates), serves the built Vue SPA, adds security headers (HSTS, CSP, …), and reverse-proxies `/api/*` to the app container.
- **`app`** is the Fastify API. It binds to `:3000` on the internal Docker network and is never published directly to the internet.
- **`/data`** is a persistent Docker volume holding the SQLite database file and the uploads directory — the only stateful thing on the box. It's backed up off-site nightly.

Production configuration and secrets are supplied as environment variables on the host. See [`docker-compose.yml`](docker-compose.yml) and [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full walkthrough.

## Local development

### Prerequisites

- Node.js **20.x** or newer
- `pnpm` 11+ (`corepack enable`, then `corepack use pnpm@11` if you don't have it)

### Quick start

```bash
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm db:migrate     # applies Prisma migrations + generates client
pnpm db:seed        # creates sample accounts (admin, alice, bob) with notes
pnpm dev            # api on :3000, web on :5173 (proxied to api)
```

Open <http://localhost:5173>. Seeded development accounts:

| Role  | Email               | Password       |
| ----- | ------------------- | -------------- |
| admin | `admin@example.com` | `adminpass123` |
| user  | `alice@example.com` | `alicepass123` |
| user  | `bob@example.com`   | `bobpass123`   |

### Useful commands

```bash
pnpm dev              # both servers, parallel
pnpm build            # type-check + production build for both apps
pnpm test             # api smoke test (one happy-path + one auth-required check)
pnpm db:reset         # drop + recreate the sqlite db
pnpm db:seed          # re-run the seed script (idempotent for users)
```

### Layout

```
apps/api/           Fastify backend
  src/routes/       auth, notes, users (profile/admin), uploads
  src/middleware/   auth + error handler
  src/lib/          db, sessions, crypto, env, file storage
  prisma/           schema.prisma + migrations + seed.ts
apps/web/           Vue 3 frontend
  src/views/        page-level components
  src/components/   NavBar, MarkdownView
  src/stores/       Pinia stores (auth, notes)
  src/api/          fetch wrapper + ApiException
packages/types/     shared TS types between api and web
uploads/            (gitignored) attachment blobs in local dev
```

## Decisions

- **argon2id over bcrypt** — argon2 is OWASP's current recommendation; the `argon2` package ships prebuilt binaries on common platforms and lets us use library-default parameters tuned for memory-hardness rather than bcrypt's CPU-only cost.
- **Database-backed sessions, signed cookie carries the session ID** — keeps logout and "disable user" actually revocable (vs. JWTs that stay valid until they expire). The cookie is `httpOnly`, `sameSite=lax`, `secure` in production, and signed with `SESSION_SECRET`. We rolled our own ~30-line session table rather than pulling in `@fastify/session` and an extra store dependency.
- **SQLite + `LIKE` for search** — `contains` queries on title and body, capped at 200 results, match how people actually use Notewell and keep the data layer a single portable file. FTS5 with Prisma is awkward enough that it isn't worth the complexity yet.
- **`marked` + `DOMPurify`** — `marked` is fast and small but emits raw HTML; sanitising its output with DOMPurify is the standard pattern and lets us render whatever Markdown the author (or a sharer) wrote without opening the door to `<script>` or `javascript:` XSS.
- **One attachment per note, content-type allowlist, randomised on-disk filenames** — keeps the disk layout boring (no path-traversal surface) and the API simple. Files are streamed back through the API with the same access check as the note, never served directly off disk.

## Security

We take reports seriously. If you think you've found a security issue, please email **security@notewell.app** rather than opening a public issue, and give us a reasonable window to fix it before disclosing. We're a small team, but we read every report and we'll get back to you.
