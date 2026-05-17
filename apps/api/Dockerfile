# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/db-schema/package.json ./packages/db-schema/package.json
RUN pnpm install --filter @quickarte/api... --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/db-schema/node_modules ./packages/db-schema/node_modules
COPY . .
RUN pnpm --filter @quickarte/api build
# pnpm deploy creates a self-contained production directory for the API
# workspace. This keeps the runner image from copying the root pnpm virtual
# store, which otherwise drags in unrelated Quickarte web and Expo packages.
RUN pnpm --config.auto-install-peers=false --filter @quickarte/api --prod deploy /deploy-out
# better-auth declares broad framework peers, so pnpm may materialize unused
# peer folders in the deploy virtual store. The API does not run Next/Expo/RN;
# remove those unreferenced framework packages from the production payload.
RUN find /deploy-out/node_modules -type d \( \
    -name next -o \
    -name '@next' -o \
    -name 'expo*' -o \
    -name '@expo' -o \
    -name 'react-native*' -o \
    -name 'hermes-compiler' \
  \) -prune -exec rm -rf '{}' +
# Strip source-only artifacts from the production payload. Swagger UI stays
# because @nestjs/swagger loads it when the decorated controllers are imported.
RUN rm -rf /deploy-out/src /deploy-out/test /deploy-out/scripts \
    /deploy-out/README.md /deploy-out/Dockerfile /deploy-out/eslint.config.mjs \
    /deploy-out/nest-cli.json /deploy-out/tsconfig.json /deploy-out/.turbo \
    /deploy-out/node_modules/.pnpm/@opentelemetry+semantic-conventions@* \
  && find /deploy-out/node_modules -type d \( \
      -name test -o -name tests -o -name docs -o -name examples -o -name benchmark \
    \) -prune -exec rm -rf '{}' + \
  && find /deploy-out/node_modules -type f \( \
      -name '*.md' -o -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \
    \) -delete

FROM alpine:3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ca-certificates libstdc++ \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs
COPY --from=builder /usr/local/bin/node /usr/local/bin/node

COPY --from=builder --chown=nestjs:nodejs /deploy-out ./

USER nestjs
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
