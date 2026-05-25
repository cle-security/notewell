# Codebase Context

## Stack and frameworks

- **Backend** — Node.js 20+, TypeScript, **Fastify** 4.x HTTP framework (`apps/api/src/index.ts`)
- **ORM / DB** — **Prisma** 5.x with **SQLite** (file-based) (`apps/api/prisma/schema.prisma`, `apps/api/src/lib/db.ts`)
- **Frontend** — **Vue 3** SPA, **Vite** 5.x dev/build, **Pinia** state management, **Vue Router** 4.x (`apps/web/`)
- **Markdown** — `marked` 14.x for Markdown→HTML, **DOMPurify** 3.x for HTML sanitization (`apps/web/src/components/MarkdownView.vue`)
- **Password hashing** — `argon2` 0.41 with argon2id (`apps/api/src/lib/crypto.ts`)
- **Input validation** — `zod` 3.x on all request schemas (`apps/api/src/routes/auth.ts`, `apps/api/src/routes/notes.ts`, `apps/api/src/routes/users.ts`)
- **Monorepo** — pnpm 11 workspaces; shared `@cle/types` package (`packages/types/src/index.ts`)

## Authentication and authorization

**Authentication** is username/password only, at `apps/api/src/routes/auth.ts`:
- `POST /api/auth/signup` — creates user, hashes password with argon2id, starts session
- `POST /api/auth/login` — verifies credentials with constant-time comparison, starts session
- `POST /api/auth/logout` — deletes session row, clears cookie
- `GET /api/auth/me` — returns current user or null

**Session management** at `apps/api/src/lib/sessions.ts`:
- Reference-type sessions stored in SQLite (`Session` table)
- Session ID is 32 random bytes (`crypto.randomBytes(32)`) encoded as base64url (256 bits)
- 14-day absolute TTL (`SESSION_TTL_MS`), no inactivity timeout
- Cookie `cle_sid` is signed (HMAC via `@fastify/cookie` secret), httpOnly, sameSite=lax, secure in production (`apps/api/src/routes/auth.ts:24-31`)

**Authorization** at `apps/api/src/middleware/auth.ts`:
- `attachUser` preHandler loads session and populates `req.user`
- `requireAuth` — returns 401 if not authenticated
- `requireAdmin` — returns 403 if not admin role
- Notes routes enforce owner-only for edits/deletes/shares; shared users get read-only access (`apps/api/src/routes/notes.ts:90-94, 101-103, 134-135`)
- Admin endpoints (`/api/admin/*`) gated by `requireAdmin` (`apps/api/src/routes/users.ts:46, 63`)

There is no OAuth, OIDC, SAML, JWT, MFA, or external Identity Provider integration.

## Entry points and external interfaces

