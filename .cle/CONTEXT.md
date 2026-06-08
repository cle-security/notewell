# Codebase Context

## Stack and Frameworks

**Notewell** — a Markdown note-taking web app with file attachments and read-only sharing.

- **Backend** (`apps/api/`): Node.js 20+, TypeScript, Fastify 4.x, Prisma ORM 5.x with SQLite.
- **Frontend** (`apps/web/`): Vue 3, Vite 5.x, Pinia, Vue Router 4.x, `marked` (Markdown → HTML), DOMPurify (HTML sanitization).
- **Shared** (`packages/types/`): TypeScript types consumed by both apps.
- **Package manager**: pnpm 11 workspaces.
- **Runtime containerization**: Two Docker containers — Fastify API and Caddy reverse proxy — on a single VM. No CDN, no cloud load balancer, no WAF.

## Authentication and Authorization

### Authentication

- Email + password sign-up and login (`apps/api/src/routes/auth.ts`).
- Password hashing with argon2id via `argon2` library (`apps/api/src/lib/crypto.ts`).
- Reference session tokens: 256-bit CSPRNG-generated session IDs stored in SQLite via Prisma (`apps/api/src/lib/sessions.ts`).
- Session cookie: `notewell_sid`, signed via `@fastify/cookie` using `SESSION_SECRET` env var. Cookie attributes: `httpOnly`, `sameSite: "lax"`, `secure` in production only (`apps/api/src/routes/auth.ts:28`).
- `preHandler` hook `attachUser` decodes the session cookie and loads the user on every request (`apps/api/src/middleware/auth.ts`).
- No password change feature exists (confirmed by user). No password recovery/reset flow.
- No rate limiting or anti-automation controls anywhere (confirmed by user).

### Authorization

- Role-based: `"user"` and `"admin"` roles stored in the `User` model (`apps/api/prisma/schema.prisma:17`).
- Middleware guards: `requireAuth` (401 if no session), `requireAdmin` (403 if not admin) in `apps/api/src/middleware/auth.ts`.
- Data-level access control: notes are gated by ownership or share relationship (`apps/api/src/routes/notes.ts:90-93`). Attachments are gated by the same check (`apps/api/src/routes/uploads.ts:69-71`).
- Admin-only endpoints under `/api/admin/` for user listing and disable/enable (`apps/api/src/routes/users.ts:46-81`).

### Password Policy

- Minimum 8 characters, maximum 200 (`apps/api/src/routes/auth.ts:16`). No character-type composition rules enforced.
- No breached-password check (e.g., no check against top-3000 list).
- Password verified exactly as received — no truncation or case transformation before passing to `argon2.verify` (`apps/api/src/lib/crypto.ts:11`).

## Entry Points and External Interfaces

### HTTP API (REST)

All routes registered in `apps/api/src/index.ts:32-39`:

| Prefix | Routes file | Auth |
|--------|-------------|------|
| `GET /api/health` | `index.ts` | None |
| `POST /api/auth/signup` | `routes/auth.ts` | None |
| `POST /api/auth/login` | `routes/auth.ts` | None |
| `POST /api/auth/logout` | `routes/auth.ts` | Optional (clears if present) |
| `GET /api/auth/me` | `routes/auth.ts` | Optional |
| `GET /api/notes` | `routes/notes.ts` | Required |
| `POST /api/notes` | `routes/notes.ts` | Required |
| `GET /api/notes/:id` | `routes/notes.ts` | Required |
| `PUT /api/notes/:id` | `routes/notes.ts` | Required (owner only) |
| `DELETE /api/notes/:id` | `routes/notes.ts` | Required (owner only) |
| `POST /api/notes/:id/shares` | `routes/notes.ts` | Required (owner only) |
| `DELETE /api/notes/:id/shares/:userId` | `routes/notes.ts` | Required (owner only) |
| `POST /api/notes/:id/attachment` | `routes/uploads.ts` | Required (owner only) |
| `GET /api/attachments/:id` | `routes/uploads.ts` | Required |
| `GET /api/profile/:username` | `routes/users.ts` | None (public) |
| `PUT /api/me/profile` | `routes/users.ts` | Required |
| `GET /api/admin/users` | `routes/users.ts` | Required + admin |
| `POST /api/admin/users/:id/disable` | `routes/users.ts` | Required + admin |

- All JSON request bodies are validated with Zod schemas inline in each route handler.
- JSON body limit: 1 MB (`apps/api/src/index.ts:18`).
- Multipart uploads limited to 1 file, size capped by `MAX_UPLOAD_BYTES` (default 5 MiB) (`apps/api/src/index.ts:25-26`).

### Frontend SPA

