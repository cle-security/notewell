# Codebase Context

## Stack and frameworks

The codebase is a full-stack notes application built as a pnpm monorepo.

- **Backend** — Node.js 20+, TypeScript, Fastify 4, Prisma 5 with a SQLite datasource, Zod for validation, and argon2 for password hashing (`apps/api/package.json`, `apps/api/prisma/schema.prisma`).
- **Frontend** — Vue 3 (Composition API), Vue Router 4, Pinia state management, Vite build tool (`apps/web/package.json`).
- **Shared** — Workspace package `@cle/types` consumed by both apps (`packages/types/`).
- **Key libraries** — `marked` + `DOMPurify` for Markdown rendering on the client; `@fastify/cookie` and `@fastify/multipart` for cookie/session and file-upload handling.
- **No GraphQL, WebSocket, gRPC, SOAP, mobile platforms, or server-side rendering** are present.

## Authentication and authorization

- **Authentication model** — Local username/password only (single-factor). No MFA, OAuth, OIDC, SAML, LDAP, or social identity providers are implemented.
- **Password storage** — Hashed with argon2id via `argon2` (`apps/api/src/lib/crypto.ts`).
- **Session management** — Custom database-backed sessions stored in SQLite; the session ID is carried in a signed cookie (`cle_sid`). Cookie flags are configured as `httpOnly`, `sameSite: lax`, `secure` in production, and signed with `SESSION_SECRET` (`apps/api/src/index.ts:21-24`, `apps/api/src/lib/sessions.ts`).
- **Authorization** — Role-based access control with two roles (`user` and `admin`). Middleware enforces authentication (`requireAuth`) and admin checks (`requireAdmin`) (`apps/api/src/middleware/auth.ts`). Note ownership and read-only sharing are enforced in route handlers (`apps/api/src/routes/notes.ts`).
- **Missing auth features** — No password-reset flow, no account-recovery mechanism, no password hints, no anti-automation or rate-limiting controls, and no audit/security logging beyond Fastify’s request logger. The README explicitly calls these out as intentionally omitted for the demo (`README.md:73`).

## Entry points and external interfaces

- **HTTP REST API** (Fastify) listens on `0.0.0.0:3000` (`apps/api/src/index.ts:49`).
- **Public routes**
  - `/api/health` — liveness probe.
  - `/api/auth/*` — signup, login, logout, current-user lookup.
  - `/api/notes/*` — note CRUD, sharing, list/search.
  - `/api/notes/:id/attachment` — multipart file upload (single file, max size `MAX_UPLOAD_BYTES`).
  - `/api/attachments/:id` — file download gated by note access control.
  - `/api/profile/:username` — public profile lookup.
  - `/api/me/profile` — authenticated profile update.
  - `/api/admin/users*` — admin-only user listing and disable toggle.
- **File-upload surface** — Accepts PNG, JPEG, GIF, WEBP, and PDF only (`apps/api/src/lib/storage.ts:6-12`). Files are renamed to server-generated random hex names and stored in a local `uploads/` directory, never in a public web folder.
- **Frontend SPA** — Served by Vite (dev: `5173`; production build is static). It proxies `/api` to the backend (`apps/web/vite.config.ts:9-14`).
- **No API gateway, no CORS configuration, and no rate-limiting or WAF logic in code.**

## Baseline-relevant technologies and data classes

| Technology / data class | Status | Evidence |
|---|---|---|
| File uploads | **Present** | Multipart endpoint with MIME allowlist (`apps/api/src/routes/uploads.ts`). |
| Password authentication | **Present** | Hashing with argon2id (`apps/api/src/lib/crypto.ts`). |
| Sessions (reference tokens) | **Present** | DB-backed sessions, signed cookies (`apps/api/src/lib/sessions.ts`). |
| Markdown rendering | **Present** | Client-side rendering with `marked` + `DOMPurify` (`apps/web/src/components/MarkdownView.vue`). |
| JWT / OAuth / OIDC / SAML | **Absent** | No JWT parsing, no OAuth flows, no SAML assertions. |
| GraphQL | **Absent** | No schema or GraphQL libraries found. |
| WebSocket | **Absent** | No `ws`, `socket.io`, or native WebSocket usage. |
| LDAP / XPath / LaTeX / JNDI / Memcache | **Absent** | No relevant imports or endpoints. |
| XML parsing / object deserialization | **Absent** | Fastify JSON parser only; no XML endpoints or unsafe deserialization libraries. |
| OS command execution | **Absent** | No `child_process`, `exec`, or shell invocation. |
| Server-side template engine | **Absent** | Backend returns JSON; Vue templates are build-time compiled. |
| Multi-tenancy | **Absent** | Single-tenant application with per-user resource isolation. |
| Self-contained tokens (JWT) | **Absent** | Uses reference tokens stored in SQLite, not JWTs. |
| WebRTC / TURN / media / signaling | **Absent** | No WebRTC stack components. |

## Tenancy and trust boundaries

- The application is **single-tenant**.
- The public trust boundary is the Fastify HTTP server. There is no subdomain separation between the API and the web frontend in development (both served from `localhost` via Vite proxy).

## Transport, secrets, and configuration

- **Configuration** is loaded from environment variables via `dotenv` in `apps/api/src/lib/env.ts`.
- **Required secrets/variables** — `SESSION_SECRET` (enforced >= 32 characters), `DATABASE_URL`.
- **Optional variables** — `PORT`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, `NODE_ENV` (`apps/api/.env.example`).
- **TLS and security headers** — Per the user, the application is deployed behind a TLS-terminating reverse proxy in production, and that proxy adds security headers such as HSTS, CSP, and CORS. The application code itself does not configure TLS or those headers.
- **Secrets management** — Per the user, production secrets are supplied as plain environment variables on the host; there is no integration with a secrets manager or key vault.
- **No secrets are hard-coded in source** beyond the seed-script defaults in `.env.example`, which are dev-only values.
