"""
Real-time notification system with multiple channels and escalation
"""
import os
import json
import smtplib
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiohttp
import sqlite3
from twilio.rest import Client as TwilioClient
from jinja2 import Template
import threading
import queue
from collections import defaultdict
import logging


@dataclass
class NotificationRule:
    """Defines when and how to send notifications"""
    id: str
    name: str
    event_types: List[str]
    severity_levels: List[str]
    channels: List[str]
    recipients: Dict[str, List[str]]  # channel -> recipients
    template_id: str
    cooldown_minutes: int = 5
    max_notifications_per_hour: int = 10
    escalation_delay_minutes: int = 15
    escalation_channels: List[str] = None
    conditions: Dict[str, Any] = None
    is_active: bool = True


@dataclass
class NotificationEvent:
    """Event that triggers notifications"""
    id: str
    timestamp: str
    event_type: str
    severity: str
    title: str
    description: str
    data: Dict[str, Any]
    actor: Optional[str] = None
    correlation_id: Optional[str] = None
    source_system: Optional[str] = None


@dataclass
class NotificationRecord:
    """Record of sent notification"""
    id: str
    event_id: str
    rule_id: str
    channel: str
    recipient: str
    sent_at: str
    status: str  # 'sent', 'failed', 'pending'
    error: Optional[str] = None
    retry_count: int = 0


class NotificationChannel:
    """Base class for notification channels"""
    
    async def send(self, recipient: str, event: NotificationEvent, 
                  template: str) -> Tuple[bool, Optional[str]]:
        """Send notification"""
        raise NotImplementedError
        
    def validate_recipient(self, recipient: str) -> bool:
        """Validate recipient format"""
        raise NotImplementedError


