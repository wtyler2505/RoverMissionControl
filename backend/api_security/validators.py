"""
Input validation for API requests
"""
import re
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, validator, Field
from datetime import datetime

class RequestValidator:
    """Base request validator"""
    
    # Common validation patterns
    IP_PATTERN = re.compile(
        r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}'
        r'(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    )
    
    URL_PATTERN = re.compile(
        r'^https?://'
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )
    
    EMAIL_PATTERN = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )
    
    @staticmethod
    def validate_ip(ip: str) -> bool:
        """Validate IP address"""
        return bool(RequestValidator.IP_PATTERN.match(ip))
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL"""
        return bool(RequestValidator.URL_PATTERN.match(url))
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email address"""
        return bool(RequestValidator.EMAIL_PATTERN.match(email))
    
    @staticmethod
    def sanitize_string(
        value: str,
        max_length: int = 1000,
        allowed_chars: Optional[str] = None
    ) -> str:
        """Sanitize string input"""
        # Truncate to max length
        value = value[:max_length]
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Filter allowed characters if specified
        if allowed_chars:
            value = ''.join(c for c in value if c in allowed_chars)
        
        return value.strip()
    
    @staticmethod
    def validate_json_schema(data: Dict, schema: Dict) -> List[str]:
        """Validate JSON data against schema"""
        errors = []
        
        # Simple schema validation (use jsonschema for production)
        for field, rules in schema.items():
            if rules.get("required") and field not in data:
                errors.append(f"Missing required field: {field}")
            
            if field in data:
                value = data[field]
                field_type = rules.get("type")
                
                if field_type == "string" and not isinstance(value, str):
                    errors.append(f"Field {field} must be a string")
                elif field_type == "number" and not isinstance(value, (int, float)):
                    errors.append(f"Field {field} must be a number")
                elif field_type == "boolean" and not isinstance(value, bool):
                    errors.append(f"Field {field} must be a boolean")
                elif field_type == "array" and not isinstance(value, list):
                    errors.append(f"Field {field} must be an array")
                
                # Check constraints
                if "min" in rules and isinstance(value, (int, float)):
                    if value < rules["min"]:
                        errors.append(f"Field {field} must be >= {rules['min']}")
                
                if "max" in rules and isinstance(value, (int, float)):
                    if value > rules["max"]:
                        errors.append(f"Field {field} must be <= {rules['max']}")
                
                if "minLength" in rules and isinstance(value, str):
                    if len(value) < rules["minLength"]:
                        errors.append(f"Field {field} must be at least {rules['minLength']} characters")
                
                if "maxLength" in rules and isinstance(value, str):
                    if len(value) > rules["maxLength"]:
                        errors.append(f"Field {field} must be at most {rules['maxLength']} characters")
                
                if "pattern" in rules and isinstance(value, str):
                    if not re.match(rules["pattern"], value):
                        errors.append(f"Field {field} does not match required pattern")
        
        return errors


# Pydantic models for common API requests

class RoverControlRequest(BaseModel):
    """Validate rover control commands"""
    command: str = Field(..., regex='^(forward|backward|left|right|stop)$')
    speed: Optional[int] = Field(50, ge=0, le=100)
    duration: Optional[int] = Field(None, ge=0, le=10000)  # milliseconds
    
    @validator('command')
    def validate_command(cls, v):
        allowed_commands = ['forward', 'backward', 'left', 'right', 'stop']
        if v not in allowed_commands:
            raise ValueError(f"Command must be one of: {', '.join(allowed_commands)}")
        return v

class ArduinoUploadRequest(BaseModel):
    """Validate Arduino upload requests"""
    code: str = Field(..., min_length=1, max_length=100000)
    board: str = Field(..., regex='^[a-zA-Z0-9:_-]+$')
    port: str = Field(..., regex='^(COM\\d+|/dev/tty[a-zA-Z0-9]+)$')
    
    @validator('code')
    def validate_code(cls, v):
        # Basic validation - no null bytes
        if '\x00' in v:
            raise ValueError("Code contains invalid characters")
        return v

class KnowledgeSearchRequest(BaseModel):
    """Validate knowledge base search"""
    query: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = Field(None, regex='^[a-zA-Z0-9_-]+$')
    limit: int = Field(10, ge=1, le=100)
    offset: int = Field(0, ge=0)

class DataExportRequest(BaseModel):
    """Validate data export requests"""
    format: str = Field(..., regex='^(json|csv|excel)$')
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_fields: Optional[List[str]] = []
    
    @validator('end_date')
    def validate_dates(cls, v, values):
        if v and 'start_date' in values and values['start_date']:
            if v < values['start_date']:
                raise ValueError("End date must be after start date")
        return v

class ConfigUpdateRequest(BaseModel):
    """Validate configuration updates"""
    key: str = Field(..., regex='^[a-zA-Z0-9._-]+$', max_length=100)
    value: Union[str, int, float, bool, List, Dict]
    
    @validator('key')
    def validate_key(cls, v):
        # Prevent access to sensitive keys
        forbidden_keys = ['jwt_secret', 'database_url', 'api_keys']
        if any(forbidden in v.lower() for forbidden in forbidden_keys):
            raise ValueError("Cannot modify sensitive configuration")
        return v


# SQL Injection prevention
class SQLValidator:
    """Validate and sanitize SQL-related inputs"""
    
    @staticmethod
    def is_safe_identifier(identifier: str) -> bool:
        """Check if identifier is safe for SQL"""
        # Only allow alphanumeric and underscore
        return bool(re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', identifier))
    
    @staticmethod
    def escape_like_pattern(pattern: str) -> str:
        """Escape special characters in LIKE patterns"""
        # Escape %, _, and \
        pattern = pattern.replace('\\', '\\\\')
        pattern = pattern.replace('%', '\\%')
        pattern = pattern.replace('_', '\\_')
        return pattern
    
    @staticmethod
    def validate_sort_field(field: str, allowed_fields: List[str]) -> bool:
        """Validate sort field against whitelist"""
        return field in allowed_fields


# Path traversal prevention
class PathValidator:
    """Validate file paths"""
    
    @staticmethod
    def is_safe_path(path: str, base_dir: str) -> bool:
        """Check if path is safe (no traversal)"""
        # Normalize paths
        import os
        normalized_path = os.path.normpath(os.path.join(base_dir, path))
        normalized_base = os.path.normpath(base_dir)
        
        # Check if normalized path is within base directory
        return normalized_path.startswith(normalized_base)
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename"""
        # Remove path separators and null bytes
        filename = filename.replace('/', '').replace('\\', '').replace('\x00', '')
        
        # Remove leading dots
        filename = filename.lstrip('.')
        
        # Limit length
        filename = filename[:255]
        
        return filename