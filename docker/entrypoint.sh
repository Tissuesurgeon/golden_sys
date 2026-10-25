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
  exec su-exec node "$0" serve
fi

run
