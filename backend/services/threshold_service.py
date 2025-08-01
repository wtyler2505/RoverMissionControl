"""
Threshold service for managing threshold definitions and templates.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
import json
import uuid

from ..models.telemetry_alerts import (
    ThresholdDefinition, AlertRule, AlertTemplate, BulkThresholdOperation,
    ThresholdType, AlertSeverity, NotificationChannel, TimeWindow,
    StaticThresholdConfig, DynamicThresholdConfig
)

logger = logging.getLogger(__name__)

class ThresholdService:
    """Service for managing threshold definitions."""
    
    def __init__(self):
        # In-memory storage for demo - replace with database
        self.thresholds: Dict[str, ThresholdDefinition] = {}
        self.templates: Dict[str, AlertTemplate] = {}
        self.metric_threshold_map: Dict[str, Set[str]] = {}
        
        # Initialize with default templates
        self._initialize_default_templates()
    
    def _initialize_default_templates(self):
        """Initialize system-provided templates."""
        templates = [
            # Battery voltage templates
            AlertTemplate(
                name="Battery Voltage Critical",
                description="Critical battery voltage threshold for rover systems",
                category="power",
                threshold_type=ThresholdType.STATIC,
                threshold_config={
                    "value": 10.5,
                    "operator": "lt",
                    "hysteresis": 0.2
                },
                alert_config={
                    "severity": "critical",
                    "notifications": ["email", "webhook"],
                    "require_acknowledgment": True
                },
                required_variables=["metric_id", "metric_name"],
                is_system=True,
                tags=["battery", "power", "critical"]
            ),
            
            AlertTemplate(
                name="Battery Voltage Warning",
                description="Warning battery voltage threshold",
                category="power",
                threshold_type=ThresholdType.STATIC,
                threshold_config={
                    "value": 11.5,
                    "operator": "lt",
                    "hysteresis": 0.1
                },
                alert_config={
                    "severity": "warning",
                    "notifications": ["dashboard"],
                    "auto_resolve": True
                },
                required_variables=["metric_id", "metric_name"],
                is_system=True,
                tags=["battery", "power", "warning"]
            ),
            
            # Temperature templates
            AlertTemplate(
                name="High Temperature Warning",
                description="High temperature warning for rover components",
                category="thermal",
                threshold_type=ThresholdType.STATIC,
                threshold_config={
                    "value": 70.0,
                    "operator": "gt",
                    "hysteresis": 2.0
                },
                alert_config={
                    "severity": "warning",
                    "notifications": ["dashboard", "email"],
                    "cooldown_minutes": 10
                },
                required_variables=["metric_id", "metric_name", "max_temperature"],
                optional_variables=["hysteresis", "cooldown_minutes"],
                is_system=True,
                tags=["temperature", "thermal", "warning"]
            ),
            
            # Dynamic anomaly detection
            AlertTemplate(
                name="Anomaly Detection",
                description="Statistical anomaly detection based on historical data",
                category="anomaly",
                threshold_type=ThresholdType.DYNAMIC_STDDEV,
                threshold_config={
                    "baseline_window": {"value": 24, "unit": "hours"},
                    "evaluation_method": "stddev",
                    "stddev_multiplier": 3.0,
                    "min_data_points": 50
                },
                alert_config={
                    "severity": "warning",
                    "notifications": ["dashboard"],
                    "consecutive_violations": 3
                },
                required_variables=["metric_id", "metric_name"],
                optional_variables=["stddev_multiplier", "baseline_hours", "min_data_points"],
                is_system=True,
                tags=["anomaly", "statistical", "dynamic"]
            ),
            
            # Rate of change detection
            AlertTemplate(
                name="Rapid Change Detection",
                description="Detect rapid changes in metric values",
                category="change",
                threshold_type=ThresholdType.RATE_OF_CHANGE,
                threshold_config={
                    "baseline_window": {"value": 1, "unit": "hours"},
                    "evaluation_method": "percentile",
                    "percentile": 95,
                    "min_data_points": 10
                },
                alert_config={
                    "severity": "info",
                    "notifications": ["dashboard"],
                    "debounce_time": {"value": 30, "unit": "seconds"}
                },
                required_variables=["metric_id", "metric_name"],
                optional_variables=["percentile", "baseline_hours"],
                is_system=True,
                tags=["rate", "change", "dynamic"]
            ),
            
            # Range-based monitoring
            AlertTemplate(
                name="Operating Range Monitor",
                description="Monitor if values stay within operating range",
                category="range",
                threshold_type=ThresholdType.STATIC,
                threshold_config={
                    "operator": "out_of_range",
                    "lower_bound": "{{min_value}}",
                    "upper_bound": "{{max_value}}"
                },
                alert_config={
                    "severity": "error",
                    "notifications": ["email", "dashboard"],
                    "require_acknowledgment": True
                },
                required_variables=["metric_id", "metric_name", "min_value", "max_value"],
                is_system=True,
                tags=["range", "bounds", "operational"]
            )
        ]
        
        for template in templates:
            self.templates[template.id] = template
    
    async def create_threshold(
        self,
        threshold: ThresholdDefinition,
        created_by: Optional[str] = None
    ) -> ThresholdDefinition:
        """Create a new threshold definition."""
        # Validate threshold configuration
        self._validate_threshold(threshold)
        
        # Set metadata
        threshold.created_by = created_by
        threshold.created_at = datetime.now()
        threshold.updated_at = threshold.created_at
        
        # Store threshold
        self.thresholds[threshold.id] = threshold
        
        # Update metric mapping
        if threshold.metric_id not in self.metric_threshold_map:
            self.metric_threshold_map[threshold.metric_id] = set()
        self.metric_threshold_map[threshold.metric_id].add(threshold.id)
        
        logger.info(f"Created threshold {threshold.id} for metric {threshold.metric_id}")
        return threshold
    
    async def get_threshold(self, threshold_id: str) -> Optional[ThresholdDefinition]:
        """Get a threshold by ID."""
        return self.thresholds.get(threshold_id)
    
    async def list_thresholds(
        self,
        filters: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[ThresholdDefinition]:
        """List thresholds with filtering."""
        thresholds = list(self.thresholds.values())
        
        # Apply filters
        if filters:
            if "metric_id" in filters:
                thresholds = [t for t in thresholds if t.metric_id == filters["metric_id"]]
            
            if "type" in filters:
                thresholds = [t for t in thresholds if t.type == filters["type"]]
            
            if "enabled" in filters:
                thresholds = [t for t in thresholds if t.enabled == filters["enabled"]]
            
            if "tags" in filters:
                filter_tags = set(filters["tags"])
                thresholds = [
                    t for t in thresholds 
                    if filter_tags.intersection(set(t.tags))
                ]
        
        # Sort by creation time (newest first)
        thresholds.sort(key=lambda t: t.created_at, reverse=True)
        
        return thresholds[skip:skip + limit]
    
    async def update_threshold(
        self,
        threshold_id: str,
        updates: Dict[str, Any],
        updated_by: Optional[str] = None
    ) -> ThresholdDefinition:
        """Update a threshold definition."""
        threshold = self.thresholds.get(threshold_id)
        if not threshold:
            raise ValueError(f"Threshold {threshold_id} not found")
        
        # Update fields
        for field, value in updates.items():
            if hasattr(threshold, field):
                setattr(threshold, field, value)
        
        # Update metadata
        threshold.updated_at = datetime.now()
        
        # Validate updated threshold
        self._validate_threshold(threshold)
        
        logger.info(f"Updated threshold {threshold_id} by {updated_by}")
        return threshold
    
    async def delete_threshold(
        self,
        threshold_id: str,
        cascade: bool = False,
        deleted_by: Optional[str] = None
    ):
        """Delete a threshold definition."""
        threshold = self.thresholds.get(threshold_id)
        if not threshold:
            raise ValueError(f"Threshold {threshold_id} not found")
        
        if cascade:
            # Delete associated alert rules
            # This would be implemented with proper database cascading
            pass
        
        # Remove from storage
        del self.thresholds[threshold_id]
        
        # Update metric mapping
        if threshold.metric_id in self.metric_threshold_map:
            self.metric_threshold_map[threshold.metric_id].discard(threshold_id)
            if not self.metric_threshold_map[threshold.metric_id]:
                del self.metric_threshold_map[threshold.metric_id]
        
        logger.info(f"Deleted threshold {threshold_id} by {deleted_by}")
    
    async def get_thresholds_for_metric(self, metric_id: str) -> List[ThresholdDefinition]:
        """Get all thresholds for a specific metric."""
        threshold_ids = self.metric_threshold_map.get(metric_id, set())
        return [
            self.thresholds[tid] for tid in threshold_ids 
            if tid in self.thresholds
        ]
    
    async def bulk_operation(
        self,
        operation: BulkThresholdOperation,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Perform bulk operations on thresholds."""
        results = {
            "success": 0,
            "failed": 0,
            "errors": []
        }
        
        # Get target threshold IDs
        if operation.threshold_ids:
            target_ids = operation.threshold_ids
        elif operation.filters:
            # Get IDs from filters
            filtered_thresholds = await self.list_thresholds(
                filters=operation.filters,
                limit=10000  # Large limit for bulk ops
            )
            target_ids = [t.id for t in filtered_thresholds]
        else:
            raise ValueError("Either threshold_ids or filters must be provided")
        
        # Perform operation on each threshold
        for threshold_id in target_ids:
            try:
                if operation.operation == "enable":
                    await self.update_threshold(
                        threshold_id,
                        {"enabled": True},
                        user_id
                    )
                elif operation.operation == "disable":
                    await self.update_threshold(
                        threshold_id,
                        {"enabled": False},
                        user_id
                    )
                elif operation.operation == "update":
                    if not operation.updates:
                        raise ValueError("Updates required for update operation")
                    await self.update_threshold(
                        threshold_id,
                        operation.updates,
                        user_id
                    )
                elif operation.operation == "delete":
                    await self.delete_threshold(
                        threshold_id,
                        cascade=True,
                        deleted_by=user_id
                    )
                
                results["success"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "threshold_id": threshold_id,
                    "error": str(e)
                })
        
        return results
    
    async def create_default_alert_rule(
        self,
        threshold_id: str,
        alert_config: Dict[str, Any],
        created_by: Optional[str] = None
    ) -> AlertRule:
        """Create a default alert rule for a threshold."""
        threshold = await self.get_threshold(threshold_id)
        if not threshold:
            raise ValueError(f"Threshold {threshold_id} not found")
        
        # Create alert rule with defaults
        rule = AlertRule(
            name=f"Alert for {threshold.name}",
            description=f"Auto-generated alert rule for threshold {threshold.name}",
            threshold_id=threshold_id,
            severity_override=alert_config.get("severity", threshold.severity),
            notification_channels=[
                NotificationChannel(ch) for ch in alert_config.get("notifications", ["dashboard"])
            ],
            notification_config=alert_config.get("notification_config", {}),
            auto_resolve=alert_config.get("auto_resolve", True),
            require_acknowledgment=alert_config.get("require_acknowledgment", False),
            created_by=created_by
        )
        
        # This would normally be saved to database
        logger.info(f"Created default alert rule for threshold {threshold_id}")
        return rule
    
    async def list_templates(
        self,
        category: Optional[str] = None,
        system_only: bool = False
    ) -> List[AlertTemplate]:
        """List available alert templates."""
        templates = list(self.templates.values())
        
        if category:
            templates = [t for t in templates if t.category == category]
        
        if system_only:
            templates = [t for t in templates if t.is_system]
        
        # Sort by category then name
        templates.sort(key=lambda t: (t.category, t.name))
        
        return templates
    
    async def apply_template(
        self,
        template_id: str,
        variables: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Apply a template to create threshold and alert rule."""
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        # Validate required variables
        missing_vars = set(template.required_variables) - set(variables.keys())
        if missing_vars:
            raise ValueError(f"Missing required variables: {', '.join(missing_vars)}")
        
        # Create threshold from template
        threshold_config = self._apply_template_variables(
            template.threshold_config,
            variables
        )
        
        threshold = ThresholdDefinition(
            name=variables.get("name", f"{template.name} - {variables.get('metric_name', 'Unknown')}"),
            description=variables.get("description", template.description),
            metric_id=variables["metric_id"],
            metric_name=variables.get("metric_name"),
            type=template.threshold_type,
            tags=template.tags.copy(),
            created_by=user_id
        )
        
        # Set type-specific configuration
        if template.threshold_type == ThresholdType.STATIC:
            threshold.static_config = StaticThresholdConfig(**threshold_config)
        elif template.threshold_type in [
            ThresholdType.DYNAMIC_PERCENTILE,
            ThresholdType.DYNAMIC_STDDEV,
            ThresholdType.DYNAMIC_MOVING_AVG,
            ThresholdType.RATE_OF_CHANGE
        ]:
            threshold.dynamic_config = DynamicThresholdConfig(**threshold_config)
        
        # Apply other threshold settings from template
        if "hysteresis" in threshold_config:
            threshold.hysteresis = threshold_config["hysteresis"]
        if "consecutive_violations" in threshold_config:
            threshold.consecutive_violations = threshold_config["consecutive_violations"]
        if "debounce_time" in threshold_config:
            threshold.debounce_time = TimeWindow(**threshold_config["debounce_time"])
        
        # Create threshold
        created_threshold = await self.create_threshold(threshold, user_id)
        
        # Create alert rule from template
        alert_config = self._apply_template_variables(
            template.alert_config,
            variables
        )
        
        alert_rule = await self.create_default_alert_rule(
            created_threshold.id,
            alert_config,
            user_id
        )
        
        return {
            "threshold": created_threshold,
            "alert_rule": alert_rule,
            "template_applied": template.name
        }
    
    def _apply_template_variables(
        self,
        config: Dict[str, Any],
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply variables to template configuration."""
        result = {}
        
        for key, value in config.items():
            if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
                # Template variable
                var_name = value[2:-2]
                if var_name in variables:
                    result[key] = variables[var_name]
                else:
                    # Keep original if variable not provided
                    result[key] = value
            elif isinstance(value, dict):
                result[key] = self._apply_template_variables(value, variables)
            elif isinstance(value, list):
                result[key] = [
                    self._apply_template_variables(item, variables) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                result[key] = value
        
        return result
    
    def _validate_threshold(self, threshold: ThresholdDefinition):
        """Validate threshold configuration."""
        if not threshold.metric_id:
            raise ValueError("metric_id is required")
        
        if not threshold.name:
            raise ValueError("name is required")
        
        # Type-specific validation
        if threshold.type == ThresholdType.STATIC:
            if not threshold.static_config:
                raise ValueError("static_config is required for static thresholds")
            
            config = threshold.static_config
            if config.operator in ["in_range", "out_of_range"]:
                if config.lower_bound is None or config.upper_bound is None:
                    raise ValueError("Both bounds required for range operators")
                if config.lower_bound >= config.upper_bound:
                    raise ValueError("lower_bound must be less than upper_bound")
        
        elif threshold.type in [
            ThresholdType.DYNAMIC_PERCENTILE,
            ThresholdType.DYNAMIC_STDDEV,
            ThresholdType.DYNAMIC_MOVING_AVG,
            ThresholdType.RATE_OF_CHANGE
        ]:
            if not threshold.dynamic_config:
                raise ValueError("dynamic_config is required for dynamic thresholds")
            
            config = threshold.dynamic_config
            if config.evaluation_method == "percentile" and not config.percentile:
                raise ValueError("percentile is required for percentile evaluation")
            if config.evaluation_method == "stddev" and not config.stddev_multiplier:
                raise ValueError("stddev_multiplier is required for stddev evaluation")
            if config.evaluation_method == "moving_avg" and not config.smoothing_factor:
                raise ValueError("smoothing_factor is required for moving average evaluation")
        
        elif threshold.type == ThresholdType.CONDITIONAL:
            if not threshold.conditional_config:
                raise ValueError("conditional_config is required for conditional thresholds")
        
        elif threshold.type == ThresholdType.TIME_BASED:
            if not threshold.time_based_config:
                raise ValueError("time_based_config is required for time-based thresholds")
        
        elif threshold.type == ThresholdType.COMPOSITE:
            if not threshold.composite_config:
                raise ValueError("composite_config is required for composite thresholds")
        
        # Validation for constraints
        if threshold.consecutive_violations < 1:
            raise ValueError("consecutive_violations must be at least 1")
        
        if threshold.hysteresis and threshold.hysteresis < 0:
            raise ValueError("hysteresis must be non-negative")
    
    async def get_threshold_statistics(self, threshold_id: str) -> Dict[str, Any]:
        """Get usage statistics for a threshold."""
        # This would be implemented with proper database queries
        return {
            "threshold_id": threshold_id,
            "total_evaluations": 0,
            "total_violations": 0,
            "alerts_generated": 0,
            "last_evaluation": None,
            "last_violation": None,
            "success_rate": 1.0
        }
    
    def get_metrics_with_thresholds(self) -> List[str]:
        """Get list of metrics that have thresholds configured."""
        return list(self.metric_threshold_map.keys())
    
    def get_threshold_count_by_type(self) -> Dict[str, int]:
        """Get count of thresholds by type."""
        counts = {}
        for threshold in self.thresholds.values():
            type_name = threshold.type.value
            counts[type_name] = counts.get(type_name, 0) + 1
        return counts
    
    def get_threshold_count_by_severity(self) -> Dict[str, int]:
        """Get count of thresholds by severity."""
        counts = {}
        for threshold in self.thresholds.values():
            severity_name = threshold.severity.value
            counts[severity_name] = counts.get(severity_name, 0) + 1
        return counts
    
    async def export_configuration(
        self,
        include_system_templates: bool = False
    ) -> Dict[str, Any]:
        """Export threshold and template configuration."""
        export_data = {
            "thresholds": [t.dict() for t in self.thresholds.values()],
            "templates": [
                t.dict() for t in self.templates.values()
                if not t.is_system or include_system_templates
            ],
            "exported_at": datetime.now().isoformat(),
            "version": "1.0"
        }
        
        return export_data
    
    async def import_configuration(
        self,
        import_data: Dict[str, Any],
        merge: bool = False,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Import threshold and template configuration."""
        results = {
            "thresholds_imported": 0,
            "templates_imported": 0,
            "errors": []
        }
        
        if not merge:
            # Clear existing data
            self.thresholds.clear()
            self.metric_threshold_map.clear()
            # Keep system templates
            self.templates = {
                tid: template for tid, template in self.templates.items()
                if template.is_system
            }
        
        # Import thresholds
        for threshold_data in import_data.get("thresholds", []):
            try:
                threshold = ThresholdDefinition(**threshold_data)
                threshold.created_by = user_id
                threshold.updated_at = datetime.now()
                
                self.thresholds[threshold.id] = threshold
                
                # Update metric mapping
                if threshold.metric_id not in self.metric_threshold_map:
                    self.metric_threshold_map[threshold.metric_id] = set()
                self.metric_threshold_map[threshold.metric_id].add(threshold.id)
                
                results["thresholds_imported"] += 1
                
            except Exception as e:
                results["errors"].append({
                    "type": "threshold",
                    "data": threshold_data,
                    "error": str(e)
                })
        
        # Import templates (non-system only)
        for template_data in import_data.get("templates", []):
            try:
                template = AlertTemplate(**template_data)
                
                if not template.is_system:  # Don't import system templates
                    template.created_by = user_id
                    self.templates[template.id] = template
                    results["templates_imported"] += 1
                
            except Exception as e:
                results["errors"].append({
                    "type": "template",
                    "data": template_data,
                    "error": str(e)
                })
        
        logger.info(f"Configuration imported by {user_id}: {results}")
        return results