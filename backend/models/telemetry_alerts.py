"""
Telemetry alerts and threshold data models.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union, Literal
from datetime import datetime, timedelta
from enum import Enum
import uuid

class ThresholdType(str, Enum):
    """Types of thresholds supported."""
    STATIC = "static"
    DYNAMIC_PERCENTILE = "dynamic_percentile"
    DYNAMIC_STDDEV = "dynamic_stddev"
    DYNAMIC_MOVING_AVG = "dynamic_moving_avg"
    CONDITIONAL = "conditional"
    TIME_BASED = "time_based"
    RATE_OF_CHANGE = "rate_of_change"
    COMPOSITE = "composite"

class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AlertState(str, Enum):
    """Current state of an alert."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SILENCED = "silenced"
    EXPIRED = "expired"

class NotificationChannel(str, Enum):
    """Available notification channels."""
    EMAIL = "email"
    WEBHOOK = "webhook"
    MQTT = "mqtt"
    SMS = "sms"
    SLACK = "slack"
    TEAMS = "teams"
    PAGERDUTY = "pagerduty"
    DASHBOARD = "dashboard"
    LOG = "log"

class ThresholdOperator(str, Enum):
    """Operators for threshold comparisons."""
    GREATER_THAN = "gt"
    GREATER_THAN_OR_EQUAL = "gte"
    LESS_THAN = "lt"
    LESS_THAN_OR_EQUAL = "lte"
    EQUAL = "eq"
    NOT_EQUAL = "neq"
    IN_RANGE = "in_range"
    OUT_OF_RANGE = "out_of_range"

class TimeWindow(BaseModel):
    """Time window configuration."""
    value: int = Field(..., gt=0, description="Window size value")
    unit: Literal["seconds", "minutes", "hours", "days"] = Field(..., description="Time unit")
    
    def to_seconds(self) -> int:
        """Convert to seconds."""
        multipliers = {
            "seconds": 1,
            "minutes": 60,
            "hours": 3600,
            "days": 86400
        }
        return self.value * multipliers[self.unit]

class StaticThresholdConfig(BaseModel):
    """Configuration for static thresholds."""
    value: float = Field(..., description="Threshold value")
    operator: ThresholdOperator = Field(ThresholdOperator.GREATER_THAN, description="Comparison operator")
    lower_bound: Optional[float] = Field(None, description="Lower bound for range operators")
    upper_bound: Optional[float] = Field(None, description="Upper bound for range operators")
    
    @validator('lower_bound', 'upper_bound')
    def validate_bounds(cls, v, values):
        operator = values.get('operator')
        if operator in [ThresholdOperator.IN_RANGE, ThresholdOperator.OUT_OF_RANGE]:
            if v is None:
                raise ValueError(f"Bounds required for {operator} operator")
        return v

class DynamicThresholdConfig(BaseModel):
    """Configuration for dynamic thresholds."""
    baseline_window: TimeWindow = Field(..., description="Window for baseline calculation")
    evaluation_method: Literal["percentile", "stddev", "moving_avg", "iqr"] = Field(..., description="Statistical method")
    
    # Percentile configuration
    percentile: Optional[float] = Field(None, ge=0, le=100, description="Percentile value (0-100)")
    
    # Standard deviation configuration
    stddev_multiplier: Optional[float] = Field(None, gt=0, description="Number of standard deviations")
    
    # Moving average configuration
    smoothing_factor: Optional[float] = Field(None, gt=0, le=1, description="Smoothing factor for exponential moving average")
    
    # Update frequency
    update_interval: Optional[TimeWindow] = Field(None, description="How often to recalculate baseline")
    min_data_points: int = Field(10, ge=1, description="Minimum data points required")

class ConditionalThresholdConfig(BaseModel):
    """Configuration for conditional thresholds based on other telemetry values."""
    condition_metric: str = Field(..., description="Metric ID to base condition on")
    condition_operator: ThresholdOperator = Field(..., description="Operator for condition")
    condition_value: float = Field(..., description="Value for condition")
    
    # Threshold when condition is met
    threshold_when_true: Union[StaticThresholdConfig, DynamicThresholdConfig] = Field(..., description="Threshold when condition is true")
    threshold_when_false: Union[StaticThresholdConfig, DynamicThresholdConfig] = Field(..., description="Threshold when condition is false")

class TimeBasedThresholdConfig(BaseModel):
    """Configuration for time-based thresholds."""
    schedules: List['ThresholdSchedule'] = Field(..., description="List of time-based schedules")
    timezone: str = Field("UTC", description="Timezone for schedule evaluation")
    default_threshold: Union[StaticThresholdConfig, DynamicThresholdConfig] = Field(..., description="Default threshold when no schedule matches")

