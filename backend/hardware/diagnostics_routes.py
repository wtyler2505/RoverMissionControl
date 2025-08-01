"""
API routes for hardware diagnostics and capability reporting
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging

from .diagnostics import (
    DiagnosticManager, DiagnosticLevel, DiagnosticReport,
    DeviceCapabilities, CommunicationMetrics, HealthStatus
)
from .manager import HardwareManager
from .base import ProtocolType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hardware/diagnostics", tags=["hardware-diagnostics"])

# Global diagnostics manager
diagnostics_manager = DiagnosticManager()

# Store for diagnostic reports
diagnostic_reports: Dict[str, DiagnosticReport] = {}


@router.get("/health/{device_id}")
async def get_device_health(device_id: str) -> Dict[str, Any]:
    """Get quick health status for a specific device"""
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    adapter = manager._adapters[device_id]
    stats = adapter.get_statistics()
    
    # Quick health check
    is_connected = adapter.is_connected
    error_rate = 0.0
    
    if stats.get('bytes_sent', 0) + stats.get('bytes_received', 0) > 0:
        total_ops = (stats['bytes_sent'] + stats['bytes_received']) / 100
        error_rate = (stats.get('error_count', 0) / total_ops * 100) if total_ops > 0 else 0
    
    # Determine health status
    if not is_connected:
        health_status = HealthStatus.CRITICAL
    elif error_rate > 5.0:
        health_status = HealthStatus.WARNING
    else:
        health_status = HealthStatus.HEALTHY
    
    return {
        "device_id": device_id,
        "health_status": health_status.value,
        "is_connected": is_connected,
        "error_rate": error_rate,
        "last_activity": stats.get('last_activity'),
        "uptime_seconds": (datetime.utcnow() - adapter.status.connected_at).total_seconds() if adapter.status.connected_at else 0,
        "quick_stats": {
            "bytes_sent": stats.get('bytes_sent', 0),
            "bytes_received": stats.get('bytes_received', 0),
            "error_count": stats.get('error_count', 0)
        }
    }


@router.get("/health")
async def get_all_device_health() -> List[Dict[str, Any]]:
    """Get health status for all connected devices"""
    manager = HardwareManager()
    health_reports = []
    
    for device_id, adapter in manager._adapters.items():
        try:
            health = await get_device_health(device_id)
            health_reports.append(health)
        except Exception as e:
            logger.error(f"Error getting health for {device_id}: {e}")
            health_reports.append({
                "device_id": device_id,
                "health_status": HealthStatus.UNKNOWN.value,
                "error": str(e)
            })
    
    return health_reports


@router.post("/run/{device_id}")
async def run_diagnostics(
    device_id: str,
    background_tasks: BackgroundTasks,
    level: DiagnosticLevel = Query(DiagnosticLevel.STANDARD),
    test_ids: Optional[List[str]] = Query(None)
) -> Dict[str, Any]:
    """
    Run diagnostics on a specific device
    
    Returns immediately with a diagnostic session ID.
    Use the session ID to check progress and retrieve results.
    """
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    # Generate session ID
    session_id = f"diag_{device_id}_{datetime.utcnow().timestamp()}"
    
    # Start diagnostics in background
    background_tasks.add_task(
        _run_diagnostics_background,
        session_id,
        device_id,
        manager._adapters[device_id],
        level,
        test_ids
    )
    
    return {
        "session_id": session_id,
        "device_id": device_id,
        "level": level.value,
        "status": "started",
        "message": "Diagnostics started in background"
    }


async def _run_diagnostics_background(
    session_id: str,
    device_id: str,
    adapter,
    level: DiagnosticLevel,
    test_ids: Optional[List[str]]
):
    """Background task to run diagnostics"""
    try:
        # Progress tracking
        progress_data = {
            "status": "running",
            "progress": 0.0,
            "current_test": ""
        }
        
        def progress_callback(message: str, percentage: float):
            progress_data["current_test"] = message
            progress_data["progress"] = percentage
        
        # Store progress data
        diagnostic_reports[f"{session_id}_progress"] = progress_data
        
        # Run diagnostics
        report = await diagnostics_manager.run_diagnostics(
            adapter,
            level=level,
            test_ids=test_ids,
            progress_callback=progress_callback
        )
        
        # Store report
        diagnostic_reports[session_id] = report
        progress_data["status"] = "completed"
        progress_data["progress"] = 100.0
        
    except Exception as e:
        logger.error(f"Diagnostic error for {device_id}: {e}")
        progress_data["status"] = "error"
        progress_data["error"] = str(e)


@router.get("/status/{session_id}")
async def get_diagnostic_status(session_id: str) -> Dict[str, Any]:
    """Get the status of a diagnostic session"""
    progress_key = f"{session_id}_progress"
    
    if progress_key not in diagnostic_reports:
        raise HTTPException(status_code=404, detail="Diagnostic session not found")
    
    return diagnostic_reports[progress_key]


@router.get("/report/{session_id}")
async def get_diagnostic_report(session_id: str) -> Dict[str, Any]:
    """Get the full diagnostic report for a completed session"""
    if session_id not in diagnostic_reports:
        # Check if still in progress
        progress_key = f"{session_id}_progress"
        if progress_key in diagnostic_reports:
            return {
                "status": diagnostic_reports[progress_key]["status"],
                "message": "Diagnostics still in progress"
            }
        raise HTTPException(status_code=404, detail="Diagnostic report not found")
    
    report = diagnostic_reports[session_id]
    
    # Convert report to dict for JSON response
    return {
        "device_id": report.device_id,
        "device_name": report.device_name,
        "protocol_type": report.protocol_type.value,
        "health_status": report.health_status.value,
        "health_score": report.health_score,
        "test_results": [
            {
                "test_id": r.test_id,
                "test_name": r.test_name,
                "status": r.status.value,
                "duration": r.duration,
                "message": r.message,
                "details": r.details,
                "error": r.error
            }
            for r in report.test_results
        ],
        "metrics": {
            "latency_avg": report.metrics.latency_avg,
            "latency_min": report.metrics.latency_min,
            "latency_max": report.metrics.latency_max,
            "throughput_tx": report.metrics.throughput_tx,
            "throughput_rx": report.metrics.throughput_rx,
            "error_rate": report.metrics.error_rate,
            "uptime_seconds": report.metrics.uptime.total_seconds()
        } if report.metrics else None,
        "tests_passed": report.tests_passed,
        "tests_failed": report.tests_failed,
        "tests_warning": report.tests_warning,
        "recommendations": report.recommendations,
        "duration": report.duration,
        "timestamp": report.timestamp.isoformat()
    }


@router.get("/capabilities/{device_id}")
async def get_device_capabilities(device_id: str) -> Dict[str, Any]:
    """Get device capabilities"""
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    adapter = manager._adapters[device_id]
    
    # Get capabilities from diagnostics
    caps = await diagnostics_manager._get_capabilities(adapter)
    
    return {
        "device_id": caps.device_id,
        "device_name": caps.device_name,
        "protocol_type": caps.protocol_type.value,
        "firmware_version": caps.firmware_version,
        "hardware_version": caps.hardware_version,
        "max_baud_rate": caps.max_baud_rate,
        "supported_protocols": caps.supported_protocols,
        "buffer_size": caps.buffer_size,
        "capabilities": [
            {
                "capability_id": c.capability_id,
                "name": c.name,
                "category": c.category,
                "supported": c.supported,
                "version": c.version,
                "parameters": c.parameters,
                "limitations": c.limitations
            }
            for c in caps.capabilities
        ],
        "max_throughput": caps.max_throughput,
        "max_packet_size": caps.max_packet_size,
        "min_response_time": caps.min_response_time,
        "metadata": caps.metadata
    }


@router.get("/metrics/{device_id}")
async def get_communication_metrics(
    device_id: str,
    duration_seconds: int = Query(60, description="Duration for metric collection")
) -> Dict[str, Any]:
    """Get real-time communication metrics for a device"""
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    adapter = manager._adapters[device_id]
    
    # Collect metrics over specified duration
    start_time = datetime.utcnow()
    initial_stats = adapter.get_statistics()
    
    # Wait for duration (in production, this would be non-blocking)
    await asyncio.sleep(min(duration_seconds, 5))  # Cap at 5 seconds for demo
    
    end_stats = adapter.get_statistics()
    elapsed = (datetime.utcnow() - start_time).total_seconds()
    
    # Calculate rates
    bytes_sent_delta = end_stats.get('bytes_sent', 0) - initial_stats.get('bytes_sent', 0)
    bytes_received_delta = end_stats.get('bytes_received', 0) - initial_stats.get('bytes_received', 0)
    errors_delta = end_stats.get('error_count', 0) - initial_stats.get('error_count', 0)
    
    tx_rate = bytes_sent_delta / elapsed if elapsed > 0 else 0
    rx_rate = bytes_received_delta / elapsed if elapsed > 0 else 0
    
    return {
        "device_id": device_id,
        "measurement_duration": elapsed,
        "throughput": {
            "tx_rate_bps": tx_rate,
            "rx_rate_bps": rx_rate,
            "tx_rate_kbps": tx_rate / 1024,
            "rx_rate_kbps": rx_rate / 1024
        },
        "totals": {
            "bytes_sent": end_stats.get('bytes_sent', 0),
            "bytes_received": end_stats.get('bytes_received', 0),
            "error_count": end_stats.get('error_count', 0)
        },
        "deltas": {
            "bytes_sent": bytes_sent_delta,
            "bytes_received": bytes_received_delta,
            "errors": errors_delta
        },
        "error_rate": (errors_delta / ((bytes_sent_delta + bytes_received_delta) / 100) * 100) if (bytes_sent_delta + bytes_received_delta) > 0 else 0
    }


@router.post("/self-test/{device_id}")
async def run_device_self_test(device_id: str) -> Dict[str, Any]:
    """Run device-specific self-test if available"""
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    adapter = manager._adapters[device_id]
    
    # Check if adapter supports self-test
    if not hasattr(adapter, 'run_self_test'):
        return {
            "device_id": device_id,
            "supported": False,
            "message": "Device does not support self-test"
        }
    
    try:
        result = await adapter.run_self_test()
        return {
            "device_id": device_id,
            "supported": True,
            "result": result
        }
    except Exception as e:
        logger.error(f"Self-test failed for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Self-test failed: {str(e)}")


@router.get("/troubleshooting/{device_id}")
async def get_troubleshooting_guide(device_id: str) -> Dict[str, Any]:
    """Get troubleshooting guide based on current device state"""
    manager = HardwareManager()
    
    if device_id not in manager._adapters:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    adapter = manager._adapters[device_id]
    protocol_type = adapter.protocol_type
    
    # Get latest diagnostic report if available
    latest_report = None
    for session_id, report in diagnostic_reports.items():
        if isinstance(report, DiagnosticReport) and report.device_id == device_id:
            latest_report = report
            break
    
    # Build troubleshooting guide
    guide = {
        "device_id": device_id,
        "protocol_type": protocol_type.value,
        "current_state": adapter.status.state.value,
        "is_connected": adapter.is_connected,
        "common_issues": [],
        "specific_recommendations": [],
        "diagnostic_steps": []
    }
    
    # Protocol-specific troubleshooting
    if protocol_type == ProtocolType.SERIAL:
        guide["common_issues"] = [
            {
                "issue": "Device not responding",
                "causes": ["Incorrect baud rate", "Wrong COM port", "Cable disconnected"],
                "solutions": [
                    "Verify baud rate matches device settings",
                    "Check device manager for correct COM port",
                    "Ensure cable is properly connected"
                ]
            },
            {
                "issue": "Data corruption",
                "causes": ["Parity mismatch", "Noise/interference", "Ground loop"],
                "solutions": [
                    "Check parity settings (None/Even/Odd)",
                    "Use shielded cables",
                    "Ensure proper grounding"
                ]
            }
        ]
    elif protocol_type == ProtocolType.I2C:
        guide["common_issues"] = [
            {
                "issue": "No ACK from device",
                "causes": ["Wrong address", "Pull-up resistors missing", "Clock stretching"],
                "solutions": [
                    "Verify device I2C address",
                    "Add 4.7kΩ pull-up resistors to SDA/SCL",
                    "Reduce clock speed"
                ]
            }
        ]
    
    # Add recommendations from latest report
    if latest_report:
        guide["specific_recommendations"] = latest_report.recommendations
        guide["last_diagnostic"] = {
            "timestamp": latest_report.timestamp.isoformat(),
            "health_status": latest_report.health_status.value,
            "issues_detected": len(latest_report.issues_detected)
        }
    
    # Diagnostic steps
    guide["diagnostic_steps"] = [
        "1. Run basic connectivity test",
        "2. Check physical connections",
        "3. Verify protocol settings",
        "4. Run comprehensive diagnostics",
        "5. Check for interference/noise",
        "6. Test with known-good device"
    ]
    
    return guide


@router.delete("/reports")
async def clear_diagnostic_reports() -> Dict[str, str]:
    """Clear all stored diagnostic reports"""
    count = len([k for k in diagnostic_reports.keys() if not k.endswith("_progress")])
    diagnostic_reports.clear()
    return {"message": f"Cleared {count} diagnostic reports"}


@router.get("/commands/{protocol_type}")
async def get_diagnostic_commands(protocol_type: ProtocolType) -> Dict[str, Any]:
    """Get diagnostic command set for a specific protocol type"""
    from .diagnostics import DiagnosticCommands
    
    commands = {}
    
    if protocol_type == ProtocolType.SERIAL:
        commands = DiagnosticCommands.get_serial_commands()
        # Convert bytes to hex strings for JSON
        commands = {k: v.hex() for k, v in commands.items()}
    elif protocol_type == ProtocolType.I2C:
        commands = DiagnosticCommands.get_i2c_commands()
    elif protocol_type == ProtocolType.SPI:
        commands = DiagnosticCommands.get_spi_commands()
        commands = {k: v.hex() for k, v in commands.items()}
    elif protocol_type == ProtocolType.CAN:
        commands = DiagnosticCommands.get_can_commands()
    
    return {
        "protocol_type": protocol_type.value,
        "commands": commands,
        "description": f"Diagnostic commands for {protocol_type.value} protocol"
    }