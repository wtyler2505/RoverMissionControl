"""
API routes for communication logging and analysis
"""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import json
import asyncio
from enum import Enum

from .base import ProtocolType, DataDirection
from .communication_logger import (
    LogLevel, LogFilter, CommunicationLogEntry,
    get_logger
)
from .protocol_analyzers import ProtocolAnalyzerFactory
from .logging_integration import LoggingHardwareManager


router = APIRouter(prefix="/api/hardware/logs", tags=["communication_logs"])


# Pydantic models for API
class LogLevelEnum(str, Enum):
    trace = "trace"
    debug = "debug"
    info = "info"
    warning = "warning"
    error = "error"


class LogFilterRequest(BaseModel):
    adapter_ids: Optional[List[str]] = None
    protocol_types: Optional[List[str]] = None
    directions: Optional[List[str]] = None
    levels: Optional[List[LogLevelEnum]] = None
    device_ids: Optional[List[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    search_text: Optional[str] = None
    has_error: Optional[bool] = None
    min_duration_ms: Optional[float] = None
    max_duration_ms: Optional[float] = None
    limit: int = Field(default=100, le=1000)


class LogEntryResponse(BaseModel):
    timestamp: datetime
    adapter_id: str
    protocol_type: str
    direction: str
    level: str
    message: Optional[str]
    device_id: Optional[str]
    data_hex: Optional[str]
    data_size: Optional[int]
    data_ascii: Optional[str]
    metadata: Dict[str, Any]
    error: Optional[str]
    sequence_number: Optional[int]
    correlation_id: Optional[str]
    duration_ms: Optional[float]

    class Config:
        orm_mode = True


class LoggingConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    default_level: Optional[LogLevelEnum] = None
    adapter_levels: Optional[Dict[str, LogLevelEnum]] = None
    enable_analysis: Optional[bool] = None


class LogStatisticsResponse(BaseModel):
    enabled: bool
    default_level: str
    sequence_counter: int
    stream_handlers: int
    custom_filters: int
    level_overrides: Dict[str, str]
    storage: Dict[str, Any]


class AnalysisRequest(BaseModel):
    adapter_id: str
    protocol_type: str
    data_hex: str
    direction: str = "bidirectional"
    metadata: Optional[Dict[str, Any]] = None


class AnalysisResponse(BaseModel):
    protocol_type: str
    summary: str
    details: Dict[str, Any]
    warnings: List[str]
    errors: List[str]
    timestamp: datetime


# Dependency to get hardware manager
def get_hardware_manager() -> LoggingHardwareManager:
    """Get the hardware manager instance"""
    from fastapi import Depends
    from ..main import app
    return app.state.hardware_manager


@router.get("/search", response_model=List[LogEntryResponse])
async def search_logs(request: LogFilterRequest = None):
    """Search communication logs with filters"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    # Convert request to LogFilter
    filter = LogFilter()
    if request:
        filter.adapter_ids = request.adapter_ids
        filter.protocol_types = [ProtocolType(pt) for pt in request.protocol_types] if request.protocol_types else None
        filter.directions = [DataDirection(d) for d in request.directions] if request.directions else None
        filter.levels = [LogLevel(l) for l in request.levels] if request.levels else None
        filter.device_ids = request.device_ids
        filter.start_time = request.start_time
        filter.end_time = request.end_time
        filter.search_text = request.search_text
        filter.has_error = request.has_error
        filter.min_duration_ms = request.min_duration_ms
        filter.max_duration_ms = request.max_duration_ms
    
    # Search logs
    entries = await logger.search(filter, request.limit if request else 100)
    
    # Convert to response format
    return [
        LogEntryResponse(
            timestamp=entry.timestamp,
            adapter_id=entry.adapter_id,
            protocol_type=entry.protocol_type.value,
            direction=entry.direction.value,
            level=entry.level.value,
            message=entry.message,
            device_id=entry.device_id,
            data_hex=entry.data_hex,
            data_size=len(entry.data) if entry.data else None,
            data_ascii=entry.data_ascii,
            metadata=entry.metadata,
            error=entry.error,
            sequence_number=entry.sequence_number,
            correlation_id=entry.correlation_id,
            duration_ms=entry.duration_ms
        )
        for entry in entries
    ]


@router.get("/stream")
async def stream_logs(
    adapter_id: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    level: Optional[LogLevelEnum] = Query(None),
    format: str = Query("json", regex="^(json|text)$")
):
    """Stream real-time communication logs"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    # Create filter
    filter = LogFilter(
        adapter_ids=[adapter_id] if adapter_id else None,
        device_ids=[device_id] if device_id else None,
        levels=[LogLevel(level)] if level else None
    )
    
    async def generate():
        """Generate log stream"""
        queue = asyncio.Queue()
        
        def handler(entry: CommunicationLogEntry):
            if filter.matches(entry):
                try:
                    queue.put_nowait(entry)
                except asyncio.QueueFull:
                    pass
        
        logger.add_stream_handler(handler)
        
        try:
            while True:
                try:
                    entry = await asyncio.wait_for(queue.get(), timeout=30.0)
                    
                    if format == "json":
                        yield json.dumps(entry.to_dict()) + "\n"
                    else:
                        yield entry.to_text() + "\n"
                    
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield "\n"
                    
        finally:
            logger.remove_stream_handler(handler)
    
    return StreamingResponse(
        generate(),
        media_type="text/plain" if format == "text" else "application/x-ndjson"
    )


@router.websocket("/ws")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint for real-time log streaming"""
    await websocket.accept()
    
    logger = get_logger()
    if not logger:
        await websocket.close(code=1011, reason="Logging system not initialized")
        return
    
    queue = asyncio.Queue(maxsize=100)
    
    def handler(entry: CommunicationLogEntry):
        try:
            queue.put_nowait(entry)
        except asyncio.QueueFull:
            # Drop oldest entry
            try:
                queue.get_nowait()
                queue.put_nowait(entry)
            except:
                pass
    
    logger.add_stream_handler(handler)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        while True:
            try:
                # Wait for log entry or client message
                done, pending = await asyncio.wait(
                    [
                        asyncio.create_task(queue.get()),
                        asyncio.create_task(websocket.receive_text())
                    ],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                for task in pending:
                    task.cancel()
                
                for task in done:
                    result = task.result()
                    
                    if isinstance(result, CommunicationLogEntry):
                        # Send log entry
                        await websocket.send_json({
                            "type": "log",
                            "entry": result.to_dict()
                        })
                    elif isinstance(result, str):
                        # Handle client message
                        try:
                            msg = json.loads(result)
                            if msg.get("type") == "ping":
                                await websocket.send_json({
                                    "type": "pong",
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                        except:
                            pass
                            
            except asyncio.TimeoutError:
                # Send keepalive
                await websocket.send_json({
                    "type": "keepalive",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
    except WebSocketDisconnect:
        pass
    finally:
        logger.remove_stream_handler(handler)


@router.get("/statistics", response_model=LogStatisticsResponse)
async def get_statistics():
    """Get logging system statistics"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    stats = await logger.get_statistics()
    return LogStatisticsResponse(**stats)


@router.post("/config")
async def update_logging_config(config: LoggingConfigRequest):
    """Update logging configuration"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    hardware_manager = get_hardware_manager()
    
    if config.enabled is not None:
        logger.enabled = config.enabled
    
    if config.default_level is not None:
        logger.set_level(LogLevel(config.default_level))
        hardware_manager.set_logging_level(LogLevel(config.default_level))
    
    if config.adapter_levels:
        for adapter_id, level in config.adapter_levels.items():
            logger.set_level(LogLevel(level), adapter_id)
            hardware_manager.set_logging_level(LogLevel(level), adapter_id)
    
    if config.enable_analysis is not None:
        hardware_manager.enable_analysis(config.enable_analysis)
    
    return {"status": "Configuration updated"}


@router.delete("/clear")
async def clear_logs(
    before: Optional[datetime] = Query(None, description="Clear logs before this timestamp")
):
    """Clear communication logs"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    count = await logger.clear_logs(before)
    return {"cleared": count}


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_packet(request: AnalysisRequest):
    """Analyze a packet without logging"""
    try:
        # Create analyzer
        analyzer = ProtocolAnalyzerFactory.create_analyzer(
            ProtocolType(request.protocol_type)
        )
        
        # Create packet from request
        from .base import DataPacket
        packet = DataPacket(
            data=bytes.fromhex(request.data_hex),
            direction=DataDirection(request.direction),
            metadata=request.metadata or {}
        )
        
        # Analyze
        result = analyzer.analyze_packet(packet)
        
        return AnalysisResponse(
            protocol_type=result.protocol_type.value,
            summary=result.summary,
            details=result.details,
            warnings=result.warnings,
            errors=result.errors,
            timestamp=result.timestamp
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/export")
async def export_logs(
    format: str = Query("json", regex="^(json|csv|text)$"),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    adapter_id: Optional[str] = Query(None)
):
    """Export logs in various formats"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    # Create filter
    filter = LogFilter(
        adapter_ids=[adapter_id] if adapter_id else None,
        start_time=start_time,
        end_time=end_time
    )
    
    # Get logs
    entries = await logger.search(filter, limit=10000)
    
    if format == "json":
        # JSON export
        data = json.dumps([entry.to_dict() for entry in entries], indent=2)
        return StreamingResponse(
            iter([data]),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=comm_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
    
    elif format == "csv":
        # CSV export
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "timestamp", "adapter_id", "protocol_type", "direction", 
            "level", "message", "device_id", "data_hex", "data_size",
            "error", "duration_ms"
        ])
        
        # Data
        for entry in entries:
            writer.writerow([
                entry.timestamp.isoformat(),
                entry.adapter_id,
                entry.protocol_type.value,
                entry.direction.value,
                entry.level.value,
                entry.message or "",
                entry.device_id or "",
                entry.data_hex or "",
                len(entry.data) if entry.data else 0,
                entry.error or "",
                entry.duration_ms or ""
            ])
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=comm_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    else:
        # Text export
        lines = [entry.to_text() for entry in entries]
        data = "\n".join(lines)
        
        return StreamingResponse(
            iter([data]),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename=comm_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.txt"
            }
        )


@router.get("/summary")
async def get_communication_summary(
    hours: int = Query(1, ge=1, le=24, description="Number of hours to summarize")
):
    """Get communication summary for the last N hours"""
    logger = get_logger()
    if not logger:
        raise HTTPException(status_code=503, detail="Logging system not initialized")
    
    hardware_manager = get_hardware_manager()
    
    # Get logs from last N hours
    start_time = datetime.utcnow() - timedelta(hours=hours)
    filter = LogFilter(start_time=start_time)
    entries = await logger.search(filter, limit=10000)
    
    # Calculate summary statistics
    summary = {
        "time_range": {
            "start": start_time.isoformat(),
            "end": datetime.utcnow().isoformat(),
            "hours": hours
        },
        "total_entries": len(entries),
        "by_protocol": {},
        "by_adapter": {},
        "by_level": {},
        "errors": [],
        "top_devices": {},
        "data_volume": {
            "total_bytes": 0,
            "tx_bytes": 0,
            "rx_bytes": 0
        }
    }
    
    # Process entries
    for entry in entries:
        # By protocol
        protocol = entry.protocol_type.value
        if protocol not in summary["by_protocol"]:
            summary["by_protocol"][protocol] = 0
        summary["by_protocol"][protocol] += 1
        
        # By adapter
        if entry.adapter_id not in summary["by_adapter"]:
            summary["by_adapter"][entry.adapter_id] = 0
        summary["by_adapter"][entry.adapter_id] += 1
        
        # By level
        level = entry.level.value
        if level not in summary["by_level"]:
            summary["by_level"][level] = 0
        summary["by_level"][level] += 1
        
        # Errors
        if entry.error:
            summary["errors"].append({
                "timestamp": entry.timestamp.isoformat(),
                "adapter_id": entry.adapter_id,
                "error": entry.error
            })
        
        # Device statistics
        if entry.device_id:
            if entry.device_id not in summary["top_devices"]:
                summary["top_devices"][entry.device_id] = 0
            summary["top_devices"][entry.device_id] += 1
        
        # Data volume
        if entry.data:
            data_size = len(entry.data)
            summary["data_volume"]["total_bytes"] += data_size
            if entry.direction == DataDirection.TX:
                summary["data_volume"]["tx_bytes"] += data_size
            elif entry.direction == DataDirection.RX:
                summary["data_volume"]["rx_bytes"] += data_size
    
    # Sort top devices
    summary["top_devices"] = dict(
        sorted(summary["top_devices"].items(), key=lambda x: x[1], reverse=True)[:10]
    )
    
    # Limit errors to last 10
    summary["errors"] = summary["errors"][-10:]
    
    # Add current system status
    summary["current_status"] = hardware_manager.get_system_status()
    
    return summary
