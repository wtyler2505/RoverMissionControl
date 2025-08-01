# Docker Container Startup and Graceful Shutdown Scripts

## Overview

This directory contains safety-critical startup and graceful shutdown scripts for Docker containers in the Rover Mission Control system. These scripts implement comprehensive validation, health checking, and graceful shutdown mechanisms to ensure reliable operation in production environments.

## Scripts

### Backend Scripts
- `backend-startup.py` - Python implementation with advanced safety features
- `backend-startup.sh` - Shell implementation for environments without Python

### Frontend Scripts
- `frontend-startup.py` - Python implementation for nginx-based frontend
- `frontend-startup.sh` - Shell implementation with circuit breaker pattern

## Safety Features

### 1. **Multi-Stage Validation**
All scripts implement a staged startup sequence with validation at each step:

```
Stage 1: Environment Validation
Stage 2: Filesystem/Asset Validation  
Stage 3: Configuration Testing
Stage 4: Health Checks
Stage 5: Connection Pool Warmup
Stage 6: Application Launch
```

### 2. **Circuit Breaker Pattern**
Frontend scripts include circuit breaker for backend connectivity:
- Closed: Normal operation
- Open: Failures exceeded threshold, blocking new attempts
- Half-Open: Testing if service recovered

### 3. **Graceful Shutdown**
All scripts handle shutdown signals properly:
- `SIGTERM`: Graceful shutdown with request draining
- `SIGINT`: Graceful shutdown (Ctrl+C)
- `SIGHUP`: Configuration reload without downtime

### 4. **Request Draining**
During shutdown:
1. Stop accepting new connections
2. Wait for active requests to complete (configurable timeout)
3. Close connections gracefully
4. Persist application state
5. Clean up resources

## Configuration

### Environment Variables

#### Backend Required:
- `DATABASE_URL`: Database connection string
- `SECRET_KEY`: Application secret (min 32 characters)
- `CORS_ORIGINS`: Allowed CORS origins

#### Backend Optional:
- `REDIS_URL`: Redis connection for caching
- `RABBITMQ_URL`: Message queue connection
- `SENTRY_DSN`: Error tracking
- `LOG_LEVEL`: Logging verbosity

#### Frontend Required:
- `REACT_APP_API_URL`: Backend API endpoint
- `REACT_APP_WS_URL`: WebSocket endpoint

#### Frontend Optional:
- `REACT_APP_ENVIRONMENT`: Deployment environment
- `REACT_APP_SENTRY_DSN`: Frontend error tracking
- `REACT_APP_FEATURE_FLAGS`: Feature toggles

### Timeouts and Limits

```python
# Backend
STARTUP_TIMEOUT = 300          # 5 minutes
DB_CHECK_RETRIES = 30         # Database connection attempts
DB_CHECK_INTERVAL = 2         # Seconds between attempts
MIGRATION_TIMEOUT = 120       # 2 minutes for migrations
WARMUP_CONNECTIONS = 10       # Connection pool size
SHUTDOWN_GRACE_PERIOD = 30    # Request draining timeout

# Frontend  
STARTUP_TIMEOUT = 180         # 3 minutes
BACKEND_CHECK_RETRIES = 20    # Backend health check attempts
BACKEND_CHECK_INTERVAL = 3    # Seconds between attempts
SHUTDOWN_GRACE_PERIOD = 25    # Connection draining timeout
```

## Usage

### Docker Integration

The scripts are automatically integrated via Dockerfile:

```dockerfile
# Backend
COPY --chown=appuser:appuser ../docker/scripts/backend-startup.* /app/scripts/
RUN chmod +x /app/scripts/backend-startup.sh
ENTRYPOINT ["tini", "--"]
CMD ["/app/scripts/backend-startup.py"]

# Frontend
COPY --chown=nodejs:nodejs ../docker/scripts/frontend-startup.* /usr/local/bin/
RUN chmod +x /usr/local/bin/frontend-startup.sh
ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/frontend-startup.py"]
```

### Direct Execution

For testing or debugging:

```bash
# Python version
python3 /app/scripts/backend-startup.py

# Shell version
/app/scripts/backend-startup.sh

# Health check mode
/usr/local/bin/frontend-startup.sh health
```

## Logging and Monitoring

### Log Files
- Backend: `/app/logs/startup.log`
- Frontend: `/var/log/nginx/startup.log`