class ThresholdSchedule(BaseModel):
    """Schedule for time-based thresholds."""
    name: str = Field(..., description="Schedule name")
    cron_expression: Optional[str] = Field(None, description="Cron expression for schedule")
    days_of_week: Optional[List[int]] = Field(None, description="Days of week (0=Monday, 6=Sunday)")
    start_time: Optional[str] = Field(None, description="Start time (HH:MM)")
    end_time: Optional[str] = Field(None, description="End time (HH:MM)")
    threshold: Union[StaticThresholdConfig, DynamicThresholdConfig] = Field(..., description="Threshold for this schedule")
    priority: int = Field(0, description="Priority for overlapping schedules (higher wins)")

class CompositeThresholdConfig(BaseModel):
    """Configuration for composite thresholds combining multiple conditions."""
    operator: Literal["AND", "OR", "XOR"] = Field(..., description="Logical operator")
    conditions: List['ThresholdDefinition'] = Field(..., min_items=2, description="Sub-thresholds to combine")

class ThresholdDefinition(BaseModel):
    """Complete threshold definition."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique threshold ID")
    name: str = Field(..., description="Threshold name")
    description: Optional[str] = Field(None, description="Threshold description")
    metric_id: str = Field(..., description="Telemetry metric ID")
    metric_name: Optional[str] = Field(None, description="Human-readable metric name")
    
    # Threshold configuration (discriminated union)
    type: ThresholdType = Field(..., description="Threshold type")
    static_config: Optional[StaticThresholdConfig] = None
    dynamic_config: Optional[DynamicThresholdConfig] = None
    conditional_config: Optional[ConditionalThresholdConfig] = None
    time_based_config: Optional[TimeBasedThresholdConfig] = None
    composite_config: Optional[CompositeThresholdConfig] = None
    
    # Alert configuration
    severity: AlertSeverity = Field(AlertSeverity.WARNING, description="Default alert severity")
    enabled: bool = Field(True, description="Whether threshold is active")
    
    # Hysteresis and debouncing
    hysteresis: Optional[float] = Field(None, ge=0, description="Hysteresis value to prevent flapping")
    debounce_time: Optional[TimeWindow] = Field(None, description="Time to wait before triggering")
    consecutive_violations: int = Field(1, ge=1, description="Number of consecutive violations required")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created the threshold")
    
    @validator('static_config', 'dynamic_config', 'conditional_config', 'time_based_config', 'composite_config')
    def validate_config(cls, v, values):
        threshold_type = values.get('type')
        field_name = cls.__fields__[v].name if v else None
        
        config_mapping = {
            ThresholdType.STATIC: 'static_config',
            ThresholdType.DYNAMIC_PERCENTILE: 'dynamic_config',
            ThresholdType.DYNAMIC_STDDEV: 'dynamic_config',
            ThresholdType.DYNAMIC_MOVING_AVG: 'dynamic_config',
            ThresholdType.CONDITIONAL: 'conditional_config',
            ThresholdType.TIME_BASED: 'time_based_config',
            ThresholdType.COMPOSITE: 'composite_config',
            ThresholdType.RATE_OF_CHANGE: 'dynamic_config'
        }
        
        expected_field = config_mapping.get(threshold_type)
        if field_name == expected_field and v is None:
            raise ValueError(f"{expected_field} is required for {threshold_type} threshold")
        elif field_name != expected_field and v is not None:
            raise ValueError(f"{field_name} should not be set for {threshold_type} threshold")
        
        return v

class AlertRule(BaseModel):
    """Complete alert rule definition."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique alert rule ID")
    name: str = Field(..., description="Alert rule name")
    description: Optional[str] = Field(None, description="Alert rule description")
    
    # Threshold reference
    threshold_id: str = Field(..., description="Associated threshold ID")
    threshold: Optional[ThresholdDefinition] = Field(None, description="Threshold definition (populated on retrieval)")
    
    # Alert configuration
    severity_override: Optional[AlertSeverity] = Field(None, description="Override threshold severity")
    enabled: bool = Field(True, description="Whether alert rule is active")
    
    # Notification configuration
    notification_channels: List[NotificationChannel] = Field(default_factory=list, description="Channels to notify")
    notification_config: Dict[str, Any] = Field(default_factory=dict, description="Channel-specific configuration")
    
    # Message templates
    alert_title_template: str = Field("Alert: {{metric_name}} {{operator}} {{threshold_value}}", description="Title template")
    alert_message_template: str = Field("{{metric_name}} is {{current_value}} (threshold: {{threshold_value}})", description="Message template")
    
    # Silencing and acknowledgment
    silence_duration: Optional[TimeWindow] = Field(None, description="Auto-silence duration after acknowledgment")
    auto_resolve: bool = Field(True, description="Auto-resolve when condition clears")
    require_acknowledgment: bool = Field(False, description="Require manual acknowledgment")
    
    # Escalation
    escalation_policy_id: Optional[str] = Field(None, description="Escalation policy reference")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created the rule")

