"""
Communication Logging System for Hardware Abstraction Layer
Provides protocol-agnostic logging, analysis, and visualization capabilities
"""

import asyncio
import json
import logging
import struct
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Callable, Tuple
from dataclasses import dataclass, field, asdict
import aiofiles
from collections import deque, defaultdict
import gzip
import sqlite3
from contextlib import asynccontextmanager

from .base import (
    ProtocolType, DataDirection, DataPacket, 
    ProtocolAdapter, ConnectionState
)


logger = logging.getLogger(__name__)


class LogLevel(Enum):
    """Communication log levels"""
    TRACE = "trace"      # All data including raw bytes
    DEBUG = "debug"      # Detailed protocol information
    INFO = "info"        # Important events and summaries
    WARNING = "warning"  # Anomalies and warnings
    ERROR = "error"      # Errors and failures
    
    def __lt__(self, other):
        if not isinstance(other, LogLevel):
            return NotImplemented
        levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR]
        return levels.index(self) < levels.index(other)


class LogFormat(Enum):
    """Log output formats"""
    JSON = "json"
    TEXT = "text"
    BINARY = "binary"
    CSV = "csv"


@dataclass
class CommunicationLogEntry:
    """Single log entry for communication events"""
    timestamp: datetime
    adapter_id: str
    protocol_type: ProtocolType
    direction: DataDirection
    level: LogLevel
    data: Optional[bytes] = None
    data_hex: Optional[str] = None
    data_ascii: Optional[str] = None
    message: Optional[str] = None
    device_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    sequence_number: Optional[int] = None
    correlation_id: Optional[str] = None
    duration_ms: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        result = {
            'timestamp': self.timestamp.isoformat(),
            'adapter_id': self.adapter_id,
            'protocol_type': self.protocol_type.value,
            'direction': self.direction.value,
            'level': self.level.value,
            'message': self.message,
            'device_id': self.device_id,
            'metadata': self.metadata,
            'error': self.error,
            'sequence_number': self.sequence_number,
            'correlation_id': self.correlation_id,
            'duration_ms': self.duration_ms
        }
        
        if self.data:
            result['data_hex'] = self.data.hex()
            result['data_size'] = len(self.data)
            # Try to decode as ASCII if possible
            try:
                result['data_ascii'] = self.data.decode('ascii', errors='ignore')
            except:
                pass
        
        return result
    
    def to_text(self) -> str:
        """Convert to human-readable text format"""
        parts = [
            f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}]",
            f"[{self.level.value.upper()}]",
            f"[{self.adapter_id}]",
            f"[{self.protocol_type.value}]",
            f"[{self.direction.value}]"
        ]
        
        if self.device_id:
            parts.append(f"[Device: {self.device_id}]")
        
        if self.message:
            parts.append(self.message)
        
        if self.data and self.level == LogLevel.TRACE:
            parts.append(f"Data: {self.data.hex()}")
            if self.data_ascii:
                parts.append(f"ASCII: {self.data_ascii}")
        
        if self.error:
            parts.append(f"ERROR: {self.error}")
        
        if self.duration_ms is not None:
            parts.append(f"Duration: {self.duration_ms:.2f}ms")
        
        return " ".join(parts)


