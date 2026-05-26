# Codebase Context

## Stack and Frameworks

- **Backend**: Node.js 20+ · TypeScript · Fastify 4 (HTTP framework) · Prisma ORM · SQLite (file-based via `DATABASE_URL`)
- **Frontend**: Vue 3 · Vite (dev server + bundler) · Pinia (state stores) · Vue Router · marked + DOMPurify (client-side Markdown rendering)
- **Monorepo**: pnpm workspaces; shared `@cle/types` package consumed by both apps via workspace protocol
- **Build/test**: `tsx` for dev/run, `tsc` for type-checking, `node:test` for a single smoke test, Vite for frontend bundling

Key dependency versions are pinned in `apps/api/package.json` and `apps/web/package.json`.

## Authentication and Authorization

Authentication is password-based, implemented entirely in-app with no external identity provider:

- **Password hashing**: `argon2` with `argon2id` type (`apps/api/src/lib/crypto.ts`). Library defaults are used for memory/time parameters.
- **Session management**: Database-backed sessions. A 256-bit random session ID (`crypto.randomBytes(32).toString("base64url")`) is stored in the `Session` SQLite table (`apps/api/src/lib/sessions.ts`). The session cookie (`cle_sid`) carries the ID, is signed via `@fastify/cookie` with `SESSION_SECRET`, and is configured as `httpOnly`, `sameSite=lax`, and `secure` in production (`apps/api/src/routes/auth.ts:24–31`).
- **Session TTL**: 14 days absolute (`SESSION_TTL_MS` in `sessions.ts`). No sliding/rolling inactivity timeout is implemented — sessions persist until they expire or are explicitly destroyed.
- **Auth middleware**: `attachUser` (preHandler on every route) loads the session and populates `req.user`; `requireAuth` and `requireAdmin` guard specific route groups (`apps/api/src/middleware/auth.ts`).
- **Authorization model**: Role-based (`user` | `admin`). Notes enforce owner-only write/delete; read sharing is a separate `NoteShare` table. Admin-only user management at `/api/admin/*`. No field-level authorization beyond what the API endpoints expose.
- **No MFA, no OAuth, no SSO, no IdP integration** — all authentication flows are local username/password.

Relevant files: `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/crypto.ts`, `apps/api/src/lib/sessions.ts`

## Entry Points and External Interfaces

### API (Fastify) — `apps/api/src/index.ts`

All routes are under `/api`:

| Route prefix | Handler file | Auth | Key operations |
|---|---|---|---|
| `/api/auth/signup` | `auth.ts` | Public | POST — register |
| `/api/auth/login` | `auth.ts` | Public | POST — login |
| `/api/auth/logout` | `auth.ts` | Any | POST — clear session |
| `/api/auth/me` | `auth.ts` | Any | GET — current user |
| `/api/notes` | `notes.ts` | Auth required | CRUD + search + share |
| `/api/notes/:id` | `notes.ts` | Auth required | Read (owner or shared), update/delete (owner) |
| `/api/notes/:id/shares` | `notes.ts` | Auth required | POST/DELETE share |
| `/api/notes/:id/attachment` | `uploads.ts` | Auth required (owner) | POST — upload file |
| `/api/attachments/:id` | `uploads.ts` | Auth required (owner or shared) | GET — download file |
| `/api/profile/:username` | `users.ts` | Public | GET — public profile |
| `/api/me/profile` | `users.ts` | Auth required | PUT — edit own profile |
| `/api/admin/users` | `users.ts` | Admin | GET — list users |
| `/api/admin/users/:id/disable` | `users.ts` | Admin | POST — toggle disable |

### Frontend (Vue SPA) — `apps/web/src/router/index.ts`

Client-side routes with route guards for `requiresAuth` and `requiresAdmin`. Vite dev server proxies `/api` to Fastify on `:3000`.

### File Upload / Download

- Upload: single file per note, MIME allowlist (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`), configurable size limit (`MAX_UPLOAD_BYTES`, default 5 MB), stored with random hex filenames (`apps/api/src/lib/storage.ts`).
- Download: streamed through the API with access control checks, `Content-Type` set to the stored MIME, and `Content-Disposition` set to `inline` for images / `attachment` for PDFs. Filenames are sanitized for header injection (`apps/api/src/routes/uploads.ts:77–79`).

## Baseline-Relevant Technologies and Data Classes

**Present**:
- Password authentication (argon2id hashing, session cookies)
- Database-backed sessions (reference tokens in SQLite)
- Cookie-based session management (signed, httpOnly, sameSite=lax, secure in production)
- REST API (JSON request/response body, query parameters, URL path parameters)
- File uploads (multipart, MIME allowlist, size limit)
- User-generated Markdown rendered as HTML client-side (marked + DOMPurify)
- Input validation with Zod schemas
- Parameterized database queries via Prisma ORM
- SQLite database
- Admin role with user management (disable accounts, kill sessions)
- Note sharing (read-only share by username)
- Public user profiles

**Absent** (technologies/data classes not in the codebase):
- GraphQL, WebSocket, SSE, gRPC, SOAP — only REST
- OAuth / OIDC (no authorization server, client, or resource server)
- External identity provider / SSO
- Multi-tenancy
- MFA / OTP / out-of-band authentication
- JWT / self-contained tokens (only reference tokens)
- CORS configuration (single-origin app)
- rate limiting / anti-automation
- TLS configuration in code
- LDAP / XPath / XML parsing
- SSRF surfaces (no outbound HTTP based on user input)
- OS command execution
- Server-side template rendering (backend returns JSON only)
- WebSocket / real-time messaging
- Email sending / SMTP
- TURN / media / signaling servers
- Memcache / Redis
- CORS headers (not configured — single-origin app served from same domain)

## Tenancy and Trust Boundaries

- **Single-tenant**: All users share the same database and application instance. There is no tenant isolation logic, no tenant IDs, and no data partitioning.
- **Public boundary**: The Fastify HTTP server is the sole entry point. Unauthenticated access is allowed on signup, login, public profile, and health endpoints. All other endpoints require a valid session cookie.
- **Per the user**: TLS is terminated at a reverse proxy in front of the app.
- **Per the user**: There is no external WAF, API gateway, or rate-limiting layer; Fastify is the only request-processing layer.

## Transport, Secrets, and Configuration

- **TLS**: Not configured in the app itself. Per the user, TLS terminates at a reverse proxy; the app listens on plain HTTP.
- **Secrets**: `SESSION_SECRET` (env var, min 32 chars, used for cookie signing) and `DATABASE_URL` (SQLite file path) are loaded via `dotenv` from environment variables (`apps/api/src/lib/env.ts`). No secrets management solution (vault, key store) is used; `.env` files are gitignored.
- **Configuration**: All runtime config is via environment variables (`apps/api/src/lib/env.ts`): `NODE_ENV`, `PORT`, `SESSION_SECRET`, `DATABASE_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`.
- **Database**: SQLite file specified by `DATABASE_URL`, accessed via Prisma ORM with parameterized queries.
- **Upload storage**: Local filesystem at `UPLOAD_DIR` (default `../../uploads`), filenames are randomly generated hex strings with extensions matching the MIME type.