class AlertInstance(BaseModel):
    """Instance of a triggered alert."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique alert instance ID")
    rule_id: str = Field(..., description="Alert rule ID")
    threshold_id: str = Field(..., description="Threshold ID")
    
    # Alert details
    metric_id: str = Field(..., description="Metric that triggered the alert")
    metric_name: str = Field(..., description="Human-readable metric name")
    severity: AlertSeverity = Field(..., description="Alert severity")
    state: AlertState = Field(AlertState.ACTIVE, description="Current alert state")
    
    # Values
    triggered_value: float = Field(..., description="Value that triggered the alert")
    threshold_value: float = Field(..., description="Threshold value at trigger time")
    
    # Messages
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional alert details")
    
    # Timestamps
    triggered_at: datetime = Field(default_factory=datetime.utcnow, description="When alert was triggered")
    acknowledged_at: Optional[datetime] = Field(None, description="When alert was acknowledged")
    resolved_at: Optional[datetime] = Field(None, description="When alert was resolved")
    last_notified_at: Optional[datetime] = Field(None, description="Last notification timestamp")
    
    # User actions
    acknowledged_by: Optional[str] = Field(None, description="User who acknowledged")
    resolved_by: Optional[str] = Field(None, description="User who resolved")
    notes: List[str] = Field(default_factory=list, description="User notes/comments")
    
    # Notification tracking
    notifications_sent: List[str] = Field(default_factory=list, description="Channels notified")
    notification_failures: Dict[str, str] = Field(default_factory=dict, description="Failed notifications")

class AlertTemplate(BaseModel):
    """Template for common alert configurations."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Template ID")
    name: str = Field(..., description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    category: str = Field(..., description="Template category")
    
    # Threshold template
    threshold_type: ThresholdType = Field(..., description="Threshold type")
    threshold_config: Dict[str, Any] = Field(..., description="Threshold configuration template")
    
    # Alert template
    alert_config: Dict[str, Any] = Field(..., description="Alert configuration template")
    
    # Variables that need to be filled
    required_variables: List[str] = Field(default_factory=list, description="Variables to be provided")
    optional_variables: List[str] = Field(default_factory=list, description="Optional variables")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Template tags")
    is_system: bool = Field(False, description="System-provided template")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(None)

class AlertStatistics(BaseModel):
    """Statistics for alerts."""
    metric_id: str = Field(..., description="Metric ID")
    time_range: TimeWindow = Field(..., description="Time range for statistics")
    
    # Alert counts
    total_alerts: int = Field(0, description="Total alerts in period")
    alerts_by_severity: Dict[AlertSeverity, int] = Field(default_factory=dict)
    alerts_by_state: Dict[AlertState, int] = Field(default_factory=dict)
    
    # Timing statistics
    mean_time_to_acknowledge: Optional[timedelta] = None
    mean_time_to_resolve: Optional[timedelta] = None
    
    # Trend analysis
    alert_rate_per_hour: float = Field(0.0, description="Average alerts per hour")
    trend_direction: Literal["increasing", "stable", "decreasing"] = Field("stable")
    trend_percentage: float = Field(0.0, description="Percentage change in alert rate")

class BulkThresholdOperation(BaseModel):
    """Bulk operations on thresholds."""
    operation: Literal["create", "update", "delete", "enable", "disable"] = Field(..., description="Operation type")
    threshold_ids: Optional[List[str]] = Field(None, description="Specific threshold IDs")
    filters: Optional[Dict[str, Any]] = Field(None, description="Filters to select thresholds")
    updates: Optional[Dict[str, Any]] = Field(None, description="Updates to apply")
    
    @validator('threshold_ids', 'filters')
    def validate_selection(cls, v, values):
        if not v and not values.get('filters'):
            raise ValueError("Either threshold_ids or filters must be provided")
        return v

# Update forward references
ThresholdSchedule.update_forward_refs()
CompositeThresholdConfig.update_forward_refs()