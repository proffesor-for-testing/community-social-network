# =============================================================================
# Stage 1: Install production dependencies only
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# =============================================================================
# Stage 2: Build the NestJS API application
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install ALL dependencies (including devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy NX and TypeScript configuration
COPY nx.json tsconfig.base.json ./

# Copy source code - API app and all required libraries
COPY apps/api/ apps/api/
COPY libs/ libs/

# Build the API application via NX
RUN npx nx build api --skip-nx-cache

# =============================================================================
# Stage 3: Production image
# =============================================================================
FROM node:20-alpine AS production

# Add labels for image metadata
LABEL org.opencontainers.image.source="https://github.com/csn/community-social-network"
LABEL org.opencontainers.image.description="CSN API Server"

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S csn && \
    adduser -S csn -u 1001 -G csn

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/dist/apps/api ./dist

# Copy package.json for metadata
COPY package.json ./

# Set ownership to non-root user
RUN chown -R csn:csn /app

# Switch to non-root user
USER csn

# Expose the API port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Health check - liveness probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
