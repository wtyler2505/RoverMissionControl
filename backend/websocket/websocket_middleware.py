"""
WebSocket Security Middleware and Authentication

This module provides comprehensive security features for WebSocket connections:
- Authentication and authorization
- CORS protection
- Rate limiting and DDoS protection
- Secure headers implementation
- CSRF token validation
- IP filtering and geoblocking
- Session management
- Security logging and monitoring
"""

import asyncio
import hashlib
import hmac
import ipaddress
import time
import secrets
import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import json

from ..auth.models import User
from ..auth.utils import verify_token
from ..auth.dependencies import get_optional_user


logger = logging.getLogger(__name__)


class SecurityLevel(Enum):
    """Security level enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"


class ThreatType(Enum):
    """Security threat types"""
    BRUTE_FORCE = "brute_force"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_TOKEN = "invalid_token"
    SUSPICIOUS_IP = "suspicious_ip"
    MALFORMED_REQUEST = "malformed_request"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    CSRF_VIOLATION = "csrf_violation"
    PROTOCOL_VIOLATION = "protocol_violation"


@dataclass
class SecurityConfig:
    """WebSocket security configuration"""
    # Authentication
    require_auth: bool = True
    allow_anonymous: bool = False
    token_validation_strict: bool = True
    session_timeout_minutes: int = 60
    
    # Rate limiting
    rate_limit_enabled: bool = True
    max_connections_per_ip: int = 10
    max_messages_per_minute: int = 100
    max_auth_attempts_per_ip: int = 5
    auth_lockout_duration_minutes: int = 15
    
    # CORS
    cors_enabled: bool = True
    allowed_origins: List[str] = field(default_factory=lambda: ["*"])
    allowed_headers: List[str] = field(default_factory=lambda: ["Authorization", "Content-Type"])
    
    # Security headers
    enforce_secure_headers: bool = True
    csrf_protection: bool = True
    csrf_token_lifetime_minutes: int = 30
    
    # IP filtering
    ip_filtering_enabled: bool = False
    blocked_ips: Set[str] = field(default_factory=set)
    allowed_ips: Set[str] = field(default_factory=set)
    blocked_networks: List[str] = field(default_factory=list)
    
    # Content security
    max_message_size: int = 1048576  # 1MB
    message_validation: bool = True
    binary_data_allowed: bool = True
    
    # Monitoring
    security_logging: bool = True
    threat_detection: bool = True
    auto_ban_enabled: bool = True
    auto_ban_threshold: int = 10
    auto_ban_duration_hours: int = 24


@dataclass
class SecurityEvent:
    """Security event record"""
    timestamp: datetime
    threat_type: ThreatType
    source_ip: str
    user_id: Optional[int]
    sid: str
    description: str
    severity: str
    blocked: bool
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "threat_type": self.threat_type.value,
            "source_ip": self.source_ip,
            "user_id": self.user_id,
            "sid": self.sid,
            "description": self.description,
            "severity": self.severity,
            "blocked": self.blocked,
            "metadata": self.metadata
        }


@dataclass
class RateLimitState:
    """Rate limiting state for an IP address"""
    message_timestamps: deque = field(default_factory=lambda: deque(maxlen=1000))
    connection_count: int = 0
    auth_attempts: int = 0
    last_auth_attempt: Optional[datetime] = None
    locked_until: Optional[datetime] = None
    violations: int = 0


@dataclass
class CSRFToken:
    """CSRF token with metadata"""
    token: str
    created_at: datetime
    user_id: Optional[int]
    ip_address: str
    expires_at: datetime
    
    def is_valid(self) -> bool:
        """Check if token is still valid"""
        return datetime.utcnow() < self.expires_at
    
    def matches(self, token: str, user_id: Optional[int], ip_address: str) -> bool:
        """Check if token matches the provided parameters"""
        return (self.token == token and 
                self.user_id == user_id and 
                self.ip_address == ip_address and 
                self.is_valid())


class SecurityMonitor:
    """Security monitoring and threat detection"""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.security_events: deque = deque(maxlen=10000)
        self.threat_counters: Dict[str, Dict[ThreatType, int]] = defaultdict(lambda: defaultdict(int))
        self.banned_ips: Dict[str, datetime] = {}
        
    async def log_security_event(
        self,
        threat_type: ThreatType,
        source_ip: str,
        sid: str,
        description: str,
        user_id: Optional[int] = None,
        severity: str = "medium",
        metadata: Optional[Dict[str, Any]] = None
    ) -> SecurityEvent:
        """Log a security event"""
        event = SecurityEvent(
            timestamp=datetime.utcnow(),
            threat_type=threat_type,
            source_ip=source_ip,
            user_id=user_id,
            sid=sid,
            description=description,
            severity=severity,
            blocked=False,
            metadata=metadata or {}
        )
        
        if self.config.security_logging:
            logger.warning(f"Security event: {description} from {source_ip} (threat: {threat_type.value})")
        
        # Store event
        self.security_events.append(event)
        
        # Update threat counters
        self.threat_counters[source_ip][threat_type] += 1
        
        # Check for auto-ban
        if self.config.auto_ban_enabled:
            await self._check_auto_ban(source_ip, threat_type)
        
        return event
    
    async def _check_auto_ban(self, ip_address: str, threat_type: ThreatType):
        """Check if IP should be auto-banned"""
        total_threats = sum(self.threat_counters[ip_address].values())
        
        if total_threats >= self.config.auto_ban_threshold:
            ban_until = datetime.utcnow() + timedelta(hours=self.config.auto_ban_duration_hours)
            self.banned_ips[ip_address] = ban_until
            
            logger.error(f"Auto-banned IP {ip_address} until {ban_until} (threats: {total_threats})")
    
    def is_ip_banned(self, ip_address: str) -> bool:
        """Check if IP is currently banned"""
        if ip_address not in self.banned_ips:
            return False
        
        ban_expiry = self.banned_ips[ip_address]
        if datetime.utcnow() > ban_expiry:
            # Ban expired
            del self.banned_ips[ip_address]
            return False
        
        return True
    
    def get_security_stats(self) -> Dict[str, Any]:
        """Get security statistics"""
        recent_events = [e for e in self.security_events if e.timestamp > datetime.utcnow() - timedelta(hours=1)]
        
        threat_stats = defaultdict(int)
        for event in recent_events:
            threat_stats[event.threat_type.value] += 1
        
        return {
            "total_events": len(self.security_events),
            "recent_events_1h": len(recent_events),
            "threat_breakdown": dict(threat_stats),
            "banned_ips": len(self.banned_ips),
            "monitored_ips": len(self.threat_counters),
            "active_bans": list(self.banned_ips.keys())
        }


class WebSocketAuthMiddleware:
    """Comprehensive WebSocket authentication and security middleware"""
    
    def __init__(self, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
        self.security_monitor = SecurityMonitor(self.config)
        
        # Rate limiting state
        self.rate_limits: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        
        # CSRF tokens
        self.csrf_tokens: Dict[str, CSRFToken] = {}
        
        # Active sessions
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        
        # Statistics
        self.stats = {
            "connections_authenticated": 0,
            "connections_rejected": 0,
            "tokens_validated": 0,
            "csrf_violations": 0,
            "rate_limit_violations": 0,
            "ip_blocks": 0
        }
    
    async def authenticate_connection(
        self,
        sid: str,
        environ: Dict[str, Any],
        auth_data: Optional[Dict[str, Any]] = None
    ) -> Optional[User]:
        """Authenticate WebSocket connection"""
        try:
            # Extract client information
            remote_addr = self._get_client_ip(environ)
            user_agent = environ.get("HTTP_USER_AGENT", "unknown")
            
            # Security checks
            if not await self._perform_security_checks(sid, remote_addr, environ):
                self.stats["connections_rejected"] += 1
                return None
            
            # Rate limiting
            if not await self._check_rate_limits(sid, remote_addr):
                await self.security_monitor.log_security_event(
                    ThreatType.RATE_LIMIT_EXCEEDED,
                    remote_addr,
                    sid,
                    "Rate limit exceeded during authentication"
                )
                self.stats["connections_rejected"] += 1
                return None
            
            # Skip authentication if not required
            if not self.config.require_auth and self.config.allow_anonymous:
                self.stats["connections_authenticated"] += 1
                return None
            
            # Extract authentication token
            token = self._extract_token(environ, auth_data)
            if not token:
                if self.config.allow_anonymous:
                    return None
                await self.security_monitor.log_security_event(
                    ThreatType.INVALID_TOKEN,
                    remote_addr,
                    sid,
                    "No authentication token provided"
                )
                self.stats["connections_rejected"] += 1
                return None
            
            # Validate token
            user = await self._validate_token(token, remote_addr, sid)
            if not user:
                # Record failed authentication
                rate_limit_state = self.rate_limits[remote_addr]
                rate_limit_state.auth_attempts += 1
                rate_limit_state.last_auth_attempt = datetime.utcnow()
                
                await self.security_monitor.log_security_event(
                    ThreatType.INVALID_TOKEN,
                    remote_addr,
                    sid,
                    "Invalid authentication token"
                )
                self.stats["connections_rejected"] += 1
                return None
            
            # CSRF validation for authenticated users
            if self.config.csrf_protection and auth_data:
                if not await self._validate_csrf_token(auth_data, user, remote_addr):
                    await self.security_monitor.log_security_event(
                        ThreatType.CSRF_VIOLATION,
                        remote_addr,
                        sid,
                        "CSRF token validation failed"
                    )
                    self.stats["csrf_violations"] += 1
                    self.stats["connections_rejected"] += 1
                    return None
            
            # Create session
            await self._create_session(sid, user, remote_addr, user_agent)
            
            self.stats["connections_authenticated"] += 1
            return user
            
        except Exception as e:
            logger.error(f"Authentication error for {sid}: {e}")
            self.stats["connections_rejected"] += 1
            return None
    
    def _get_client_ip(self, environ: Dict[str, Any]) -> str:
        """Extract client IP address from environment"""
        # Check for forwarded headers (reverse proxy)
        forwarded_for = environ.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            # Take first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = environ.get("HTTP_X_REAL_IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to remote address
        return environ.get("REMOTE_ADDR", "unknown")
    
    async def _perform_security_checks(
        self,
        sid: str,
        remote_addr: str,
        environ: Dict[str, Any]
    ) -> bool:
        """Perform basic security checks"""
        try:
            # Check if IP is banned
            if self.security_monitor.is_ip_banned(remote_addr):
                await self.security_monitor.log_security_event(
                    ThreatType.SUSPICIOUS_IP,
                    remote_addr,
                    sid,
                    "Connection from banned IP",
                    severity="high"
                )
                return False
            
            # IP filtering
            if self.config.ip_filtering_enabled:
                if not await self._check_ip_allowed(remote_addr):
                    await self.security_monitor.log_security_event(
                        ThreatType.SUSPICIOUS_IP,
                        remote_addr,
                        sid,
                        "Connection from blocked IP/network"
                    )
                    self.stats["ip_blocks"] += 1
                    return False
            
            # CORS checks
            if self.config.cors_enabled:
                if not await self._check_cors(environ):
                    await self.security_monitor.log_security_event(
                        ThreatType.PROTOCOL_VIOLATION,
                        remote_addr,
                        sid,
                        "CORS violation"
                    )
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Security check error: {e}")
            return False
    
    async def _check_ip_allowed(self, ip_address: str) -> bool:
        """Check if IP address is allowed"""
        try:
            ip = ipaddress.ip_address(ip_address)
            
            # Check explicit blocks
            if ip_address in self.config.blocked_ips:
                return False
            
            # Check allowed IPs (if specified)
            if self.config.allowed_ips and ip_address not in self.config.allowed_ips:
                return False
            
            # Check blocked networks
            for network_str in self.config.blocked_networks:
                try:
                    network = ipaddress.ip_network(network_str, strict=False)
                    if ip in network:
                        return False
                except ValueError:
                    continue
            
            return True
            
        except ValueError:
            # Invalid IP address
            return False
    
    async def _check_cors(self, environ: Dict[str, Any]) -> bool:
        """Check CORS headers"""
        origin = environ.get("HTTP_ORIGIN", "")
        
        if not origin:
            return True  # No origin header is okay
        
        # Check against allowed origins
        if "*" in self.config.allowed_origins:
            return True
        
        return origin in self.config.allowed_origins
    
    async def _check_rate_limits(self, sid: str, ip_address: str) -> bool:
        """Check rate limits for the IP address"""
        if not self.config.rate_limit_enabled:
            return True
        
        rate_limit_state = self.rate_limits[ip_address]
        current_time = datetime.utcnow()
        
        # Check if IP is locked out from auth attempts
        if (rate_limit_state.locked_until and 
            current_time < rate_limit_state.locked_until):
            return False
        
        # Check auth attempts
        if (rate_limit_state.auth_attempts >= self.config.max_auth_attempts_per_ip and
            rate_limit_state.last_auth_attempt and
            current_time - rate_limit_state.last_auth_attempt < timedelta(minutes=self.config.auth_lockout_duration_minutes)):
            
            # Lock out IP
            rate_limit_state.locked_until = current_time + timedelta(minutes=self.config.auth_lockout_duration_minutes)
            return False
        
        # Reset auth attempts if lockout period has passed
        if (rate_limit_state.last_auth_attempt and
            current_time - rate_limit_state.last_auth_attempt >= timedelta(minutes=self.config.auth_lockout_duration_minutes)):
            rate_limit_state.auth_attempts = 0
        
        # Check connection limits
        if rate_limit_state.connection_count >= self.config.max_connections_per_ip:
            return False
        
        return True
    
    def _extract_token(self, environ: Dict[str, Any], auth_data: Optional[Dict[str, Any]]) -> Optional[str]:
        """Extract authentication token from request"""
        # Try auth_data first
        if auth_data and "token" in auth_data:
            return auth_data["token"]
        
        # Try Authorization header
        auth_header = environ.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        
        # Try query parameter
        query_string = environ.get("QUERY_STRING", "")
        if "token=" in query_string:
            for param in query_string.split("&"):
                if param.startswith("token="):
                    return param.split("=", 1)[1]
        
        return None
    
    async def _validate_token(self, token: str, remote_addr: str, sid: str) -> Optional[User]:
        """Validate authentication token"""
        try:
            # Verify JWT token
            payload = verify_token(token, token_type="access")
            if not payload:
                return None
            
            user_id = payload.get("sub")
            if not user_id:
                return None
            
            # For this implementation, we'll need to get the user from database
            # This would typically be injected or imported from the auth system
            # For now, we'll create a mock user validation
            
            # TODO: Replace with actual user lookup
            # user = await get_user_by_id(user_id)
            # if not user or not user.is_active:
            #     return None
            
            self.stats["tokens_validated"] += 1
            return None  # Return None for now, replace with actual user
            
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return None
    
    async def _validate_csrf_token(
        self,
        auth_data: Dict[str, Any],
        user: User,
        remote_addr: str
    ) -> bool:
        """Validate CSRF token"""
        csrf_token = auth_data.get("csrf_token")
        if not csrf_token:
            return False
        
        # Find matching token
        token_obj = self.csrf_tokens.get(csrf_token)
        if not token_obj:
            return False
        
        # Validate token
        return token_obj.matches(csrf_token, user.id, remote_addr)
    
    async def _create_session(
        self,
        sid: str,
        user: Optional[User],
        remote_addr: str,
        user_agent: str
    ):
        """Create user session"""
        session_data = {
            "sid": sid,
            "user_id": user.id if user else None,
            "remote_addr": remote_addr,
            "user_agent": user_agent,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=self.config.session_timeout_minutes)
        }
        
        self.active_sessions[sid] = session_data
        
        # Update connection count
        self.rate_limits[remote_addr].connection_count += 1
    
    async def cleanup_connection(self, sid: str):
        """Clean up connection resources"""
        session = self.active_sessions.pop(sid, None)
        if session:
            remote_addr = session["remote_addr"]
            if remote_addr in self.rate_limits:
                self.rate_limits[remote_addr].connection_count = max(
                    0, self.rate_limits[remote_addr].connection_count - 1
                )
    
    def generate_csrf_token(self, user_id: Optional[int], ip_address: str) -> str:
        """Generate CSRF token"""
        token = secrets.token_urlsafe(32)
        
        csrf_token = CSRFToken(
            token=token,
            created_at=datetime.utcnow(),
            user_id=user_id,
            ip_address=ip_address,
            expires_at=datetime.utcnow() + timedelta(minutes=self.config.csrf_token_lifetime_minutes)
        )
        
        self.csrf_tokens[token] = csrf_token
        
        # Clean up old tokens
        self._cleanup_csrf_tokens()
        
        return token
    
    def _cleanup_csrf_tokens(self):
        """Clean up expired CSRF tokens"""
        current_time = datetime.utcnow()
        expired_tokens = [
            token for token, csrf_obj in self.csrf_tokens.items()
            if not csrf_obj.is_valid()
        ]
        
        for token in expired_tokens:
            del self.csrf_tokens[token]
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get security headers to send with responses"""
        if not self.config.enforce_secure_headers:
            return {}
        
        return {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws: wss:",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        }
    
    async def validate_message(self, sid: str, data: Any) -> bool:
        """Validate incoming message"""
        if not self.config.message_validation:
            return True
        
        try:
            # Check message size
            if isinstance(data, (str, bytes)):
                if len(data) > self.config.max_message_size:
                    session = self.active_sessions.get(sid)
                    if session:
                        await self.security_monitor.log_security_event(
                            ThreatType.MALFORMED_REQUEST,
                            session["remote_addr"],
                            sid,
                            f"Message size exceeded limit: {len(data)} bytes"
                        )
                    return False
            
            # Check binary data allowance
            if isinstance(data, bytes) and not self.config.binary_data_allowed:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Message validation error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get middleware statistics"""
        security_stats = self.security_monitor.get_security_stats()
        
        return {
            **self.stats,
            "active_sessions": len(self.active_sessions),
            "csrf_tokens": len(self.csrf_tokens),
            "rate_limited_ips": len(self.rate_limits),
            "security": security_stats
        }