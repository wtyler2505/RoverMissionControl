# Build stage
FROM node:18-alpine AS builder

# Install build dependencies including image optimization tools
RUN apk add --no-cache python3 make g++ vips-dev libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with frozen lockfile
RUN yarn install --frozen-lockfile --network-timeout 100000

# Copy source code
COPY . .

# Copy optimization scripts
COPY ../scripts/optimize-assets.js ../scripts/

# Build the application with asset optimization
ENV NODE_ENV=production
RUN yarn build:production

# Production dependencies stage
FROM node:18-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production --network-timeout 100000 && \
    yarn cache clean

# Final stage
FROM nginx:alpine

# Install runtime dependencies
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy nginx configuration
COPY --chown=nodejs:nodejs nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/build /usr/share/nginx/html

# Add labels
LABEL maintainer="Rover Mission Control Team" \
      version="1.0.0" \
      description="Rover Mission Control Frontend" \
      org.opencontainers.image.source="https://github.com/yourusername/rovermissioncontrol" \
      org.opencontainers.image.vendor="Rover Mission Control" \
      org.opencontainers.image.title="Rover Mission Control Frontend" \
      org.opencontainers.image.description="React-based frontend for Rover Mission Control System"

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Copy startup scripts
COPY --chown=nodejs:nodejs ../docker/scripts/frontend-startup.* /usr/local/bin/
RUN chmod +x /usr/local/bin/frontend-startup.sh

# Create necessary directories
RUN mkdir -p /var/log/nginx && chown -R nodejs:nodejs /var/log/nginx

# Use tini to handle signals properly with our startup script
ENTRYPOINT ["tini", "--"]

# Run the startup script (which will start nginx)
CMD ["/usr/local/bin/frontend-startup.py"]