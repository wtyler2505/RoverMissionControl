"""
API endpoints for schema validation management
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
import json
import yaml

from .schema_service import SchemaService
from .schema_models import (
    SchemaDefinition, SchemaType, SchemaStatus, ValidationSeverity,
    ValidationRuleType, ValidationRule, SchemaVersion, ValidationLog,
    SchemaEndpointMapping, ValidationMetrics
)
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User

router = APIRouter(prefix="/api/schemas", tags=["Schema Management"])

# Pydantic models
class SchemaCreate(BaseModel):
    """Create a new schema definition"""
    name: str = Field(..., description="Schema name")
    description: Optional[str] = Field(None, description="Schema description")
    schema_content: Dict[str, Any] = Field(..., description="The actual schema definition")
    schema_version: str = Field("1.0.0", description="Semantic version")
    schema_type: SchemaType = Field(SchemaType.JSON_SCHEMA, description="Type of schema")
    namespace: Optional[str] = Field(None, description="Schema namespace for organization")
    tags: Optional[List[str]] = Field(None, description="Tags for categorization")
    status: SchemaStatus = Field(SchemaStatus.DRAFT, description="Initial status")

class SchemaUpdate(BaseModel):
    """Update schema definition"""
    name: Optional[str] = None
    description: Optional[str] = None
    schema_content: Optional[Dict[str, Any]] = None
    schema_version: Optional[str] = None
    status: Optional[SchemaStatus] = None
    tags: Optional[List[str]] = None
    change_description: Optional[str] = Field(None, description="Description of changes for versioning")
    breaking_changes: Optional[bool] = Field(False, description="Whether changes are breaking")
    migration_guide: Optional[str] = Field(None, description="Guide for migrating from previous version")

class SchemaResponse(BaseModel):
    """Schema response"""
    id: str
    name: str
    description: Optional[str]
    schema_type: str
    schema_content: Dict[str, Any]
    schema_version: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    namespace: Optional[str]
    tags: List[str]
    openapi_version: Optional[str]
    imported_from: Optional[str]
    import_timestamp: Optional[datetime]
    
    # Stats
    active_mappings: Optional[int] = 0
    validation_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

class ValidationRuleCreate(BaseModel):
    """Create validation rule"""
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    error_message: str = Field(..., description="Error message to display")
    rule_type: ValidationRuleType = Field(ValidationRuleType.CUSTOM_FUNCTION, description="Type of rule")
    severity: ValidationSeverity = Field(ValidationSeverity.ERROR, description="Severity level")
    field_path: Optional[str] = Field(None, description="JSONPath or dot notation to field")
    condition: Optional[Dict[str, Any]] = Field(None, description="Rule conditions")
    validator_function: Optional[str] = Field(None, description="Python code for custom validation")
    validator_imports: Optional[List[str]] = Field(None, description="Required imports")
    applies_to: str = Field("both", description="request, response, or both")
    http_methods: Optional[List[str]] = Field(None, description="HTTP methods this rule applies to")
    business_context: Optional[str] = Field(None, description="Business rule explanation")
    compliance_requirement: Optional[str] = Field(None, description="Related compliance requirement")

class ValidationRuleUpdate(BaseModel):
    """Update validation rule"""
    name: Optional[str] = None
    description: Optional[str] = None
    error_message: Optional[str] = None
    severity: Optional[ValidationSeverity] = None
    field_path: Optional[str] = None
    condition: Optional[Dict[str, Any]] = None
    validator_function: Optional[str] = None
    validator_imports: Optional[List[str]] = None
    applies_to: Optional[str] = None
    http_methods: Optional[List[str]] = None
    enabled: Optional[bool] = None

class ValidationRuleResponse(BaseModel):
    """Validation rule response"""
    id: str
    name: str
    description: Optional[str]
    rule_type: str
    severity: str
    field_path: Optional[str]
    condition: Optional[Dict[str, Any]]
    error_message: str
    error_code: Optional[str]
    validator_function: Optional[str]
    validator_imports: Optional[List[str]]
    applies_to: str
    http_methods: Optional[List[str]]
    business_context: Optional[str]
    compliance_requirement: Optional[str]
    enabled: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class EndpointMappingCreate(BaseModel):
    """Create endpoint mapping"""
    endpoint_path: str = Field(..., description="API endpoint path (e.g., /api/v1/rovers/{id})")
    http_method: str = Field(..., description="HTTP method")
    request_schema_id: Optional[str] = Field(None, description="Schema ID for request validation")
    response_schema_id: Optional[str] = Field(None, description="Default response schema ID")
    response_schemas_by_status: Optional[Dict[str, str]] = Field(None, description="Response schemas by status code")
    validate_request: bool = Field(True, description="Enable request validation")
    validate_response: bool = Field(True, description="Enable response validation")
    strict_validation: bool = Field(False, description="Fail on extra fields")
    api_version: Optional[str] = Field(None, description="API version")
    description: Optional[str] = Field(None, description="Mapping description")
    example_request: Optional[Dict[str, Any]] = Field(None, description="Example request")
    example_response: Optional[Dict[str, Any]] = Field(None, description="Example response")

class EndpointMappingUpdate(BaseModel):
    """Update endpoint mapping"""
    request_schema_id: Optional[str] = None
    response_schema_id: Optional[str] = None
    response_schemas_by_status: Optional[Dict[str, str]] = None
    validate_request: Optional[bool] = None
    validate_response: Optional[bool] = None
    strict_validation: Optional[bool] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None
    example_request: Optional[Dict[str, Any]] = None
    example_response: Optional[Dict[str, Any]] = None

class EndpointMappingResponse(BaseModel):
    """Endpoint mapping response"""
    id: str
    endpoint_path: str
    http_method: str
    request_schema_id: Optional[str]
    response_schema_id: Optional[str]
    response_schemas_by_status: Optional[Dict[str, str]]
    validate_request: bool
    validate_response: bool
    strict_validation: bool
    api_version: Optional[str]
    enabled: bool
    created_at: datetime
    updated_at: Optional[datetime]
    description: Optional[str]
    example_request: Optional[Dict[str, Any]]
    example_response: Optional[Dict[str, Any]]
    
    # Related info
    request_schema_name: Optional[str] = None
    response_schema_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class ValidationTestRequest(BaseModel):
    """Test validation request"""
    data: Dict[str, Any] = Field(..., description="Data to validate")
    validation_type: str = Field("request", description="request or response")
    include_warnings: bool = Field(True, description="Include warnings in result")

class SchemaVersionResponse(BaseModel):
    """Schema version response"""
    id: str
    schema_id: str
    version_number: str
    change_description: str
    breaking_changes: bool
    migration_guide: Optional[str]
    schema_content: Dict[str, Any]
    created_by: str
    created_at: datetime
    published_at: Optional[datetime]
    deprecated_at: Optional[datetime]
    retired_at: Optional[datetime]
    compatible_with: Optional[List[str]]
    active_endpoints: int
    
    class Config:
        from_attributes = True

class ValidationLogResponse(BaseModel):
    """Validation log response"""
    id: str
    request_id: str
    endpoint: str
    http_method: str
    schema_id: Optional[str]
    validation_type: str
    validation_result: str
    errors: List[Dict[str, Any]]
    error_count: int
    warning_count: int
    response_status: Optional[int]
    validation_duration_ms: Optional[float]
    user_id: Optional[str]
    api_key_id: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True

class ValidationMetricsResponse(BaseModel):
    """Validation metrics response"""
    id: str
    period_start: datetime
    period_end: datetime
    endpoint: Optional[str]
    schema_id: Optional[str]
    total_validations: int
    passed_validations: int
    failed_validations: int
    warning_validations: int
    avg_validation_time_ms: Optional[float]
    max_validation_time_ms: Optional[float]
    min_validation_time_ms: Optional[float]
    pass_rate: float
    top_errors: List[Dict[str, Any]]
    
    class Config:
        from_attributes = True

# Schema CRUD Endpoints
@router.post("/", response_model=SchemaResponse)
async def create_schema(
    schema: SchemaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new schema definition"""
    service = SchemaService(db)
    
    return service.create_schema(
        name=schema.name,
        schema_content=schema.schema_content,
        schema_version=schema.schema_version,
        current_user=current_user,
        description=schema.description,
        schema_type=schema.schema_type,
        namespace=schema.namespace,
        tags=schema.tags,
        status=schema.status
    )

