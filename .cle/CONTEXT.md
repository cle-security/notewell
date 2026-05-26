# Codebase Context

## Stack and Frameworks

- **Backend**: Node.js 20+ / TypeScript, Fastify 4 web framework, Prisma 5 ORM, SQLite (file-based via `DATABASE_URL`).
  - Source: `apps/api/src/index.ts`, `apps/api/package.json`, `apps/api/prisma/schema.prisma`
- **Frontend**: Vue 3 (Composition API), Vite 5 build tool, Pinia 2 state management, Vue Router 4.
  - Source: `apps/web/src/main.ts`, `apps/web/package.json`
- **Shared types**: Monorepo `@cle/types` package (`packages/types/src/index.ts`).
- **Markdown rendering**: `marked` → `DOMPurify` on the client (`apps/web/src/components/MarkdownView.vue`).
- **Password hashing**: argon2id (`apps/api/src/lib/crypto.ts`).
- **Validation**: Zod schemas for API input (`apps/api/src/routes/auth.ts`, `apps/api/src/routes/notes.ts`, `apps/api/src/routes/users.ts`).
- **Session tokens**: Server-side reference tokens stored in SQLite (`Session` table, `apps/api/src/lib/sessions.ts`). 32-byte random IDs generated with `crypto.randomBytes(32)`, signed cookies via `@fastify/cookie`.
- **File uploads**: `@fastify/multipart`; stored to local disk, MIME allowlist (PNG/JPEG/GIF/WEBP/PDF) with size limit (`apps/api/src/lib/storage.ts`, `apps/api/src/routes/uploads.ts`).

## Authentication and Authorization

- **Password signup/login** at `POST /api/auth/signup` and `POST /api/auth/login` (`apps/api/src/routes/auth.ts`). Passwords hashed with argon2id.
- **Session management**: Cookie-based sessions (`cle_sid`), signed with `SESSION_SECRET`, created/destroyed in `apps/api/src/lib/sessions.ts`. 14-day TTL.
- **Auth middleware**: `attachUser` (preHandler hook on all routes) unsigns cookie and loads session/user; `requireAuth` and `requireAdmin` guard specific routes (`apps/api/src/middleware/auth.ts`).
- **Authorization model**: Role-based (`user` / `admin`) plus ownership-based. Notes are owner-editable; shared notes are read-only. Admin endpoints at `/api/admin/*`. Profile edits are owner-only.
- **No OAuth/OIDC, no JWT, no multi-factor authentication, no federated identity** is present in the codebase.

## Entry Points and External Interfaces

- **API routes** (all under `/api`):
  - `GET /api/health` — unauthenticated health check
  - `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - `GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/:id`, `POST/DELETE /api/notes/:id/shares(/:userId)`
  - `POST /api/notes/:id/attachment`, `GET /api/attachments/:id`
  - `GET /api/profile/:username`, `PUT /api/me/profile`
  - `GET /api/admin/users`, `POST /api/admin/users/:id/disable`
- **Frontend**: Vue SPA served by Vite dev server, proxied to API (`apps/web/vite.config.ts`). Routes defined in `apps/web/src/router/index.ts`.
- **No GraphQL, no WebSocket, no gRPC, no CLI surface, no mobile platform, no SSR/server-rendered HTML**.

## Baseline-Relevant Technologies and Data Classes

### Present
- **HTML/Markdown output**: User-authored Markdown rendered via `marked` → `DOMPurify` → `v-html` (`apps/web/src/components/MarkdownView.vue`).
- **Password authentication**: Argon2id hashing; minimum 8-character password enforced by Zod (`apps/api/src/routes/auth.ts`).
- **Session cookies**: Signed, httpOnly, sameSite=lax, Secure in production (`apps/api/src/routes/auth.ts:24-31`).
- **File uploads**: Multipart uploads with MIME allowlist and size limits (`apps/api/src/routes/uploads.ts`, `apps/api/src/lib/storage.ts`).
- **Database queries**: Prisma ORM (parameterized queries) against SQLite (`apps/api/src/lib/db.ts`, `apps/api/prisma/schema.prisma`).
- **SQL (SQLite)**: Via Prisma; Prisma-generated parameterized queries.
- **Input validation**: Zod schemas for all mutation endpoints.
- **Content-Disposition header**: Set on file downloads with sanitization of filename (`apps/api/src/routes/uploads.ts:76-79`).
- **CORS**: No explicit CORS configuration in code (no `@fastify/cors`).
- **Cookie-based reference tokens**: Not self-contained/JWT.

### Absent
- No GraphQL, WebSocket, LDAP, XPath, LaTeX, XML parsers, XSLT, SSRF-capable outbound fetch (backend makes no outbound HTTP requests).
- No JWT or self-contained token creation/validation.
- No OAuth/OIDC server or client, no consent management.
- No MFA, no out-of-band authentication, no TOTP/lookup secrets.
- No JNDI, no memcache, no SMTP/IMAP.
- No template engines (server-side), no CSS/XSL processing, no SVG upload processing.
- No Java, no unmanaged/native code, no deserialization of binary/serialized objects.
- No CORS configuration, no TLS/HTTPS configuration in code (Per the user: TLS terminates at an upstream reverse proxy).
- No mTLS, no client certificate authentication.
- No TURN server, no media/SRTP/DTLS/WebRTC signaling.
- No format string processing, no OS command execution (`child_process`).
- No multi-tenancy (Per the user: single-tenant).

## Tenancy and Trust Boundaries

- **Single-tenant**: One deployment, one database, all users share the same SQLite database. Per the user, this is a single-tenant application.
- **Public boundary**: The Fastify API on port 3000; Vite dev proxy on 5173. Per the user, the app is deployed behind a TLS-terminating reverse proxy.
- **Auth boundary**: Anonymous access to `GET /api/health`, `GET /api/profile/:username`, signup, login, and `GET /api/auth/me`. All other endpoints require authentication; admin endpoints additionally require `role === "admin"`.

## Transport, Secrets, and Configuration

- **TLS**: Per the user, TLS terminates at an upstream reverse proxy. No TLS configuration exists in the application code.
- **Secrets managed via environment variables** (`apps/api/src/lib/env.ts`): `SESSION_SECRET` (required, min 32 chars), `DATABASE_URL`, `PORT`, `NODE_ENV`, `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`.
- **`.env.example`** at `apps/api/.env.example` documents defaults; `.env` is gitignored.
- **No secret management vault or key management service** is integrated.
- **No CORS headers** are set by the application.
- **Session cookie configuration**: Defined in `apps/api/src/routes/auth.ts` (httpOnly, sameSite=lax, signed, Secure in production). Cookie name is `cle_sid`.