- Vue 3 SPA served by Caddy as static files from `/srv` (`Dockerfile.web`, `Caddyfile:25`).
- Client-side routing via Vue Router with `createWebHistory` (`apps/web/src/router/index.ts`).
- Navigation guards: `requiresAuth` redirects to `/login`, `requiresAdmin` redirects to `/notes` (`apps/web/src/router/index.ts:45-49`).
- API client at `apps/web/src/api/client.ts`: `fetch`-based with `credentials: "same-origin"`, JSON and FormData (upload) support.
- Auth state pre-fetched via `GET /api/auth/me` before initial render (`apps/web/src/main.ts:16`).

### No other interfaces

- No WebSocket, no GraphQL, no gRPC, no SOAP, no CLI surface beyond dev tooling.
- No mobile app — web only.

## Technologies and Data Classes Present

| Technology / Data Class | Location |
|-------------------------|----------|
| Password authentication (email + password) | `apps/api/src/routes/auth.ts`, `apps/api/src/lib/crypto.ts` |
| Session cookies (reference tokens) | `apps/api/src/lib/sessions.ts`, `apps/api/src/middleware/auth.ts` |
| Cookie signing (Fastify cookie plugin) | `apps/api/src/index.ts:21-24` |
| File upload (multipart, images + PDF) | `apps/api/src/routes/uploads.ts`, `apps/api/src/lib/storage.ts` |
| Markdown → HTML rendering | `apps/web/src/components/MarkdownView.vue` |
| HTML sanitization (DOMPurify) | `apps/web/src/components/MarkdownView.vue:11` |
| Input validation (Zod schemas) | Each route file under `apps/api/src/routes/` |
| URL building with user input (search query) | `apps/web/src/stores/notes.ts:15` |
| Server-side file storage | `apps/api/src/lib/storage.ts` |

## Technologies and Data Classes Absent

- **No self-contained tokens (JWT, JWS, JWE)** — sessions are reference tokens only.
- **No OAuth 2.0 / OIDC** — authentication is local email + password.
- **No WebSocket connections** — HTTP only.
- **No GraphQL, SOAP, gRPC** — REST only.
- **No XML parsing** — JSON in, JSON out.
- **No WYSIWYG editor** — plain Markdown textarea input.
- **No OS command execution** — no `child_process`, `exec`, or `spawn` in application code.
- **No dynamic code execution (`eval`, `Function` constructor)** — none found.
- **No password hints or secret questions** — feature does not exist.
- **No password change feature** — not yet implemented (confirmed by user).

## Tenancy and Trust Boundaries

- **Single-tenant database** — one SQLite file shared by all users (`apps/api/prisma/schema.prisma`).
- **Trust boundary**: the public internet reaches Caddy on ports 80/443. Caddy terminates TLS, serves the SPA, and reverse-proxies `/api/*` to the Fastify container on the internal Docker network (`docker-compose.yml:18-20`). The API container is never exposed to the host.
- **Admin role**: can list all users and disable/enable non-admin accounts. Cannot disable themselves (`apps/api/src/routes/users.ts:69-73`).
- **Multi-user data isolation**: notes are only accessible to the owner and explicitly shared users. Disabled users are treated as 404 to outsiders (`apps/api/src/routes/users.ts:16-17`).

## Transport, Secrets, and Configuration

### Transport Security

- TLS terminated at Caddy using automatic Let's Encrypt certificates when `NOTEWELL_DOMAIN` is set (`Caddyfile:4`, `docker-compose.yml:31`). Falls back to plain HTTP on `:80` when unset (local dev).
- Security headers added at the Caddy layer (`Caddyfile:9-16`): HSTS (max-age=31536000), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `-Server`. CSP is commented out.
- Per the user: production runs exactly as shown in docker-compose.yml — Caddy is the sole edge, no CDN, no cloud load balancer, no WAF.

### Secrets and Configuration

- Environment variables loaded via `dotenv` in `apps/api/src/lib/env.ts`.
- `SESSION_SECRET` — required, validated to be ≥32 characters (`apps/api/src/lib/env.ts:14-18`).
- `DATABASE_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, `PORT`, `NODE_ENV` — all from env vars with sensible defaults (`apps/api/src/lib/env.ts`).
- Production env vars supplied via `deploy/.env` loaded by docker-compose (`deploy/.env.example`).
- No secret manager or vault integration — secrets are host environment variables.
- Database is a single SQLite file on a persistent Docker volume at `/data/app.db`.
- Uploads stored under `UPLOAD_DIR` (production: `/data/uploads`). Backed up off-site nightly per README.

### CORS and Origin Controls

- No CORS headers set by the API. Frontend uses `credentials: "same-origin"` for all fetch requests (`apps/web/src/api/client.ts:16`).
- In production, the SPA and API share the same origin (Caddy serves both from the same domain), so no cross-origin requests occur in normal use.
