"""
Permission definitions and structures for RBAC system
"""
from enum import Enum
from typing import Set, Dict, List, Optional
from dataclasses import dataclass

class Resource(Enum):
    """System resources that can be protected"""
    # Rover Control
    ROVER = "rover"
    ROVER_CONTROL = "rover.control"
    ROVER_TELEMETRY = "rover.telemetry"
    ROVER_CAMERA = "rover.camera"
    ROVER_EMERGENCY = "rover.emergency"
    
    # Arduino & Hardware
    ARDUINO = "arduino"
    ARDUINO_UPLOAD = "arduino.upload"
    ARDUINO_SERIAL = "arduino.serial"
    
    # Knowledge Base
    KNOWLEDGE = "knowledge"
    KNOWLEDGE_PARTS = "knowledge.parts"
    KNOWLEDGE_DOCUMENTS = "knowledge.documents"
    
    # AI System
    AI = "ai"
    AI_CHAT = "ai.chat"
    AI_CONFIG = "ai.config"
    
    # System Administration
    USERS = "users"
    ROLES = "roles"
    PERMISSIONS = "permissions"
    AUDIT_LOGS = "audit_logs"
    SYSTEM_CONFIG = "system.config"
    
    # Data Management
    DATA_EXPORT = "data.export"
    DATA_IMPORT = "data.import"
    
    # Mission Planning
    MISSIONS = "missions"
    MISSION_PLANNING = "missions.planning"
    MISSION_EXECUTION = "missions.execution"
    
    # API Security
    API_KEYS = "api_keys"
    API_KEY_ROTATION = "api_key_rotation"
    API_KEY_SCOPES = "api_key_scopes"

class Action(Enum):
    """Actions that can be performed on resources"""
    # Basic CRUD
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    
    # Special actions
    EXECUTE = "execute"
    APPROVE = "approve"
    EXPORT = "export"
    IMPORT = "import"
    CONFIGURE = "configure"
    MONITOR = "monitor"
    EMERGENCY_STOP = "emergency_stop"
    OVERRIDE = "override"

@dataclass
class Permission:
    """A single permission combining resource and action"""
    resource: Resource
    action: Action
    
    def __str__(self):
        return f"{self.resource.value}:{self.action.value}"
    
    @classmethod
    def from_string(cls, permission_string: str) -> 'Permission':
        """Create permission from string format 'resource:action'"""
        resource_str, action_str = permission_string.split(':')
        return cls(
            resource=Resource(resource_str),
            action=Action(action_str)
        )

class PermissionSet:
    """Collection of permissions with utility methods"""
    def __init__(self, permissions: Optional[List[Permission]] = None):
        self.permissions: Set[Permission] = set(permissions or [])
    
    def add(self, permission: Permission):
        """Add a permission to the set"""
        self.permissions.add(permission)
    
    def remove(self, permission: Permission):
        """Remove a permission from the set"""
        self.permissions.discard(permission)
    
    def has_permission(self, resource: Resource, action: Action) -> bool:
        """Check if set contains a specific permission"""
        return Permission(resource, action) in self.permissions
    
    def has_any_permission(self, resource: Resource) -> bool:
        """Check if set contains any permission for a resource"""
        return any(p.resource == resource for p in self.permissions)
    
    def has_wildcard_permission(self) -> bool:
        """Check if set contains wildcard permissions (admin)"""
        # Admin has permission on all resources with all actions
        admin_resources = [Resource.USERS, Resource.ROLES, Resource.PERMISSIONS]
        admin_actions = [Action.CREATE, Action.UPDATE, Action.DELETE]
        
        for resource in admin_resources:
            for action in admin_actions:
                if not self.has_permission(resource, action):
                    return False
        return True
    
    def merge(self, other: 'PermissionSet') -> 'PermissionSet':
        """Merge two permission sets"""
        merged = PermissionSet()
        merged.permissions = self.permissions.union(other.permissions)
        return merged
    
    def to_list(self) -> List[str]:
        """Convert to list of permission strings"""
        return [str(p) for p in self.permissions]
    
    @classmethod
    def from_list(cls, permission_strings: List[str]) -> 'PermissionSet':
        """Create from list of permission strings"""
        permissions = [Permission.from_string(ps) for ps in permission_strings]
        return cls(permissions)

# Pre-defined permission sets for standard roles
ADMIN_PERMISSIONS = PermissionSet([
    # Full access to all resources
    Permission(resource, action)
    for resource in Resource
    for action in Action
])

