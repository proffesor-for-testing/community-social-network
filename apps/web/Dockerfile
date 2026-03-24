# =============================================================================
# Stage 1: Build the React/Vite application
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy NX and TypeScript configuration
COPY nx.json tsconfig.base.json ./

# Copy source code - Web app and shared libraries
COPY apps/web/ apps/web/
COPY libs/shared/ libs/shared/

# Build the web application via NX
RUN npx nx build web --skip-nx-cache

# =============================================================================
# Stage 2: Serve with nginx
# =============================================================================
FROM nginx:alpine AS production

# Add labels for image metadata
LABEL org.opencontainers.image.source="https://github.com/csn/community-social-network"
LABEL org.opencontainers.image.description="CSN Web Frontend"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from build stage
COPY --from=build /app/dist/apps/web /usr/share/nginx/html

# Create non-root user for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
