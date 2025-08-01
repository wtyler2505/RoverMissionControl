# Build stage
FROM python:3.11-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Create wheels for dependencies
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Final stage
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy wheels from builder stage
COPY --from=builder /app/wheels /wheels

# Copy requirements and install from wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appuser /app

# Add labels
LABEL maintainer="Rover Mission Control Team" \
      version="1.0.0" \
      description="Rover Mission Control Backend" \
      org.opencontainers.image.source="https://github.com/yourusername/rovermissioncontrol" \
      org.opencontainers.image.vendor="Rover Mission Control" \
      org.opencontainers.image.title="Rover Mission Control Backend" \
      org.opencontainers.image.description="FastAPI-based backend for Rover Mission Control System"

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy startup scripts
COPY --chown=appuser:appuser ../docker/scripts/backend-startup.* /app/scripts/
RUN chmod +x /app/scripts/backend-startup.sh

# Use tini as entrypoint with our startup script
ENTRYPOINT ["tini", "--"]

# Run the startup script (which will exec uvicorn)
CMD ["/app/scripts/backend-startup.py"]