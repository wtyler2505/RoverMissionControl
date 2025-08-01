"""
Structured logging configuration for Rover Mission Control Backend
"""
import logging
import logging.config
import json
import sys
import os
from datetime import datetime
from typing import Any, Dict, Optional
from pythonjsonlogger import jsonlogger
import socket
from contextvars import ContextVar

# Context variables for correlation
correlation_id_var: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)

class RoverJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with rover-specific fields"""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)
        
        # Add timestamp in ISO format
        log_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        
        # Add service information
        log_record['service'] = 'backend'
        log_record['environment'] = os.getenv('ENVIRONMENT', 'development')
        log_record['hostname'] = socket.gethostname()
        log_record['process_id'] = os.getpid()
        
        # Add context variables if available
        if correlation_id := correlation_id_var.get():
            log_record['correlation_id'] = correlation_id
        if user_id := user_id_var.get():
            log_record['user_id'] = user_id
        if session_id := session_id_var.get():
            log_record['session_id'] = session_id
        
        # Rename level to log_level for consistency
        if 'level' in log_record:
            log_record['log_level'] = log_record.pop('level')
        
        # Add module information
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line_number'] = record.lineno
        
        # Handle exceptions
        if record.exc_info:
            log_record['exception_type'] = record.exc_info[0].__name__
            log_record['exception_message'] = str(record.exc_info[1])
            
        # Remove internal fields
        for field in ['taskName', 'processName', 'thread', 'threadName', 'msecs', 'relativeCreated']:
            log_record.pop(field, None)

class FluentdHandler(logging.Handler):
    """Handler for sending logs to Fluentd"""
    
    def __init__(self, tag: str = 'rover.backend', host: str = 'localhost', port: int = 24224):
        super().__init__()
        self.tag = tag
        self.host = host
        self.port = port
        try:
            from fluent import sender
            self.sender = sender.FluentSender(tag, host=host, port=port)
        except ImportError:
            self.sender = None
            
    def emit(self, record: logging.LogRecord) -> None:
        if not self.sender:
            return
            
        try:
            # Format record as dict
            data = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'service': 'backend',
                'environment': os.getenv('ENVIRONMENT', 'development'),
                'log_level': record.levelname,
                'module': record.module,
                'function': record.funcName,
                'line_number': record.lineno,
                'message': record.getMessage(),
            }
            
            # Add context variables
            if correlation_id := correlation_id_var.get():
                data['correlation_id'] = correlation_id
            if user_id := user_id_var.get():
                data['user_id'] = user_id
            if session_id := session_id_var.get():
                data['session_id'] = session_id
                
            # Add extra fields
            if hasattr(record, '__dict__'):
                for key, value in record.__dict__.items():
                    if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName', 
                                  'levelname', 'levelno', 'lineno', 'module', 'msecs', 
                                  'pathname', 'process', 'processName', 'relativeCreated', 
                                  'thread', 'threadName', 'exc_info', 'exc_text', 'stack_info']:
                        data[key] = value
                        
            self.sender.emit(None, data)
        except Exception:
            self.handleError(record)

class TelemetryLogger:
    """Specialized logger for telemetry data"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        
    def log_telemetry(self, telemetry_type: str, data: Dict[str, Any]) -> None:
        """Log telemetry data with proper structure"""
        self.logger.info(
            "Telemetry data received",
            extra={
                'telemetry_type': telemetry_type,
                'telemetry_data': data,
                **data  # Flatten telemetry values for indexing
            }
        )