OPERATOR_PERMISSIONS = PermissionSet([
    # Rover control
    Permission(Resource.ROVER, Action.READ),
    Permission(Resource.ROVER, Action.MONITOR),
    Permission(Resource.ROVER_CONTROL, Action.EXECUTE),
    Permission(Resource.ROVER_TELEMETRY, Action.READ),
    Permission(Resource.ROVER_CAMERA, Action.READ),
    Permission(Resource.ROVER_CAMERA, Action.EXECUTE),
    Permission(Resource.ROVER_EMERGENCY, Action.EXECUTE),
    
    # Arduino
    Permission(Resource.ARDUINO, Action.READ),
    Permission(Resource.ARDUINO_UPLOAD, Action.EXECUTE),
    Permission(Resource.ARDUINO_SERIAL, Action.READ),
    Permission(Resource.ARDUINO_SERIAL, Action.EXECUTE),
    
    # Knowledge base
    Permission(Resource.KNOWLEDGE, Action.READ),
    Permission(Resource.KNOWLEDGE_PARTS, Action.READ),
    Permission(Resource.KNOWLEDGE_PARTS, Action.UPDATE),
    Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.READ),
    
    # AI
    Permission(Resource.AI, Action.READ),
    Permission(Resource.AI_CHAT, Action.EXECUTE),
    
    # Missions
    Permission(Resource.MISSIONS, Action.READ),
    Permission(Resource.MISSIONS, Action.CREATE),
    Permission(Resource.MISSION_PLANNING, Action.EXECUTE),
    Permission(Resource.MISSION_EXECUTION, Action.EXECUTE),
    
    # Data
    Permission(Resource.DATA_EXPORT, Action.EXECUTE),
    
    # API Keys (limited)
    Permission(Resource.API_KEYS, Action.READ),  # Can view their own keys
    Permission(Resource.API_KEYS, Action.CREATE),  # Can create keys
    Permission(Resource.API_KEY_ROTATION, Action.EXECUTE),  # Can rotate their keys
])

VIEWER_PERMISSIONS = PermissionSet([
    # Read-only access to most resources
    Permission(Resource.ROVER, Action.READ),
    Permission(Resource.ROVER_TELEMETRY, Action.READ),
    Permission(Resource.ROVER_CAMERA, Action.READ),
    
    # Knowledge base
    Permission(Resource.KNOWLEDGE, Action.READ),
    Permission(Resource.KNOWLEDGE_PARTS, Action.READ),
    Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.READ),
    
    # AI (read only)
    Permission(Resource.AI, Action.READ),
    
    # Missions (read only)
    Permission(Resource.MISSIONS, Action.READ),
    
    # Data export
    Permission(Resource.DATA_EXPORT, Action.EXECUTE),
])

USER_PERMISSIONS = PermissionSet([
    # Basic read access
    Permission(Resource.ROVER_TELEMETRY, Action.READ),
    Permission(Resource.KNOWLEDGE, Action.READ),
    Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.READ),
])

# Permission groups for easier management
PERMISSION_GROUPS = {
    "rover_control": [
        Permission(Resource.ROVER_CONTROL, Action.EXECUTE),
        Permission(Resource.ROVER_EMERGENCY, Action.EXECUTE),
    ],
    "rover_monitoring": [
        Permission(Resource.ROVER, Action.READ),
        Permission(Resource.ROVER_TELEMETRY, Action.READ),
        Permission(Resource.ROVER_CAMERA, Action.READ),
    ],
    "arduino_management": [
        Permission(Resource.ARDUINO, Action.READ),
        Permission(Resource.ARDUINO_UPLOAD, Action.EXECUTE),
        Permission(Resource.ARDUINO_SERIAL, Action.READ),
        Permission(Resource.ARDUINO_SERIAL, Action.EXECUTE),
    ],
    "knowledge_management": [
        Permission(Resource.KNOWLEDGE, Action.CREATE),
        Permission(Resource.KNOWLEDGE, Action.UPDATE),
        Permission(Resource.KNOWLEDGE, Action.DELETE),
        Permission(Resource.KNOWLEDGE_PARTS, Action.CREATE),
        Permission(Resource.KNOWLEDGE_PARTS, Action.UPDATE),
        Permission(Resource.KNOWLEDGE_PARTS, Action.DELETE),
        Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.CREATE),
        Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.UPDATE),
        Permission(Resource.KNOWLEDGE_DOCUMENTS, Action.DELETE),
    ],
    "user_management": [
        Permission(Resource.USERS, Action.CREATE),
        Permission(Resource.USERS, Action.READ),
        Permission(Resource.USERS, Action.UPDATE),
        Permission(Resource.USERS, Action.DELETE),
        Permission(Resource.ROLES, Action.READ),
    ],
    "role_management": [
        Permission(Resource.ROLES, Action.CREATE),
        Permission(Resource.ROLES, Action.UPDATE),
        Permission(Resource.ROLES, Action.DELETE),
        Permission(Resource.PERMISSIONS, Action.CREATE),
        Permission(Resource.PERMISSIONS, Action.UPDATE),
        Permission(Resource.PERMISSIONS, Action.DELETE),
    ],
    "audit_management": [
        Permission(Resource.AUDIT_LOGS, Action.READ),
        Permission(Resource.AUDIT_LOGS, Action.EXPORT),
    ],
    "mission_planning": [
        Permission(Resource.MISSIONS, Action.CREATE),
        Permission(Resource.MISSIONS, Action.UPDATE),
        Permission(Resource.MISSION_PLANNING, Action.EXECUTE),
    ],
    "mission_execution": [
        Permission(Resource.MISSION_EXECUTION, Action.EXECUTE),
        Permission(Resource.MISSION_EXECUTION, Action.MONITOR),
        Permission(Resource.MISSION_EXECUTION, Action.OVERRIDE),
    ],
}