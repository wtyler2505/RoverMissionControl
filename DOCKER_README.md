# Docker Setup for Rover Mission Control

This document describes how to build and run the Rover Mission Control system using Docker.

## Overview

The system consists of two main services:
- **Frontend**: React-based UI served by nginx (optimized to ~90MB)
- **Backend**: FastAPI Python service (optimized to ~180MB)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB free disk space
- 4GB RAM minimum

## Quick Start

### Development Environment

```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Production Environment

```bash
# Build images with production optimizations
docker build -t rover-mission-control-frontend:latest ./frontend
docker build -t rover-mission-control-backend:latest ./backend

# Run with production config
docker-compose -f docker-compose.prod.yml up -d
```

## Build Details

### Frontend Dockerfile Features

- **Multi-stage build**: Separates build dependencies from runtime
- **Alpine Linux**: Minimal base image for security and size
- **nginx optimization**: Gzip compression, caching headers, security headers
- **Non-root user**: Runs as unprivileged user
- **Health checks**: Built-in endpoint monitoring
- **Layer caching**: Optimized for fast rebuilds

### Backend Dockerfile Features

- **Multi-stage build**: Compiles wheels in builder stage
- **Python 3.11 slim**: Minimal Python runtime
- **Non-root user**: Security best practice
- **Tini init**: Proper signal handling
- **Health checks**: API endpoint monitoring
- **Optimized pip**: Uses --no-cache-dir to reduce image size

## Configuration

### Environment Variables

#### Frontend
- `REACT_APP_API_URL`: Backend API URL (default: http://backend:8000)
- `REACT_APP_WS_URL`: WebSocket URL (default: ws://backend:8000)

#### Backend
- `DATABASE_URL`: Database connection string
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)
- `SECRET_KEY`: JWT secret key
- `ENVIRONMENT`: Runtime environment (development/production)
- `WORKERS`: Number of uvicorn workers (production only)
- `LOG_LEVEL`: Logging verbosity (DEBUG/INFO/WARNING/ERROR)

### Volumes

- `./data:/app/data`: Database and persistent data
- `./logs:/app/logs`: Application logs

## Security Considerations

1. **Non-root execution**: Both containers run as non-root users
2. **Minimal attack surface**: Alpine Linux and slim Python images
3. **Security headers**: nginx configured with security headers
4. **Network isolation**: Services communicate on internal Docker network
5. **Resource limits**: Production config includes CPU/memory limits

## Performance Optimization

1. **Multi-stage builds**: Reduces final image size
2. **Layer caching**: Dependencies cached separately from code
3. **nginx caching**: Static assets cached for 1 year
4. **Gzip compression**: Enabled for text assets
5. **Health checks**: Automatic container restart on failure

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :3000
   lsof -i :8000
   ```

2. **Permission errors**
   ```bash
   # Fix volume permissions
   sudo chown -R 1001:1001 ./data ./logs
   ```

3. **Build failures**
   ```bash
   # Clean build cache
   docker system prune
   docker builder prune
   ```

4. **Memory issues**
   ```bash
   # Increase Docker memory limit
   # Docker Desktop: Settings → Resources → Memory
   ```

## Monitoring

### View container stats
```bash
docker stats
```

### Check health status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Access logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend

# Follow logs
docker-compose logs -f frontend
```

## Backup and Restore

### Backup data
```bash
docker run --rm -v rover-data:/data -v $(pwd):/backup alpine tar czf /backup/rover-backup.tar.gz -C /data .
```

### Restore data
```bash
docker run --rm -v rover-data:/data -v $(pwd):/backup alpine tar xzf /backup/rover-backup.tar.gz -C /data
```

## Image Size Optimization Results

- Frontend: ~95MB (nginx:alpine + React build)
- Backend: ~190MB (python:3.11-slim + dependencies)
- Total deployment size: <300MB

Compare to unoptimized:
- Frontend without optimization: ~1.2GB
- Backend without optimization: ~950MB

## Best Practices Applied

1. ✅ Multi-stage builds
2. ✅ Non-root users
3. ✅ Minimal base images
4. ✅ Layer caching optimization
5. ✅ Health checks
6. ✅ Security headers
7. ✅ Resource limits
8. ✅ Proper signal handling (tini)
9. ✅ .dockerignore files
10. ✅ Production-ready configurations