"""
Alert service for managing alerts and processing telemetry thresholds.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
import json
from collections import defaultdict
import statistics

from ..models.telemetry_alerts import (
    ThresholdDefinition, AlertRule, AlertInstance, AlertStatistics,
    ThresholdType, AlertSeverity, AlertState, ThresholdOperator,
    TimeWindow, StaticThresholdConfig, DynamicThresholdConfig,
    ConditionalThresholdConfig, TimeBasedThresholdConfig
)
from ..websocket.websocket_manager import WebSocketManager
from .notification_service import NotificationService
from .threshold_service import ThresholdService

logger = logging.getLogger(__name__)

class AlertProcessor:
    """Processes telemetry data against thresholds to generate alerts."""
    
    def __init__(self):
        self.threshold_cache: Dict[str, ThresholdDefinition] = {}
        self.rule_cache: Dict[str, List[AlertRule]] = {}
        self.active_alerts: Dict[str, AlertInstance] = {}
        self.historical_data: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        self.last_values: Dict[str, float] = {}
        self.violation_counts: Dict[str, int] = defaultdict(int)
        self.last_alert_times: Dict[str, datetime] = {}
        
    def evaluate_threshold(
        self,
        value: float,
        threshold: ThresholdDefinition,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, float, str]:
        """
        Evaluate a value against a threshold.
        Returns: (violated, threshold_value, reason)
        """
        try:
            if not threshold.enabled:
                return False, 0.0, "Threshold disabled"
            
            if threshold.type == ThresholdType.STATIC:
                return self._evaluate_static_threshold(value, threshold.static_config)
            
            elif threshold.type in [ThresholdType.DYNAMIC_PERCENTILE, 
                                  ThresholdType.DYNAMIC_STDDEV,
                                  ThresholdType.DYNAMIC_MOVING_AVG]:
                return self._evaluate_dynamic_threshold(
                    value, 
                    threshold.metric_id, 
                    threshold.dynamic_config
                )
            
            elif threshold.type == ThresholdType.CONDITIONAL:
                return self._evaluate_conditional_threshold(
                    value,
                    threshold.conditional_config,
                    context
                )
            
            elif threshold.type == ThresholdType.TIME_BASED:
                return self._evaluate_time_based_threshold(
                    value,
                    threshold.time_based_config
                )
            
            elif threshold.type == ThresholdType.RATE_OF_CHANGE:
                return self._evaluate_rate_of_change(
                    value,
                    threshold.metric_id,
                    threshold.dynamic_config
                )
            
            else:
                logger.warning(f"Unknown threshold type: {threshold.type}")
                return False, 0.0, "Unknown threshold type"
                
        except Exception as e:
            logger.error(f"Error evaluating threshold {threshold.id}: {e}")
            return False, 0.0, f"Evaluation error: {str(e)}"
    
    def _evaluate_static_threshold(
        self, 
        value: float, 
        config: StaticThresholdConfig
    ) -> Tuple[bool, float, str]:
        """Evaluate static threshold."""
        threshold_value = config.value
        operator = config.operator
        
        violated = False
        reason = ""
        
        if operator == ThresholdOperator.GREATER_THAN:
            violated = value > threshold_value
            reason = f"{value} > {threshold_value}"
        elif operator == ThresholdOperator.GREATER_THAN_OR_EQUAL:
            violated = value >= threshold_value
            reason = f"{value} >= {threshold_value}"
        elif operator == ThresholdOperator.LESS_THAN:
            violated = value < threshold_value
            reason = f"{value} < {threshold_value}"
        elif operator == ThresholdOperator.LESS_THAN_OR_EQUAL:
            violated = value <= threshold_value
            reason = f"{value} <= {threshold_value}"
        elif operator == ThresholdOperator.EQUAL:
            violated = abs(value - threshold_value) < 0.0001  # Float comparison
            reason = f"{value} == {threshold_value}"
        elif operator == ThresholdOperator.NOT_EQUAL:
            violated = abs(value - threshold_value) >= 0.0001
            reason = f"{value} != {threshold_value}"
        elif operator == ThresholdOperator.IN_RANGE:
            violated = config.lower_bound <= value <= config.upper_bound
            reason = f"{value} in [{config.lower_bound}, {config.upper_bound}]"
        elif operator == ThresholdOperator.OUT_OF_RANGE:
            violated = value < config.lower_bound or value > config.upper_bound
            reason = f"{value} not in [{config.lower_bound}, {config.upper_bound}]"
        
        return violated, threshold_value, reason
    
    def _evaluate_dynamic_threshold(
        self,
        value: float,
        metric_id: str,
        config: DynamicThresholdConfig
    ) -> Tuple[bool, float, str]:
        """Evaluate dynamic threshold based on historical data."""
        # Get historical data within baseline window
        historical = self._get_historical_data(
            metric_id,
            config.baseline_window
        )
        
        if len(historical) < config.min_data_points:
            return False, 0.0, f"Insufficient data ({len(historical)} < {config.min_data_points})"
        
        values = [v for _, v in historical]
        
        if config.evaluation_method == "percentile":
            threshold_value = self._calculate_percentile(values, config.percentile)
            violated = value > threshold_value
            reason = f"{value} > P{config.percentile}({threshold_value:.2f})"
            
        elif config.evaluation_method == "stddev":
            mean = statistics.mean(values)
            stddev = statistics.stdev(values) if len(values) > 1 else 0
            threshold_value = mean + (config.stddev_multiplier * stddev)
            violated = value > threshold_value
            reason = f"{value} > μ+{config.stddev_multiplier}σ ({threshold_value:.2f})"
            
        elif config.evaluation_method == "moving_avg":
            # Exponential moving average
            ema = self._calculate_ema(values, config.smoothing_factor)
            threshold_value = ema
            violated = abs(value - ema) > (ema * 0.2)  # 20% deviation
            reason = f"|{value} - EMA({ema:.2f})| > 20%"
            
        elif config.evaluation_method == "iqr":
            q1 = self._calculate_percentile(values, 25)
            q3 = self._calculate_percentile(values, 75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            threshold_value = upper
            violated = value < lower or value > upper
            reason = f"{value} outside IQR bounds [{lower:.2f}, {upper:.2f}]"
        else:
            return False, 0.0, f"Unknown evaluation method: {config.evaluation_method}"
        
        return violated, threshold_value, reason
    
    def _evaluate_conditional_threshold(
        self,
        value: float,
        config: ConditionalThresholdConfig,
        context: Optional[Dict[str, Any]]
    ) -> Tuple[bool, float, str]:
        """Evaluate conditional threshold."""
        if not context or config.condition_metric not in context:
            return False, 0.0, f"Missing condition metric: {config.condition_metric}"
        
        condition_value = context[config.condition_metric]
        
        # Evaluate condition
        condition_met, _, _ = self._evaluate_static_threshold(
            condition_value,
            StaticThresholdConfig(
                value=config.condition_value,
                operator=config.condition_operator
            )
        )
        
        # Use appropriate threshold based on condition
        if condition_met:
            sub_threshold = config.threshold_when_true
            condition_desc = "condition met"
        else:
            sub_threshold = config.threshold_when_false
            condition_desc = "condition not met"
        
        # Evaluate against sub-threshold
        if isinstance(sub_threshold, StaticThresholdConfig):
            violated, threshold_value, reason = self._evaluate_static_threshold(
                value, sub_threshold
            )
        else:
            violated, threshold_value, reason = self._evaluate_dynamic_threshold(
                value, config.condition_metric, sub_threshold
            )
        
        reason = f"{reason} ({condition_desc}: {config.condition_metric}={condition_value})"
        return violated, threshold_value, reason
    
    def _evaluate_time_based_threshold(
        self,
        value: float,
        config: TimeBasedThresholdConfig
    ) -> Tuple[bool, float, str]:
        """Evaluate time-based threshold."""
        current_time = datetime.now()
        
        # Find matching schedule
        matched_schedule = None
        highest_priority = -1
        
        for schedule in config.schedules:
            if self._matches_schedule(schedule, current_time):
                if schedule.priority > highest_priority:
                    matched_schedule = schedule
                    highest_priority = schedule.priority
        
        # Use matched schedule or default
        if matched_schedule:
            sub_threshold = matched_schedule.threshold
            schedule_desc = f"schedule: {matched_schedule.name}"
        else:
            sub_threshold = config.default_threshold
            schedule_desc = "default schedule"
        
        # Evaluate against sub-threshold
        if isinstance(sub_threshold, StaticThresholdConfig):
            violated, threshold_value, reason = self._evaluate_static_threshold(
                value, sub_threshold
            )
        else:
            # Dynamic threshold evaluation would go here
            violated = False
            threshold_value = 0.0
            reason = "Dynamic time-based not implemented"
        
        reason = f"{reason} ({schedule_desc})"
        return violated, threshold_value, reason
    
    def _evaluate_rate_of_change(
        self,
        value: float,
        metric_id: str,
        config: DynamicThresholdConfig
    ) -> Tuple[bool, float, str]:
        """Evaluate rate of change threshold."""
        if metric_id not in self.last_values:
            self.last_values[metric_id] = value
            return False, 0.0, "First value, no rate calculation"
        
        # Calculate rate of change
        last_value = self.last_values[metric_id]
        rate = abs(value - last_value)
        
        # Get historical rates for dynamic threshold
        historical = self._get_historical_data(metric_id, config.baseline_window)
        if len(historical) < 2:
            self.last_values[metric_id] = value
            return False, 0.0, "Insufficient data for rate calculation"
        
        # Calculate historical rates
        rates = []
        for i in range(1, len(historical)):
            prev_time, prev_val = historical[i-1]
            curr_time, curr_val = historical[i]
            time_diff = (curr_time - prev_time).total_seconds()
            if time_diff > 0:
                rates.append(abs(curr_val - prev_val) / time_diff)
        
        if not rates:
            self.last_values[metric_id] = value
            return False, 0.0, "No rate data available"
        
        # Calculate threshold based on percentile
        threshold_value = self._calculate_percentile(
            rates, 
            config.percentile or 95
        )
        
        violated = rate > threshold_value
        reason = f"Rate {rate:.2f} > P95({threshold_value:.2f})"
        
        self.last_values[metric_id] = value
        return violated, threshold_value, reason
    
    def _get_historical_data(
        self,
        metric_id: str,
        window: TimeWindow
    ) -> List[Tuple[datetime, float]]:
        """Get historical data within time window."""
        cutoff = datetime.now() - timedelta(seconds=window.to_seconds())
        
        if metric_id in self.historical_data:
            return [
                (t, v) for t, v in self.historical_data[metric_id]
                if t >= cutoff
            ]
        return []
    
    def _calculate_percentile(self, values: List[float], percentile: float) -> float:
        """Calculate percentile value."""
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        index = int((percentile / 100) * len(sorted_values))
        
        if index >= len(sorted_values):
            return sorted_values[-1]
        elif index == 0:
            return sorted_values[0]
        else:
            # Linear interpolation
            lower = sorted_values[index - 1]
            upper = sorted_values[index]
            fraction = (percentile / 100) * len(sorted_values) - index
            return lower + (upper - lower) * fraction
    
    def _calculate_ema(self, values: List[float], alpha: float) -> float:
        """Calculate exponential moving average."""
        if not values:
            return 0.0
        
        ema = values[0]
        for value in values[1:]:
            ema = alpha * value + (1 - alpha) * ema
        
        return ema
    
    def _matches_schedule(self, schedule: Any, current_time: datetime) -> bool:
        """Check if current time matches schedule."""
        # Simplified implementation - would need proper cron/schedule parsing
        if schedule.days_of_week:
            if current_time.weekday() not in schedule.days_of_week:
                return False
        
        if schedule.start_time and schedule.end_time:
            current_time_str = current_time.strftime("%H:%M")
            if not (schedule.start_time <= current_time_str <= schedule.end_time):
                return False
        
        return True
    
    def add_data_point(self, metric_id: str, value: float, timestamp: Optional[datetime] = None):
        """Add a data point to historical data."""
        if timestamp is None:
            timestamp = datetime.now()
        
        # Add to historical data
        self.historical_data[metric_id].append((timestamp, value))
        
        # Maintain window (keep last 24 hours)
        cutoff = datetime.now() - timedelta(hours=24)
        self.historical_data[metric_id] = [
            (t, v) for t, v in self.historical_data[metric_id]
            if t >= cutoff
        ]

class AlertService:
    """Main service for alert management."""
    
    def __init__(
        self,
        threshold_service: ThresholdService,
        notification_service: NotificationService,
        websocket_manager: Optional[WebSocketManager] = None
    ):
        self.threshold_service = threshold_service
        self.notification_service = notification_service
        self.websocket_manager = websocket_manager
        self.processor = AlertProcessor()
        
        # Alert management
        self.active_alerts: Dict[str, AlertInstance] = {}
        self.alert_history: List[AlertInstance] = []
        self.silence_periods: Dict[str, datetime] = {}
        
        # Background tasks
        self.processing_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start alert service background tasks."""
        self.processing_task = asyncio.create_task(self._process_loop())
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        # Load active alerts from storage
        await self._load_active_alerts()
        
        # Load thresholds and rules
        await self._refresh_configurations()
        
        logger.info("Alert service started")
    
    async def stop(self):
        """Stop alert service."""
        if self.processing_task:
            self.processing_task.cancel()
        if self.cleanup_task:
            self.cleanup_task.cancel()
        
        # Save active alerts
        await self._save_active_alerts()
        
        logger.info("Alert service stopped")
    
    async def process_telemetry(
        self,
        metric_id: str,
        value: float,
        timestamp: Optional[datetime] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """Process telemetry value for alerts."""
        if timestamp is None:
            timestamp = datetime.now()
        
        # Add to historical data
        self.processor.add_data_point(metric_id, value, timestamp)
        
        # Get thresholds for this metric
        thresholds = await self.threshold_service.get_thresholds_for_metric(metric_id)
        
        for threshold in thresholds:
            if not threshold.enabled:
                continue
            
            # Check if in cooldown
            if self._in_cooldown(threshold.id):
                continue
            
            # Evaluate threshold
            violated, threshold_value, reason = self.processor.evaluate_threshold(
                value, threshold, context
            )
            
            # Handle hysteresis
            if threshold.hysteresis:
                violated = self._apply_hysteresis(
                    threshold.id, value, threshold_value, 
                    threshold.hysteresis, violated
                )
            
            # Handle consecutive violations
            if violated:
                self.processor.violation_counts[threshold.id] += 1
                
                if self.processor.violation_counts[threshold.id] < threshold.consecutive_violations:
                    continue  # Not enough violations yet
            else:
                self.processor.violation_counts[threshold.id] = 0
                
                # Check for auto-resolve
                await self._check_auto_resolve(threshold.id, metric_id)
                continue
            
            # Get alert rules for threshold
            rules = await self._get_rules_for_threshold(threshold.id)
            
            for rule in rules:
                if not rule.enabled:
                    continue
                
                # Check if already alerting
                alert_key = f"{rule.id}:{metric_id}"
                if alert_key in self.active_alerts:
                    # Update existing alert
                    await self._update_alert(
                        self.active_alerts[alert_key],
                        value, threshold_value, timestamp
                    )
                else:
                    # Create new alert
                    await self._create_alert(
                        rule, threshold, metric_id,
                        value, threshold_value, reason,
                        timestamp, context
                    )
    
    async def _create_alert(
        self,
        rule: AlertRule,
        threshold: ThresholdDefinition,
        metric_id: str,
        value: float,
        threshold_value: float,
        reason: str,
        timestamp: datetime,
        context: Optional[Dict[str, Any]] = None
    ):
        """Create a new alert instance."""
        # Generate alert content
        title = self._format_template(
            rule.alert_title_template,
            metric_name=threshold.metric_name or metric_id,
            operator=reason.split()[1] if ' ' in reason else '>',
            threshold_value=threshold_value,
            current_value=value
        )
        
        message = self._format_template(
            rule.alert_message_template,
            metric_name=threshold.metric_name or metric_id,
            current_value=value,
            threshold_value=threshold_value,
            reason=reason
        )
        
        # Create alert instance
        alert = AlertInstance(
            rule_id=rule.id,
            threshold_id=threshold.id,
            metric_id=metric_id,
            metric_name=threshold.metric_name or metric_id,
            severity=rule.severity_override or threshold.severity,
            triggered_value=value,
            threshold_value=threshold_value,
            title=title,
            message=message,
            details={
                "reason": reason,
                "context": context,
                "threshold_type": threshold.type.value
            },
            triggered_at=timestamp
        )
        
        # Store alert
        alert_key = f"{rule.id}:{metric_id}"
        self.active_alerts[alert_key] = alert
        self.alert_history.append(alert)
        
        # Update cooldown
        self.processor.last_alert_times[threshold.id] = timestamp
        
        # Send notifications
        await self._send_notifications(alert, rule)
        
        # Broadcast via WebSocket
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "alert_triggered",
                "data": alert.dict()
            })
        
        logger.info(f"Alert triggered: {alert.title}")
    
    async def _update_alert(
        self,
        alert: AlertInstance,
        value: float,
        threshold_value: float,
        timestamp: datetime
    ):
        """Update an existing alert with new values."""
        alert.triggered_value = value
        alert.threshold_value = threshold_value
        alert.details["last_updated"] = timestamp.isoformat()
        alert.details["update_count"] = alert.details.get("update_count", 0) + 1
        
        # Broadcast update
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "alert_updated",
                "data": alert.dict()
            })
    
    async def _check_auto_resolve(self, threshold_id: str, metric_id: str):
        """Check if alert should be auto-resolved."""
        # Find active alerts for this threshold/metric
        for alert_key, alert in list(self.active_alerts.items()):
            if alert.threshold_id == threshold_id and alert.metric_id == metric_id:
                if alert.state == AlertState.ACTIVE:
                    # Get the rule
                    rule = await self.get_rule(alert.rule_id)
                    if rule and rule.auto_resolve:
                        await self.resolve_alert(
                            alert.id,
                            user_id="system",
                            notes="Auto-resolved: condition cleared"
                        )
    
    async def _send_notifications(self, alert: AlertInstance, rule: AlertRule):
        """Send notifications for an alert."""
        for channel in rule.notification_channels:
            try:
                config = rule.notification_config.get(channel.value, {})
                
                await self.notification_service.send_notification(
                    channel=channel,
                    alert=alert,
                    config=config
                )
                
                alert.notifications_sent.append(channel.value)
                
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {e}")
                alert.notification_failures[channel.value] = str(e)
    
    def _format_template(self, template: str, **kwargs) -> str:
        """Format a message template."""
        try:
            # Simple template replacement
            for key, value in kwargs.items():
                template = template.replace(f"{{{{{key}}}}}", str(value))
            return template
        except Exception as e:
            logger.error(f"Template formatting error: {e}")
            return template
    
    def _in_cooldown(self, threshold_id: str) -> bool:
        """Check if threshold is in cooldown period."""
        if threshold_id not in self.processor.last_alert_times:
            return False
        
        # Get threshold to check cooldown
        # This would need to be async in real implementation
        return False  # Simplified
    
    def _apply_hysteresis(
        self,
        threshold_id: str,
        value: float,
        threshold_value: float,
        hysteresis: float,
        violated: bool
    ) -> bool:
        """Apply hysteresis to prevent flapping."""
        # Track previous state
        prev_state_key = f"hysteresis:{threshold_id}"
        
        if prev_state_key not in self.processor.last_values:
            self.processor.last_values[prev_state_key] = 0
        
        prev_violated = self.processor.last_values[prev_state_key] > 0
        
        if prev_violated and not violated:
            # Was violated, check if cleared by hysteresis margin
            if abs(value - threshold_value) < hysteresis:
                return True  # Still violated
        elif not prev_violated and violated:
            # Was not violated, check if exceeded by hysteresis margin
            if abs(value - threshold_value) < hysteresis:
                return False  # Not violated yet
        
        self.processor.last_values[prev_state_key] = 1 if violated else 0
        return violated
    
    async def acknowledge_alert(
        self,
        alert_id: str,
        user_id: str,
        notes: Optional[str] = None,
        silence_duration: Optional[TimeWindow] = None
    ) -> AlertInstance:
        """Acknowledge an alert."""
        alert = await self.get_alert(alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")
        
        if alert.state != AlertState.ACTIVE:
            raise ValueError(f"Alert {alert_id} is not active")
        
        alert.state = AlertState.ACKNOWLEDGED
        alert.acknowledged_at = datetime.now()
        alert.acknowledged_by = user_id
        
        if notes:
            alert.notes.append(f"[{user_id}] Acknowledged: {notes}")
        
        if silence_duration:
            silence_until = datetime.now() + timedelta(
                seconds=silence_duration.to_seconds()
            )
            self.silence_periods[alert.rule_id] = silence_until
            alert.state = AlertState.SILENCED
        
        # Broadcast update
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "alert_acknowledged",
                "data": alert.dict()
            })
        
        return alert
    
    async def resolve_alert(
        self,
        alert_id: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> AlertInstance:
        """Resolve an alert."""
        alert = await self.get_alert(alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")
        
        alert.state = AlertState.RESOLVED
        alert.resolved_at = datetime.now()
        alert.resolved_by = user_id
        
        if notes:
            alert.notes.append(f"[{user_id}] Resolved: {notes}")
        
        # Remove from active alerts
        alert_key = f"{alert.rule_id}:{alert.metric_id}"
        self.active_alerts.pop(alert_key, None)
        
        # Reset violation count
        if alert.threshold_id in self.processor.violation_counts:
            self.processor.violation_counts[alert.threshold_id] = 0
        
        # Broadcast update
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "alert_resolved",
                "data": alert.dict()
            })
        
        return alert
    
    async def get_alert(self, alert_id: str) -> Optional[AlertInstance]:
        """Get an alert by ID."""
        # Check active alerts
        for alert in self.active_alerts.values():
            if alert.id == alert_id:
                return alert
        
        # Check history
        for alert in self.alert_history:
            if alert.id == alert_id:
                return alert
        
        return None
    
    async def list_alerts(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 100
    ) -> List[AlertInstance]:
        """List alerts with filtering."""
        alerts = []
        
        # Get active alerts
        if filters.get("active", True):
            alerts.extend(self.active_alerts.values())
        
        # Apply filters
        if "metric_id" in filters:
            alerts = [a for a in alerts if a.metric_id == filters["metric_id"]]
        
        if "severity" in filters:
            alerts = [a for a in alerts if a.severity == filters["severity"]]
        
        if "state" in filters:
            alerts = [a for a in alerts if a.state == filters["state"]]
        
        # Sort by triggered time (newest first)
        alerts.sort(key=lambda a: a.triggered_at, reverse=True)
        
        return alerts[skip:skip + limit]
    
    async def get_summary_statistics(
        self,
        time_range: TimeWindow,
        metric_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get summary statistics for alerts."""
        cutoff = datetime.now() - timedelta(seconds=time_range.to_seconds())
        
        # Filter alerts by time range
        relevant_alerts = [
            a for a in self.alert_history
            if a.triggered_at >= cutoff
        ]
        
        if metric_ids:
            relevant_alerts = [
                a for a in relevant_alerts
                if a.metric_id in metric_ids
            ]
        
        # Calculate statistics
        total = len(relevant_alerts)
        by_severity = defaultdict(int)
        by_state = defaultdict(int)
        by_metric = defaultdict(int)
        
        ack_times = []
        resolve_times = []
        
        for alert in relevant_alerts:
            by_severity[alert.severity.value] += 1
            by_state[alert.state.value] += 1
            by_metric[alert.metric_id] += 1
            
            if alert.acknowledged_at and alert.triggered_at:
                ack_time = (alert.acknowledged_at - alert.triggered_at).total_seconds()
                ack_times.append(ack_time)
            
            if alert.resolved_at and alert.triggered_at:
                resolve_time = (alert.resolved_at - alert.triggered_at).total_seconds()
                resolve_times.append(resolve_time)
        
        return {
            "total_alerts": total,
            "alerts_by_severity": dict(by_severity),
            "alerts_by_state": dict(by_state),
            "alerts_by_metric": dict(by_metric),
            "mean_time_to_acknowledge": statistics.mean(ack_times) if ack_times else None,
            "mean_time_to_resolve": statistics.mean(resolve_times) if resolve_times else None,
            "alert_rate_per_hour": total / (time_range.to_seconds() / 3600) if total > 0 else 0
        }
    
    async def _process_loop(self):
        """Background processing loop."""
        while True:
            try:
                # Process any queued telemetry data
                # Check for expired silences
                # Update alert states
                
                await asyncio.sleep(1)  # Process every second
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Alert processing error: {e}")
                await asyncio.sleep(5)
    
    async def _cleanup_loop(self):
        """Background cleanup loop."""
        while True:
            try:
                # Clean old historical data
                # Archive old alerts
                # Update statistics
                
                await asyncio.sleep(300)  # Every 5 minutes
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Alert cleanup error: {e}")
                await asyncio.sleep(60)
    
    async def _load_active_alerts(self):
        """Load active alerts from storage."""
        # Implementation would load from database
        pass
    
    async def _save_active_alerts(self):
        """Save active alerts to storage."""
        # Implementation would save to database
        pass
    
    async def _refresh_configurations(self):
        """Refresh threshold and rule configurations."""
        # Implementation would load from threshold service
        pass
    
    async def _get_rules_for_threshold(self, threshold_id: str) -> List[AlertRule]:
        """Get alert rules for a threshold."""
        # Implementation would query from storage
        return []
    
    # Placeholder methods for API compatibility
    async def create_rule(self, rule: AlertRule, created_by: str) -> AlertRule:
        """Create an alert rule."""
        rule.created_by = created_by
        # Implementation would save to database
        return rule
    
    async def get_rule(self, rule_id: str) -> Optional[AlertRule]:
        """Get an alert rule."""
        # Implementation would query from database
        return None
    
    async def update_rule(
        self, 
        rule_id: str, 
        updates: Dict[str, Any],
        updated_by: str
    ) -> AlertRule:
        """Update an alert rule."""
        # Implementation would update in database
        return AlertRule(
            id=rule_id,
            name="Updated Rule",
            threshold_id="threshold-1"
        )
    
    async def delete_rule(self, rule_id: str, deleted_by: str):
        """Delete an alert rule."""
        # Implementation would delete from database
        pass
    
    async def list_rules(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 100
    ) -> List[AlertRule]:
        """List alert rules."""
        # Implementation would query from database
        return []
    
    async def test_rule(
        self,
        rule_id: str,
        test_value: Optional[float] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Test an alert rule."""
        # Implementation would simulate alert
        return {
            "success": True,
            "alert_triggered": True,
            "test_value": test_value
        }
    
    async def list_alert_history(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 100
    ) -> List[AlertInstance]:
        """List alert history."""
        # Apply filters to history
        alerts = self.alert_history
        
        if "start_time" in filters and filters["start_time"]:
            alerts = [a for a in alerts if a.triggered_at >= filters["start_time"]]
        
        if "end_time" in filters and filters["end_time"]:
            alerts = [a for a in alerts if a.triggered_at <= filters["end_time"]]
        
        if "metric_id" in filters:
            alerts = [a for a in alerts if a.metric_id == filters["metric_id"]]
        
        if "severity" in filters:
            alerts = [a for a in alerts if a.severity == filters["severity"]]
        
        # Sort by triggered time (newest first)
        alerts.sort(key=lambda a: a.triggered_at, reverse=True)
        
        return alerts[skip:skip + limit]
    
    async def bulk_action(
        self,
        alert_ids: List[str],
        action: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Perform bulk action on alerts."""
        results = {
            "success": 0,
            "failed": 0,
            "errors": []
        }
        
        for alert_id in alert_ids:
            try:
                if action == "acknowledge":
                    await self.acknowledge_alert(alert_id, user_id, notes)
                elif action == "resolve":
                    await self.resolve_alert(alert_id, user_id, notes)
                elif action == "silence":
                    await self.acknowledge_alert(
                        alert_id, user_id, notes,
                        silence_duration=TimeWindow(value=1, unit="hours")
                    )
                
                results["success"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "alert_id": alert_id,
                    "error": str(e)
                })
        
        return results
    
    async def add_note(
        self,
        alert_id: str,
        note: str,
        user_id: str
    ) -> AlertInstance:
        """Add a note to an alert."""
        alert = await self.get_alert(alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")
        
        alert.notes.append(f"[{user_id}] {note}")
        
        return alert
    
    async def get_alert_trends(
        self,
        time_range: TimeWindow,
        granularity: str,
        metric_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get alert trend analysis."""
        # Implementation would calculate trends
        return {
            "time_range": time_range.dict(),
            "granularity": granularity,
            "trends": []
        }