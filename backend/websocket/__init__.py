"""
WebSocket Infrastructure Module

Comprehensive WebSocket server infrastructure for rover mission control system.
Provides enterprise-grade real-time communication with authentication, security,
and protocol negotiation.

Main Components:
- WebSocketServer: Core Socket.IO v4.x server with FastAPI integration
- ConnectionManager: Connection lifecycle and resource management  
- EventHandlerRegistry: Message routing and command processing
- MessageProtocolManager: Binary and text protocol support
- WebSocketAuthMiddleware: Security and authentication middleware

Usage:
    from backend.websocket import create_websocket_server, ServerConfig
    
    # Create WebSocket server with custom configuration
    config = ServerConfig(
        max_connections=1000,
        require_auth=True,
        enable_compression=True
    )
    
    ws_server = create_websocket_server(app, config)
"""

from .websocket_server import (
    WebSocketServer,
    ServerConfig,
    ServerState,
    create_websocket_server
)

from .connection_manager import (
    ConnectionManager,
    ConnectionInfo,
    ConnectionState,
    ConnectionMetrics,
    SubscriptionInfo,
    RateLimitInfo
)

from .event_handlers import (
    EventHandlerRegistry,
    EventType,
    CommandType,
    EventContext,
    CommandResult,
    TelemetryStreamer,
    RoverController
)

from .message_protocols import (
    MessageProtocolManager,
    ProtocolType,
    CompressionType,
    ProtocolCapabilities,
    MessageHeader,
    MessageEncoder,
    TelemetryProtocol
)

from .websocket_middleware import (
    WebSocketAuthMiddleware,
    SecurityConfig,
    SecurityLevel,
    ThreatType,
    SecurityEvent,
    SecurityMonitor
)

from .http_fallback import (
    router as http_fallback_router,
    initialize_fallback_manager,
    HttpFallbackManager,
    get_fallback_manager
)

from .websocket_manager import WebSocketManager

__all__ = [
    # Main server components
    'WebSocketServer',
    'ServerConfig', 
    'ServerState',
    'create_websocket_server',
    
    # Connection management
    'ConnectionManager',
    'ConnectionInfo',
    'ConnectionState',
    'ConnectionMetrics',
    'SubscriptionInfo',
    'RateLimitInfo',
    
    # Event handling
    'EventHandlerRegistry',
    'EventType',
    'CommandType', 
    'EventContext',
    'CommandResult',
    'TelemetryStreamer',
    'RoverController',
    
    # Message protocols
    'MessageProtocolManager',
    'ProtocolType',
    'CompressionType',
    'ProtocolCapabilities',
    'MessageHeader',
    'MessageEncoder',
    'TelemetryProtocol',
    
    # Security middleware
    'WebSocketAuthMiddleware',
    'SecurityConfig',
    'SecurityLevel',
    'ThreatType',
    'SecurityEvent',
    'SecurityMonitor',
    
    # HTTP fallback
    'http_fallback_router',
    'initialize_fallback_manager',
    'HttpFallbackManager',
    'get_fallback_manager',
    
    # WebSocket Manager
    'WebSocketManager'
]

# Version information
__version__ = '1.0.0'
__author__ = 'Rover Mission Control Team'
__description__ = 'Enterprise WebSocket infrastructure for rover mission control'

# Configuration defaults
DEFAULT_CONFIG = ServerConfig(
    # Connection settings
    cors_allowed_origins=["http://localhost:3000", "http://localhost:8000"],
    cors_credentials=True,
    
    # Socket.IO settings  
    ping_timeout=20,
    ping_interval=25,
    max_http_buffer_size=1000000,
    
    # Connection management
    max_connections=1000,
    connection_timeout=300,
    heartbeat_interval=10,
    heartbeat_timeout=30,
    
    # Message handling
    max_message_size=1048576,
    message_queue_size=1000,
    backpressure_threshold=0.8,
    rate_limit_messages=100,
    rate_limit_window=60,
    
    # Security
    require_auth=True,
    session_secret="your-secret-key-change-in-production",
    csrf_protection=True,
    
    # Performance
    enable_compression=True,
    compression_threshold=1024,
    enable_binary=True
)