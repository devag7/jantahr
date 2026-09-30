# Build context: repository root  (docker build -f packages/backend/Dockerfile .)
# --- build ---
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

# Only the manifests first, so dependency layers cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json packages/backend/
RUN pnpm install --frozen-lockfile

COPY packages/backend packages/backend
WORKDIR /app/packages/backend
RUN npx prisma generate && pnpm build
RUN pnpm prune --prod

# --- runtime ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app/packages/backend
ENV NODE_ENV=production PORT=3002 UPLOAD_DIR=/data/uploads

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/prisma ./prisma
COPY --from=builder /app/packages/backend/scripts/doctor.mjs ./scripts/doctor.mjs
COPY --from=builder /app/packages/backend/package.json ./package.json
COPY packages/backend/docker-entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data/uploads && chown -R node:node /data /app
USER node
VOLUME /data/uploads
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://localhost:3002/health || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
