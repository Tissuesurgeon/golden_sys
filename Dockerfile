# Local and other container hosts. Vercel builds Dockerfile.vercel instead.
# Default listen port is 3000. Override with --build-arg LISTEN_PORT=80.

FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    AUTH_SECRET=docker-build-placeholder \
    sh -c "npx prisma generate && npm run build"

FROM node:22-alpine AS prisma-cli
RUN apk add --no-cache openssl libc6-compat
WORKDIR /prisma
RUN npm install prisma@6.16.3

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat su-exec
WORKDIR /app
ARG LISTEN_PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=${LISTEN_PORT}
ENV STORAGE_DIR=storage/private
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma /prisma/prisma
COPY --from=prisma-cli --chown=node:node /prisma/node_modules /prisma/node_modules
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p storage/private && chown -R node:node storage
EXPOSE 3000
CMD ["sh", "/entrypoint.sh"]