**HTTP API** (all under `/api` prefix):

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/signup` | No | Creates account + session |
| POST | `/api/auth/login` | No | Starts session |
| POST | `/api/auth/logout` | Cookie | Destroys session |
| GET | `/api/auth/me` | Cookie | Returns current user |
| GET | `/api/notes` | Required | List own + shared notes, `?q=` search |
| POST | `/api/notes` | Required | Create note |
| GET | `/api/notes/:id` | Required | View note (owner or shared) |
| PUT | `/api/notes/:id` | Owner | Update note |
| DELETE | `/api/notes/:id` | Owner | Delete note + attachment |
| POST | `/api/notes/:id/shares` | Owner | Share note read-only |
| DELETE | `/api/notes/:id/shares/:userId` | Owner | Remove share |
| POST | `/api/notes/:id/attachment` | Owner | Upload/replace attachment |
| GET | `/api/attachments/:id` | Required | Download attachment |
| GET | `/api/profile/:username` | No | Public profile |
| PUT | `/api/me/profile` | Required | Update own profile |
| GET | `/api/admin/users` | Admin | List all users |
| POST | `/api/admin/users/:id/disable` | Admin | Enable/disable user |
| GET | `/api/health` | No | Health check |

**Frontend** — Vue 3 SPA served by Vite dev server (`:5173`), proxied to Fastify (`:3000`) for `/api` routes (`apps/web/vite.config.ts:9-14`).

No WebSocket, GraphQL, gRPC, message broker, CLI surface, or mobile platform.

## Baseline-relevant technologies and data classes present

- **Password authentication** — email + password stored as argon2id hash
- **Session management** — database-backed reference tokens, signed cookies
- **File uploads** — `@fastify/multipart`, MIME allowlist (PNG/JPEG/GIF/WEBP/PDF), 5MB limit, randomised on-disk filenames (`apps/api/src/lib/storage.ts:6-12, 29-33`)
- **Markdown rendering** — `marked` + DOMPurify, output injected via Vue `v-html` (`apps/web/src/components/MarkdownView.vue:9-16`)
- **SQL database** — SQLite via Prisma (parameterised queries)
- **REST/JSON API** — all routes return JSON; one multipart upload endpoint
- **Search** — Prisma `contains` (SQL LIKE), not regex-based

## Baseline-relevant technologies and data classes absent

- No GraphQL, WebSocket, gRPC, SOAP
- No OAuth/OIDC/SAML, no JWT, no external IdP
- No LDAP, XPath, LaTeX, XML parsing
- No OS command execution (`child_process`, `exec`, `spawn`)
- No memcache/memcached, no email/SMS sending
- No MFA/OTP, no PSTN delivery
- No self-contained tokens (JWT)
- No public-key crypto (RSA/ECC), no mTLS
- No SSRF surface (no outbound HTTP requests from user input)
- No compressed/archive file handling (zip, gz)
- No postMessage, no localStorage/sessionStorage
- No client-side plugins (Flash, ActiveX, etc.)
- No TURN server, no DTLS/SRTP media, no WebRTC signaling

## Tenancy and trust boundaries

- The application runs as a single deployment serving all users from one SQLite database.
- Data isolation is enforced at the application layer (ownerId/userId checks on notes, shares, attachments).
- Admin users can disable accounts and view all users' data.
- There is no organisational/tenant separation — all users share the same data namespace.
- Whether this constitutes "multi-tenant" depends on the deployment context (see open questions).

## Transport, secrets, and configuration

**Transport** — The Fastify server listens on HTTP (`0.0.0.0:env.port`, default 3000) with no TLS configuration in code (`apps/api/src/index.ts:49`). TLS termination is expected to be handled upstream (reverse proxy, load balancer).

**Secrets** — `SESSION_SECRET` (cookie signing HMAC key) loaded from environment variable, minimum 32 characters enforced (`apps/api/src/lib/env.ts:14-17`). The `.env.example` has a placeholder value. No secrets management solution (key vault) is used; secrets are expected to be provided via environment variables.

**Configuration** — `apps/api/.env.example` defines: `NODE_ENV`, `PORT`, `SESSION_SECRET`, `DATABASE_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Production mode (`NODE_ENV=production`) enables secure cookie flag, structured logging, and reduces Prisma log verbosity.

