# syntax=docker/dockerfile:1.7

# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/qr-menu/package.json ./apps/qr-menu/package.json
RUN pnpm install --filter @quickarte/qr-menu... --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/qr-menu/node_modules ./apps/qr-menu/node_modules
COPY . .
RUN pnpm --filter @quickarte/qr-menu build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/qr-menu/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/qr-menu/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/qr-menu/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/qr-menu/lib/db/migrations ./lib/db/migrations

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
