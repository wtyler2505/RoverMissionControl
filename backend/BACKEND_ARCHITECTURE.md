# Backend Architecture

## Overview
FastAPI-based backend server providing REST APIs and WebSocket connections for rover control and monitoring.

## Directory Structure
```
backend/
├── server.py          # Main FastAPI application (1900+ lines)
├── requirements.txt   # Python dependencies
├── .env              # Environment configuration (gitignored)
├── .env.example      # Example environment configuration
├── models/           # Pydantic models (to be created)
│   ├── __init__.py
│   ├── rover.py     # Rover control models
│   ├── telemetry.py # Telemetry data models
│   └── auth.py      # Authentication models
├── routers/         # API route modules (to be created)
│   ├── __init__.py
│   ├── rover.py     # Rover control endpoints
│   ├── arduino.py   # Arduino integration
│   ├── knowledge.py # Knowledge base endpoints
│   └── websocket.py # WebSocket handlers
├── services/        # Business logic (to be created)
│   ├── __init__.py
│   ├── hardware.py  # Hardware communication
│   ├── auth.py      # Authentication service
│   └── database.py  # Database operations
└── tests/          # Test files (to be created)
    ├── __init__.py
    ├── test_api.py
    └── test_hardware.py
```

## Core Components

### server.py (1900+ lines)
Main application file implementing:

#### API Endpoint Groups

##### 1. **Rover Control** (`/api/rover/*`)
Core hardware control endpoints with real-time command execution.

###### POST `/api/rover/control`
**Description**: Send movement commands to the rover
**Authentication**: Required (JWT Bearer token)
**Rate Limit**: 10 requests per second
**Request Body**:
```python
from pydantic import BaseModel, Field

class RoverControlCommand(BaseModel):
    forward: float = Field(..., ge=-1.0, le=1.0, description="Forward/backward speed")
    turn: float = Field(..., ge=-1.0, le=1.0, description="Left/right turn rate")
    duration: Optional[float] = Field(None, gt=0, le=10.0, description="Command duration in seconds")
```
**Response**: 
```json
{
  "status": "success",
  "command_id": "uuid-v4",
  "timestamp": "2025-07-21T10:30:00Z",
  "executed_command": {
    "forward": 0.5,
    "turn": 0.0,
    "duration": null
  }
}
```
**Error Responses**:
- `400 Bad Request`: Invalid command values
- `401 Unauthorized`: Missing or invalid token
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Hardware disconnected

###### POST `/api/rover/emergency-stop`
**Description**: Immediately halt all rover movement
**Authentication**: Required (JWT Bearer token)
**Priority**: High - bypasses command queue
**Response**:
```json
{
  "status": "stopped",
  "timestamp": "2025-07-21T10:30:00Z",
  "previous_state": {
    "moving": true,
    "speed": 0.5
  }
}
```

###### POST `/api/rover/resume`
**Description**: Resume operations after emergency stop
**Authentication**: Required (JWT Bearer token)
**Response**:
```json
{
  "status": "resumed",
  "timestamp": "2025-07-21T10:30:00Z"
}
```

###### GET `/api/rover/status`
**Description**: Get current rover state and health
**Authentication**: Optional (public endpoint)
**Response**:
```json
{
  "connected": true,
  "emergency_stop": false,
  "position": {
    "x": 0.0,
    "y": 0.0,
    "z": 0.0
  },
  "rotation": {
    "pitch": 0.0,
    "roll": 0.0,
    "yaw": 0.0
  },
  "battery": {
    "voltage": 12.6,
    "percentage": 85,
    "charging": false
  },
  "sensors": {
    "temperature": 25.5,
    "humidity": 45.2
  },
  "last_command": {
    "timestamp": "2025-07-21T10:29:00Z",
    "type": "move",
    "success": true
  }
}
```

##### 2. **Arduino Integration** (`/api/arduino/*`)
Arduino IDE functionality exposed via API for sketch management.

###### POST `/api/arduino/compile`
**Description**: Compile Arduino sketch code
**Authentication**: Required (JWT Bearer token)
**Request Body**:
```python
class ArduinoSketch(BaseModel):
    code: str = Field(..., description="Arduino sketch source code")
    board: str = Field("arduino:avr:uno", description="Board type")
    libraries: List[str] = Field(default_factory=list, description="Required libraries")
```
**Response**:
```json
{
  "status": "success",
  "compilation_id": "uuid-v4",
  "output": "Sketch uses 1234 bytes...",
  "warnings": [],
  "binary_path": "/tmp/sketches/uuid-v4.hex"
}
```