@dataclass
class LogFilter:
    """Filter criteria for log entries"""
    adapter_ids: Optional[List[str]] = None
    protocol_types: Optional[List[ProtocolType]] = None
    directions: Optional[List[DataDirection]] = None
    levels: Optional[List[LogLevel]] = None
    device_ids: Optional[List[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    search_text: Optional[str] = None
    has_error: Optional[bool] = None
    min_duration_ms: Optional[float] = None
    max_duration_ms: Optional[float] = None
    
    def matches(self, entry: CommunicationLogEntry) -> bool:
        """Check if log entry matches filter criteria"""
        if self.adapter_ids and entry.adapter_id not in self.adapter_ids:
            return False
        
        if self.protocol_types and entry.protocol_type not in self.protocol_types:
            return False
        
        if self.directions and entry.direction not in self.directions:
            return False
        
        if self.levels and entry.level not in self.levels:
            return False
        
        if self.device_ids and entry.device_id not in self.device_ids:
            return False
        
        if self.start_time and entry.timestamp < self.start_time:
            return False
        
        if self.end_time and entry.timestamp > self.end_time:
            return False
        
        if self.search_text:
            search_lower = self.search_text.lower()
            if not any([
                search_lower in (entry.message or "").lower(),
                search_lower in (entry.error or "").lower(),
                search_lower in (entry.data_hex or "").lower(),
                search_lower in (entry.data_ascii or "").lower()
            ]):
                return False
        
        if self.has_error is not None:
            if self.has_error and not entry.error:
                return False
            if not self.has_error and entry.error:
                return False
        
        if self.min_duration_ms is not None and entry.duration_ms is not None:
            if entry.duration_ms < self.min_duration_ms:
                return False
        
        if self.max_duration_ms is not None and entry.duration_ms is not None:
            if entry.duration_ms > self.max_duration_ms:
                return False
        
        return True


class LogStorage(ABC):
    """Abstract base class for log storage backends"""
    
    @abstractmethod
    async def write(self, entry: CommunicationLogEntry) -> None:
        """Write a log entry"""
        pass
    
    @abstractmethod
    async def read(self, filter: LogFilter, limit: Optional[int] = None) -> List[CommunicationLogEntry]:
        """Read log entries matching filter"""
        pass
    
    @abstractmethod
    async def clear(self, before: Optional[datetime] = None) -> int:
        """Clear logs, optionally before a certain date. Returns number of entries cleared."""
        pass
    
    @abstractmethod
    async def get_statistics(self) -> Dict[str, Any]:
        """Get storage statistics"""
        pass


class MemoryLogStorage(LogStorage):
    """In-memory log storage with size limits"""
    
    def __init__(self, max_entries: int = 10000):
        self.max_entries = max_entries
        self.entries: deque[CommunicationLogEntry] = deque(maxlen=max_entries)
        self._lock = asyncio.Lock()
    
    async def write(self, entry: CommunicationLogEntry) -> None:
        async with self._lock:
            self.entries.append(entry)
    
    async def read(self, filter: LogFilter, limit: Optional[int] = None) -> List[CommunicationLogEntry]:
        async with self._lock:
            filtered = [e for e in self.entries if filter.matches(e)]
            if limit:
                filtered = filtered[-limit:]
            return filtered
    
    async def clear(self, before: Optional[datetime] = None) -> int:
        async with self._lock:
            if before:
                original_len = len(self.entries)
                self.entries = deque(
                    (e for e in self.entries if e.timestamp >= before),
                    maxlen=self.max_entries
                )
                return original_len - len(self.entries)
            else:
                count = len(self.entries)
                self.entries.clear()
                return count
    
    async def get_statistics(self) -> Dict[str, Any]:
        async with self._lock:
            return {
                'type': 'memory',
                'entries': len(self.entries),
                'max_entries': self.max_entries,
                'memory_usage_estimate': len(self.entries) * 1024  # Rough estimate
            }


class FileLogStorage(LogStorage):
    """File-based log storage with rotation and compression"""
    
    def __init__(self, 
                 log_dir: Union[str, Path],
                 max_file_size: int = 100 * 1024 * 1024,  # 100MB
                 max_files: int = 10,
                 compress_old: bool = True,
                 format: LogFormat = LogFormat.JSON):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.max_file_size = max_file_size
        self.max_files = max_files
        self.compress_old = compress_old
        self.format = format
        self._current_file: Optional[Path] = None
        self._current_size = 0
        self._lock = asyncio.Lock()
    
    def _get_log_filename(self) -> Path:
        """Generate log filename with timestamp"""
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        extension = '.json' if self.format == LogFormat.JSON else '.log'
        return self.log_dir / f"comm_log_{timestamp}{extension}"
    
    async def _rotate_if_needed(self) -> None:
        """Rotate log file if it exceeds size limit"""
        if self._current_file and self._current_size >= self.max_file_size:
            # Compress old file if enabled
            if self.compress_old:
                compressed_path = self._current_file.with_suffix('.gz')
                async with aiofiles.open(self._current_file, 'rb') as f_in:
                    content = await f_in.read()
                async with aiofiles.open(compressed_path, 'wb') as f_out:
                    await f_out.write(gzip.compress(content))
                self._current_file.unlink()
            
            self._current_file = None
            self._current_size = 0
            
            # Clean up old files
            await self._cleanup_old_files()
    
    async def _cleanup_old_files(self) -> None:
        """Remove old log files beyond max_files limit"""
        log_files = sorted(
            [f for f in self.log_dir.glob('comm_log_*') if f.is_file()],
            key=lambda f: f.stat().st_mtime
        )
        
        while len(log_files) > self.max_files:
            oldest = log_files.pop(0)
            oldest.unlink()
    
    async def write(self, entry: CommunicationLogEntry) -> None:
        async with self._lock:
            await self._rotate_if_needed()
            
            if not self._current_file:
                self._current_file = self._get_log_filename()
            
            # Format entry based on selected format
            if self.format == LogFormat.JSON:
                line = json.dumps(entry.to_dict()) + '\n'
            else:
                line = entry.to_text() + '\n'
            
            async with aiofiles.open(self._current_file, 'a', encoding='utf-8') as f:
                await f.write(line)
                self._current_size += len(line.encode('utf-8'))
    
    async def read(self, filter: LogFilter, limit: Optional[int] = None) -> List[CommunicationLogEntry]:
        entries = []
        
        # Read from all log files
        log_files = sorted(
            [f for f in self.log_dir.glob('comm_log_*') if f.is_file()],
            key=lambda f: f.stat().st_mtime,
            reverse=True
        )
        
        for log_file in log_files:
            if limit and len(entries) >= limit:
                break
            
            try:
                if log_file.suffix == '.gz':
                    async with aiofiles.open(log_file, 'rb') as f:
                        content = gzip.decompress(await f.read()).decode('utf-8')
                else:
                    async with aiofiles.open(log_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                
                for line in content.strip().split('\n'):
                    if not line:
                        continue
                    
                    if self.format == LogFormat.JSON:
                        data = json.loads(line)
                        entry = self._dict_to_entry(data)
                    else:
                        # For text format, we'd need a parser
                        continue
                    
                    if filter.matches(entry):
                        entries.append(entry)
                        if limit and len(entries) >= limit:
                            break
            
            except Exception as e:
                logger.error(f"Error reading log file {log_file}: {e}")
        
        return entries
    
    def _dict_to_entry(self, data: Dict[str, Any]) -> CommunicationLogEntry:
        """Convert dictionary to log entry"""
        return CommunicationLogEntry(
            timestamp=datetime.fromisoformat(data['timestamp']),
            adapter_id=data['adapter_id'],
            protocol_type=ProtocolType(data['protocol_type']),
            direction=DataDirection(data['direction']),
            level=LogLevel(data['level']),
            data=bytes.fromhex(data.get('data_hex', '')) if data.get('data_hex') else None,
            message=data.get('message'),
            device_id=data.get('device_id'),
            metadata=data.get('metadata', {}),
            error=data.get('error'),
            sequence_number=data.get('sequence_number'),
            correlation_id=data.get('correlation_id'),
            duration_ms=data.get('duration_ms')
        )
    
    async def clear(self, before: Optional[datetime] = None) -> int:
        count = 0
        async with self._lock:
            log_files = list(self.log_dir.glob('comm_log_*'))
            
            for log_file in log_files:
                if before:
                    # Check file modification time
                    mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                    if mtime < before:
                        log_file.unlink()
                        count += 1
                else:
                    log_file.unlink()
                    count += 1
            
            if count > 0:
                self._current_file = None
                self._current_size = 0
        
        return count
    
    async def get_statistics(self) -> Dict[str, Any]:
        log_files = list(self.log_dir.glob('comm_log_*'))
        total_size = sum(f.stat().st_size for f in log_files)
        
        return {
            'type': 'file',
            'log_dir': str(self.log_dir),
            'files': len(log_files),
            'total_size': total_size,
            'max_file_size': self.max_file_size,
            'max_files': self.max_files,
            'compress_old': self.compress_old,
            'format': self.format.value
        }


class CommunicationLogger:
    """Main communication logging system"""
    
    def __init__(self,
                 storage: LogStorage,
                 default_level: LogLevel = LogLevel.INFO,
                 enabled: bool = True):
        self.storage = storage
        self.default_level = default_level
        self.enabled = enabled
        self._sequence_counter = 0
        self._correlation_map: Dict[str, str] = {}
        self._stream_handlers: List[Callable[[CommunicationLogEntry], None]] = []
        self._level_overrides: Dict[str, LogLevel] = {}
        self._filters: List[Callable[[CommunicationLogEntry], bool]] = []
        self._lock = asyncio.Lock()
    
    def set_level(self, level: LogLevel, adapter_id: Optional[str] = None) -> None:
        """Set logging level globally or for specific adapter"""
        if adapter_id:
            self._level_overrides[adapter_id] = level
        else:
            self.default_level = level
    
    def get_level(self, adapter_id: str) -> LogLevel:
        """Get effective logging level for an adapter"""
        return self._level_overrides.get(adapter_id, self.default_level)
    
    def add_filter(self, filter_func: Callable[[CommunicationLogEntry], bool]) -> None:
        """Add a custom filter function"""
        self._filters.append(filter_func)
    
    def remove_filter(self, filter_func: Callable[[CommunicationLogEntry], bool]) -> None:
        """Remove a custom filter function"""
        if filter_func in self._filters:
            self._filters.remove(filter_func)
    
    def add_stream_handler(self, handler: Callable[[CommunicationLogEntry], None]) -> None:
        """Add a real-time stream handler"""
        self._stream_handlers.append(handler)
    
    def remove_stream_handler(self, handler: Callable[[CommunicationLogEntry], None]) -> None:
        """Remove a stream handler"""
        if handler in self._stream_handlers:
            self._stream_handlers.remove(handler)
    
    async def log(self,
                  adapter_id: str,
                  protocol_type: ProtocolType,
                  direction: DataDirection,
                  level: LogLevel,
                  message: Optional[str] = None,
                  data: Optional[bytes] = None,
                  device_id: Optional[str] = None,
                  metadata: Optional[Dict[str, Any]] = None,
                  error: Optional[str] = None,
                  correlation_id: Optional[str] = None,
                  duration_ms: Optional[float] = None) -> None:
        """Log a communication event"""
        
        if not self.enabled:
            return
        
        # Check if we should log based on level
        effective_level = self.get_level(adapter_id)
        if level < effective_level:
            return
        
        async with self._lock:
            self._sequence_counter += 1
            sequence_number = self._sequence_counter
        
        # Create log entry
        entry = CommunicationLogEntry(
            timestamp=datetime.utcnow(),
            adapter_id=adapter_id,
            protocol_type=protocol_type,
            direction=direction,
            level=level,
            data=data,
            data_hex=data.hex() if data else None,
            data_ascii=self._safe_ascii_decode(data) if data else None,
            message=message,
            device_id=device_id,
            metadata=metadata or {},
            error=error,
            sequence_number=sequence_number,
            correlation_id=correlation_id,
            duration_ms=duration_ms
        )
        
        # Apply custom filters
        for filter_func in self._filters:
            if not filter_func(entry):
                return
        
        # Write to storage
        await self.storage.write(entry)
        
        # Notify stream handlers
        for handler in self._stream_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(entry)
                else:
                    handler(entry)
            except Exception as e:
                logger.error(f"Error in stream handler: {e}")
    
    def _safe_ascii_decode(self, data: bytes) -> Optional[str]:
        """Safely decode bytes to ASCII for display"""
        try:
            # Replace non-printable characters
            result = ''
            for byte in data:
                if 32 <= byte <= 126:
                    result += chr(byte)
                else:
                    result += '.'
            return result
        except:
            return None
    
    async def log_packet(self,
                        adapter_id: str,
                        protocol_type: ProtocolType,
                        packet: DataPacket,
                        level: LogLevel = LogLevel.TRACE,
                        device_id: Optional[str] = None,
                        error: Optional[str] = None) -> None:
        """Log a data packet"""
        await self.log(
            adapter_id=adapter_id,
            protocol_type=protocol_type,
            direction=packet.direction,
            level=level,
            data=packet.data,
            device_id=device_id,
            metadata=packet.metadata,
            error=error
        )
    
    async def log_error(self,
                       adapter_id: str,
                       protocol_type: ProtocolType,
                       error: str,
                       data: Optional[bytes] = None,
                       device_id: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log an error event"""
        await self.log(
            adapter_id=adapter_id,
            protocol_type=protocol_type,
            direction=DataDirection.BIDIRECTIONAL,
            level=LogLevel.ERROR,
            message=f"Communication error: {error}",
            data=data,
            device_id=device_id,
            metadata=metadata,
            error=error
        )
    
    async def log_connection_event(self,
                                  adapter_id: str,
                                  protocol_type: ProtocolType,
                                  event: str,
                                  state: ConnectionState,
                                  metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log connection state changes"""
        await self.log(
            adapter_id=adapter_id,
            protocol_type=protocol_type,
            direction=DataDirection.BIDIRECTIONAL,
            level=LogLevel.INFO,
            message=f"Connection {event}: {state.value}",
            metadata=metadata
        )
    
    @asynccontextmanager
    async def timed_operation(self,
                             adapter_id: str,
                             protocol_type: ProtocolType,
                             operation: str,
                             correlation_id: Optional[str] = None):
        """Context manager for timing operations"""
        start_time = datetime.utcnow()
        
        try:
            yield correlation_id
        finally:
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            await self.log(
                adapter_id=adapter_id,
                protocol_type=protocol_type,
                direction=DataDirection.BIDIRECTIONAL,
                level=LogLevel.DEBUG,
                message=f"{operation} completed",
                correlation_id=correlation_id,
                duration_ms=duration_ms
            )
    
    async def search(self, filter: LogFilter, limit: Optional[int] = None) -> List[CommunicationLogEntry]:
        """Search logs with filter"""
        return await self.storage.read(filter, limit)
    
    async def clear_logs(self, before: Optional[datetime] = None) -> int:
        """Clear logs from storage"""
        return await self.storage.clear(before)
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get logging statistics"""
        storage_stats = await self.storage.get_statistics()
        
        return {
            'enabled': self.enabled,
            'default_level': self.default_level.value,
            'sequence_counter': self._sequence_counter,
            'stream_handlers': len(self._stream_handlers),
            'custom_filters': len(self._filters),
            'level_overrides': {k: v.value for k, v in self._level_overrides.items()},
            'storage': storage_stats
        }


# Global logger instance
communication_logger: Optional[CommunicationLogger] = None


def initialize_logger(storage: LogStorage,
                     default_level: LogLevel = LogLevel.INFO,
                     enabled: bool = True) -> CommunicationLogger:
    """Initialize the global communication logger"""
    global communication_logger
    communication_logger = CommunicationLogger(storage, default_level, enabled)
    return communication_logger


def get_logger() -> Optional[CommunicationLogger]:
    """Get the global communication logger instance"""
    return communication_logger
