# syntax=docker/dockerfile:1.7

# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/qr-menu/package.json ./apps/qr-menu/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/db-schema/package.json ./packages/db-schema/package.json
COPY packages/i18n/package.json ./packages/i18n/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --filter @quickarte/qr-menu... --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE_TRACE_ROOT=workspace
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/qr-menu/node_modules ./apps/qr-menu/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/db-schema/node_modules ./packages/db-schema/node_modules
COPY --from=deps /app/packages/i18n/node_modules ./packages/i18n/node_modules
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

COPY --from=builder /app/apps/qr-menu/public ./apps/qr-menu/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/qr-menu/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/qr-menu/.next/static ./apps/qr-menu/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/db-schema/migrations ./packages/db-schema/migrations

USER nextjs
EXPOSE 3000

CMD ["node", "apps/qr-menu/server.js"]
