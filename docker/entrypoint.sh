#!/bin/sh
set -eu

# Docker sets HOSTNAME to the container id. Next.js would bind to that name,
# so force the address Vercel and other hosts can reach.
export HOSTNAME=0.0.0.0

mkdir -p /app/storage/private

run() {
  cd /prisma
  node ./node_modules/prisma/build/index.js migrate deploy
  cd /app
  exec node server.js
}

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/storage/private
  # Vercel routes to port 80. Only root can bind that port there.
  port="${PORT:-3000}"
  if [ "$port" -ge 1024 ]; then
    exec su-exec node "$0" serve
  fi
fi

run