class EmailChannel(NotificationChannel):
    """Email notification channel"""
    
    def __init__(self, smtp_host: str, smtp_port: int, 
                 smtp_user: str, smtp_password: str, 
                 from_address: str, use_tls: bool = True):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_address = from_address
        self.use_tls = use_tls
        
    async def send(self, recipient: str, event: NotificationEvent, 
                  template: str) -> Tuple[bool, Optional[str]]:
        """Send email notification"""
        try:
            # Render template
            tmpl = Template(template)
            html_content = tmpl.render(event=asdict(event))
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"[{event.severity.upper()}] {event.title}"
            msg['From'] = self.from_address
            msg['To'] = recipient
            
            # Add text and HTML parts
            text_part = MIMEText(event.description, 'plain')
            html_part = MIMEText(html_content, 'html')
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._send_email_sync,
                recipient,
                msg
            )
            
            return True, None
        except Exception as e:
            return False, str(e)
            
    def _send_email_sync(self, recipient: str, msg: MIMEMultipart):
        """Synchronous email sending"""
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.use_tls:
                server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
            
    def validate_recipient(self, recipient: str) -> bool:
        """Validate email address"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, recipient) is not None


class SMSChannel(NotificationChannel):
    """SMS notification channel using Twilio"""
    
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.client = TwilioClient(account_sid, auth_token)
        self.from_number = from_number
        
    async def send(self, recipient: str, event: NotificationEvent, 
                  template: str) -> Tuple[bool, Optional[str]]:
        """Send SMS notification"""
        try:
            # Render template (limit to 160 chars for SMS)
            tmpl = Template(template)
            message = tmpl.render(event=asdict(event))[:160]
            
            # Send SMS
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._send_sms_sync,
                recipient,
                message
            )
            
            return True, None
        except Exception as e:
            return False, str(e)
            
    def _send_sms_sync(self, recipient: str, message: str):
        """Synchronous SMS sending"""
        self.client.messages.create(
            body=message,
            from_=self.from_number,
            to=recipient
        )
        
    def validate_recipient(self, recipient: str) -> bool:
        """Validate phone number"""
        import re
        # Basic international phone number validation
        pattern = r'^\+?1?\d{9,15}$'
        return re.match(pattern, recipient) is not None


class WebhookChannel(NotificationChannel):
    """Webhook notification channel"""
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        
    async def send(self, recipient: str, event: NotificationEvent, 
                  template: str) -> Tuple[bool, Optional[str]]:
        """Send webhook notification"""
        try:
            # Render template as JSON payload
            tmpl = Template(template)
            payload = json.loads(tmpl.render(event=asdict(event)))
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    recipient,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status >= 200 and response.status < 300:
                        return True, None
                    else:
                        return False, f"HTTP {response.status}"
                        
        except Exception as e:
            return False, str(e)
            
    def validate_recipient(self, recipient: str) -> bool:
        """Validate webhook URL"""
        return recipient.startswith(('http://', 'https://'))


class SlackChannel(NotificationChannel):
    """Slack notification channel"""
    
    def __init__(self, webhook_url: Optional[str] = None, 
                 bot_token: Optional[str] = None):
        self.webhook_url = webhook_url
        self.bot_token = bot_token
        
    async def send(self, recipient: str, event: NotificationEvent, 
                  template: str) -> Tuple[bool, Optional[str]]:
        """Send Slack notification"""
        try:
            # Render template
            tmpl = Template(template)
            message = json.loads(tmpl.render(event=asdict(event)))
            
            if self.webhook_url and recipient == "webhook":
                # Send to webhook
                async with aiohttp.ClientSession() as session:
                    async with session.post(self.webhook_url, json=message) as response:
                        if response.status == 200:
                            return True, None
                        else:
                            return False, f"HTTP {response.status}"
                            
            elif self.bot_token:
                # Send using bot token
                headers = {
                    'Authorization': f'Bearer {self.bot_token}',
                    'Content-Type': 'application/json'
                }
                
                payload = {
                    'channel': recipient,
                    **message
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        'https://slack.com/api/chat.postMessage',
                        headers=headers,
                        json=payload
                    ) as response:
                        data = await response.json()
                        if data.get('ok'):
                            return True, None
                        else:
                            return False, data.get('error', 'Unknown error')
                            
            return False, "No Slack configuration"
            
        except Exception as e:
            return False, str(e)
            
    def validate_recipient(self, recipient: str) -> bool:
        """Validate Slack channel/user"""
        return recipient.startswith(('#', '@', 'webhook')) or recipient == 'webhook'


class NotificationManager:
    """
    Manages notifications across multiple channels with:
    - Role-based routing
    - Escalation procedures
    - Rate limiting
    - Delivery tracking
    - Template management
    """
    
    def __init__(self,
                 db_path: str = "/var/log/rover/notifications.db",
                 max_workers: int = 10):
        """
        Initialize notification manager
        
        Args:
            db_path: Path to notification database
            max_workers: Maximum concurrent notification workers
        """
        self.db_path = db_path
        self.max_workers = max_workers
        
        # Initialize database
        self._init_database()
        
        # Channels
        self.channels: Dict[str, NotificationChannel] = {}
        
        # Templates
        self.templates: Dict[str, str] = {}
        self._load_templates()
        
        # Rules
        self.rules: List[NotificationRule] = []
        self._load_rules()
        
        # Rate limiting
        self.rate_limiter = defaultdict(lambda: {'count': 0, 'reset_time': None})
        
        # Notification queue
        self.notification_queue = asyncio.Queue()
        
        # Start workers
        self.workers = []
        self.running = True
        
        # Start async event loop in thread
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run_event_loop, daemon=True)
        self.thread.start()
        
    def _run_event_loop(self):
        """Run async event loop in thread"""
        asyncio.set_event_loop(self.loop)
        self.loop.run_until_complete(self._start_workers())
        
    async def _start_workers(self):
        """Start notification workers"""
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._notification_worker())
            self.workers.append(worker)
            
        # Wait for shutdown
        while self.running:
            await asyncio.sleep(1)
            
    def _init_database(self):
        """Initialize notification database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Rules table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Templates table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                channel TEXT NOT NULL,
                template TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Notification log
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_log (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                rule_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                recipient TEXT NOT NULL,
                sent_at TEXT NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                retry_count INTEGER DEFAULT 0,
                data TEXT
            )
        """)
        
        # Indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notification_log_event 
            ON notification_log(event_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notification_log_sent 
            ON notification_log(sent_at)
        """)
        
        conn.commit()
        conn.close()
        
    def _load_templates(self):
        """Load notification templates"""
        # Default templates
        self.templates['email_default'] = """
        <html>
        <body>
            <h2>{{ event.title }}</h2>
            <p><strong>Severity:</strong> {{ event.severity }}</p>
            <p><strong>Time:</strong> {{ event.timestamp }}</p>
            <p><strong>Description:</strong> {{ event.description }}</p>
            {% if event.data %}
            <h3>Details:</h3>
            <pre>{{ event.data | tojson(indent=2) }}</pre>
            {% endif %}
        </body>
        </html>
        """
        
        self.templates['sms_default'] = """
        [{{ event.severity }}] {{ event.title }} - {{ event.description[:100] }}
        """
        
        self.templates['webhook_default'] = """
        {
            "event_id": "{{ event.id }}",
            "timestamp": "{{ event.timestamp }}",
            "event_type": "{{ event.event_type }}",
            "severity": "{{ event.severity }}",
            "title": "{{ event.title }}",
            "description": "{{ event.description }}",
            "data": {{ event.data | tojson }}
        }
        """
        
        self.templates['slack_default'] = """
        {
            "text": "{{ event.title }}",
            "attachments": [{
                "color": "{% if event.severity == 'critical' %}danger{% elif event.severity == 'high' %}warning{% else %}good{% endif %}",
                "fields": [
                    {"title": "Severity", "value": "{{ event.severity }}", "short": true},
                    {"title": "Type", "value": "{{ event.event_type }}", "short": true},
                    {"title": "Time", "value": "{{ event.timestamp }}", "short": false},
                    {"title": "Description", "value": "{{ event.description }}", "short": false}
                ]
            }]
        }
        """
        
        # Load custom templates from database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, template FROM notification_templates")
        for row in cursor.fetchall():
            self.templates[row[0]] = row[1]
        conn.close()
        
    def _load_rules(self):
        """Load notification rules from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, config FROM notification_rules")
        
        for row in cursor.fetchall():
            try:
                config = json.loads(row[1])
                rule = NotificationRule(**config)
                self.rules.append(rule)
            except Exception as e:
                logging.error(f"Failed to load rule {row[0]}: {e}")
                
        conn.close()
        
    def add_channel(self, name: str, channel: NotificationChannel):
        """Add notification channel"""
        self.channels[name] = channel
        
    def add_rule(self, rule: NotificationRule):
        """Add notification rule"""
        self.rules.append(rule)
        
        # Save to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO notification_rules (id, name, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            rule.id,
            rule.name,
            json.dumps(asdict(rule)),
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
        conn.close()
        
    async def notify(self, event: NotificationEvent):
        """
        Process notification event
        
        Args:
            event: Notification event
        """
        # Add to queue
        await self.notification_queue.put(event)
        
    async def _notification_worker(self):
        """Worker to process notifications"""
        while self.running:
            try:
                # Get event from queue
                event = await asyncio.wait_for(
                    self.notification_queue.get(),
                    timeout=1.0
                )
                
                # Find matching rules
                matching_rules = self._find_matching_rules(event)
                
                # Process each rule
                for rule in matching_rules:
                    await self._process_rule(event, rule)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logging.error(f"Notification worker error: {e}")
                
    def _find_matching_rules(self, event: NotificationEvent) -> List[NotificationRule]:
        """Find rules that match the event"""
        matching = []
        
        for rule in self.rules:
            if not rule.is_active:
                continue
                
            # Check event type
            if rule.event_types and event.event_type not in rule.event_types:
                continue
                
            # Check severity
            if rule.severity_levels and event.severity not in rule.severity_levels:
                continue
                
            # Check custom conditions
            if rule.conditions:
                if not self._evaluate_conditions(event, rule.conditions):
                    continue
                    
            matching.append(rule)
            
        return matching
        
    def _evaluate_conditions(self, event: NotificationEvent, 
                           conditions: Dict[str, Any]) -> bool:
        """Evaluate custom rule conditions"""
        # Simple condition evaluation
        # Could be extended with more complex logic
        for field, expected in conditions.items():
            if field in event.data:
                if event.data[field] != expected:
                    return False
        return True
        
    async def _process_rule(self, event: NotificationEvent, rule: NotificationRule):
        """Process notification rule"""
        # Check rate limiting
        if not self._check_rate_limit(rule.id):
            return
            
        # Send to each channel
        for channel_name in rule.channels:
            if channel_name not in self.channels:
                continue
                
            channel = self.channels[channel_name]
            recipients = rule.recipients.get(channel_name, [])
            
            for recipient in recipients:
                # Get template
                template_key = f"{channel_name}_{rule.template_id}"
                if template_key not in self.templates:
                    template_key = f"{channel_name}_default"
                    
                template = self.templates.get(template_key, "")
                
                # Send notification
                await self._send_notification(
                    event, rule, channel_name, channel, 
                    recipient, template
                )
                
    def _check_rate_limit(self, rule_id: str) -> bool:
        """Check rate limiting for rule"""
        now = datetime.now(timezone.utc)
        limiter = self.rate_limiter[rule_id]
        
        # Reset if needed
        if limiter['reset_time'] is None or now >= limiter['reset_time']:
            limiter['count'] = 0
            limiter['reset_time'] = now + timedelta(hours=1)
            
        # Check limit
        rule = next((r for r in self.rules if r.id == rule_id), None)
        if rule and limiter['count'] >= rule.max_notifications_per_hour:
            return False
            
        limiter['count'] += 1
        return True
        
    async def _send_notification(self, event: NotificationEvent, 
                               rule: NotificationRule,
                               channel_name: str,
                               channel: NotificationChannel,
                               recipient: str,
                               template: str):
        """Send individual notification"""
        # Create record
        record = NotificationRecord(
            id=f"{event.id}_{rule.id}_{channel_name}_{recipient}",
            event_id=event.id,
            rule_id=rule.id,
            channel=channel_name,
            recipient=recipient,
            sent_at=datetime.now(timezone.utc).isoformat(),
            status='pending'
        )
        
        # Validate recipient
        if not channel.validate_recipient(recipient):
            record.status = 'failed'
            record.error = 'Invalid recipient format'
            self._save_notification_record(record)
            return
            
        # Send notification
        try:
            success, error = await channel.send(recipient, event, template)
            
            if success:
                record.status = 'sent'
            else:
                record.status = 'failed'
                record.error = error
                
        except Exception as e:
            record.status = 'failed'
            record.error = str(e)
            
        # Save record
        self._save_notification_record(record)
        
        # Handle escalation if needed
        if record.status == 'failed' and rule.escalation_channels:
            await self._schedule_escalation(event, rule, record)
            
    def _save_notification_record(self, record: NotificationRecord):
        """Save notification record to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO notification_log 
            (id, event_id, rule_id, channel, recipient, sent_at, status, error, retry_count, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.id,
            record.event_id,
            record.rule_id,
            record.channel,
            record.recipient,
            record.sent_at,
            record.status,
            record.error,
            record.retry_count,
            json.dumps(asdict(record))
        ))
        
        conn.commit()
        conn.close()
        
    async def _schedule_escalation(self, event: NotificationEvent,
                                 rule: NotificationRule,
                                 failed_record: NotificationRecord):
        """Schedule escalation notification"""
        # Wait for escalation delay
        await asyncio.sleep(rule.escalation_delay_minutes * 60)
        
        # Create escalated rule
        escalated_rule = NotificationRule(
            id=f"{rule.id}_escalation",
            name=f"{rule.name} (Escalation)",
            event_types=rule.event_types,
            severity_levels=['critical'],  # Escalate to critical
            channels=rule.escalation_channels,
            recipients=rule.recipients,
            template_id=rule.template_id,
            cooldown_minutes=0,  # No cooldown for escalation
            max_notifications_per_hour=999,  # No rate limit
            is_active=True
        )
        
        # Process escalation
        await self._process_rule(event, escalated_rule)
        
    def get_notification_history(self,
                               start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None,
                               event_id: Optional[str] = None,
                               channel: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get notification history"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT * FROM notification_log WHERE 1=1"
        params = []
        
        if start_time:
            query += " AND sent_at >= ?"
            params.append(start_time.isoformat())
            
        if end_time:
            query += " AND sent_at <= ?"
            params.append(end_time.isoformat())
            
        if event_id:
            query += " AND event_id = ?"
            params.append(event_id)
            
        if channel:
            query += " AND channel = ?"
            params.append(channel)
            
        query += " ORDER BY sent_at DESC"
        
        cursor.execute(query, params)
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'id': row[0],
                'event_id': row[1],
                'rule_id': row[2],
                'channel': row[3],
                'recipient': row[4],
                'sent_at': row[5],
                'status': row[6],
                'error': row[7],
                'retry_count': row[8]
            })
            
        conn.close()
        return results
        
    def shutdown(self):
        """Shutdown notification manager"""
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=5)