### State Files
- Startup success: `startup_success.json`
- Startup failure: `startup_failure.json`
- Shutdown state: `shutdown_state.json`
- Migration state: `migration_state.json`

### Log Format
```
[2024-01-28 10:15:23] [INFO] [a1b2c3d4] Stage 1: Environment Validation
```

Components:
- Timestamp: ISO format
- Level: INFO, WARN, ERROR, DEBUG
- Correlation ID: 8-character unique identifier
- Message: Descriptive log message

## Error Handling

### Startup Failures

When startup fails, the scripts:
1. Log detailed error information
2. Write failure marker with timestamp and errors
3. Attempt cleanup of partial state
4. Exit with appropriate code:
   - 1: Validation or expected failure
   - 2: Unexpected error

### Recovery Mechanisms

1. **Database Connection**: Exponential backoff with jitter
2. **Migration Rollback**: Automatic on failure
3. **Circuit Breaker**: Prevents cascade failures
4. **Resource Cleanup**: Always attempted on failure

## Health Checks

### Backend Health Endpoints
- `/api/health`: Basic health status
- `/api/v1/status`: Detailed component status

### Frontend Health Check
```bash
# Used by Docker HEALTHCHECK
/usr/local/bin/frontend-startup.sh health
```

## Signal Handling

### Graceful Shutdown Flow

```
1. Receive SIGTERM/SIGINT
2. Log shutdown initiation
3. Block new requests
4. Wait for active requests (max grace period)
5. Execute shutdown callbacks
6. Persist application state
7. Close connection pools
8. Clean up temporary files
9. Remove PID files
10. Exit with status 0
```

### Configuration Reload (SIGHUP)

- Backend: Reload configuration without restart
- Frontend: Nginx configuration reload via `nginx -s reload`

## Best Practices

### 1. **Always Use Startup Scripts**
Never bypass the startup scripts as they ensure:
- Critical dependencies are available
- Configuration is valid
- Health checks pass
- Proper signal handling

### 2. **Monitor Circuit Breaker State**
Watch for circuit breaker transitions in logs:
```
Circuit breaker opened after 5 failures
Circuit breaker transitioning to half-open state
Circuit breaker closed - service recovered
```

### 3. **Configure Appropriate Timeouts**
Adjust timeouts based on your environment:
- Increase for slower networks
- Decrease for faster failure detection
- Balance between reliability and responsiveness

### 4. **Review Shutdown States**
After graceful shutdown, review state files:
```json
{
  "shutdown_time": "2024-01-28T10:30:45Z",
  "correlation_id": "a1b2c3d4",
  "uptime_seconds": 3600,
  "graceful": true
}
```

### 5. **Enable Debug Mode**
For troubleshooting:
```bash
DEBUG=true /app/scripts/backend-startup.sh
```

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Ensure database is running
   - Check credentials

2. **Migration Failures**
   - Review migration scripts
   - Check rollback succeeded
   - Verify database permissions

3. **Backend Health Check Failures**
   - Verify REACT_APP_API_URL
   - Check backend is running
   - Review circuit breaker state
   - Check network policies

4. **Nginx Configuration Errors**
   - Run `nginx -t` manually
   - Check syntax errors
   - Verify upstream servers

### Debug Commands

```bash
# Check process status
ps aux | grep nginx

# View recent logs
tail -f /var/log/nginx/startup.log

# Test backend connectivity
curl -v http://backend:8000/api/health

# Check file permissions
ls -la /usr/share/nginx/html

# Verify environment
env | grep REACT_APP
```

## Security Considerations

1. **Secret Validation**: SECRET_KEY must be 32+ characters
2. **URL Validation**: All URLs are parsed and validated
3. **File Permissions**: Checked before startup
4. **Non-Root Execution**: Scripts run as unprivileged user
5. **Resource Limits**: Timeouts prevent resource exhaustion

## Integration with Orchestrators

### Docker Compose
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Kubernetes
```yaml
livenessProbe:
  exec:
    command:
    - /usr/local/bin/frontend-startup.sh
    - health
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Maintenance

### Adding New Validation
1. Add to appropriate validation stage
2. Log clear error messages
3. Update documentation
4. Test failure scenarios

### Modifying Timeouts
1. Update CONFIG dictionary
2. Consider downstream effects
3. Test with slow connections
4. Document changes

### Adding Health Checks
1. Implement endpoint
2. Add to health check list
3. Define success criteria
4. Handle partial failures

## License

These scripts are part of the Rover Mission Control system and follow the same license terms.