"""
SIEM (Security Information and Event Management) integration
"""
import os
import json
import socket
import ssl
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone
import aiohttp
from dataclasses import dataclass, asdict
import xml.etree.ElementTree as ET
import struct
import logging


@dataclass 
class SIEMEvent:
    """Standard SIEM event format"""
    timestamp: str
    source_ip: str
    source_hostname: str
    event_id: str
    event_type: str
    severity: int  # 0-10 scale
    facility: str
    message: str
    raw_event: Dict[str, Any]
    tags: List[str] = None


class SIEMConnector:
    """Base class for SIEM connectors"""
    
    async def send_event(self, event: SIEMEvent) -> bool:
        """Send event to SIEM"""
        raise NotImplementedError
        
    async def send_batch(self, events: List[SIEMEvent]) -> int:
        """Send batch of events"""
        success_count = 0
        for event in events:
            if await self.send_event(event):
                success_count += 1
        return success_count
        
    def format_event(self, event: SIEMEvent) -> str:
        """Format event for SIEM"""
        raise NotImplementedError


class SyslogConnector(SIEMConnector):
    """RFC 5424 Syslog connector"""
    
    def __init__(self, host: str, port: int = 514, 
                 transport: str = 'udp', use_tls: bool = False):
        self.host = host
        self.port = port
        self.transport = transport
        self.use_tls = use_tls
        self.hostname = socket.gethostname()
        
        # Facility and severity mappings
        self.facilities = {
            'kern': 0, 'user': 1, 'mail': 2, 'daemon': 3,
            'auth': 4, 'syslog': 5, 'lpr': 6, 'news': 7,
            'uucp': 8, 'cron': 9, 'authpriv': 10, 'ftp': 11,
            'local0': 16, 'local1': 17, 'local2': 18, 'local3': 19,
            'local4': 20, 'local5': 21, 'local6': 22, 'local7': 23
        }
        
        self.severities = {
            0: 7,  # Emergency -> Debug (inverted)
            1: 6,  # Alert -> Info
            2: 5,  # Critical -> Notice
            3: 4,  # Error -> Warning
            4: 3,  # Warning -> Error
            5: 2,  # Notice -> Critical
            6: 1,  # Info -> Alert
            7: 0,  # Debug -> Emergency
            8: 0,
            9: 0,
            10: 0
        }
        
    def format_event(self, event: SIEMEvent) -> str:
        """Format event as RFC 5424 syslog message"""
        # Calculate priority
        facility = self.facilities.get(event.facility, 16)  # Default to local0
        severity = self.severities.get(event.severity, 6)
        priority = facility * 8 + severity
        
        # Format timestamp
        timestamp = event.timestamp
        
        # Build structured data
        structured_data = self._build_structured_data(event)
        
        # Build message
        message = (
            f"<{priority}>1 {timestamp} {event.source_hostname} "
            f"RoverMissionControl {event.event_id} {structured_data} "
            f"{event.message}"
        )
        
        return message
        
    def _build_structured_data(self, event: SIEMEvent) -> str:
        """Build RFC 5424 structured data"""
        sd_elements = []
        
        # Event metadata
        sd_elements.append(
            f'[rover@32473 eventType="{event.event_type}" '
            f'severity="{event.severity}"]'
        )
        
        # Tags if present
        if event.tags:
            tags_str = ','.join(event.tags)
            sd_elements.append(f'[tags@32473 list="{tags_str}"]')
            
        # Custom fields from raw event
        custom_fields = []
        for key, value in event.raw_event.items():
            if key not in ['timestamp', 'message', 'severity']:
                # Escape special characters
                value_str = str(value).replace('"', '\\"').replace(']', '\\]')
                custom_fields.append(f'{key}="{value_str}"')
                
        if custom_fields:
            sd_elements.append(f'[custom@32473 {" ".join(custom_fields[:5])}]')
            
        return ''.join(sd_elements) if sd_elements else '-'
        
    async def send_event(self, event: SIEMEvent) -> bool:
        """Send syslog event"""
        message = self.format_event(event)
        
        try:
            if self.transport == 'udp':
                await self._send_udp(message)
            elif self.transport == 'tcp':
                await self._send_tcp(message)
            else:
                raise ValueError(f"Unsupported transport: {self.transport}")
            return True
        except Exception as e:
            logging.error(f"Failed to send syslog: {e}")
            return False
            
    async def _send_udp(self, message: str):
        """Send via UDP"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.sendto(message.encode('utf-8'), (self.host, self.port))
        finally:
            sock.close()
            
    async def _send_tcp(self, message: str):
        """Send via TCP with optional TLS"""
        reader, writer = await asyncio.open_connection(self.host, self.port)
        
        try:
            if self.use_tls:
                # Upgrade to TLS
                ssl_context = ssl.create_default_context()
                await asyncio.get_event_loop().start_tls(
                    reader.transport,
                    writer.transport,
                    ssl_context
                )
                
            # Send message with length prefix for TCP
            msg_bytes = message.encode('utf-8')
            writer.write(struct.pack('>I', len(msg_bytes)) + msg_bytes)
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()


class SplunkConnector(SIEMConnector):
    """Splunk HTTP Event Collector (HEC) connector"""
    
    def __init__(self, hec_url: str, hec_token: str, 
                 index: Optional[str] = None,
                 source_type: str = "rover_security",
                 verify_ssl: bool = True):
        self.hec_url = hec_url
        self.hec_token = hec_token
        self.index = index
        self.source_type = source_type
        self.verify_ssl = verify_ssl
        
    def format_event(self, event: SIEMEvent) -> Dict[str, Any]:
        """Format event for Splunk HEC"""
        splunk_event = {
            "time": datetime.fromisoformat(
                event.timestamp.replace('Z', '+00:00')
            ).timestamp(),
            "source": "rover_mission_control",
            "sourcetype": self.source_type,
            "event": {
                "message": event.message,
                "event_id": event.event_id,
                "event_type": event.event_type,
                "severity": event.severity,
                "source_ip": event.source_ip,
                "source_hostname": event.source_hostname,
                **event.raw_event
            }
        }
        
        if self.index:
            splunk_event["index"] = self.index
            
        if event.tags:
            splunk_event["event"]["tags"] = event.tags
            
        return splunk_event
        
    async def send_event(self, event: SIEMEvent) -> bool:
        """Send event to Splunk HEC"""
        headers = {
            "Authorization": f"Splunk {self.hec_token}",
            "Content-Type": "application/json"
        }
        
        data = self.format_event(event)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.hec_url,
                    headers=headers,
                    json=data,
                    ssl=self.verify_ssl
                ) as response:
                    return response.status == 200
        except Exception as e:
            logging.error(f"Failed to send to Splunk: {e}")
            return False
            
    async def send_batch(self, events: List[SIEMEvent]) -> int:
        """Send batch to Splunk (more efficient)"""
        headers = {
            "Authorization": f"Splunk {self.hec_token}",
            "Content-Type": "application/json"
        }
        
        # Format events as newline-delimited JSON
        batch_data = '\n'.join([
            json.dumps(self.format_event(event))
            for event in events
        ])
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.hec_url,
                    headers=headers,
                    data=batch_data,
                    ssl=self.verify_ssl
                ) as response:
                    if response.status == 200:
                        return len(events)
                    else:
                        return 0
        except Exception as e:
            logging.error(f"Failed to send batch to Splunk: {e}")
            return 0


class ElasticConnector(SIEMConnector):
    """Elasticsearch/ELK Stack connector"""
    
    def __init__(self, elasticsearch_url: str,
                 api_key: Optional[str] = None,
                 username: Optional[str] = None,
                 password: Optional[str] = None,
                 index_pattern: str = "rover-security-{date}",
                 verify_ssl: bool = True):
        self.elasticsearch_url = elasticsearch_url
        self.api_key = api_key
        self.username = username
        self.password = password
        self.index_pattern = index_pattern
        self.verify_ssl = verify_ssl
        
    def format_event(self, event: SIEMEvent) -> Dict[str, Any]:
        """Format event for Elasticsearch"""
        return {
            "@timestamp": event.timestamp,
            "event": {
                "id": event.event_id,
                "type": event.event_type,
                "severity": event.severity,
                "module": "rover_security"
            },
            "host": {
                "ip": event.source_ip,
                "hostname": event.source_hostname
            },
            "message": event.message,
            "tags": event.tags or [],
            "rover": event.raw_event
        }
        
    def _get_index_name(self) -> str:
        """Get index name with date substitution"""
        date_str = datetime.now(timezone.utc).strftime("%Y.%m.%d")
        return self.index_pattern.replace("{date}", date_str)
        
    async def send_event(self, event: SIEMEvent) -> bool:
        """Send event to Elasticsearch"""
        headers = {"Content-Type": "application/json"}
        
        # Authentication
        if self.api_key:
            headers["Authorization"] = f"ApiKey {self.api_key}"
        elif self.username and self.password:
            import base64
            auth = base64.b64encode(
                f"{self.username}:{self.password}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {auth}"
            
        # Build URL
        index = self._get_index_name()
        url = f"{self.elasticsearch_url}/{index}/_doc"
        
        # Send event
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers=headers,
                    json=self.format_event(event),
                    ssl=self.verify_ssl
                ) as response:
                    return response.status in [200, 201]
        except Exception as e:
            logging.error(f"Failed to send to Elasticsearch: {e}")
            return False
            
    async def send_batch(self, events: List[SIEMEvent]) -> int:
        """Send batch using bulk API"""
        headers = {"Content-Type": "application/x-ndjson"}
        
        # Authentication
        if self.api_key:
            headers["Authorization"] = f"ApiKey {self.api_key}"
        elif self.username and self.password:
            import base64
            auth = base64.b64encode(
                f"{self.username}:{self.password}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {auth}"
            
        # Build bulk request
        index = self._get_index_name()
        bulk_data = []
        
        for event in events:
            # Action
            bulk_data.append(json.dumps({
                "index": {"_index": index}
            }))
            # Document
            bulk_data.append(json.dumps(self.format_event(event)))
            
        bulk_body = '\n'.join(bulk_data) + '\n'
        
        # Send bulk request
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.elasticsearch_url}/_bulk",
                    headers=headers,
                    data=bulk_body,
                    ssl=self.verify_ssl
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        # Count successful indexing
                        success_count = sum(
                            1 for item in result.get('items', [])
                            if item.get('index', {}).get('status') in [200, 201]
                        )
                        return success_count
                    return 0
        except Exception as e:
            logging.error(f"Failed to send bulk to Elasticsearch: {e}")
            return 0


class ArcSightConnector(SIEMConnector):
    """HP ArcSight CEF (Common Event Format) connector"""
    
    def __init__(self, host: str, port: int = 514,
                 transport: str = 'udp'):
        self.host = host
        self.port = port
        self.transport = transport
        self.device_vendor = "RoverMissionControl"
        self.device_product = "SecurityMonitor"
        self.device_version = "1.0"
        
    def format_event(self, event: SIEMEvent) -> str:
        """Format event as CEF"""
        # CEF header
        cef_header = (
            f"CEF:0|{self.device_vendor}|{self.device_product}|"
            f"{self.device_version}|{event.event_type}|"
            f"{event.message}|{event.severity}|"
        )
        
        # CEF extensions
        extensions = {
            'rt': event.timestamp,
            'src': event.source_ip,
            'shost': event.source_hostname,
            'eventId': event.event_id,
            'cat': ','.join(event.tags) if event.tags else 'Security'
        }
        
        # Add custom fields
        for key, value in event.raw_event.items():
            # CEF field mapping
            if key == 'user':
                extensions['suser'] = value
            elif key == 'destination_ip':
                extensions['dst'] = value
            elif key == 'destination_port':
                extensions['dpt'] = value
            else:
                # Custom field
                extensions[f'cs1Label'] = key
                extensions[f'cs1'] = str(value)
                
        # Build extension string
        ext_str = ' '.join([
            f"{k}={v}" for k, v in extensions.items()
        ])
        
        return f"{cef_header}{ext_str}"
        
    async def send_event(self, event: SIEMEvent) -> bool:
        """Send CEF event"""
        message = self.format_event(event)
        
        # Wrap in syslog format
        priority = 134  # local0.info
        timestamp = datetime.now().strftime('%b %d %H:%M:%S')
        hostname = socket.gethostname()
        
        syslog_message = f"<{priority}>{timestamp} {hostname} {message}"
        
        try:
            if self.transport == 'udp':
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.sendto(syslog_message.encode('utf-8'), (self.host, self.port))
                sock.close()
            else:
                reader, writer = await asyncio.open_connection(self.host, self.port)
                writer.write(syslog_message.encode('utf-8'))
                await writer.drain()
                writer.close()
                await writer.wait_closed()
            return True
        except Exception as e:
            logging.error(f"Failed to send CEF: {e}")
            return False


class SIEMIntegration:
    """
    Central SIEM integration manager supporting multiple SIEM platforms
    """
    
    def __init__(self):
        self.connectors: Dict[str, SIEMConnector] = {}
        self.event_queue = asyncio.Queue(maxsize=10000)
        self.running = False
        self.workers = []
        
    def add_connector(self, name: str, connector: SIEMConnector):
        """Add SIEM connector"""
        self.connectors[name] = connector
        
    def remove_connector(self, name: str):
        """Remove SIEM connector"""
        if name in self.connectors:
            del self.connectors[name]
            
    async def send_event(self, 
                        event_data: Dict[str, Any],
                        severity: int = 6,
                        tags: Optional[List[str]] = None):
        """Send event to all configured SIEMs"""
        # Create SIEM event
        event = SIEMEvent(
            timestamp=event_data.get('timestamp', 
                                   datetime.now(timezone.utc).isoformat()),
            source_ip=event_data.get('source_ip', '127.0.0.1'),
            source_hostname=event_data.get('source_hostname', 
                                         socket.gethostname()),
            event_id=event_data.get('event_id', 'UNKNOWN'),
            event_type=event_data.get('event_type', 'security'),
            severity=severity,
            facility=event_data.get('facility', 'auth'),
            message=event_data.get('message', 'Security event'),
            raw_event=event_data,
            tags=tags
        )
        
        # Queue event
        await self.event_queue.put(event)
        
    async def start(self, num_workers: int = 3):
        """Start SIEM integration workers"""
        self.running = True
        
        for i in range(num_workers):
            worker = asyncio.create_task(self._event_worker())
            self.workers.append(worker)
            
    async def stop(self):
        """Stop SIEM integration"""
        self.running = False
        
        # Wait for workers
        await asyncio.gather(*self.workers, return_exceptions=True)
        
    async def _event_worker(self):
        """Worker to process events"""
        batch = []
        batch_timeout = 5.0  # seconds
        last_flush = asyncio.get_event_loop().time()
        
        while self.running:
            try:
                # Get event with timeout
                event = await asyncio.wait_for(
                    self.event_queue.get(),
                    timeout=1.0
                )
                batch.append(event)
                
                # Check if we should flush
                current_time = asyncio.get_event_loop().time()
                if (len(batch) >= 100 or 
                    current_time - last_flush > batch_timeout):
                    await self._flush_batch(batch)
                    batch = []
                    last_flush = current_time
                    
            except asyncio.TimeoutError:
                # Flush any pending events
                if batch:
                    await self._flush_batch(batch)
                    batch = []
                    last_flush = asyncio.get_event_loop().time()
                    
            except Exception as e:
                logging.error(f"SIEM worker error: {e}")
                
    async def _flush_batch(self, events: List[SIEMEvent]):
        """Send batch of events to all connectors"""
        tasks = []
        
        for name, connector in self.connectors.items():
            # Some connectors support batch, others don't
            if hasattr(connector, 'send_batch'):
                task = connector.send_batch(events)
            else:
                # Send individually
                task = self._send_individual(connector, events)
                
            tasks.append(task)
            
        # Wait for all to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log results
        for i, (name, result) in enumerate(zip(self.connectors.keys(), results)):
            if isinstance(result, Exception):
                logging.error(f"SIEM {name} error: {result}")
            else:
                logging.debug(f"SIEM {name} sent {result} events")
                
    async def _send_individual(self, connector: SIEMConnector, 
                              events: List[SIEMEvent]) -> int:
        """Send events individually"""
        success_count = 0
        
        for event in events:
            try:
                if await connector.send_event(event):
                    success_count += 1
            except Exception as e:
                logging.error(f"Failed to send event: {e}")
                
        return success_count
        
    def get_status(self) -> Dict[str, Any]:
        """Get SIEM integration status"""
        return {
            'connectors': list(self.connectors.keys()),
            'queue_size': self.event_queue.qsize(),
            'running': self.running,
            'workers': len(self.workers)
        }