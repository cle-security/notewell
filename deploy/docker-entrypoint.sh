#!/bin/sh
set -e

# Apply any pending migrations against the SQLite file on the /data volume.
echo "[notewell] applying database migrations..."
node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

echo "[notewell] starting API on :${PORT:-3000}"
exec node dist/index.js
