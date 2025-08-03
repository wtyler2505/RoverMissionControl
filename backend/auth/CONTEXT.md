# Authentication System - Component Context

## Overview
This directory contains the complete authentication and authorization infrastructure for RoverMissionControl, implementing JWT-based authentication with Role-Based Access Control (RBAC), comprehensive audit logging, and integration with all rover subsystems.

## Core Architecture

### Authentication Flow
1. **Login**: User credentials → Validation → JWT Generation
2. **Token Management**: Access tokens (15min) + Refresh tokens (7days)
3. **Session Tracking**: Active session management with device fingerprinting
4. **Logout**: Token revocation + Session cleanup

### Components

#### Core Services (`services.py`)
- **AuthService**: Central authentication logic
- **TokenService**: JWT generation/validation
- **SessionManager**: Active session tracking
- **PasswordManager**: Bcrypt hashing with configurable rounds

#### API Routes (`router.py`)
- `/api/v1/auth/login` - User authentication
- `/api/v1/auth/refresh` - Token refresh
- `/api/v1/auth/logout` - Session termination
- `/api/v1/auth/me` - Current user info
- `/api/v1/auth/change-password` - Password updates

#### Database Models (`models.py`)
- **User**: User accounts with hashed passwords
- **Role**: Role definitions (admin, operator, viewer)
- **Permission**: Granular permissions
- **UserRole**: User-role associations
- **UserSession**: Active session tracking
- **AuthAuditLog**: Security event logging

#### Integration (`integration.py`)
- WebSocket authentication
- Hardware access control
- API endpoint protection
- Command queue authorization

## Security Features

### Password Security
- **Algorithm**: Bcrypt with 12 rounds (configurable)
- **Requirements**: Min 8 chars, complexity rules
- **History**: Prevents reuse of last 5 passwords
- **Lockout**: Account lock after 5 failed attempts

### Token Security
- **Algorithm**: RS256 (RSA with SHA-256)
- **Access Token**: 15-minute expiry
- **Refresh Token**: 7-day expiry, single-use
- **Storage**: httpOnly cookies (frontend)
- **Rotation**: Automatic refresh token rotation

### Rate Limiting
```python
RATE_LIMITS = {
    'login': '5/minute',
    'refresh': '10/minute',
    'password_change': '3/hour'
}
```

### Audit Logging
```python
# All auth events are logged
audit_log.record({
    'event': 'login_success',
    'user_id': user.id,
    'ip_address': request.client.host,
    'user_agent': request.headers.get('user-agent'),
    'timestamp': datetime.utcnow()
})
```

## RBAC Implementation

### Default Roles
```python
ROLES = {
    'admin': [
        'users:create', 'users:read', 'users:update', 'users:delete',
        'hardware:control', 'telemetry:write', 'system:configure'
    ],
    'operator': [
        'hardware:control', 'telemetry:read', 'telemetry:write',
        'commands:execute', 'emergency:stop'
    ],
    'viewer': [
        'telemetry:read', 'status:read', 'logs:read'
    ]
}
```

### Permission Check
```python
@require_permission('hardware:control')
async def control_rover(request: Request):
    # Only users with hardware:control permission
    pass
```

## Integration Points

### WebSocket Authentication
```python
# WebSocket connection authentication
async def authenticate_websocket(token: str):
    user = await verify_token(token)
    if not user:
        raise WebSocketException(code=4001, reason="Unauthorized")
    return user
```

### Hardware Access Control
```python
# HAL integration
def check_hardware_permission(user: User, operation: str):
    if operation == 'emergency_stop':
        return True  # Always allow emergency stop
    return user.has_permission(f'hardware:{operation}')
```

### API Protection
```python
# FastAPI dependency
async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> User:
    return await verify_access_token(token)
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    failed_attempts INTEGER DEFAULT 0,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    refresh_token_hash VARCHAR(255) UNIQUE,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Common Operations

### User Login
```python
from auth.services import AuthService

auth_service = AuthService()
result = await auth_service.login(
    username="operator1",
    password="secure_password",
    device_info=request.headers
)
# Returns: {access_token, refresh_token, user_info}
```

### Token Refresh
```python
new_tokens = await auth_service.refresh_token(
    refresh_token=current_refresh_token
)
# Returns: {access_token, refresh_token}
```

### Permission Check
```python
from auth.dependencies import require_permission

@router.post("/critical-operation")
@require_permission("system:configure")
async def critical_operation(user: User = Depends(get_current_user)):
    # User has required permission
    pass
```

## Testing

### Unit Tests
```bash
pytest backend/tests/test_auth.py -v
pytest backend/tests/test_rbac.py -v
```

### Integration Tests
```python
# Test complete auth flow
async def test_auth_flow():
    # 1. Login
    tokens = await login(username, password)
    # 2. Access protected resource
    response = await get_protected_resource(tokens.access_token)
    # 3. Refresh token
    new_tokens = await refresh(tokens.refresh_token)
    # 4. Logout
    await logout(new_tokens.access_token)
```

## Environment Configuration

### Required Environment Variables
```env
# JWT Configuration
JWT_SECRET=<32+ character secret>
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Password Hashing
BCRYPT_ROUNDS=12

# Default Admin (first run only)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_me_immediately
```

### Generate JWT Secret
```bash
openssl rand -hex 32
```

## Security Checklist

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens with short expiry
- ✅ Refresh token rotation
- ✅ Rate limiting on auth endpoints
- ✅ Account lockout mechanism
- ✅ Comprehensive audit logging
- ✅ HTTPS enforcement in production
- ✅ CORS properly configured
- ✅ SQL injection prevention
- ✅ XSS protection

## Known Issues & Mitigations

### Issue: Token Storage in Frontend
**Mitigation**: Use httpOnly cookies, not localStorage

### Issue: Concurrent Session Limit
**Mitigation**: Implement device-based session management

### Issue: Password Reset Flow
**Status**: Pending implementation (Task 27.5)

## Future Enhancements

- [ ] Multi-factor authentication (MFA)
- [ ] OAuth2/OIDC integration
- [ ] Biometric authentication support
- [ ] Hardware key (FIDO2) support
- [ ] Session activity monitoring
- [ ] Anomaly detection in auth patterns