###### POST `/api/arduino/upload`
**Description**: Upload compiled sketch to Arduino
**Authentication**: Required (JWT Bearer token)
**Request Body**:
```python
class UploadRequest(BaseModel):
    binary_path: str = Field(..., description="Path to compiled binary")
    port: str = Field(..., description="Serial port (e.g., COM3, /dev/ttyUSB0)")
    board: str = Field("arduino:avr:uno", description="Target board")
```
**Response**:
```json
{
  "status": "uploaded",
  "port": "COM3",
  "upload_time": 2.5,
  "board_info": {
    "name": "Arduino Uno",
    "vid": "2341",
    "pid": "0043"
  }
}
```

###### GET `/api/arduino/ports`
**Description**: List available serial ports with Arduino detection
**Authentication**: Optional
**Response**:
```json
{
  "ports": [
    {
      "port": "COM3",
      "description": "Arduino Uno",
      "hwid": "USB VID:PID=2341:0043",
      "is_arduino": true
    },
    {
      "port": "COM4",
      "description": "USB Serial Device",
      "hwid": "USB VID:PID=0403:6001",
      "is_arduino": false
    }
  ]
}
```

###### WebSocket `/api/arduino/serial/{port}`
**Description**: Real-time serial port monitoring
**Authentication**: Required (JWT Bearer token in query param)
**Protocol**:
```javascript
// Client -> Server
{
  "type": "configure",
  "baudrate": 9600,
  "databits": 8,
  "parity": "none",
  "stopbits": 1
}

// Server -> Client
{
  "type": "data",
  "timestamp": "2025-07-21T10:30:00Z",
  "data": "Sensor reading: 512\n"
}
```

