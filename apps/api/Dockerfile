# =============================================================================
# CSN API - dev image (ts-node runtime, no production build)
# =============================================================================
# The NX monorepo's library tsconfigs have unresolved rootDir/path-alias
# conflicts that block `nx build api` in CI. For local testing we run the
# api directly with ts-node, which honors tsconfig path mappings via
# tsconfig-paths/register.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Native deps for some npm packages (bcrypt etc.)
RUN apk add --no-cache python3 make g++ wget

# Install all deps (including dev — ts-node, tsconfig-paths)
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts --legacy-peer-deps && \
    npm rebuild bcrypt && \
    npm cache clean --force

# Copy NX + TS config and source
COPY nx.json tsconfig.base.json ./
COPY apps/api/ apps/api/
COPY libs/ libs/

EXPOSE 3000

ENV NODE_ENV=development
ENV PORT=3000
ENV TS_NODE_PROJECT=apps/api/tsconfig.app.json
ENV TS_NODE_TRANSPILE_ONLY=true

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "--require", "ts-node/register", "--require", "tsconfig-paths/register", "apps/api/src/main.ts"]
