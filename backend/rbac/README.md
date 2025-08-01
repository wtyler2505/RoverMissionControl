# Role-Based Access Control (RBAC) System

## Overview

This enhanced RBAC system provides enterprise-grade access control for the RoverMissionControl platform. It extends the basic authentication system with hierarchical roles, granular permissions, audit logging, temporary role elevation, and approval workflows.

## Features

### 1. **Hierarchical Role System**
- Role inheritance with parent-child relationships
- Permission inheritance from parent roles
- Circular dependency prevention
- Dynamic role assignment

### 2. **Granular Permission Model**
- Resource-based permissions (e.g., rover, arduino, missions)
- Action-based permissions (e.g., read, execute, approve)
- Permission groups for easier management
- Resource-specific access policies

### 3. **Comprehensive Audit Logging**
- All permission checks logged
- User action tracking
- Suspicious activity detection
- Export capabilities (JSON/CSV)

### 4. **Temporary Role Elevation**
- Time-limited elevated permissions
- Approval requirements
- Use count restrictions
- Resource-specific limitations

### 5. **Approval Workflows**
- Multi-step approval for sensitive actions
- Role-based approvers
- Expiration handling
- Full audit trail

### 6. **API Middleware & Decorators**
- Automatic permission enforcement
- Request-level RBAC checks
- Easy-to-use decorators
- Performance optimization with caching

## Architecture

```
backend/rbac/
├── __init__.py          # Module exports
├── permissions.py       # Permission definitions and structures
├── models.py           # Database models for RBAC
├── rbac_service.py     # Core business logic
├── audit.py            # Audit logging service
├── middleware.py       # FastAPI middleware
├── decorators.py       # Convenient decorators
└── README.md           # This file
```

## Predefined Roles

1. **Admin** - Full system access
2. **Operator** - Rover control and mission execution
3. **Viewer** - Read-only access to telemetry and data
4. **User** - Basic access to knowledge base

## Resources and Permissions

### Rover Resources
- `rover:read` - View rover status
- `rover.control:execute` - Control rover movement
- `rover.telemetry:read` - View telemetry data
- `rover.camera:read/execute` - Camera access
- `rover.emergency:execute` - Emergency stop

### Arduino Resources
- `arduino:read` - View Arduino status
- `arduino.upload:execute` - Upload sketches
- `arduino.serial:read/execute` - Serial communication

### Mission Resources
- `missions:create/read/update/delete` - Mission CRUD
- `missions.planning:execute` - Plan missions
- `missions.execution:execute/monitor/override` - Execute missions

### System Resources
- `users:create/read/update/delete` - User management
- `roles:create/read/update/delete` - Role management
- `permissions:create/read/update/delete` - Permission management
- `audit_logs:read/export` - Audit log access

## Usage Examples

### 1. Using Decorators

```python
from fastapi import APIRouter, Depends
from backend.auth.dependencies import get_current_user
from backend.rbac.decorators import require_permission, require_role
from backend.rbac.permissions import Resource, Action

router = APIRouter()

# Require specific permission
@router.post("/rover/control")
@require_permission(Resource.ROVER_CONTROL, Action.EXECUTE)
async def control_rover(
    command: str,
    user: User = Depends(get_current_user)
):
    return {"status": "executing", "command": command}

# Require role
@router.get("/admin/users")
@require_role("admin")
async def list_users(user: User = Depends(get_current_user)):
    return {"users": []}

# Require approval
@router.delete("/critical-data/{id}")
@require_approval("critical_data_deletion", approver_roles=["admin"])
async def delete_critical_data(
    id: str,
    user: User = Depends(get_current_user)
):
    # This will return approval workflow instead of executing
    pass
```

### 2. Using RBAC Service

```python
from backend.rbac.rbac_service import RBACService
from backend.rbac.permissions import Resource, Action

# Check permission
has_permission, reason = rbac_service.check_permission(
    user=current_user,
    resource=Resource.ROVER_CONTROL,
    action=Action.EXECUTE,
    resource_id="rover-001"
)

# Request role elevation
elevation = rbac_service.request_role_elevation(
    user_id=current_user.id,
    role_id="operator",
    reason="Emergency rover recovery",
    duration_minutes=60,
    requires_approval=True
)

# Create approval workflow
workflow = rbac_service.create_approval_workflow(
    action_type="critical_operation",
    requested_by=current_user.id,
    reason="Delete mission data",
    action_details={"mission_id": "mission-123"},
    required_approvals=2,
    approver_roles=["admin", "mission_director"]
)
```

### 3. Middleware Configuration

```python
from fastapi import FastAPI
from backend.rbac.middleware import RBACMiddleware
from backend.rbac.rbac_service import RBACService
from backend.rbac.audit import AuditLogger

app = FastAPI()

# Initialize services
rbac_service = RBACService(db)
audit_logger = AuditLogger(db)

# Add to app state
app.state.rbac_service = rbac_service
app.state.audit_logger = audit_logger

# Add middleware
app.add_middleware(
    RBACMiddleware,
    rbac_service=rbac_service,
    audit_logger=audit_logger,
    exclude_paths=["/health", "/docs"]
)
```

## Audit Trail

The system maintains comprehensive audit logs for:
- All permission checks (granted and denied)
- Role assignments and removals
- Permission grants and revocations
- Role elevation requests and approvals
- Critical actions and approvals
- Login/logout events
- Suspicious activity patterns

### Accessing Audit Logs

```python
# Get user audit trail
logs = audit_logger.get_user_audit_trail(
    user_id="user-123",
    limit=50,
    action_filter=[AuditAction.PERMISSION_DENIED]
)

# Export audit logs
json_export = audit_logger.export_audit_logs(
    format="json",
    filters={
        "date_from": datetime(2025, 7, 1),
        "action": AuditAction.CRITICAL_ACTION
    }
)

# Analyze suspicious activity
analysis = audit_logger.analyze_suspicious_activity(
    user_id="user-123",
    window_hours=24
)
```

## Security Considerations

1. **Permission Caching** - Permissions are cached for performance but cleared on changes
2. **Audit Integrity** - All audit logs are immutable and timestamped
3. **Elevation Limits** - Role elevations have time and use count restrictions
4. **Approval Expiry** - Approval workflows expire after configured time
5. **Circular Hierarchy Prevention** - System prevents circular role dependencies

## Database Schema

The RBAC system extends the authentication schema with:
- `role_hierarchy` - Parent-child role relationships
- `permission_groups` - Grouped permissions for easier management
- `role_permission_groups` - Role to permission group mappings
- `audit_logs` - Comprehensive audit trail
- `role_elevations` - Temporary role elevation tracking
- `approval_workflows` - Multi-step approval tracking
- `approval_decisions` - Individual approval records
- `resource_access_policies` - Fine-grained resource policies

## Performance

- Permission checks are optimized with caching
- Hierarchical role resolution uses efficient traversal
- Audit logs are indexed for fast queries
- Bulk operations minimize database calls

## Future Enhancements

1. **Dynamic Permissions** - Runtime permission creation
2. **Attribute-Based Access Control (ABAC)** - Context-aware permissions
3. **Delegation** - Allow users to delegate permissions
4. **Time-Based Policies** - Schedule-based access control
5. **Location-Based Policies** - Geo-fencing for sensitive operations