"""
Command persistence layer for reliable command storage and recovery
"""

import json
import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import asyncio
import aiosqlite

from .command_base import Command, CommandStatus, CommandPriority


logger = logging.getLogger(__name__)


@dataclass
class PersistenceConfig:
    """Configuration for command persistence"""
    db_path: str = "data/command_queue.db"
    auto_vacuum: bool = True
    journal_mode: str = "WAL"  # Write-Ahead Logging for better concurrency
    retention_days: int = 7  # How long to keep completed commands
    batch_size: int = 100  # Batch size for bulk operations
    checkpoint_interval: int = 1000  # WAL checkpoint interval


class CommandPersistence:
    """
    SQLite-based persistence layer for commands
    Provides durability and recovery capabilities
    """
    
    def __init__(self, config: Optional[PersistenceConfig] = None):
        self.config = config or PersistenceConfig()
        self._db_path = Path(self.config.db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False
        self._write_lock = asyncio.Lock()
        self._checkpoint_counter = 0
    
    async def initialize(self):
        """Initialize the persistence layer and create tables"""
        async with aiosqlite.connect(str(self._db_path)) as db:
            # Set database parameters
            await db.execute(f"PRAGMA journal_mode = {self.config.journal_mode}")
            if self.config.auto_vacuum:
                await db.execute("PRAGMA auto_vacuum = FULL")
            
            # Create commands table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS commands (
                    id TEXT PRIMARY KEY,
                    command_type TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    parameters TEXT,
                    metadata TEXT,
                    timeout_ms INTEGER,
                    max_retries INTEGER,
                    retry_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP NOT NULL,
                    queued_at TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    result TEXT,
                    INDEX idx_status (status),
                    INDEX idx_priority (priority),
                    INDEX idx_created_at (created_at)
                )
            """)
            
            # Create command history table for analytics
            await db.execute("""
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    command_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    details TEXT,
                    INDEX idx_command_id (command_id),
                    INDEX idx_timestamp (timestamp)
                )
            """)
            
            # Create metrics table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS command_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_type TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    command_type TEXT,
                    priority INTEGER,
                    timestamp TIMESTAMP NOT NULL,
                    INDEX idx_metric_type (metric_type),
                    INDEX idx_timestamp (timestamp)
                )
            """)
            
            await db.commit()
            
        self._initialized = True
        logger.info(f"Command persistence initialized at {self._db_path}")
    
    async def save_command(self, command: Command) -> bool:
        """Save a single command to the database"""
        try:
            async with self._write_lock:
                async with aiosqlite.connect(str(self._db_path)) as db:
                    await db.execute("""
                        INSERT OR REPLACE INTO commands (
                            id, command_type, priority, status, parameters, metadata,
                            timeout_ms, max_retries, retry_count, created_at, queued_at,
                            started_at, completed_at, result
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        command.id,
                        command.command_type.value,
                        command.priority.value,
                        command.status.value,
                        json.dumps(command.parameters),
                        json.dumps({
                            "source": command.metadata.source,
                            "session_id": command.metadata.session_id,
                            "user_id": command.metadata.user_id,
                            "correlation_id": command.metadata.correlation_id,
                            "tags": command.metadata.tags,
                            "custom_data": command.metadata.custom_data
                        }),
                        command.timeout_ms,
                        command.max_retries,
                        command.retry_count,
                        command.created_at.isoformat(),
                        command.queued_at.isoformat() if command.queued_at else None,
                        command.started_at.isoformat() if command.started_at else None,
                        command.completed_at.isoformat() if command.completed_at else None,
                        command.result.to_json() if command.result else None
                    ))
                    
                    # Log status change
                    await self._log_command_history(db, command.id, command.status.value)
                    
                    await db.commit()
                    
                    # Check if we need to checkpoint
                    self._checkpoint_counter += 1
                    if self._checkpoint_counter >= self.config.checkpoint_interval:
                        await db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                        self._checkpoint_counter = 0
                    
                    return True
                    
        except Exception as e:
            logger.error(f"Error saving command {command.id}: {e}")
            return False
    
    async def save_commands_batch(self, commands: List[Command]) -> int:
        """Save multiple commands in a batch operation"""
        saved_count = 0
        
        try:
            async with self._write_lock:
                async with aiosqlite.connect(str(self._db_path)) as db:
                    # Prepare batch data
                    batch_data = []
                    history_data = []
                    
                    for command in commands:
                        batch_data.append((
                            command.id,
                            command.command_type.value,
                            command.priority.value,
                            command.status.value,
                            json.dumps(command.parameters),
                            json.dumps({
                                "source": command.metadata.source,
                                "session_id": command.metadata.session_id,
                                "user_id": command.metadata.user_id,
                                "correlation_id": command.metadata.correlation_id,
                                "tags": command.metadata.tags,
                                "custom_data": command.metadata.custom_data
                            }),
                            command.timeout_ms,
                            command.max_retries,
                            command.retry_count,
                            command.created_at.isoformat(),
                            command.queued_at.isoformat() if command.queued_at else None,
                            command.started_at.isoformat() if command.started_at else None,
                            command.completed_at.isoformat() if command.completed_at else None,
                            command.result.to_json() if command.result else None
                        ))
                        
                        history_data.append((
                            command.id,
                            command.status.value,
                            datetime.utcnow().isoformat(),
                            None
                        ))
                    
                    # Batch insert
                    await db.executemany("""
                        INSERT OR REPLACE INTO commands (
                            id, command_type, priority, status, parameters, metadata,
                            timeout_ms, max_retries, retry_count, created_at, queued_at,
                            started_at, completed_at, result
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, batch_data)
                    
                    # Batch history insert
                    await db.executemany("""
                        INSERT INTO command_history (command_id, status, timestamp, details)
                        VALUES (?, ?, ?, ?)
                    """, history_data)
                    
                    await db.commit()
                    saved_count = len(commands)
                    
                    # Checkpoint if needed
                    self._checkpoint_counter += saved_count
                    if self._checkpoint_counter >= self.config.checkpoint_interval:
                        await db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                        self._checkpoint_counter = 0
                    
        except Exception as e:
            logger.error(f"Error in batch save: {e}")
        
        return saved_count
    
    async def load_pending_commands(self) -> List[Dict[str, Any]]:
        """Load all pending/queued commands from the database"""
        commands = []
        
        try:
            async with aiosqlite.connect(str(self._db_path)) as db:
                cursor = await db.execute("""
                    SELECT * FROM commands
                    WHERE status IN (?, ?, ?)
                    ORDER BY priority DESC, created_at ASC
                """, (
                    CommandStatus.PENDING.value,
                    CommandStatus.QUEUED.value,
                    CommandStatus.RETRYING.value
                ))
                
                async for row in cursor:
                    commands.append(self._row_to_dict(row))
                    
        except Exception as e:
            logger.error(f"Error loading pending commands: {e}")
        
        return commands
    
    async def update_command_status(
        self,
        command_id: str,
        status: CommandStatus,
        result: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update command status in the database"""
        try:
            async with self._write_lock:
                async with aiosqlite.connect(str(self._db_path)) as db:
                    now = datetime.utcnow().isoformat()
                    
                    # Update status and appropriate timestamp
                    if status == CommandStatus.QUEUED:
                        await db.execute("""
                            UPDATE commands 
                            SET status = ?, queued_at = ?
                            WHERE id = ?
                        """, (status.value, now, command_id))
                    elif status == CommandStatus.EXECUTING:
                        await db.execute("""
                            UPDATE commands 
                            SET status = ?, started_at = ?
                            WHERE id = ?
                        """, (status.value, now, command_id))
                    elif status in [CommandStatus.COMPLETED, CommandStatus.FAILED, CommandStatus.CANCELLED]:
                        await db.execute("""
                            UPDATE commands 
                            SET status = ?, completed_at = ?, result = ?
                            WHERE id = ?
                        """, (status.value, now, json.dumps(result) if result else None, command_id))
                    else:
                        await db.execute("""
                            UPDATE commands 
                            SET status = ?
                            WHERE id = ?
                        """, (status.value, command_id))
                    
                    # Log status change
                    await self._log_command_history(
                        db, command_id, status.value,
                        json.dumps(result) if result else None
                    )
                    
                    await db.commit()
                    return True
                    
        except Exception as e:
            logger.error(f"Error updating command status: {e}")
            return False
    
    async def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        """Get a single command by ID"""
        try:
            async with aiosqlite.connect(str(self._db_path)) as db:
                cursor = await db.execute(
                    "SELECT * FROM commands WHERE id = ?",
                    (command_id,)
                )
                row = await cursor.fetchone()
                
                if row:
                    return self._row_to_dict(row)
                    
        except Exception as e:
            logger.error(f"Error getting command {command_id}: {e}")
        
        return None
    
    async def delete_command(self, command_id: str) -> bool:
        """Delete a command from the database"""
        try:
            async with self._write_lock:
                async with aiosqlite.connect(str(self._db_path)) as db:
                    await db.execute("DELETE FROM commands WHERE id = ?", (command_id,))
                    await db.commit()
                    return True
                    
        except Exception as e:
            logger.error(f"Error deleting command {command_id}: {e}")
            return False
    
    async def cleanup_old_commands(self) -> int:
        """Clean up old completed commands based on retention policy"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.config.retention_days)
            
            async with self._write_lock:
                async with aiosqlite.connect(str(self._db_path)) as db:
                    # Delete old completed commands
                    cursor = await db.execute("""
                        DELETE FROM commands
                        WHERE status IN (?, ?, ?)
                        AND completed_at < ?
                    """, (
                        CommandStatus.COMPLETED.value,
                        CommandStatus.FAILED.value,
                        CommandStatus.CANCELLED.value,
                        cutoff_date.isoformat()
                    ))
                    
                    deleted_count = cursor.rowcount
                    
                    # Also clean up old history
                    await db.execute("""
                        DELETE FROM command_history
                        WHERE timestamp < ?
                    """, (cutoff_date.isoformat(),))
                    
                    # Clean up old metrics
                    await db.execute("""
                        DELETE FROM command_metrics
                        WHERE timestamp < ?
                    """, (cutoff_date.isoformat(),))
                    
                    await db.commit()
                    
                    # Vacuum if auto-vacuum is disabled
                    if not self.config.auto_vacuum and deleted_count > 0:
                        await db.execute("VACUUM")
                    
                    return deleted_count
                    
        except Exception as e:
            logger.error(f"Error cleaning up old commands: {e}")
            return 0
    
    async def save_metric(
        self,
        metric_type: str,
        metric_value: float,
        command_type: Optional[str] = None,
        priority: Optional[CommandPriority] = None
    ):
        """Save a performance metric"""
        try:
            async with aiosqlite.connect(str(self._db_path)) as db:
                await db.execute("""
                    INSERT INTO command_metrics (metric_type, metric_value, command_type, priority, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    metric_type,
                    metric_value,
                    command_type,
                    priority.value if priority else None,
                    datetime.utcnow().isoformat()
                ))
                await db.commit()
                
        except Exception as e:
            logger.error(f"Error saving metric: {e}")
    
    async def get_metrics(
        self,
        metric_type: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get metrics within a time range"""
        metrics = []
        
        try:
            if not start_time:
                start_time = datetime.utcnow() - timedelta(hours=1)
            if not end_time:
                end_time = datetime.utcnow()
            
            async with aiosqlite.connect(str(self._db_path)) as db:
                cursor = await db.execute("""
                    SELECT metric_type, metric_value, command_type, priority, timestamp
                    FROM command_metrics
                    WHERE metric_type = ?
                    AND timestamp BETWEEN ? AND ?
                    ORDER BY timestamp DESC
                """, (metric_type, start_time.isoformat(), end_time.isoformat()))
                
                async for row in cursor:
                    metrics.append({
                        "metric_type": row[0],
                        "metric_value": row[1],
                        "command_type": row[2],
                        "priority": row[3],
                        "timestamp": row[4]
                    })
                    
        except Exception as e:
            logger.error(f"Error getting metrics: {e}")
        
        return metrics
    
    async def _log_command_history(
        self,
        db: aiosqlite.Connection,
        command_id: str,
        status: str,
        details: Optional[str] = None
    ):
        """Log command status change to history"""
        await db.execute("""
            INSERT INTO command_history (command_id, status, timestamp, details)
            VALUES (?, ?, ?, ?)
        """, (command_id, status, datetime.utcnow().isoformat(), details))
    
    def _row_to_dict(self, row) -> Dict[str, Any]:
        """Convert database row to dictionary"""
        return {
            "id": row[0],
            "command_type": row[1],
            "priority": row[2],
            "status": row[3],
            "parameters": json.loads(row[4]) if row[4] else {},
            "metadata": json.loads(row[5]) if row[5] else {},
            "timeout_ms": row[6],
            "max_retries": row[7],
            "retry_count": row[8],
            "created_at": row[9],
            "queued_at": row[10],
            "started_at": row[11],
            "completed_at": row[12],
            "result": json.loads(row[13]) if row[13] else None
        }