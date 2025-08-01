"""
Rate Limiting Service Layer

Handles rate limit policy management, enforcement, and monitoring
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
import re
import json
import logging
from collections import defaultdict
import asyncio
import aiohttp

from .rate_limit_models import (
    RateLimitPolicy, RateLimitViolation, RateLimitAlert,
    RateLimitMetrics, RateLimitCache, RateLimitWindow,
    RateLimitTarget, ViolationAction
)
from ..auth.models import User
from ..rbac.audit import AuditLogger

logger = logging.getLogger(__name__)


class RateLimitService:
    """Service for managing rate limiting"""
    
    def __init__(self, db: Session, audit_logger: AuditLogger):
        self.db = db
        self.audit_logger = audit_logger
        self._cache = {}  # In-memory cache (use Redis in production)
        
    # Policy Management
    
    def create_policy(
        self,
        user: User,
        name: str,
        target_type: RateLimitTarget,
        window: RateLimitWindow,
        limit: int,
        **kwargs
    ) -> RateLimitPolicy:
        """Create a new rate limit policy"""
        # Check for duplicate name
        if self.db.query(RateLimitPolicy).filter_by(name=name).first():
            raise ValueError(f"Policy with name '{name}' already exists")
            
        policy = RateLimitPolicy(
            name=name,
            target_type=target_type,
            window=window,
            limit=limit,
            created_by_id=user.id,
            **kwargs
        )
        
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user.id,
            action="RATE_LIMIT_POLICY_CREATE",
            resource_type="rate_limit_policy",
            resource_id=policy.id,
            details={"name": name, "target": target_type.value, "limit": limit}
        )
        
        return policy
        
    def update_policy(
        self,
        user: User,
        policy_id: str,
        updates: Dict[str, Any]
    ) -> RateLimitPolicy:
        """Update a rate limit policy"""
        policy = self.db.query(RateLimitPolicy).filter_by(id=policy_id).first()
        if not policy:
            raise ValueError("Policy not found")
            
        # Update fields
        for key, value in updates.items():
            if hasattr(policy, key):
                setattr(policy, key, value)
                
        policy.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(policy)
        
        # Clear cache for this policy
        self._clear_policy_cache(policy_id)
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user.id,
            action="RATE_LIMIT_POLICY_UPDATE",
            resource_type="rate_limit_policy",
            resource_id=policy_id,
            details={"updates": updates}
        )
        
        return policy
        
    def delete_policy(self, user: User, policy_id: str) -> None:
        """Delete a rate limit policy"""
        policy = self.db.query(RateLimitPolicy).filter_by(id=policy_id).first()
        if not policy:
            raise ValueError("Policy not found")
            
        policy_name = policy.name
        self.db.delete(policy)
        self.db.commit()
        
        # Clear cache
        self._clear_policy_cache(policy_id)
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user.id,
            action="RATE_LIMIT_POLICY_DELETE",
            resource_type="rate_limit_policy",
            resource_id=policy_id,
            details={"name": policy_name}
        )
        
    def get_policies(
        self,
        target_type: Optional[RateLimitTarget] = None,
        active_only: bool = True
    ) -> List[RateLimitPolicy]:
        """Get rate limit policies"""
        query = self.db.query(RateLimitPolicy)
        
        if target_type:
            query = query.filter_by(target_type=target_type)
            
        if active_only:
            query = query.filter_by(is_active=True)
            
        return query.order_by(desc(RateLimitPolicy.priority)).all()
        
    # Rate Limit Checking
    
    def check_rate_limit(
        self,
        identifier: str,
        endpoint: str,
        method: str,
        api_key_id: Optional[str] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, Optional[RateLimitPolicy], Dict[str, Any]]:
        """
        Check if request is within rate limits
        Returns: (allowed, policy, info)
        """
        # Find applicable policies
        policies = self._find_applicable_policies(
            identifier, endpoint, method, api_key_id, user_id, ip_address
        )
        
        if not policies:
            return True, None, {"message": "No rate limit applied"}
            
        # Check each policy (ordered by priority)
        for policy in policies:
            allowed, info = self._check_policy(
                policy, identifier, endpoint, method
            )
            
            if not allowed:
                # Record violation
                self._record_violation(
                    policy, identifier, endpoint, method, ip_address, info
                )
                return False, policy, info
                
        return True, None, {"message": "Within rate limits"}
        
    def _find_applicable_policies(
        self,
        identifier: str,
        endpoint: str,
        method: str,
        api_key_id: Optional[str],
        user_id: Optional[str],
        ip_address: Optional[str]
    ) -> List[RateLimitPolicy]:
        """Find policies that apply to this request"""
        policies = []
        
        # Global policies
        global_policies = self.db.query(RateLimitPolicy).filter(
            and_(
                RateLimitPolicy.target_type == RateLimitTarget.GLOBAL,
                RateLimitPolicy.is_active == True
            )
        ).all()
        policies.extend(global_policies)
        
        # API key specific
        if api_key_id:
            key_policies = self.db.query(RateLimitPolicy).filter(
                and_(
                    RateLimitPolicy.target_type == RateLimitTarget.API_KEY,
                    RateLimitPolicy.target_value == api_key_id,
                    RateLimitPolicy.is_active == True
                )
            ).all()
            policies.extend(key_policies)
            
        # User specific
        if user_id:
            user_policies = self.db.query(RateLimitPolicy).filter(
                and_(
                    RateLimitPolicy.target_type == RateLimitTarget.USER,
                    RateLimitPolicy.target_value == user_id,
                    RateLimitPolicy.is_active == True
                )
            ).all()
            policies.extend(user_policies)            
        # Endpoint specific
        endpoint_policies = self.db.query(RateLimitPolicy).filter(
            and_(
                RateLimitPolicy.target_type == RateLimitTarget.ENDPOINT,
                RateLimitPolicy.is_active == True
            )
        ).all()
        
        # Filter endpoint policies by pattern matching
        for policy in endpoint_policies:
            if self._endpoint_matches(endpoint, policy.target_value):
                policies.append(policy)
                
        # IP address specific
        if ip_address:
            ip_policies = self.db.query(RateLimitPolicy).filter(
                and_(
                    RateLimitPolicy.target_type == RateLimitTarget.IP_ADDRESS,
                    RateLimitPolicy.is_active == True
                )
            ).all()
            
            # Filter IP policies by range matching
            for policy in ip_policies:
                if self._ip_matches(ip_address, policy.target_value):
                    policies.append(policy)
                    
        # Sort by priority (descending)
        policies.sort(key=lambda p: p.priority, reverse=True)
        
        # Apply include/exclude patterns
        filtered_policies = []
        for policy in policies:
            # Check exclude patterns
            if policy.exclude_patterns:
                if any(self._endpoint_matches(endpoint, pattern) 
                      for pattern in policy.exclude_patterns):
                    continue
                    
            # Check include patterns
            if policy.include_patterns:
                if not any(self._endpoint_matches(endpoint, pattern) 
                          for pattern in policy.include_patterns):
                    continue
                    
            # Check method-specific limits
            if policy.method_specific and method in policy.method_specific:
                # Create a copy with method-specific limit
                method_policy = RateLimitPolicy(**policy.__dict__)
                method_policy.limit = policy.method_specific[method]
                filtered_policies.append(method_policy)
            else:
                filtered_policies.append(policy)
                
        return filtered_policies
        
    def _check_policy(
        self,
        policy: RateLimitPolicy,
        identifier: str,
        endpoint: str,
        method: str
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check if request is within policy limits"""
        now = datetime.utcnow()
        window_start = self._get_window_start(now, policy.window)
        cache_key = f"{policy.id}:{identifier}:{window_start}"
        
        # Get current count
        count = self._get_request_count(cache_key, window_start, policy)
        
        # Check burst if enabled
        if policy.burst_enabled:
            burst_allowed, burst_info = self._check_burst(
                policy, identifier, count
            )
            if not burst_allowed:
                return False, {
                    "reason": "Burst limit exceeded",
                    "burst_info": burst_info,
                    "limit": policy.limit,
                    "window": policy.window.value,
                    "current_count": count
                }
                
        # Check regular limit
        if count >= policy.limit:
            retry_after = self._calculate_retry_after(window_start, policy.window)
            return False, {
                "reason": "Rate limit exceeded",
                "limit": policy.limit,
                "window": policy.window.value,
                "current_count": count,
                "retry_after_seconds": retry_after,
                "reset_at": (window_start + self._get_window_duration(policy.window)).isoformat()
            }
            
        # Increment counter
        self._increment_request_count(cache_key, window_start, policy)
        
        return True, {
            "limit": policy.limit,
            "window": policy.window.value,
            "current_count": count + 1,
            "remaining": policy.limit - count - 1
        }
        
    def _record_violation(
        self,
        policy: RateLimitPolicy,
        identifier: str,
        endpoint: str,
        method: str,
        ip_address: Optional[str],
        info: Dict[str, Any]
    ) -> None:
        """Record a rate limit violation"""
        violation = RateLimitViolation(
            policy_id=policy.id,
            identifier=identifier,
            endpoint=endpoint,
            method=method,
            ip_address=ip_address,
            window_start=self._get_window_start(datetime.utcnow(), policy.window),
            request_count=info.get("current_count", 0),
            limit_exceeded_by=info.get("current_count", 0) - policy.limit,
            action_taken=ViolationAction.BLOCK,
            response_code=429
        )
        
        self.db.add(violation)
        self.db.commit()
        
        # Check for alerts
        self._check_alerts(policy, violation)
        
    def _check_alerts(
        self,
        policy: RateLimitPolicy,
        violation: RateLimitViolation
    ) -> None:
        """Check if alerts should be triggered"""
        alerts = self.db.query(RateLimitAlert).filter(
            and_(
                RateLimitAlert.policy_id == policy.id,
                RateLimitAlert.is_active == True
            )
        ).all()
        
        for alert in alerts:
            # Check if in cooldown
            if alert.last_triggered_at:
                cooldown_end = alert.last_triggered_at + timedelta(minutes=alert.cooldown_minutes)
                if datetime.utcnow() < cooldown_end:
                    continue
                    
            # Count recent violations
            since = datetime.utcnow() - timedelta(minutes=alert.time_window_minutes)
            violation_count = self.db.query(RateLimitViolation).filter(
                and_(
                    RateLimitViolation.policy_id == policy.id,
                    RateLimitViolation.violated_at >= since
                )
            ).count()
            
            if violation_count >= alert.violation_threshold:
                # Trigger alert
                asyncio.create_task(self._send_alert(alert, policy, violation_count))
                
                # Update alert
                alert.last_triggered_at = datetime.utcnow()
                alert.trigger_count += 1
                self.db.commit()    # Alert Notifications
    
    async def _send_alert(
        self,
        alert: RateLimitAlert,
        policy: RateLimitPolicy,
        violation_count: int
    ) -> None:
        """Send alert notifications"""
        alert_data = {
            "alert_name": alert.name,
            "policy_name": policy.name,
            "violation_count": violation_count,
            "time_window": f"{alert.time_window_minutes} minutes",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send emails
        if alert.notify_emails:
            # In production, integrate with email service
            logger.info(f"Would send email alert to {alert.notify_emails}: {alert_data}")
            
        # Send webhooks
        if alert.notify_webhooks:
            for webhook_url in alert.notify_webhooks:
                try:
                    async with aiohttp.ClientSession() as session:
                        await session.post(webhook_url, json=alert_data)
                except Exception as e:
                    logger.error(f"Failed to send webhook to {webhook_url}: {e}")
                    
        # Send Slack
        if alert.notify_slack:
            # In production, integrate with Slack API
            logger.info(f"Would send Slack alert: {alert_data}")
            
    # Metrics and Analytics
    
    def collect_metrics(self, bucket_minutes: int = 5) -> None:
        """Collect and aggregate rate limit metrics"""
        now = datetime.utcnow()
        bucket_start = now - (now.minute % bucket_minutes) * timedelta(minutes=1)
        
        # Get all policies
        policies = self.db.query(RateLimitPolicy).filter_by(is_active=True).all()
        
        for policy in policies:
            # Count requests and violations in this bucket
            violations = self.db.query(RateLimitViolation).filter(
                and_(
                    RateLimitViolation.policy_id == policy.id,
                    RateLimitViolation.violated_at >= bucket_start
                )
            ).all()
            
            # Calculate metrics
            total_requests = self._estimate_total_requests(policy, bucket_start)
            blocked_requests = len(violations)
            
            # Get top violators
            violator_counts = defaultdict(int)
            endpoint_counts = defaultdict(int)
            
            for violation in violations:
                violator_counts[violation.identifier] += 1
                endpoint_counts[violation.endpoint] += 1
                
            top_violators = sorted(
                [{"identifier": k, "count": v} for k, v in violator_counts.items()],
                key=lambda x: x["count"],
                reverse=True
            )[:10]
            
            top_endpoints = sorted(
                [{"endpoint": k, "count": v} for k, v in endpoint_counts.items()],
                key=lambda x: x["count"],
                reverse=True
            )[:10]
            
            # Create metrics record
            metrics = RateLimitMetrics(
                policy_id=policy.id,
                bucket_start=bucket_start,
                bucket_minutes=bucket_minutes,
                total_requests=total_requests,
                blocked_requests=blocked_requests,
                violation_rate=blocked_requests / total_requests if total_requests > 0 else 0,
                top_violators=top_violators,
                top_endpoints=top_endpoints
            )
            
            self.db.add(metrics)
            
        self.db.commit()
        
    def get_metrics(
        self,
        policy_id: Optional[str] = None,
        hours_back: int = 24
    ) -> List[RateLimitMetrics]:
        """Get rate limit metrics"""
        since = datetime.utcnow() - timedelta(hours=hours_back)
        
        query = self.db.query(RateLimitMetrics).filter(
            RateLimitMetrics.bucket_start >= since
        )
        
        if policy_id:
            query = query.filter_by(policy_id=policy_id)
            
        return query.order_by(desc(RateLimitMetrics.bucket_start)).all()
        
    def get_violation_history(
        self,
        policy_id: Optional[str] = None,
        identifier: Optional[str] = None,
        hours_back: int = 24,
        limit: int = 100
    ) -> List[RateLimitViolation]:
        """Get violation history"""
        since = datetime.utcnow() - timedelta(hours=hours_back)
        
        query = self.db.query(RateLimitViolation).filter(
            RateLimitViolation.violated_at >= since
        )
        
        if policy_id:
            query = query.filter_by(policy_id=policy_id)
            
        if identifier:
            query = query.filter_by(identifier=identifier)
            
        return query.order_by(desc(RateLimitViolation.violated_at)).limit(limit).all()
        
    # Helper Methods
    
    def _endpoint_matches(self, endpoint: str, pattern: str) -> bool:
        """Check if endpoint matches pattern (supports wildcards)"""
        # Convert pattern to regex
        pattern = pattern.replace("*", ".*")
        pattern = f"^{pattern}$"
        return bool(re.match(pattern, endpoint))
        
    def _ip_matches(self, ip: str, range_spec: str) -> bool:
        """Check if IP matches range specification"""
        # Simple implementation - in production use ipaddress module
        if "/" in range_spec:
            # CIDR notation
            return ip.startswith(range_spec.split("/")[0].rsplit(".", 1)[0])
        else:
            # Exact match
            return ip == range_spec
            
    def _get_window_start(self, now: datetime, window: RateLimitWindow) -> datetime:
        """Get the start of the current window"""
        if window == RateLimitWindow.MINUTE:
            return now.replace(second=0, microsecond=0)
        elif window == RateLimitWindow.HOUR:
            return now.replace(minute=0, second=0, microsecond=0)
        elif window == RateLimitWindow.DAY:
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif window == RateLimitWindow.WEEK:
            days_since_monday = now.weekday()
            week_start = now - timedelta(days=days_since_monday)
            return week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        elif window == RateLimitWindow.MONTH:
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
    def _get_window_duration(self, window: RateLimitWindow) -> timedelta:
        """Get the duration of a window"""
        if window == RateLimitWindow.MINUTE:
            return timedelta(minutes=1)
        elif window == RateLimitWindow.HOUR:
            return timedelta(hours=1)
        elif window == RateLimitWindow.DAY:
            return timedelta(days=1)
        elif window == RateLimitWindow.WEEK:
            return timedelta(weeks=1)
        elif window == RateLimitWindow.MONTH:
            return timedelta(days=30)  # Approximate
            
    def _calculate_retry_after(self, window_start: datetime, window: RateLimitWindow) -> int:
        """Calculate seconds until window resets"""
        window_end = window_start + self._get_window_duration(window)
        remaining = (window_end - datetime.utcnow()).total_seconds()
        return max(1, int(remaining))
        
    def _get_request_count(self, cache_key: str, window_start: datetime, policy: RateLimitPolicy) -> int:
        """Get current request count from cache"""
        # Check in-memory cache first
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        # Check database cache
        cache_entry = self.db.query(RateLimitCache).filter_by(
            policy_id=policy.id,
            identifier=cache_key.split(":")[1],
            window_start=window_start
        ).first()
        
        if cache_entry:
            count = cache_entry.request_count
            self._cache[cache_key] = count
            return count
            
        return 0
        
    def _increment_request_count(self, cache_key: str, window_start: datetime, policy: RateLimitPolicy) -> None:
        """Increment request count in cache"""
        # Update in-memory cache
        self._cache[cache_key] = self._cache.get(cache_key, 0) + 1
        
        # Update database cache
        policy_id, identifier, _ = cache_key.split(":")
        expires_at = window_start + self._get_window_duration(policy.window)
        
        cache_entry = self.db.query(RateLimitCache).filter_by(
            policy_id=policy_id,
            identifier=identifier,
            window_start=window_start
        ).first()
        
        if cache_entry:
            cache_entry.request_count += 1
        else:
            cache_entry = RateLimitCache(
                policy_id=policy_id,
                identifier=identifier,
                window_start=window_start,
                request_count=1,
                expires_at=expires_at
            )
            self.db.add(cache_entry)
            
        self.db.commit()
        
    def _clear_policy_cache(self, policy_id: str) -> None:
        """Clear cache entries for a policy"""
        # Clear in-memory cache
        keys_to_remove = [k for k in self._cache if k.startswith(f"{policy_id}:")]
        for key in keys_to_remove:
            del self._cache[key]
            
        # Clear database cache
        self.db.query(RateLimitCache).filter_by(policy_id=policy_id).delete()
        self.db.commit()
        
    def _check_burst(self, policy: RateLimitPolicy, identifier: str, current_count: int) -> Tuple[bool, Dict[str, Any]]:
        """Check burst limits using token bucket algorithm"""
        if not policy.burst_enabled:
            return True, {}
            
        # Implement token bucket algorithm
        # This is a simplified version - in production use Redis for distributed systems
        burst_key = f"burst:{policy.id}:{identifier}"
        now = datetime.utcnow()
        
        # Get or initialize burst state
        if burst_key not in self._cache:
            self._cache[burst_key] = {
                "tokens": float(policy.burst_limit),
                "last_refill": now
            }
            
        burst_state = self._cache[burst_key]
        
        # Refill tokens
        time_passed = (now - burst_state["last_refill"]).total_seconds()
        refill_rate = policy.burst_limit / policy.burst_window_seconds
        tokens_to_add = time_passed * refill_rate
        
        burst_state["tokens"] = min(
            policy.burst_limit,
            burst_state["tokens"] + tokens_to_add
        )
        burst_state["last_refill"] = now
        
        # Check if request allowed
        if burst_state["tokens"] >= 1:
            burst_state["tokens"] -= 1
            return True, {
                "tokens_remaining": burst_state["tokens"],
                "burst_limit": policy.burst_limit
            }
        else:
            return False, {
                "tokens_remaining": 0,
                "burst_limit": policy.burst_limit,
                "refill_rate": refill_rate
            }
            
    def _estimate_total_requests(self, policy: RateLimitPolicy, bucket_start: datetime) -> int:
        """Estimate total requests for a policy in a time bucket"""
        # Sum all cache entries for this policy in the bucket
        cache_entries = self.db.query(RateLimitCache).filter(
            and_(
                RateLimitCache.policy_id == policy.id,
                RateLimitCache.window_start >= bucket_start
            )
        ).all()
        
        return sum(entry.request_count for entry in cache_entries)