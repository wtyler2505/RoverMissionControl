"""
Notification service for sending alerts to external systems.
"""

import asyncio
import logging
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Optional, Any
from datetime import datetime
import httpx
import ssl
from dataclasses import dataclass

from ..models.telemetry_alerts import (
    NotificationChannel, AlertInstance, AlertSeverity
)

logger = logging.getLogger(__name__)

@dataclass
class NotificationResult:
    """Result of a notification attempt."""
    success: bool
    message: str
    delivery_time_ms: Optional[float] = None
    retry_count: int = 0

class EmailNotificationProvider:
    """Email notification provider."""
    
    def __init__(self, smtp_config: Dict[str, Any]):
        self.smtp_host = smtp_config.get("host", "localhost")
        self.smtp_port = smtp_config.get("port", 587)
        self.username = smtp_config.get("username")
        self.password = smtp_config.get("password")
        self.use_tls = smtp_config.get("use_tls", True)
        self.from_address = smtp_config.get("from_address", "alerts@rover.local")
        self.from_name = smtp_config.get("from_name", "Rover Mission Control")
    
    async def send(
        self, 
        alert: AlertInstance, 
        recipients: List[str],
        template: Optional[Dict[str, str]] = None
    ) -> NotificationResult:
        """Send email notification."""
        try:
            start_time = datetime.now()
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = alert.title
            msg['From'] = f"{self.from_name} <{self.from_address}>"
            msg['To'] = ", ".join(recipients)
            
            # Generate email content
            text_content, html_content = self._generate_content(alert, template)
            
            # Attach text and HTML
            msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))
            
            # Send email
            await self._send_smtp(msg, recipients)
            
            delivery_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return NotificationResult(
                success=True,
                message=f"Email sent to {len(recipients)} recipients",
                delivery_time_ms=delivery_time
            )
            
        except Exception as e:
            logger.error(f"Email notification failed: {e}")
            return NotificationResult(
                success=False,
                message=f"Email failed: {str(e)}"
            )
    
    def _generate_content(
        self, 
        alert: AlertInstance, 
        template: Optional[Dict[str, str]] = None
    ) -> tuple[str, str]:
        """Generate email content."""
        # Default templates
        if not template:
            template = {
                "text": self._default_text_template(),
                "html": self._default_html_template()
            }
        
        # Template variables
        variables = {
            "alert_title": alert.title,
            "alert_message": alert.message,
            "metric_name": alert.metric_name,
            "current_value": alert.triggered_value,
            "threshold_value": alert.threshold_value,
            "severity": alert.severity.value.upper(),
            "triggered_at": alert.triggered_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "alert_id": alert.id,
            "severity_color": self._get_severity_color(alert.severity)
        }
        
        # Replace variables in templates
        text_content = template["text"].format(**variables)
        html_content = template["html"].format(**variables)
        
        return text_content, html_content
    
    async def _send_smtp(self, msg: MIMEMultipart, recipients: List[str]):
        """Send email via SMTP."""
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._send_smtp_sync, msg, recipients)
    
    def _send_smtp_sync(self, msg: MIMEMultipart, recipients: List[str]):
        """Synchronous SMTP send."""
        server = None
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            
            if self.use_tls:
                server.starttls(context=ssl.create_default_context())
            
            if self.username and self.password:
                server.login(self.username, self.password)
            
            server.send_message(msg, to_addrs=recipients)
            
        finally:
            if server:
                server.quit()
    
    def _default_text_template(self) -> str:
        """Default text email template."""
        return """
Rover Mission Control Alert

Alert: {alert_title}
Severity: {severity}
Metric: {metric_name}
Current Value: {current_value}
Threshold: {threshold_value}
Triggered: {triggered_at}

Message: {alert_message}

Alert ID: {alert_id}

--
Rover Mission Control System
        """.strip()
    
    def _default_html_template(self) -> str:
        """Default HTML email template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Rover Mission Control Alert</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; }}
        .alert-container {{ max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; }}
        .alert-header {{ background-color: {severity_color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
        .alert-body {{ padding: 20px; }}
        .alert-details {{ background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; padding: 15px; }}
        .severity-badge {{ display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="alert-container">
        <div class="alert-header">
            <h2>{alert_title}</h2>
            <span class="severity-badge">{severity}</span>
        </div>
        <div class="alert-body">
            <p><strong>Message:</strong> {alert_message}</p>
            
            <div class="alert-details">
                <h4>Alert Details</h4>
                <ul>
                    <li><strong>Metric:</strong> {metric_name}</li>
                    <li><strong>Current Value:</strong> {current_value}</li>
                    <li><strong>Threshold:</strong> {threshold_value}</li>
                    <li><strong>Triggered:</strong> {triggered_at}</li>
                    <li><strong>Alert ID:</strong> {alert_id}</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            Rover Mission Control System
        </div>
    </div>
</body>
</html>
        """.strip()
    
    def _get_severity_color(self, severity: AlertSeverity) -> str:
        """Get color for severity level."""
        colors = {
            AlertSeverity.INFO: "#17a2b8",
            AlertSeverity.WARNING: "#ffc107", 
            AlertSeverity.ERROR: "#dc3545",
            AlertSeverity.CRITICAL: "#6f42c1"
        }
        return colors.get(severity, "#6c757d")

