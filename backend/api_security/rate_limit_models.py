"""
Rate Limiting Models for API Security

Provides granular rate limiting configuration with:
- Multiple time windows (minute, hour, day)
- Per API key, endpoint, or user limits
- Burst handling and custom error messages
- Real-time monitoring and alerting
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, JSON, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base


class RateLimitWindow(enum.Enum):
    """Time windows for rate limiting"""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class RateLimitTarget(enum.Enum):
    """Target types for rate limiting"""
    GLOBAL = "global"  # Applies to all requests
    API_KEY = "api_key"  # Specific API key
    USER = "user"  # Specific user
    ENDPOINT = "endpoint"  # Specific endpoint pattern
    IP_ADDRESS = "ip_address"  # Specific IP or range


class ViolationAction(enum.Enum):
    """Actions to take on rate limit violations"""
    BLOCK = "block"  # Block with 429 response
    THROTTLE = "throttle"  # Slow down requests
    ALERT = "alert"  # Alert but allow
    LOG = "log"  # Log only


class RateLimitPolicy(Base):
    """Rate limit policy configuration"""
    __tablename__ = 'rate_limit_policies'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    
    # Target configuration
    target_type = Column(SQLEnum(RateLimitTarget), nullable=False)
    target_value = Column(String(255))  # API key ID, user ID, endpoint pattern, IP range
    
    # Limit configuration
    window = Column(SQLEnum(RateLimitWindow), nullable=False)
    limit = Column(Integer, nullable=False)
    
    # Burst handling
    burst_enabled = Column(Boolean, default=False)
    burst_limit = Column(Integer)  # Max burst size
    burst_window_seconds = Column(Integer)  # Burst window duration
    
    # Response configuration
    custom_error_message = Column(Text)
    custom_headers = Column(JSON)  # Additional headers to include
    
    # Advanced options
    exclude_patterns = Column(JSON)  # Endpoint patterns to exclude
    include_patterns = Column(JSON)  # Endpoint patterns to include (if set, only these are limited)
    method_specific = Column(JSON)  # Different limits per HTTP method
    
    # Control
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher priority policies evaluated first
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    created_by_id = Column(String(36), ForeignKey('users.id'))
    
    # Relationships
    created_by = relationship('User', foreign_keys=[created_by_id])
    violations = relationship('RateLimitViolation', back_populates='policy', cascade='all, delete-orphan')
    alerts = relationship('RateLimitAlert', back_populates='policy', cascade='all, delete-orphan')


class RateLimitViolation(Base):
    """Log of rate limit violations"""
    __tablename__ = 'rate_limit_violations'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id = Column(String(36), ForeignKey('rate_limit_policies.id'), nullable=False)
    
    # Request details
    identifier = Column(String(255), nullable=False)  # API key, user ID, IP
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    # Violation details
    window_start = Column(DateTime, nullable=False)
    request_count = Column(Integer, nullable=False)
    limit_exceeded_by = Column(Integer, nullable=False)
    
    # Response
    action_taken = Column(SQLEnum(ViolationAction), nullable=False)
    response_code = Column(Integer)
    
    # Timestamp
    violated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    policy = relationship('RateLimitPolicy', back_populates='violations')


class RateLimitAlert(Base):
    """Alert configuration for rate limit violations"""
    __tablename__ = 'rate_limit_alerts'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id = Column(String(36), ForeignKey('rate_limit_policies.id'), nullable=False)
    
    # Alert configuration
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Trigger conditions
    violation_threshold = Column(Integer, default=1)  # Number of violations to trigger
    time_window_minutes = Column(Integer, default=5)  # Time window for threshold
    
    # Notification
    notify_emails = Column(JSON)  # List of emails
    notify_webhooks = Column(JSON)  # List of webhook URLs
    notify_slack = Column(JSON)  # Slack configuration
    
    # Control
    is_active = Column(Boolean, default=True)
    cooldown_minutes = Column(Integer, default=60)  # Don't alert again for this period
    
    # Tracking
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    policy = relationship('RateLimitPolicy', back_populates='alerts')


class RateLimitMetrics(Base):
    """Aggregated metrics for rate limiting"""
    __tablename__ = 'rate_limit_metrics'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id = Column(String(36), ForeignKey('rate_limit_policies.id'))
    
    # Time bucket
    bucket_start = Column(DateTime, nullable=False)
    bucket_minutes = Column(Integer, nullable=False)  # Bucket duration
    
    # Metrics
    total_requests = Column(Integer, default=0)
    blocked_requests = Column(Integer, default=0)
    throttled_requests = Column(Integer, default=0)
    
    # Performance
    avg_response_time_ms = Column(Float)
    p95_response_time_ms = Column(Float)
    p99_response_time_ms = Column(Float)
    
    # Top violators
    top_violators = Column(JSON)  # List of {identifier, count}
    top_endpoints = Column(JSON)  # List of {endpoint, count}
    
    # Calculated metrics
    violation_rate = Column(Float)  # Percentage of blocked requests
    
    created_at = Column(DateTime, default=datetime.utcnow)


class RateLimitCache(Base):
    """Redis-backed cache for rate limit counters"""
    __tablename__ = 'rate_limit_cache'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Cache key components
    policy_id = Column(String(36), ForeignKey('rate_limit_policies.id'), nullable=False)
    identifier = Column(String(255), nullable=False)  # API key, user ID, IP
    window_start = Column(DateTime, nullable=False)
    
    # Counter
    request_count = Column(Integer, default=0)
    
    # Burst tracking
    burst_tokens = Column(Float)
    last_refill = Column(DateTime)
    
    # TTL
    expires_at = Column(DateTime, nullable=False)
    
    # Indexes for fast lookup
    __table_args__ = (
        {'mysql_engine': 'InnoDB'}
    )