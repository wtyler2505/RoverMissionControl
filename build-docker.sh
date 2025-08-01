#!/bin/bash

# Build script for Rover Mission Control Docker images

set -e

echo "🚀 Building Rover Mission Control Docker images..."

# Parse arguments
ENVIRONMENT=${1:-development}
NO_CACHE=${2:-false}

# Set build arguments based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📦 Building for PRODUCTION environment"
    BUILD_ARGS="--build-arg NODE_ENV=production"
    COMPOSE_FILE="docker-compose.prod.yml"
else
    echo "🔧 Building for DEVELOPMENT environment"
    BUILD_ARGS=""
    COMPOSE_FILE="docker-compose.yml"
fi

# Add no-cache flag if requested
if [ "$NO_CACHE" = "no-cache" ]; then
    echo "🔄 Building without cache"
    BUILD_ARGS="$BUILD_ARGS --no-cache"
fi

# Build frontend
echo "🎨 Building frontend image..."
docker build $BUILD_ARGS -t rover-mission-control-frontend:latest ./frontend

# Build backend
echo "⚙️ Building backend image..."
docker build $BUILD_ARGS -t rover-mission-control-backend:latest ./backend

# Show image sizes
echo "📊 Image sizes:"
docker images | grep rover-mission-control

# Optional: Run containers
read -p "Start containers? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting containers..."
    docker-compose -f $COMPOSE_FILE up -d
    echo "✅ Containers started!"
    echo "Frontend: http://localhost:3000"
    echo "Backend: http://localhost:8000"
    echo "API Docs: http://localhost:8000/docs"
fi

echo "✨ Build complete!"