**Browser security headers** — No `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, or `X-Frame-Options` headers are set in the application code. These would need to come from the reverse proxy or a dedicated Fastify plugin.

**Seed data** — `apps/api/prisma/seed.ts` creates an admin account with default credentials from env vars (`ADMIN_PASSWORD` defaults to `adminpass123`).

## Open questions

### Out-of-repo controls

- [ ] Is the Fastify API deployed behind a TLS-terminating reverse proxy or load balancer (e.g., nginx, Caddy, AWS ALB)? The app itself listens on plain HTTP (`0.0.0.0:3000`) with no TLS configuration. If no upstream TLS termination exists, all traffic is unencrypted.
- [ ] Does the reverse proxy / hosting platform inject or enforce browser security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` / frame-ancestors)? The application code does not set any of these.
- [ ] Is there a WAF, API gateway, or reverse proxy that provides rate limiting, request throttling, or anti-automation before requests reach Fastify? The app has no rate limiting at any layer.
- [ ] Are static source-control metadata directories (`.git`, `.svn`) blocked from external access at the web server or CDN layer? The repo root contains a `.gitignore` but no server-level deny rules are in the code.
- [ ] Is the `TRACE` HTTP method disabled at the web server or reverse proxy?
- [ ] Is directory listing disabled at the web server or reverse proxy level?
- [ ] Are monitoring endpoints or API documentation (Swagger/OpenAPI) exposed, and are they gated?
- [ ] Is production debug mode disabled across all components (Node.js, Fastify, Vite)?
- [ ] Is a secrets management solution (key vault, encrypted env-injection) used to provide `SESSION_SECRET` and other secrets in production? The code reads them from environment variables directly.
- [ ] Are TLS versions and cipher suites restricted to recommended ones (TLS 1.2+ only, strong cipher preference) at the termination point?
- [ ] Are publicly trusted TLS certificates used for external-facing services?
- [ ] Does the infrastructure enforce HTTPS redirect with no transparent HTTP→HTTPS redirect for non-browser endpoints (to avoid masking accidental plaintext)?
- [ ] Do intermediary layers (load balancer, reverse proxy) set and protect trust-requiring headers (e.g., X-Real-IP, X-Forwarded-For) from client override?
- [ ] Are uploaded files scanned by antivirus software before being served to users?

### Business / risk context

- [ ] Is this application public-facing (internet-accessible) or internal-only? This affects risk ratings for many requirements (e.g., HSTS, CSP, rate limiting, MFA).
- [ ] What is the tenancy model? Is this a single-organisation deployment (single-tenant) or does one instance serve multiple organisations (multi-tenant with cross-tenant data isolation needs)? The code enforces per-user data isolation but has no organisational segmentation.
- [ ] What data sensitivity tier applies to stored data (notes, bios, email addresses, attachments)? Are any regulated data classes (PII, health, financial) processed?
- [ ] Is the seed-created admin account (`admin` / `adminpass123`) intended for production use or only development? The seed reads `ADMIN_PASSWORD` from env but the `.env.example` default is weak.
- [ ] Is password-only authentication acceptable for this application's risk profile, or is MFA expected? The codebase implements only single-factor password authentication.
- [ ] Are there compliance or regulatory requirements that mandate breached-password checking, password rotation policies, or specific session time-out values?

### Code that looks unsafe but may be intentional

- [ ] The login view redirects to `route.query.next` after successful login (`apps/web/src/views/LoginView.vue:18`). Vue Router's `push()` only handles same-origin SPA navigation, but if this parameter were consumed server-side for HTTP redirects it could enable open redirect. Confirm this is expected client-side-only behaviour.
- [ ] No CSRF tokens are used for state-changing POST/PUT/DELETE endpoints — the app relies solely on `sameSite=lax` cookies. The README explicitly notes this as an intentional simplification. Is this acceptable given the application's risk profile and exposure?
- [ ] There is no inactivity-based session timeout; sessions expire only after 14 days absolute (`apps/api/src/lib/sessions.ts:5`). Is this maximum session lifetime appropriate for the risk context?
- [ ] The error handler (`apps/api/src/middleware/error.ts:17`) returns a generic message for 500 errors but includes validation error details for Zod 400 responses (field paths and messages). Is this level of detail acceptable in production?
- [ ] Attachment filenames from the user are stored in the database after truncation to 200 chars (`apps/api/src/routes/uploads.ts:44`) and stripped of CR/LF/quotes in the Content-Disposition header (`apps/api/src/routes/uploads.ts:78`). No full RFC 6266 encoding is applied. Is this sufficient for the application's needs?
- [ ] File content validation checks MIME type (from the multipart Content-Type header) but does not verify magic bytes or re-encode images. Is this acceptable given the MIME allowlist (image types + PDF)?
- [ ] The admin disable endpoint accepts `disabled` from the request body with no schema validation beyond a truthiness check (`apps/api/src/routes/users.ts:67-68`). Other routes use Zod strictly.
