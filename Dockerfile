# syntax=docker/dockerfile:1

# ---------- Builder: install deps, generate Prisma client, build both apps ----------
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Install with a cache keyed on manifests + lockfile (copied before sources).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

# Build the API (and the rest of the workspace).
COPY . .
RUN pnpm --filter @notewell/api exec prisma generate
RUN pnpm -r run build

# Carve out a self-contained production bundle for the API (prod deps only).
RUN pnpm --filter @notewell/api deploy --prod /app-prod

# ---------- Runtime: Fastify API only ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
# Prisma's query engine needs OpenSSL present at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app-prod ./
# The pruned bundle drops the generated client; regenerate it here (same Prisma version).
RUN node_modules/.bin/prisma generate --schema=prisma/schema.prisma
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
# Runs `prisma migrate deploy`, then starts the server.
ENTRYPOINT ["docker-entrypoint.sh"]
