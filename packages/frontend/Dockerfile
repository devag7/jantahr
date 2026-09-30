# Build context: repository root  (docker build -f packages/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .)
FROM node:20-alpine AS deps
WORKDIR /app
COPY packages/frontend/package.json packages/frontend/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/frontend .
# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ARG NEXT_PUBLIC_SHOW_DEMO_LOGINS=false
# self_hosted: the app only (no marketing site or billing); cloud: marketing, pricing and billing pages too
ARG NEXT_PUBLIC_EDITION=self_hosted
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SHOW_DEMO_LOGINS=$NEXT_PUBLIC_SHOW_DEMO_LOGINS NEXT_PUBLIC_EDITION=$NEXT_PUBLIC_EDITION NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://localhost:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
