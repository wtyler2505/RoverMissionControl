# Environment Variables Guide

This document describes all environment variables used in the RoverMissionControl application.

## Setup Instructions

1. Copy `.env.example` to `.env` in the project root
2. Fill in the appropriate values for your environment
3. **NEVER commit `.env` files to version control**

```bash
cp .env.example .env
```

## Variable Categories

### Application Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment | `development` | Yes |
| `PORT` | Backend server port | `8001` | No |
| `HOST` | Backend server host | `localhost` | No |

### Frontend Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:8001` | Yes |
| `REACT_APP_WEBSOCKET_URL` | WebSocket endpoint | `ws://localhost:8001` | Yes |
| `REACT_APP_API_VERSION` | API version | `v1` | No |
| `REACT_APP_DEBUG_MODE` | Enable debug features | `false` | No |

### API Keys & External Services

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | - | No* |
| `ANTHROPIC_API_KEY` | Claude API key for AI assistant | - | No* |
| `PERPLEXITY_API_KEY` | Perplexity API key for research | - | No* |

*At least one AI API key is recommended for full functionality.

### Security & Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | - | Yes |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` | No |
| `JWT_EXPIRES_IN` | Token expiration time | `24h` | No |
| `SESSION_SECRET` | Session secret (min 32 chars) | - | Yes |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` | No |

### CORS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:3000` | Yes |
| `CORS_CREDENTIALS` | Allow credentials | `true` | No |

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Database connection string | `sqlite:///data/rover_platform.db` | Yes |
| `DATABASE_POOL_SIZE` | Connection pool size | `10` | No |
| `DATABASE_TIMEOUT` | Query timeout (seconds) | `30` | No |

### Hardware Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SERIAL_PORT` | Serial port device | `/dev/ttyUSB0` | No* |
| `SERIAL_BAUDRATE` | Serial communication speed | `115200` | No |
| `I2C_ADDRESS` | I2C device address | `0x48` | No* |
| `CAN_INTERFACE` | CAN bus interface | `can0` | No* |

*Required if using hardware integration features.

### Logging & Monitoring

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FORMAT` | Log format (`json`/`text`) | `json` | No |
| `LOG_FILE` | Log file path | `logs/rover-control.log` | No |
| `METRICS_ENABLED` | Enable metrics collection | `true` | No |
| `METRICS_PORT` | Metrics server port | `9090` | No |

### Development Tools

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DEBUG_ENABLED` | Enable debug features | `true` | No |
| `HOT_RELOAD` | Enable hot reloading | `true` | No |
| `SOURCE_MAPS` | Generate source maps | `true` | No |

### Feature Flags

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FEATURE_AI_ASSISTANT` | Enable AI assistant | `true` | No |
| `FEATURE_ADVANCED_TELEMETRY` | Enable advanced telemetry | `true` | No |
| `FEATURE_MULTI_ROVER` | Enable multi-rover support | `false` | No |
| `FEATURE_CLOUD_SYNC` | Enable cloud synchronization | `false` | No |

## Security Best Practices

### API Keys
- Use environment-specific API keys
- Rotate keys regularly
- Use read-only keys when possible
- Monitor API usage for anomalies

### Secrets Management
- Use strong, random secrets (min 32 characters)
- Different secrets for different environments
- Regular secret rotation
- Consider using secret management services (AWS Secrets Manager, etc.)

### CORS Configuration
- Specify exact origins, avoid wildcards (`*`)
- Use HTTPS in production
- Regularly review allowed origins

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
DEBUG_ENABLED=true
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
LOG_LEVEL=debug
```

### Production
```bash
NODE_ENV=production
DEBUG_ENABLED=false
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
SECURITY_HEADERS_ENABLED=true
```

### Testing
```bash
NODE_ENV=test
DATABASE_URL=sqlite:///:memory:
TEST_API_KEY=test_key_for_automated_tests
LOG_LEVEL=error
```

## Validation

The application validates environment variables on startup:
- Required variables must be present
- API keys must have correct format
- URLs must be valid
- Numeric values must be within acceptable ranges

## Troubleshooting

### Common Issues

1. **Missing required variables**: Check `.env` file exists and contains all required variables
2. **Invalid API keys**: Verify keys are correctly formatted and active
3. **CORS errors**: Check `CORS_ORIGIN` includes your frontend URL
4. **Database connection**: Verify `DATABASE_URL` path and permissions

### Environment Variable Priority

1. System environment variables
2. `.env` file in project root
3. Default values (if specified)

### Debugging

Enable debug logging to see which variables are loaded:
```bash
DEBUG_ENABLED=true
LOG_LEVEL=debug
```

## Security Checklist

- [ ] `.env` files are in `.gitignore`
- [ ] Strong secrets (min 32 characters)
- [ ] API keys are environment-specific
- [ ] CORS origins are explicitly defined
- [ ] Production debug features are disabled
- [ ] Database credentials are secure
- [ ] Regular secret rotation schedule