3. **Knowledge Base** (`/api/knowledge/*`)
   - `/api/knowledge/parts` - GET: Electronic components database
   - `/api/knowledge/documents` - GET: Documentation system
   - `/api/knowledge/search` - GET: Search functionality
   - `/api/knowledge/calculators/*` - Electrical calculators (Ohm's law, etc.)

4. **AI Integration** (`/api/ai/*`)
   - `/api/ai/chat` - POST: Claude AI assistant

##### 5. **Real-time Communication**

###### WebSocket `/api/ws/telemetry`
**Description**: Bidirectional telemetry stream with authentication
**Authentication**: JWT Bearer token via query parameter or cookie
**Implementation**:
```python
from fastapi import WebSocket, Depends, Query, Cookie
from fastapi.websockets import WebSocketDisconnect, WebSocketException
import secrets

async def get_ws_token(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    session: Optional[str] = Cookie(None)
):
    if not token and not session:
        raise WebSocketException(code=1008, reason="No authentication provided")
    # Validate token/session
    return token or session

@app.websocket("/api/ws/telemetry")
async def telemetry_websocket(
    websocket: WebSocket,
    client_id: str = Query(...),
    auth_token: str = Depends(get_ws_token)
):
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Receive commands
            data = await websocket.receive_json()
            
            # Process based on message type
            if data["type"] == "subscribe":
                await manager.subscribe(client_id, data["channels"])
            elif data["type"] == "command":
                await process_command(data["payload"])
            elif data["type"] == "heartbeat":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast(f"Client {client_id} disconnected")
```

**Message Protocol**:
```typescript
// Telemetry Update (Server -> Client)
interface TelemetryMessage {
  type: "telemetry";
  timestamp: string;
  data: {
    position: { x: number; y: number; z: number };
    rotation: { pitch: number; roll: number; yaw: number };
    wheelSpeeds: { fl: number; fr: number; rl: number; rr: number };
    sensors: {
      battery: number;
      temperature: number;
      current: number;
    };
  };
}

// Command (Client -> Server)
interface CommandMessage {
  type: "command";
  payload: {
    action: "move" | "stop" | "calibrate";
    parameters: any;
  };
}

// Subscription Management
interface SubscriptionMessage {
  type: "subscribe" | "unsubscribe";
  channels: string[];
}
```

6. **Data Management** (`/api/data/*`)
   - `/api/data/export` - POST: Export telemetry data

7. **Configuration** (`/api/config`)
   - GET/POST: Application configuration management

#### Key Features
- **Async/Await**: Non-blocking I/O for all operations
- **CORS**: Enabled for all origins (development mode)
- **WebSocket**: Real-time telemetry with heartbeat monitoring
- **Serial Communication**: Direct hardware control via PySerial
- **Background Tasks**: Long-running operations (compilation, etc.)
- **Static Files**: Serves frontend build in production
- **Logging**: Comprehensive logging setup

#### Hardware Interface
- Serial port enumeration and management
- Command queuing for reliable delivery
- Telemetry parsing and streaming
- Emergency stop capabilities

#### Security Implementation

##### Authentication & Authorization

###### JWT Token Authentication
```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import secrets

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Token creation
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Token validation
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user
```

###### Role-Based Access Control (RBAC)
```python
from enum import Enum
from fastapi import Security
from fastapi.security import SecurityScopes

class Role(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"

# Scope definitions
SCOPES = {
    "rover:control": "Control rover movement",
    "rover:view": "View rover status",
    "arduino:upload": "Upload Arduino sketches",
    "system:admin": "System administration"
}

# Dependency for checking scopes
async def check_permissions(
    security_scopes: SecurityScopes,
    current_user: User = Security(get_current_user)
):
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"
        
    for scope in security_scopes.scopes:
        if scope not in current_user.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return current_user

# Usage in endpoints
@app.post("/api/rover/control")
async def control_rover(
    command: RoverControlCommand,
    user: User = Security(check_permissions, scopes=["rover:control"])
):
    # Only users with rover:control scope can access
    return execute_command(command)
```

##### Security Best Practices

###### 1. Environment Variables
```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    # API Keys
    claude_api_key: str
    secret_key: str = secrets.token_urlsafe(32)
    
    # Database
    database_url: str = "sqlite:///data/rover_platform.db"
    
    # CORS
    allowed_origins: List[str] = ["http://localhost:3000"]
    
    # Security
    access_token_expire_minutes: int = 30
    bcrypt_rounds: int = 12
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

###### 2. CORS Configuration
```python
from fastapi.middleware.cors import CORSMiddleware

# Configure CORS based on environment
if os.getenv("ENVIRONMENT") == "production":
    origins = [
        "https://rover.example.com",
        "https://api.rover.example.com"
    ]
else:
    origins = [
        "http://localhost:3000",
        "http://localhost:8001"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Request-ID"]
)
```

###### 3. Rate Limiting
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Create limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"]
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to specific endpoints
@app.post("/api/rover/control")
@limiter.limit("10 per second")  # Hardware control rate limit
async def control_rover(request: Request, command: RoverControlCommand):
    return execute_command(command)
```

###### 4. Input Validation
```python
from pydantic import BaseModel, Field, validator
import re

class RoverControlCommand(BaseModel):
    forward: float = Field(..., ge=-1.0, le=1.0)
    turn: float = Field(..., ge=-1.0, le=1.0)
    duration: Optional[float] = Field(None, gt=0, le=10.0)
    
    @validator('forward', 'turn')
    def validate_control_values(cls, v):
        # Additional validation logic
        if abs(v) < 0.01:  # Dead zone
            return 0.0
        return round(v, 2)  # Limit precision
        
class SerialPortName(BaseModel):
    port: str = Field(..., regex=r"^(COM\d+|/dev/tty[A-Z]+\d*)$")
    
    @validator('port')
    def validate_port_exists(cls, v):
        import serial.tools.list_ports
        available_ports = [p.device for p in serial.tools.list_ports.comports()]
        if v not in available_ports:
            raise ValueError(f"Port {v} not found")
        return v
```

###### 5. SQL Injection Prevention
```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Use parameterized queries
def get_telemetry_by_date(db: Session, start_date: datetime, end_date: datetime):
    query = text("""
        SELECT * FROM telemetry 
        WHERE timestamp BETWEEN :start_date AND :end_date
        ORDER BY timestamp DESC
    """)
    
    result = db.execute(
        query, 
        {"start_date": start_date, "end_date": end_date}
    )
    return result.fetchall()

# Never do string concatenation
# BAD: query = f"SELECT * FROM telemetry WHERE date = '{user_input}'"
```

###### 6. Secure Headers
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

# HTTPS redirect in production
if os.getenv("ENVIRONMENT") == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

# Trusted host validation
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["rover.example.com", "*.rover.example.com"]
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

## Dependencies (requirements.txt)
Key packages:
- **fastapi>=0.104.0**: Web framework
- **uvicorn[standard]>=0.24.0**: ASGI server
- **pyserial>=3.5**: Hardware communication
- **websockets>=15.0**: Real-time communication
- **pymongo>=4.6.0**: Database connectivity (though SQLite is used)
- **bcrypt, PyJWT, passlib**: Security (prepared but not implemented)
- **httpx>=0.24.0**: HTTP client
- **aiofiles>=24.1**: Async file operations

## Configuration
Environment variables (.env):
- `CLAUDE_API_KEY`: API key for Claude AI integration
- Database connection strings (if needed)
- Serial port configurations

## Running the Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run server (port 8001)
python server.py
```

## Architecture Patterns
1. **Repository Pattern**: Not implemented (direct DB access)
2. **Service Layer**: Logic embedded in route handlers
3. **Dependency Injection**: FastAPI's built-in DI for request handling
4. **Event-Driven**: WebSocket for real-time updates

## Integration Points
- Frontend connects via HTTP/WebSocket
- Arduino hardware via serial ports
- SQLite database for persistence
- External Claude API for AI features

## Performance Considerations
- Async operations prevent blocking
- WebSocket reduces polling overhead
- Background tasks for heavy operations
- Connection pooling not implemented

## Error Handling & Logging

### Global Exception Handler
```python
import logging
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Custom exception classes
class RoverException(Exception):
    """Base exception for rover-related errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class HardwareException(RoverException):
    """Hardware communication errors"""
    def __init__(self, message: str):
        super().__init__(message, status_code=503)

class CommandException(RoverException):
    """Invalid command errors"""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)

# Exception handlers
@app.exception_handler(RoverException)
async def rover_exception_handler(request: Request, exc: RoverException):
    logger.error(f"Rover exception: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "rover_error",
            "message": exc.message,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "An unexpected error occurred",
            "request_id": request.state.request_id
        }
    )
```

### Request Logging Middleware
```python
import uuid
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    
    # Log request
    logger.info(
        f"Request {request_id}: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host
        }
    )
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            f"Response {request_id}: {response.status_code} in {process_time:.3f}s",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "process_time": process_time
            }
        )
        
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"Request {request_id} failed after {process_time:.3f}s: {str(e)}",
            extra={"request_id": request_id},
            exc_info=True
        )
        raise
```

## Performance Optimization

### Connection Pooling
```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from databases import Database

# SQLite with proper settings
DATABASE_URL = "sqlite:///data/rover_platform.db"

# Async database
database = Database(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 30.0
    }
)

# Sync engine for migrations
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600
)

# Startup/shutdown events
@app.on_event("startup")
async def startup():
    await database.connect()
    # Run migrations
    # await run_migrations()
    
@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()
```

### Caching Strategy
```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache
from fastapi_cache.backend.redis import RedisBackend
import redis

# Initialize cache
@app.on_event("startup")
async def startup():
    redis_client = redis.from_url("redis://localhost:6379")
    FastAPICache.init(RedisBackend(redis_client), prefix="rover-cache:")

# Cache expensive operations
@app.get("/api/knowledge/parts")
@cache(expire=3600)  # Cache for 1 hour
async def get_parts_list(
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    # Expensive database query
    return await fetch_parts(category, search, page, limit)
```

### Background Tasks
```python
from fastapi import BackgroundTasks
import asyncio

class TelemetryProcessor:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=1000)
        self.processing = False
        
    async def start_processing(self):
        self.processing = True
        while self.processing:
            try:
                data = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                await self.process_telemetry(data)
            except asyncio.TimeoutError:
                continue
                
    async def process_telemetry(self, data):
        # Store in database
        # Calculate statistics
        # Trigger alerts if needed
        pass
        
    async def add_telemetry(self, data):
        if self.queue.full():
            # Drop oldest data
            self.queue.get_nowait()
        await self.queue.put(data)

telemetry_processor = TelemetryProcessor()

@app.on_event("startup")
async def startup():
    asyncio.create_task(telemetry_processor.start_processing())
```

## Testing Strategy

### Unit Tests
```python
# tests/test_api.py
import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
from server import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

def test_rover_status(client):
    response = client.get("/api/rover/status")
    assert response.status_code == 200
    assert response.json()["connected"] in [True, False]

@pytest.mark.asyncio
async def test_rover_control_authenticated(async_client):
    # Get token
    login_response = await async_client.post(
        "/token",
        data={"username": "testuser", "password": "testpass"}
    )
    token = login_response.json()["access_token"]
    
    # Test control endpoint
    response = await async_client.post(
        "/api/rover/control",
        json={"forward": 0.5, "turn": 0.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
```

### WebSocket Tests
```python
from fastapi.testclient import TestClient

def test_websocket_telemetry():
    client = TestClient(app)
    with client.websocket_connect(
        "/api/ws/telemetry?client_id=test&token=test_token"
    ) as websocket:
        # Send subscription
        websocket.send_json({
            "type": "subscribe",
            "channels": ["telemetry", "alerts"]
        })
        
        # Receive confirmation
        data = websocket.receive_json()
        assert data["type"] == "subscription_confirmed"
        
        # Test heartbeat
        websocket.send_json({"type": "heartbeat"})
        pong = websocket.receive_json()
        assert pong["type"] == "pong"
```

## API Documentation

### OpenAPI Extensions
```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
        
    openapi_schema = get_openapi(
        title="Rover Mission Control API",
        version="1.0.0",
        description="""
        # Rover Mission Control API
        
        This API provides endpoints for controlling and monitoring a rover platform.
        
        ## Authentication
        
        Most endpoints require JWT Bearer token authentication. Obtain a token using `/token` endpoint.
        
        ## Rate Limiting
        
        - General endpoints: 100 requests per minute
        - Control endpoints: 10 requests per second
        - WebSocket connections: 5 concurrent per user
        
        ## WebSocket Protocol
        
        See `/docs/websocket` for detailed WebSocket message protocol documentation.
        """,
        routes=app.routes,
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    # Add tags
    openapi_schema["tags"] = [
        {"name": "rover", "description": "Rover control operations"},
        {"name": "arduino", "description": "Arduino integration"},
        {"name": "knowledge", "description": "Knowledge base"},
        {"name": "auth", "description": "Authentication"},
        {"name": "websocket", "description": "WebSocket endpoints"}
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```

## Deployment Configuration

### Production Settings
```python
# gunicorn_config.py
import multiprocessing

bind = "0.0.0.0:8001"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 5

# Logging
accesslog = "/var/log/rover/access.log"
errorlog = "/var/log/rover/error.log"
loglevel = "info"

# Process naming
proc_name = "rover-api"

# Server mechanics
daemon = False
pidfile = "/var/run/rover-api.pid"
user = "rover"
group = "rover"
tmp_upload_dir = "/tmp"

# SSL (if not using reverse proxy)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 rover && chown -R rover:rover /app
USER rover

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8001/health')"

# Run with gunicorn
CMD ["gunicorn", "server:app", "-c", "gunicorn_config.py"]
```

## Monitoring & Observability

### Health Check Endpoint
```python
@app.get("/health", tags=["monitoring"])
async def health_check():
    checks = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # Database check
    try:
        await database.execute("SELECT 1")
        checks["checks"]["database"] = "ok"
    except Exception as e:
        checks["checks"]["database"] = f"error: {str(e)}"
        checks["status"] = "unhealthy"
    
    # Serial port check
    try:
        ports = list_serial_ports()
        checks["checks"]["serial_ports"] = len(ports)
    except Exception as e:
        checks["checks"]["serial_ports"] = f"error: {str(e)}"
        
    # WebSocket connections
    checks["checks"]["websocket_clients"] = len(manager.active_connections)
    
    status_code = 200 if checks["status"] == "healthy" else 503
    return JSONResponse(content=checks, status_code=status_code)
```

### Metrics Collection
```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_client import CONTENT_TYPE_LATEST

# Metrics
request_count = Counter(
    'rover_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'rover_api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint']
)

active_connections = Gauge(
    'rover_websocket_connections',
    'Active WebSocket connections'
)

rover_battery = Gauge(
    'rover_battery_voltage',
    'Rover battery voltage'
)

# Metrics endpoint
@app.get("/metrics", tags=["monitoring"])
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Metrics middleware
@app.middleware("http")
async def track_metrics(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    request_duration.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response
```

## Recommended Next Steps

1. **Immediate Security Fixes**
   - [ ] Move API key to environment variables
   - [ ] Implement JWT authentication
   - [ ] Configure CORS properly
   - [ ] Add rate limiting

2. **Code Organization**
   - [ ] Split server.py into modules
   - [ ] Create dedicated routers
   - [ ] Implement service layer
   - [ ] Add dependency injection

3. **Testing**
   - [ ] Add comprehensive unit tests
   - [ ] Implement integration tests
   - [ ] Add load testing
   - [ ] Create E2E test suite

4. **Documentation**
   - [ ] Generate API client SDKs
   - [ ] Create developer guides
   - [ ] Add inline code documentation
   - [ ] Create architecture diagrams

5. **Production Readiness**
   - [ ] Set up CI/CD pipeline
   - [ ] Implement proper logging
   - [ ] Add monitoring/alerting
   - [ ] Create deployment scripts
   - [ ] Set up database backups