@router.get("/", response_model=List[SchemaResponse])
async def get_schemas(
    namespace: Optional[str] = None,
    schema_type: Optional[SchemaType] = None,
    status: Optional[SchemaStatus] = None,
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all schemas with optional filters"""
    service = SchemaService(db)
    
    # Parse tags
    tag_list = tags.split(",") if tags else None
    
    schemas = service.get_schemas(
        namespace=namespace,
        schema_type=schema_type,
        status=status,
        tags=tag_list,
        search=search
    )
    
    # Add statistics
    for schema in schemas:
        # Count active mappings
        schema.active_mappings = db.query(SchemaEndpointMapping).filter(
            or_(
                SchemaEndpointMapping.request_schema_id == schema.id,
                SchemaEndpointMapping.response_schema_id == schema.id
            ),
            SchemaEndpointMapping.enabled == True
        ).count()
        
        # Count validations
        schema.validation_count = db.query(ValidationLog).filter(
            ValidationLog.schema_id == schema.id
        ).count()
    
    return schemas

@router.get("/{schema_id}", response_model=SchemaResponse)
async def get_schema(
    schema_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific schema"""
    service = SchemaService(db)
    schema = service.get_schema(schema_id)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found"
        )
    
    return schema

@router.put("/{schema_id}", response_model=SchemaResponse)
async def update_schema(
    schema_id: str,
    updates: SchemaUpdate,
    create_version: bool = Query(True, description="Create new version if content changed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a schema definition"""
    service = SchemaService(db)
    
    # Convert to dict and remove None values
    update_dict = updates.dict(exclude_unset=True)
    
    return service.update_schema(
        schema_id=schema_id,
        updates=update_dict,
        current_user=current_user,
        create_version=create_version
    )

@router.delete("/{schema_id}")
async def delete_schema(
    schema_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a schema definition"""
    service = SchemaService(db)
    success = service.delete_schema(schema_id, current_user)
    
    return {"success": success, "message": "Schema deleted successfully"}

# Import/Export Endpoints
@router.post("/import/openapi")
async def import_openapi(
    file: UploadFile = File(..., description="OpenAPI/Swagger specification file"),
    namespace: Optional[str] = Form(None, description="Namespace for imported schemas"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import schemas from OpenAPI/Swagger file"""
    service = SchemaService(db)
    
    # Read and parse file
    content = await file.read()
    
    try:
        # Try JSON first
        openapi_spec = json.loads(content)
    except json.JSONDecodeError:
        try:
            # Try YAML
            openapi_spec = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file format: {str(e)}"
            )
    
    # Import schemas
    imported_schemas = service.import_openapi(
        openapi_spec=openapi_spec,
        current_user=current_user,
        namespace=namespace
    )
    
    return {
        "success": True,
        "imported_count": len(imported_schemas),
        "schemas": [
            {
                "id": schema.id,
                "name": schema.name,
                "version": schema.schema_version
            }
            for schema in imported_schemas
        ]
    }

@router.get("/{schema_id}/export")
async def export_schema(
    schema_id: str,
    format: str = Query("json_schema", description="Export format: json_schema, openapi"),
    include_custom_rules: bool = Query(False, description="Include custom validation rules"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export a schema in various formats"""
    service = SchemaService(db)
    
    return service.export_schema(
        schema_id=schema_id,
        export_format=format,
        include_custom_rules=include_custom_rules
    )

@router.get("/export/all")
async def export_all_schemas(
    namespace: Optional[str] = None,
    format: str = Query("openapi", description="Export format: openapi, json"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export all schemas in a namespace"""
    service = SchemaService(db)
    
    return service.export_all_schemas(
        namespace=namespace,
        export_format=format
    )

# Validation Testing Endpoint
@router.post("/{schema_id}/validate")
async def test_validation(
    schema_id: str,
    test_request: ValidationTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test data validation against a schema"""
    service = SchemaService(db)
    
    return service.validate_data(
        schema_id=schema_id,
        data=test_request.data,
        validation_type=test_request.validation_type,
        include_warnings=test_request.include_warnings
    )

# Endpoint Mapping Management
@router.post("/mappings", response_model=EndpointMappingResponse)
async def create_endpoint_mapping(
    mapping: EndpointMappingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an endpoint mapping"""
    service = SchemaService(db)
    
    result = service.create_endpoint_mapping(
        endpoint_path=mapping.endpoint_path,
        http_method=mapping.http_method,
        current_user=current_user,
        request_schema_id=mapping.request_schema_id,
        response_schema_id=mapping.response_schema_id,
        response_schemas_by_status=mapping.response_schemas_by_status,
        validate_request=mapping.validate_request,
        validate_response=mapping.validate_response,
        strict_validation=mapping.strict_validation,
        api_version=mapping.api_version
    )
    
    # Set additional fields
    result.description = mapping.description
    result.example_request = mapping.example_request
    result.example_response = mapping.example_response
    
    db.commit()
    db.refresh(result)
    
    return result

@router.get("/mappings", response_model=List[EndpointMappingResponse])
async def get_endpoint_mappings(
    endpoint_path: Optional[str] = None,
    http_method: Optional[str] = None,
    api_version: Optional[str] = None,
    enabled_only: bool = Query(True, description="Only show enabled mappings"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get endpoint mappings"""
    service = SchemaService(db)
    
    mappings = service.get_endpoint_mappings(
        endpoint_path=endpoint_path,
        http_method=http_method,
        api_version=api_version,
        enabled_only=enabled_only
    )
    
    # Add schema names
    for mapping in mappings:
        if mapping.request_schema_id:
            request_schema = service.get_schema(mapping.request_schema_id)
            if request_schema:
                mapping.request_schema_name = request_schema.name
        
        if mapping.response_schema_id:
            response_schema = service.get_schema(mapping.response_schema_id)
            if response_schema:
                mapping.response_schema_name = response_schema.name
    
    return mappings

@router.get("/mappings/{mapping_id}", response_model=EndpointMappingResponse)
async def get_endpoint_mapping(
    mapping_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific endpoint mapping"""
    mapping = db.query(SchemaEndpointMapping).filter(
        SchemaEndpointMapping.id == mapping_id
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found"
        )
    
    return mapping

@router.put("/mappings/{mapping_id}", response_model=EndpointMappingResponse)
async def update_endpoint_mapping(
    mapping_id: str,
    updates: EndpointMappingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an endpoint mapping"""
    service = SchemaService(db)
    
    mapping = db.query(SchemaEndpointMapping).filter(
        SchemaEndpointMapping.id == mapping_id
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found"
        )
    
    # Check permissions
    if not service.rbac.check_permission(current_user.id, "schema:write", "endpoint_mappings"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update endpoint mappings"
        )
    
    # Apply updates
    update_dict = updates.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if hasattr(mapping, key):
            setattr(mapping, key, value)
    
    mapping.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(mapping)
    
    return mapping

@router.delete("/mappings/{mapping_id}")
async def delete_endpoint_mapping(
    mapping_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an endpoint mapping"""
    service = SchemaService(db)
    
    # Check permissions
    if not service.rbac.check_permission(current_user.id, "schema:write", "endpoint_mappings"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete endpoint mappings"
        )
    
    mapping = db.query(SchemaEndpointMapping).filter(
        SchemaEndpointMapping.id == mapping_id
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mapping not found"
        )
    
    db.delete(mapping)
    db.commit()
    
    return {"success": True, "message": "Mapping deleted successfully"}

# Validation Rule CRUD
@router.post("/rules", response_model=ValidationRuleResponse)
async def create_validation_rule(
    rule: ValidationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a custom validation rule"""
    service = SchemaService(db)
    
    return service.create_validation_rule(
        name=rule.name,
        error_message=rule.error_message,
        current_user=current_user,
        description=rule.description,
        rule_type=rule.rule_type,
        severity=rule.severity,
        field_path=rule.field_path,
        condition=rule.condition,
        validator_function=rule.validator_function,
        validator_imports=rule.validator_imports,
        applies_to=rule.applies_to,
        http_methods=rule.http_methods
    )

@router.get("/rules", response_model=List[ValidationRuleResponse])
async def get_validation_rules(
    rule_type: Optional[ValidationRuleType] = None,
    severity: Optional[ValidationSeverity] = None,
    enabled_only: bool = Query(True, description="Only show enabled rules"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all validation rules"""
    query = db.query(ValidationRule)
    
    if rule_type:
        query = query.filter(ValidationRule.rule_type == rule_type)
    
    if severity:
        query = query.filter(ValidationRule.severity == severity)
    
    if enabled_only:
        query = query.filter(ValidationRule.enabled == True)
    
    return query.order_by(ValidationRule.created_at.desc()).all()

@router.get("/rules/{rule_id}", response_model=ValidationRuleResponse)
async def get_validation_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific validation rule"""
    rule = db.query(ValidationRule).filter(
        ValidationRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validation rule not found"
        )
    
    return rule

@router.put("/rules/{rule_id}", response_model=ValidationRuleResponse)
async def update_validation_rule(
    rule_id: str,
    updates: ValidationRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a validation rule"""
    service = SchemaService(db)
    
    # Check permissions
    if not service.rbac.check_permission(current_user.id, "schema:write", "validation_rules"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update validation rules"
        )
    
    rule = db.query(ValidationRule).filter(
        ValidationRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validation rule not found"
        )
    
    # Apply updates
    update_dict = updates.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if hasattr(rule, key):
            setattr(rule, key, value)
    
    rule.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(rule)
    
    return rule

@router.delete("/rules/{rule_id}")
async def delete_validation_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a validation rule"""
    service = SchemaService(db)
    
    # Check permissions
    if not service.rbac.check_permission(current_user.id, "schema:write", "validation_rules"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete validation rules"
        )
    
    rule = db.query(ValidationRule).filter(
        ValidationRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validation rule not found"
        )
    
    db.delete(rule)
    db.commit()
    
    return {"success": True, "message": "Validation rule deleted successfully"}

@router.post("/{schema_id}/rules/{rule_id}/attach")
async def attach_rule_to_schema(
    schema_id: str,
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Attach a validation rule to a schema"""
    service = SchemaService(db)
    
    success = service.attach_rule_to_schema(
        schema_id=schema_id,
        rule_id=rule_id,
        current_user=current_user
    )
    
    return {"success": success, "message": "Rule attached to schema"}

# Version Management Endpoints
@router.post("/{schema_id}/versions", response_model=SchemaVersionResponse)
async def create_schema_version(
    schema_id: str,
    version_number: str = Query(..., description="Semantic version number"),
    change_description: str = Query(..., description="Description of changes"),
    schema_content: Dict[str, Any] = None,
    breaking_changes: bool = Query(False, description="Whether changes are breaking"),
    migration_guide: Optional[str] = Query(None, description="Migration guide"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new version of a schema"""
    service = SchemaService(db)
    
    return service.create_schema_version(
        schema_id=schema_id,
        version_number=version_number,
        change_description=change_description,
        schema_content=schema_content,
        current_user=current_user,
        breaking_changes=breaking_changes,
        migration_guide=migration_guide
    )

@router.get("/{schema_id}/versions", response_model=List[SchemaVersionResponse])
async def get_schema_versions(
    schema_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all versions of a schema"""
    service = SchemaService(db)
    
    return service.get_schema_versions(schema_id)

@router.post("/{schema_id}/versions/migrate")
async def migrate_schema_version(
    schema_id: str,
    from_version: str = Query(..., description="Source version"),
    to_version: str = Query(..., description="Target version"),
    data: Dict[str, Any] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Migrate data from one schema version to another"""
    service = SchemaService(db)
    
    return service.migrate_schema_version(
        schema_id=schema_id,
        from_version=from_version,
        to_version=to_version,
        data=data
    )

# Validation Logs and Metrics Endpoints
@router.get("/logs", response_model=List[ValidationLogResponse])
async def get_validation_logs(
    schema_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    validation_result: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get validation logs"""
    query = db.query(ValidationLog)
    
    if schema_id:
        query = query.filter(ValidationLog.schema_id == schema_id)
    
    if endpoint:
        query = query.filter(ValidationLog.endpoint == endpoint)
    
    if validation_result:
        query = query.filter(ValidationLog.validation_result == validation_result)
    
    if start_date:
        query = query.filter(ValidationLog.timestamp >= start_date)
    
    if end_date:
        query = query.filter(ValidationLog.timestamp <= end_date)
    
    return query.order_by(ValidationLog.timestamp.desc()).limit(limit).all()

@router.get("/metrics", response_model=List[ValidationMetricsResponse])
async def get_validation_metrics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    endpoint: Optional[str] = None,
    schema_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated validation metrics"""
    service = SchemaService(db)
    
    metrics = service.get_validation_metrics(
        start_date=start_date,
        end_date=end_date,
        endpoint=endpoint,
        schema_id=schema_id
    )
    
    # Calculate pass rates
    for metric in metrics:
        metric.pass_rate = (metric.passed_validations / metric.total_validations * 100) if metric.total_validations > 0 else 0
    
    return metrics

@router.get("/{schema_id}/report")
async def generate_validation_report(
    schema_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a validation report for a schema"""
    service = SchemaService(db)
    
    return service.generate_validation_report(
        schema_id=schema_id,
        start_date=start_date,
        end_date=end_date
    )

# Validation Check Endpoint (for middleware/runtime validation)
@router.post("/validate/request")
async def validate_request(
    endpoint_path: str = Query(..., description="API endpoint path"),
    http_method: str = Query(..., description="HTTP method"),
    request_data: Dict[str, Any] = None,
    api_version: Optional[str] = Query(None, description="API version"),
    db: Session = Depends(get_db)
):
    """Validate request data for an endpoint"""
    service = SchemaService(db)
    
    return service.validate_endpoint_request(
        endpoint_path=endpoint_path,
        http_method=http_method,
        request_data=request_data,
        api_version=api_version
    )

@router.post("/validate/response")
async def validate_response(
    endpoint_path: str = Query(..., description="API endpoint path"),
    http_method: str = Query(..., description="HTTP method"),
    response_data: Dict[str, Any] = None,
    status_code: int = Query(200, description="HTTP status code"),
    api_version: Optional[str] = Query(None, description="API version"),
    db: Session = Depends(get_db)
):
    """Validate response data for an endpoint"""
    service = SchemaService(db)
    
    return service.validate_endpoint_response(
        endpoint_path=endpoint_path,
        http_method=http_method,
        response_data=response_data,
        status_code=status_code,
        api_version=api_version
    )

# Sample Code Generation
@router.get("/sample-code/{language}")
async def get_schema_sample_code(
    language: str,
    schema_id: str = Query(..., description="Schema ID to generate code for"),
    validation_type: str = Query("request", description="request or response"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sample code for using schemas"""
    service = SchemaService(db)
    schema = service.get_schema(schema_id)
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found"
        )
    
    samples = {
        "python": f"""
# Python validation example using jsonschema
import json
import jsonschema
from jsonschema import validate

# Schema definition
schema = {json.dumps(schema.schema_content, indent=2)}

# Data to validate
data = {{
    # Your data here
}}

try:
    validate(instance=data, schema=schema)
    print("Validation passed!")
except jsonschema.exceptions.ValidationError as e:
    print(f"Validation failed: {{e.message}}")
    print(f"Failed at: {{list(e.path)}}")
""",
        "javascript": f"""
// JavaScript validation example using ajv
const Ajv = require('ajv');
const ajv = new Ajv();

// Schema definition
const schema = {json.dumps(schema.schema_content, indent=2)};

// Data to validate
const data = {{
    // Your data here
}};

// Compile and validate
const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {{
    console.log('Validation passed!');
}} else {{
    console.log('Validation failed:', validate.errors);
}}
""",
        "typescript": f"""
// TypeScript with type generation
import Ajv from 'ajv';
import {{ JSONSchema7 }} from 'json-schema';

const ajv = new Ajv();

// Schema definition
const schema: JSONSchema7 = {json.dumps(schema.schema_content, indent=2)};

// Generate TypeScript interface from schema
// Use json-schema-to-typescript for automatic type generation

// Validation function
const validate = ajv.compile(schema);

function validateData(data: unknown): data is YourType {{
    return validate(data) as boolean;
}}
""",
        "curl": f"""
# cURL example for API validation
curl -X POST https://your-api.com/api/schemas/{schema.id}/validate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{{
    "data": {{
        // Your data here
    }},
    "validation_type": "{validation_type}"
  }}'
"""
    }
    
    if language not in samples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{language}' not supported. Available: {list(samples.keys())}"
        )
    
    return {
        "language": language,
        "schema_name": schema.name,
        "schema_version": schema.schema_version,
        "code": samples[language]
    }