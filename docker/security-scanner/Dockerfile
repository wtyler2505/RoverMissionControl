FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    docker.io \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install security tools
RUN pip install --no-cache-dir \
    requests \
    pyyaml \
    schedule \
    docker \
    prometheus-client \
    slack-sdk

# Install Syft for SBOM generation
RUN curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Install OPA
RUN curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/v0.60.0/opa_linux_amd64_static && \
    chmod +x /usr/local/bin/opa

# Create non-root user
RUN useradd -m -u 1000 scanner

# Set working directory
WORKDIR /app

# Copy scanner application
COPY --chown=scanner:scanner scanner.py requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create results directory
RUN mkdir -p /results && chown scanner:scanner /results

# Switch to non-root user
USER scanner

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health').raise_for_status()"

# Run the scanner
CMD ["python", "-u", "scanner.py"]