class CommandLogger:
    """Specialized logger for command execution"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        
    def log_command(self, command_type: str, command_id: str, parameters: Dict[str, Any], 
                   status: str = 'pending', validation_errors: Optional[list] = None) -> None:
        """Log command execution with proper structure"""
        extra = {
            'command_type': command_type,
            'command_id': command_id,
            'command_parameters': parameters,
            'command_status': status
        }
        
        if validation_errors:
            extra['validation_errors'] = validation_errors
            
        self.logger.info(f"Command {command_type} {status}", extra=extra)

class AuditLogger:
    """Specialized logger for audit events"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        
    def log_audit_event(self, event_type: str, actor: str, resource: str, 
                       action: str, result: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Log audit event with proper structure"""
        self.logger.info(
            f"Audit: {actor} {action} {resource}",
            extra={
                'audit_event': event_type,
                'audit_actor': actor,
                'audit_resource': resource,
                'audit_action': action,
                'audit_result': result,
                'audit_details': details or {}
            }
        )

def setup_logging(
    level: str = 'INFO',
    enable_console: bool = True,
    enable_file: bool = True,
    enable_fluentd: bool = False,
    log_dir: str = '/app/logs'
) -> None:
    """Setup structured logging configuration"""
    
    # Create log directory if needed
    if enable_file:
        os.makedirs(log_dir, exist_ok=True)
    
    # Base configuration
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {
                '()': RoverJsonFormatter,
                'format': '%(timestamp)s %(log_level)s %(module)s %(message)s'
            },
            'standard': {
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            }
        },
        'handlers': {},
        'loggers': {
            '': {  # Root logger
                'handlers': [],
                'level': level,
                'propagate': False
            },
            'uvicorn': {
                'handlers': [],
                'level': 'INFO',
                'propagate': False
            },
            'uvicorn.error': {
                'handlers': [],
                'level': 'INFO',
                'propagate': False
            },
            'uvicorn.access': {
                'handlers': [],
                'level': 'INFO',
                'propagate': False
            }
        }
    }
    
    # Console handler
    if enable_console:
        config['handlers']['console'] = {
            'class': 'logging.StreamHandler',
            'level': level,
            'formatter': 'json' if os.getenv('ENVIRONMENT') == 'production' else 'standard',
            'stream': 'ext://sys.stdout'
        }
        for logger in config['loggers'].values():
            logger['handlers'].append('console')
    
    # File handler with rotation
    if enable_file:
        config['handlers']['file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': level,
            'formatter': 'json',
            'filename': f'{log_dir}/rover-backend.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5
        }
        for logger in config['loggers'].values():
            logger['handlers'].append('file')
    
    # Fluentd handler
    if enable_fluentd and os.getenv('FLUENTD_HOST'):
        config['handlers']['fluentd'] = {
            '()': FluentdHandler,
            'tag': 'rover.backend',
            'host': os.getenv('FLUENTD_HOST', 'localhost'),
            'port': int(os.getenv('FLUENTD_PORT', 24224))
        }
        for logger in config['loggers'].values():
            logger['handlers'].append('fluentd')
    
    # Apply configuration
    logging.config.dictConfig(config)
    
    # Log startup
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging system initialized",
        extra={
            'logging_level': level,
            'handlers': list(config['handlers'].keys()),
            'environment': os.getenv('ENVIRONMENT', 'development')
        }
    )

# Convenience function to get specialized loggers
def get_telemetry_logger() -> TelemetryLogger:
    """Get telemetry logger instance"""
    return TelemetryLogger(logging.getLogger('rover.telemetry'))

def get_command_logger() -> CommandLogger:
    """Get command logger instance"""
    return CommandLogger(logging.getLogger('rover.command'))

def get_audit_logger() -> AuditLogger:
    """Get audit logger instance"""
    return AuditLogger(logging.getLogger('rover.audit'))

# Middleware for adding correlation IDs
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware to add correlation IDs to requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Get or generate correlation ID
        correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
        
        # Set in context
        correlation_id_var.set(correlation_id)
        
        # Process request
        response = await call_next(request)
        
        # Add to response headers
        response.headers['X-Correlation-ID'] = correlation_id
        
        return response

# Example usage
if __name__ == "__main__":
    setup_logging(level='DEBUG')
    
    # Test different loggers
    logger = logging.getLogger(__name__)
    logger.info("Basic log message")
    
    telemetry = get_telemetry_logger()
    telemetry.log_telemetry('sensor_reading', {
        'temperature': 22.5,
        'battery_voltage': 12.8,
        'signal_strength': -45
    })
    
    command = get_command_logger()
    command.log_command('MOVE_FORWARD', 'cmd-123', {'speed': 10, 'duration': 5}, 'executed')
    
    audit = get_audit_logger()
    audit.log_audit_event('permission_granted', 'user123', 'rover_control', 'execute', 'success')