class WebhookNotificationProvider:
    """Webhook notification provider."""
    
    def __init__(self, webhook_config: Dict[str, Any]):
        self.timeout = webhook_config.get("timeout", 30)
        self.max_retries = webhook_config.get("max_retries", 3)
        self.retry_delay = webhook_config.get("retry_delay", 5)
    
    async def send(
        self,
        alert: AlertInstance,
        url: str,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        template: Optional[Dict[str, Any]] = None
    ) -> NotificationResult:
        """Send webhook notification."""
        start_time = datetime.now()
        
        # Prepare payload
        payload = self._prepare_payload(alert, template)
        
        # Default headers
        default_headers = {
            "Content-Type": "application/json",
            "User-Agent": "Rover-Mission-Control/1.0"
        }
        if headers:
            default_headers.update(headers)
        
        retry_count = 0
        last_error = None
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while retry_count <= self.max_retries:
                try:
                    response = await client.request(
                        method=method,
                        url=url,
                        json=payload,
                        headers=default_headers
                    )
                    
                    response.raise_for_status()
                    
                    delivery_time = (datetime.now() - start_time).total_seconds() * 1000
                    
                    return NotificationResult(
                        success=True,
                        message=f"Webhook sent successfully ({response.status_code})",
                        delivery_time_ms=delivery_time,
                        retry_count=retry_count
                    )
                    
                except Exception as e:
                    last_error = e
                    retry_count += 1
                    
                    if retry_count <= self.max_retries:
                        await asyncio.sleep(self.retry_delay * retry_count)
                    
                    logger.warning(f"Webhook attempt {retry_count} failed: {e}")
        
        return NotificationResult(
            success=False,
            message=f"Webhook failed after {retry_count} attempts: {str(last_error)}",
            retry_count=retry_count
        )
    
    def _prepare_payload(
        self, 
        alert: AlertInstance, 
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Prepare webhook payload."""
        if template:
            # Use custom template
            payload = template.copy()
            # Replace template variables
            payload = self._replace_template_variables(payload, alert)
        else:
            # Default payload format
            payload = {
                "alert_id": alert.id,
                "title": alert.title,
                "message": alert.message,
                "severity": alert.severity.value,
                "state": alert.state.value,
                "metric": {
                    "id": alert.metric_id,
                    "name": alert.metric_name,
                    "current_value": alert.triggered_value,
                    "threshold_value": alert.threshold_value
                },
                "timestamps": {
                    "triggered_at": alert.triggered_at.isoformat(),
                    "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                    "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
                },
                "details": alert.details,
                "rule_id": alert.rule_id,
                "threshold_id": alert.threshold_id
            }
        
        return payload
    
    def _replace_template_variables(
        self, 
        obj: Any, 
        alert: AlertInstance
    ) -> Any:
        """Recursively replace template variables in object."""
        variables = {
            "{{alert_id}}": alert.id,
            "{{title}}": alert.title,
            "{{message}}": alert.message,
            "{{severity}}": alert.severity.value,
            "{{metric_name}}": alert.metric_name,
            "{{current_value}}": str(alert.triggered_value),
            "{{threshold_value}}": str(alert.threshold_value),
            "{{triggered_at}}": alert.triggered_at.isoformat()
        }
        
        if isinstance(obj, str):
            for var, value in variables.items():
                obj = obj.replace(var, value)
            return obj
        elif isinstance(obj, dict):
            return {k: self._replace_template_variables(v, alert) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._replace_template_variables(item, alert) for item in obj]
        else:
            return obj

class MQTTNotificationProvider:
    """MQTT notification provider."""
    
    def __init__(self, mqtt_config: Dict[str, Any]):
        self.broker_host = mqtt_config.get("host", "localhost")
        self.broker_port = mqtt_config.get("port", 1883)
        self.username = mqtt_config.get("username")
        self.password = mqtt_config.get("password")
        self.use_tls = mqtt_config.get("use_tls", False)
        self.topic_prefix = mqtt_config.get("topic_prefix", "rover/alerts")
        self.qos = mqtt_config.get("qos", 1)
        self.retain = mqtt_config.get("retain", False)
    
    async def send(
        self,
        alert: AlertInstance,
        topic: Optional[str] = None,
        template: Optional[Dict[str, Any]] = None
    ) -> NotificationResult:
        """Send MQTT notification."""
        try:
            # Dynamic import to make MQTT optional
            import paho.mqtt.client as mqtt
            
            start_time = datetime.now()
            
            # Prepare topic and payload
            if not topic:
                topic = f"{self.topic_prefix}/{alert.severity.value}/{alert.metric_id}"
            
            payload = self._prepare_payload(alert, template)
            
            # Create client and connect
            client = mqtt.Client()
            
            if self.username and self.password:
                client.username_pw_set(self.username, self.password)
            
            if self.use_tls:
                client.tls_set()
            
            # Connect and publish
            result = await self._mqtt_publish(
                client, topic, payload, start_time
            )
            
            return result
            
        except ImportError:
            return NotificationResult(
                success=False,
                message="MQTT client not available (install paho-mqtt)"
            )
        except Exception as e:
            logger.error(f"MQTT notification failed: {e}")
            return NotificationResult(
                success=False,
                message=f"MQTT failed: {str(e)}"
            )
    
    async def _mqtt_publish(
        self,
        client,
        topic: str,
        payload: Dict[str, Any],
        start_time: datetime
    ) -> NotificationResult:
        """Publish to MQTT broker."""
        connected = asyncio.Event()
        published = asyncio.Event()
        error_msg = None
        
        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                connected.set()
            else:
                nonlocal error_msg
                error_msg = f"MQTT connection failed with code {rc}"
                connected.set()
        
        def on_publish(client, userdata, mid):
            published.set()
        
        client.on_connect = on_connect
        client.on_publish = on_publish
        
        # Connect
        client.connect(self.broker_host, self.broker_port, 60)
        client.loop_start()
        
        try:
            # Wait for connection
            await asyncio.wait_for(connected.wait(), timeout=10.0)
            
            if error_msg:
                return NotificationResult(success=False, message=error_msg)
            
            # Publish message
            result = client.publish(
                topic,
                json.dumps(payload),
                qos=self.qos,
                retain=self.retain
            )
            
            # Wait for publish confirmation
            await asyncio.wait_for(published.wait(), timeout=10.0)
            
            delivery_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return NotificationResult(
                success=True,
                message=f"MQTT message published to {topic}",
                delivery_time_ms=delivery_time
            )
            
        except asyncio.TimeoutError:
            return NotificationResult(
                success=False,
                message="MQTT publish timeout"
            )
        finally:
            client.loop_stop()
            client.disconnect()
    
    def _prepare_payload(
        self, 
        alert: AlertInstance, 
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Prepare MQTT payload."""
        if template:
            return template
        
        return {
            "alert_id": alert.id,
            "timestamp": alert.triggered_at.isoformat(),
            "severity": alert.severity.value,
            "metric_id": alert.metric_id,
            "metric_name": alert.metric_name,
            "value": alert.triggered_value,
            "threshold": alert.threshold_value,
            "title": alert.title,
            "message": alert.message,
            "state": alert.state.value
        }

class SlackNotificationProvider:
    """Slack notification provider."""
    
    def __init__(self, slack_config: Dict[str, Any]):
        self.webhook_url = slack_config.get("webhook_url")
        self.token = slack_config.get("token")
        self.default_channel = slack_config.get("default_channel", "#alerts")
        self.username = slack_config.get("username", "Rover Alerts")
        self.icon_emoji = slack_config.get("icon_emoji", ":warning:")
    
    async def send(
        self,
        alert: AlertInstance,
        channel: Optional[str] = None,
        template: Optional[Dict[str, Any]] = None
    ) -> NotificationResult:
        """Send Slack notification."""
        try:
            start_time = datetime.now()
            
            # Prepare Slack message
            message = self._prepare_slack_message(
                alert, channel or self.default_channel, template
            )
            
            # Send via webhook or API
            if self.webhook_url:
                result = await self._send_webhook(message, start_time)
            elif self.token:
                result = await self._send_api(message, start_time)
            else:
                return NotificationResult(
                    success=False,
                    message="No Slack webhook URL or token configured"
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Slack notification failed: {e}")
            return NotificationResult(
                success=False,
                message=f"Slack failed: {str(e)}"
            )
    
    async def _send_webhook(
        self, 
        message: Dict[str, Any], 
        start_time: datetime
    ) -> NotificationResult:
        """Send via Slack webhook."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self.webhook_url,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            response.raise_for_status()
            
            delivery_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return NotificationResult(
                success=True,
                message="Slack webhook sent successfully",
                delivery_time_ms=delivery_time
            )
    
    async def _send_api(
        self, 
        message: Dict[str, Any], 
        start_time: datetime
    ) -> NotificationResult:
        """Send via Slack API."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://slack.com/api/chat.postMessage",
                json=message,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                }
            )
            
            response.raise_for_status()
            
            delivery_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return NotificationResult(
                success=True,
                message="Slack API message sent successfully",
                delivery_time_ms=delivery_time
            )
    
    def _prepare_slack_message(
        self,
        alert: AlertInstance,
        channel: str,
        template: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Prepare Slack message."""
        if template:
            return template
        
        # Color based on severity
        colors = {
            AlertSeverity.INFO: "#36a64f",
            AlertSeverity.WARNING: "#ff9500", 
            AlertSeverity.ERROR: "#ff0000",
            AlertSeverity.CRITICAL: "#800080"
        }
        
        color = colors.get(alert.severity, "#808080")
        
        return {
            "channel": channel,
            "username": self.username,
            "icon_emoji": self.icon_emoji,
            "attachments": [
                {
                    "color": color,
                    "title": alert.title,
                    "text": alert.message,
                    "fields": [
                        {
                            "title": "Metric",
                            "value": alert.metric_name,
                            "short": True
                        },
                        {
                            "title": "Severity",
                            "value": alert.severity.value.upper(),
                            "short": True
                        },
                        {
                            "title": "Current Value",
                            "value": str(alert.triggered_value),
                            "short": True
                        },
                        {
                            "title": "Threshold",
                            "value": str(alert.threshold_value),
                            "short": True
                        }
                    ],
                    "footer": "Rover Mission Control",
                    "ts": int(alert.triggered_at.timestamp())
                }
            ]
        }

class NotificationService:
    """Main notification service that manages all providers."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.providers = {}
        self.delivery_stats = {
            "total_sent": 0,
            "total_failed": 0,
            "by_channel": {},
            "avg_delivery_time": {}
        }
        
        # Initialize providers
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize notification providers."""
        if "email" in self.config:
            self.providers[NotificationChannel.EMAIL] = EmailNotificationProvider(
                self.config["email"]
            )
        
        if "webhook" in self.config:
            self.providers[NotificationChannel.WEBHOOK] = WebhookNotificationProvider(
                self.config["webhook"]
            )
        
        if "mqtt" in self.config:
            self.providers[NotificationChannel.MQTT] = MQTTNotificationProvider(
                self.config["mqtt"]
            )
        
        if "slack" in self.config:
            self.providers[NotificationChannel.SLACK] = SlackNotificationProvider(
                self.config["slack"]
            )
    
    async def send_notification(
        self,
        channel: NotificationChannel,
        alert: AlertInstance,
        config: Dict[str, Any]
    ) -> NotificationResult:
        """Send notification through specified channel."""
        if channel not in self.providers:
            return NotificationResult(
                success=False,
                message=f"Provider for {channel.value} not configured"
            )
        
        provider = self.providers[channel]
        
        try:
            # Send notification
            result = await self._send_with_provider(provider, channel, alert, config)
            
            # Update statistics
            self._update_stats(channel, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Notification failed for {channel.value}: {e}")
            
            error_result = NotificationResult(
                success=False,
                message=f"Provider error: {str(e)}"
            )
            
            self._update_stats(channel, error_result)
            return error_result
    
    async def _send_with_provider(
        self,
        provider: Any,
        channel: NotificationChannel,
        alert: AlertInstance,
        config: Dict[str, Any]
    ) -> NotificationResult:
        """Send notification with specific provider."""
        if channel == NotificationChannel.EMAIL:
            recipients = config.get("recipients", [])
            template = config.get("template")
            return await provider.send(alert, recipients, template)
            
        elif channel == NotificationChannel.WEBHOOK:
            url = config.get("url", "")
            method = config.get("method", "POST")
            headers = config.get("headers", {})
            template = config.get("template")
            return await provider.send(alert, url, method, headers, template)
            
        elif channel == NotificationChannel.MQTT:
            topic = config.get("topic")
            template = config.get("template")
            return await provider.send(alert, topic, template)
            
        elif channel == NotificationChannel.SLACK:
            channel_name = config.get("channel")
            template = config.get("template")
            return await provider.send(alert, channel_name, template)
            
        else:
            return NotificationResult(
                success=False,
                message=f"Unsupported channel: {channel.value}"
            )
    
    def _update_stats(self, channel: NotificationChannel, result: NotificationResult):
        """Update delivery statistics."""
        if result.success:
            self.delivery_stats["total_sent"] += 1
        else:
            self.delivery_stats["total_failed"] += 1
        
        # Channel-specific stats
        channel_key = channel.value
        if channel_key not in self.delivery_stats["by_channel"]:
            self.delivery_stats["by_channel"][channel_key] = {
                "sent": 0,
                "failed": 0,
                "total_delivery_time": 0.0,
                "delivery_count": 0
            }
        
        channel_stats = self.delivery_stats["by_channel"][channel_key]
        
        if result.success:
            channel_stats["sent"] += 1
            if result.delivery_time_ms:
                channel_stats["total_delivery_time"] += result.delivery_time_ms
                channel_stats["delivery_count"] += 1
        else:
            channel_stats["failed"] += 1
        
        # Update average delivery time
        if channel_stats["delivery_count"] > 0:
            self.delivery_stats["avg_delivery_time"][channel_key] = (
                channel_stats["total_delivery_time"] / channel_stats["delivery_count"]
            )
    
    async def test_channel(
        self,
        channel: NotificationChannel,
        config: Dict[str, Any],
        test_message: str = "Test notification",
        user_id: Optional[str] = None
    ) -> NotificationResult:
        """Test a notification channel."""
        # Create test alert
        test_alert = AlertInstance(
            rule_id="test-rule",
            threshold_id="test-threshold",
            metric_id="test.metric",
            metric_name="Test Metric",
            severity=AlertSeverity.INFO,
            triggered_value=100.0,
            threshold_value=90.0,
            title="Test Alert",
            message=test_message,
            details={"test": True, "user_id": user_id}
        )
        
        return await self.send_notification(channel, test_alert, config)
    
    async def get_global_config(self) -> Dict[str, Any]:
        """Get global notification configuration."""
        return {
            "available_channels": [channel.value for channel in self.providers.keys()],
            "statistics": self.delivery_stats,
            "config_keys": {
                channel.value: list(provider_config.keys())
                for channel, provider_config in self.config.items()
            }
        }
    
    async def update_global_config(
        self,
        config: Dict[str, Any],
        updated_by: str
    ) -> Dict[str, Any]:
        """Update global notification configuration."""
        # Validate configuration
        self._validate_config(config)
        
        # Update config
        self.config.update(config)
        
        # Reinitialize providers
        self._initialize_providers()
        
        logger.info(f"Notification config updated by {updated_by}")
        
        return await self.get_global_config()
    
    def _validate_config(self, config: Dict[str, Any]):
        """Validate notification configuration."""
        # Basic validation - could be expanded
        for channel, channel_config in config.items():
            if not isinstance(channel_config, dict):
                raise ValueError(f"Configuration for {channel} must be a dictionary")
            
            # Channel-specific validation
            if channel == "email":
                required = ["host", "port", "from_address"]
                for field in required:
                    if field not in channel_config:
                        raise ValueError(f"Email config missing required field: {field}")
            
            elif channel == "webhook":
                if "timeout" in channel_config and channel_config["timeout"] <= 0:
                    raise ValueError("Webhook timeout must be positive")
            
            elif channel == "mqtt":
                required = ["host", "port"]
                for field in required:
                    if field not in channel_config:
                        raise ValueError(f"MQTT config missing required field: {field}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get notification statistics."""
        return self.delivery_stats.copy()
    
    def reset_stats(self):
        """Reset notification statistics."""
        self.delivery_stats = {
            "total_sent": 0,
            "total_failed": 0,
            "by_channel": {},
            "avg_delivery_time": {}
        }