"""
Service layer for API schema validation and management
"""
import re
import json
import uuid
from typing import List, Optional, Dict, Any, Tuple, Union
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from fastapi import HTTPException, status
import jsonschema
from jsonschema import Draft7Validator, ValidationError
import yaml

from .schema_models import (
    SchemaDefinition, SchemaType, SchemaStatus, ValidationSeverity,
    ValidationRuleType, ValidationRule, SchemaVersion, ValidationLog,
    SchemaEndpointMapping, SchemaRegistry, ValidationMetrics
)
from ..auth.models import User
from ..rbac.rbac_service import RBACService


class SchemaService:
    """Service for managing API schema validation"""
    
    def __init__(self, db: Session):
        self.db = db
        self.rbac = RBACService(db)
    
    # Schema CRUD Operations
    def create_schema(
        self,
        name: str,
        schema_content: Dict[str, Any],
        schema_version: str,
        current_user: User,
        description: Optional[str] = None,
        schema_type: SchemaType = SchemaType.JSON_SCHEMA,
        namespace: Optional[str] = None,
        tags: Optional[List[str]] = None,
        status: SchemaStatus = SchemaStatus.DRAFT
    ) -> SchemaDefinition:
        """Create a new schema definition"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "schema_definitions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create schemas"
            )
        
        # Validate schema content
        if schema_type == SchemaType.JSON_SCHEMA:
            try:
                Draft7Validator.check_schema(schema_content)
            except jsonschema.SchemaError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid JSON Schema: {str(e)}"
                )
        
        # Check for duplicate schema
        existing = self.db.query(SchemaDefinition).filter(
            SchemaDefinition.namespace == namespace,
            SchemaDefinition.name == name,
            SchemaDefinition.schema_version == schema_version
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Schema '{name}' version '{schema_version}' already exists in namespace '{namespace}'"
            )
        
        # Create schema
        schema = SchemaDefinition(
            name=name,
            description=description,
            schema_type=schema_type,
            schema_content=schema_content,
            schema_version=schema_version,
            status=status,
            created_by=current_user.id,
            namespace=namespace,
            tags=tags or []
        )
        
        self.db.add(schema)
        
        # Create initial version
        initial_version = SchemaVersion(
            schema_id=schema.id,
            version_number=schema_version,
            change_description="Initial version",
            schema_content=schema_content,
            created_by=current_user.id
        )
        
        self.db.add(initial_version)
        self.db.commit()
        self.db.refresh(schema)
        
        return schema
    
    def get_schema(self, schema_id: str) -> Optional[SchemaDefinition]:
        """Get a schema by ID"""
        return self.db.query(SchemaDefinition).filter(
            SchemaDefinition.id == schema_id
        ).first()
    
    def get_schemas(
        self,
        namespace: Optional[str] = None,
        schema_type: Optional[SchemaType] = None,
        status: Optional[SchemaStatus] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> List[SchemaDefinition]:
        """Get all schemas with optional filters"""
        query = self.db.query(SchemaDefinition)
        
        if namespace:
            query = query.filter(SchemaDefinition.namespace == namespace)
        
        if schema_type:
            query = query.filter(SchemaDefinition.schema_type == schema_type)
        
        if status:
            query = query.filter(SchemaDefinition.status == status)
        
        if tags:
            # Filter by tags (schemas that have any of the provided tags)
            query = query.filter(
                func.json_contains(SchemaDefinition.tags, json.dumps(tags))
            )
        
        if search:
            query = query.filter(
                or_(
                    SchemaDefinition.name.ilike(f"%{search}%"),
                    SchemaDefinition.description.ilike(f"%{search}%"),
                    SchemaDefinition.namespace.ilike(f"%{search}%")
                )
            )
        
        return query.order_by(SchemaDefinition.created_at.desc()).all()
    
    def update_schema(
        self,
        schema_id: str,
        updates: Dict[str, Any],
        current_user: User,
        create_version: bool = True
    ) -> SchemaDefinition:
        """Update a schema definition"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "schema_definitions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update schemas"
            )
        
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        # If updating schema content, validate it
        if 'schema_content' in updates and schema.schema_type == SchemaType.JSON_SCHEMA:
            try:
                Draft7Validator.check_schema(updates['schema_content'])
            except jsonschema.SchemaError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid JSON Schema: {str(e)}"
                )
        
        # Create new version if schema content changed
        if create_version and 'schema_content' in updates:
            new_version = self._create_schema_version(
                schema=schema,
                new_content=updates['schema_content'],
                version_number=updates.get('schema_version', self._increment_version(schema.schema_version)),
                change_description=updates.get('change_description', 'Schema updated'),
                breaking_changes=updates.get('breaking_changes', False),
                migration_guide=updates.get('migration_guide'),
                current_user=current_user
            )
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(schema, key) and key not in ['id', 'created_at', 'created_by']:
                setattr(schema, key, value)
        
        schema.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(schema)
        
        return schema
    
    def delete_schema(self, schema_id: str, current_user: User) -> bool:
        """Delete a schema definition"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "schema_definitions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete schemas"
            )
        
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        # Check if schema is in use
        active_mappings = self.db.query(SchemaEndpointMapping).filter(
            or_(
                SchemaEndpointMapping.request_schema_id == schema_id,
                SchemaEndpointMapping.response_schema_id == schema_id
            ),
            SchemaEndpointMapping.enabled == True
        ).count()
        
        if active_mappings > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete schema: {active_mappings} active endpoint mappings exist"
            )
        
        # Delete schema (cascades to versions and logs)
        self.db.delete(schema)
        self.db.commit()
        
        return True
    
    # Version Management
    def create_schema_version(
        self,
        schema_id: str,
        version_number: str,
        change_description: str,
        schema_content: Dict[str, Any],
        current_user: User,
        breaking_changes: bool = False,
        migration_guide: Optional[str] = None
    ) -> SchemaVersion:
        """Create a new version of a schema"""
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        return self._create_schema_version(
            schema=schema,
            new_content=schema_content,
            version_number=version_number,
            change_description=change_description,
            breaking_changes=breaking_changes,
            migration_guide=migration_guide,
            current_user=current_user
        )
    
    def get_schema_versions(self, schema_id: str) -> List[SchemaVersion]:
        """Get all versions of a schema"""
        return self.db.query(SchemaVersion).filter(
            SchemaVersion.schema_id == schema_id
        ).order_by(SchemaVersion.created_at.desc()).all()
    
    def migrate_schema_version(
        self,
        schema_id: str,
        from_version: str,
        to_version: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Migrate data from one schema version to another"""
        # Get versions
        from_ver = self.db.query(SchemaVersion).filter(
            SchemaVersion.schema_id == schema_id,
            SchemaVersion.version_number == from_version
        ).first()
        
        to_ver = self.db.query(SchemaVersion).filter(
            SchemaVersion.schema_id == schema_id,
            SchemaVersion.version_number == to_version
        ).first()
        
        if not from_ver or not to_ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version not found"
            )
        
        # TODO: Implement actual migration logic based on schema differences
        # For now, return data as-is with a warning
        return {
            "migrated_data": data,
            "from_version": from_version,
            "to_version": to_version,
            "warnings": ["Migration logic not implemented - data returned as-is"]
        }
    
    # OpenAPI/Swagger Import
    def import_openapi(
        self,
        openapi_spec: Dict[str, Any],
        current_user: User,
        namespace: Optional[str] = None
    ) -> List[SchemaDefinition]:
        """Import schemas from OpenAPI/Swagger specification"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "schema_definitions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to import schemas"
            )
        
        # Detect OpenAPI version
        openapi_version = openapi_spec.get('openapi', openapi_spec.get('swagger', '2.0'))
        
        # Extract info
        info = openapi_spec.get('info', {})
        api_title = info.get('title', 'Imported API')
        api_version = info.get('version', '1.0.0')
        
        # Parse components/definitions
        if openapi_version.startswith('3'):
            schemas = openapi_spec.get('components', {}).get('schemas', {})
            schema_type = SchemaType.OPENAPI
        else:
            schemas = openapi_spec.get('definitions', {})
            schema_type = SchemaType.SWAGGER
        
        created_schemas = []
        
        # Create schema definitions
        for schema_name, schema_content in schemas.items():
            try:
                schema_def = self.create_schema(
                    name=schema_name,
                    schema_content=schema_content,
                    schema_version=api_version,
                    current_user=current_user,
                    description=schema_content.get('description', f"Imported from {api_title}"),
                    schema_type=schema_type,
                    namespace=namespace or api_title.lower().replace(' ', '_'),
                    tags=['imported', 'openapi'],
                    status=SchemaStatus.ACTIVE
                )
                
                # Store import metadata
                schema_def.imported_from = f"OpenAPI {openapi_version}"
                schema_def.import_timestamp = datetime.now(timezone.utc)
                schema_def.openapi_version = openapi_version
                
                created_schemas.append(schema_def)
            except Exception as e:
                # Log error but continue with other schemas
                print(f"Failed to import schema '{schema_name}': {str(e)}")
        
        # Create endpoint mappings from paths
        if 'paths' in openapi_spec:
            self._create_endpoint_mappings_from_openapi(
                openapi_spec['paths'],
                created_schemas,
                current_user
            )
        
        self.db.commit()
        
        return created_schemas
    
    # Validation Execution
    def validate_data(
        self,
        schema_id: str,
        data: Dict[str, Any],
        validation_type: str = "request",
        include_warnings: bool = True
    ) -> Dict[str, Any]:
        """Validate data against a schema"""
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "schema_id": schema_id,
            "schema_name": schema.name,
            "validation_timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # JSON Schema validation
        if schema.schema_type == SchemaType.JSON_SCHEMA:
            validator = Draft7Validator(schema.schema_content)
            errors = list(validator.iter_errors(data))
            
            if errors:
                result["valid"] = False
                result["errors"] = [
                    {
                        "path": list(error.path),
                        "message": error.message,
                        "validator": error.validator,
                        "validator_value": error.validator_value
                    }
                    for error in errors
                ]
        
        # Apply custom validation rules
        custom_errors, custom_warnings = self._apply_custom_rules(
            schema_id, data, validation_type
        )
        
        result["errors"].extend(custom_errors)
        if include_warnings:
            result["warnings"].extend(custom_warnings)
        
        if custom_errors:
            result["valid"] = False
        
        return result
    
    def validate_endpoint_request(
        self,
        endpoint_path: str,
        http_method: str,
        request_data: Dict[str, Any],
        api_version: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate request data for a specific endpoint"""
        mapping = self._get_endpoint_mapping(endpoint_path, http_method, api_version)
        
        if not mapping or not mapping.validate_request:
            return {"valid": True, "message": "No validation configured for this endpoint"}
        
        if not mapping.request_schema_id:
            return {"valid": True, "message": "No request schema defined"}
        
        # Perform validation
        result = self.validate_data(
            mapping.request_schema_id,
            request_data,
            validation_type="request"
        )
        
        # Log validation result
        self._log_validation(
            endpoint=endpoint_path,
            http_method=http_method,
            schema_id=mapping.request_schema_id,
            validation_type="request",
            validation_result="passed" if result["valid"] else "failed",
            errors=result.get("errors", []),
            request_data=request_data
        )
        
        return result
    
    def validate_endpoint_response(
        self,
        endpoint_path: str,
        http_method: str,
        response_data: Dict[str, Any],
        status_code: int = 200,
        api_version: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate response data for a specific endpoint"""
        mapping = self._get_endpoint_mapping(endpoint_path, http_method, api_version)
        
        if not mapping or not mapping.validate_response:
            return {"valid": True, "message": "No validation configured for this endpoint"}
        
        # Check for status-specific schema
        schema_id = None
        if mapping.response_schemas_by_status:
            schema_id = mapping.response_schemas_by_status.get(str(status_code))
        
        if not schema_id:
            schema_id = mapping.response_schema_id
        
        if not schema_id:
            return {"valid": True, "message": "No response schema defined"}
        
        # Perform validation
        result = self.validate_data(
            schema_id,
            response_data,
            validation_type="response"
        )
        
        # Log validation result
        self._log_validation(
            endpoint=endpoint_path,
            http_method=http_method,
            schema_id=schema_id,
            validation_type="response",
            validation_result="passed" if result["valid"] else "failed",
            errors=result.get("errors", []),
            response_data=response_data,
            response_status=status_code
        )
        
        return result
    
    # Custom Validation Rules
    def create_validation_rule(
        self,
        name: str,
        error_message: str,
        current_user: User,
        description: Optional[str] = None,
        rule_type: ValidationRuleType = ValidationRuleType.CUSTOM_FUNCTION,
        severity: ValidationSeverity = ValidationSeverity.ERROR,
        field_path: Optional[str] = None,
        condition: Optional[Dict[str, Any]] = None,
        validator_function: Optional[str] = None,
        validator_imports: Optional[List[str]] = None,
        applies_to: str = "both",
        http_methods: Optional[List[str]] = None
    ) -> ValidationRule:
        """Create a custom validation rule"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "validation_rules"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create validation rules"
            )
        
        # Validate custom function if provided
        if validator_function:
            self._validate_custom_function(validator_function, validator_imports)
        
        rule = ValidationRule(
            name=name,
            description=description,
            rule_type=rule_type,
            severity=severity,
            field_path=field_path,
            condition=condition,
            error_message=error_message,
            validator_function=validator_function,
            validator_imports=validator_imports,
            applies_to=applies_to,
            http_methods=http_methods,
            created_by=current_user.id
        )
        
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        
        return rule
    
    def attach_rule_to_schema(
        self,
        schema_id: str,
        rule_id: str,
        current_user: User
    ) -> bool:
        """Attach a validation rule to a schema"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "schema_definitions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to modify schema rules"
            )
        
        schema = self.get_schema(schema_id)
        rule = self.db.query(ValidationRule).filter(
            ValidationRule.id == rule_id
        ).first()
        
        if not schema or not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema or rule not found"
            )
        
        if rule not in schema.validation_rules:
            schema.validation_rules.append(rule)
            self.db.commit()
        
        return True
    
    # Endpoint Mapping Management
    def create_endpoint_mapping(
        self,
        endpoint_path: str,
        http_method: str,
        current_user: User,
        request_schema_id: Optional[str] = None,
        response_schema_id: Optional[str] = None,
        response_schemas_by_status: Optional[Dict[str, str]] = None,
        validate_request: bool = True,
        validate_response: bool = True,
        strict_validation: bool = False,
        api_version: Optional[str] = None
    ) -> SchemaEndpointMapping:
        """Create an endpoint mapping"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "schema:write", "endpoint_mappings"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create endpoint mappings"
            )
        
        # Check for existing mapping
        existing = self.db.query(SchemaEndpointMapping).filter(
            SchemaEndpointMapping.endpoint_path == endpoint_path,
            SchemaEndpointMapping.http_method == http_method.upper(),
            SchemaEndpointMapping.api_version == api_version
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mapping already exists for this endpoint"
            )
        
        mapping = SchemaEndpointMapping(
            endpoint_path=endpoint_path,
            http_method=http_method.upper(),
            request_schema_id=request_schema_id,
            response_schema_id=response_schema_id,
            response_schemas_by_status=response_schemas_by_status,
            validate_request=validate_request,
            validate_response=validate_response,
            strict_validation=strict_validation,
            api_version=api_version,
            created_by=current_user.id
        )
        
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        
        return mapping
    
    def get_endpoint_mappings(
        self,
        endpoint_path: Optional[str] = None,
        http_method: Optional[str] = None,
        api_version: Optional[str] = None,
        enabled_only: bool = True
    ) -> List[SchemaEndpointMapping]:
        """Get endpoint mappings with filters"""
        query = self.db.query(SchemaEndpointMapping)
        
        if endpoint_path:
            query = query.filter(SchemaEndpointMapping.endpoint_path == endpoint_path)
        
        if http_method:
            query = query.filter(SchemaEndpointMapping.http_method == http_method.upper())
        
        if api_version:
            query = query.filter(SchemaEndpointMapping.api_version == api_version)
        
        if enabled_only:
            query = query.filter(SchemaEndpointMapping.enabled == True)
        
        return query.order_by(SchemaEndpointMapping.created_at.desc()).all()
    
    # Export Functionality
    def export_schema(
        self,
        schema_id: str,
        export_format: str = "json_schema",
        include_custom_rules: bool = False
    ) -> Dict[str, Any]:
        """Export a schema in various formats"""
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        export_data = {
            "schema_id": schema.id,
            "name": schema.name,
            "version": schema.schema_version,
            "exported_at": datetime.now(timezone.utc).isoformat()
        }
        
        if export_format == "json_schema":
            export_data["schema"] = schema.schema_content
        
        elif export_format == "openapi":
            # Convert to OpenAPI format
            export_data["openapi"] = "3.0.0"
            export_data["info"] = {
                "title": schema.name,
                "version": schema.schema_version,
                "description": schema.description
            }
            export_data["components"] = {
                "schemas": {
                    schema.name: schema.schema_content
                }
            }
        
        if include_custom_rules:
            export_data["custom_rules"] = [
                {
                    "name": rule.name,
                    "type": rule.rule_type,
                    "severity": rule.severity,
                    "field_path": rule.field_path,
                    "condition": rule.condition,
                    "error_message": rule.error_message
                }
                for rule in schema.validation_rules
            ]
        
        return export_data
    
    def export_all_schemas(
        self,
        namespace: Optional[str] = None,
        export_format: str = "openapi"
    ) -> Dict[str, Any]:
        """Export all schemas in a namespace"""
        schemas = self.get_schemas(namespace=namespace, status=SchemaStatus.ACTIVE)
        
        if export_format == "openapi":
            export_data = {
                "openapi": "3.0.0",
                "info": {
                    "title": f"{namespace or 'All'} Schemas",
                    "version": "1.0.0",
                    "description": f"Exported schemas from namespace: {namespace or 'all'}"
                },
                "components": {
                    "schemas": {}
                }
            }
            
            for schema in schemas:
                export_data["components"]["schemas"][schema.name] = schema.schema_content
        
        else:
            export_data = {
                "namespace": namespace,
                "schemas": [
                    self.export_schema(schema.id, export_format)
                    for schema in schemas
                ]
            }
        
        return export_data
    
    # Validation Metrics and Analytics
    def get_validation_metrics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        endpoint: Optional[str] = None,
        schema_id: Optional[str] = None
    ) -> List[ValidationMetrics]:
        """Get aggregated validation metrics"""
        query = self.db.query(ValidationMetrics)
        
        if start_date:
            query = query.filter(ValidationMetrics.period_start >= start_date)
        
        if end_date:
            query = query.filter(ValidationMetrics.period_end <= end_date)
        
        if endpoint:
            query = query.filter(ValidationMetrics.endpoint == endpoint)
        
        if schema_id:
            query = query.filter(ValidationMetrics.schema_id == schema_id)
        
        return query.order_by(ValidationMetrics.period_start.desc()).all()
    
    def generate_validation_report(
        self,
        schema_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate a validation report for a schema"""
        schema = self.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schema not found"
            )
        
        # Get validation logs
        logs_query = self.db.query(ValidationLog).filter(
            ValidationLog.schema_id == schema_id
        )
        
        if start_date:
            logs_query = logs_query.filter(ValidationLog.timestamp >= start_date)
        
        if end_date:
            logs_query = logs_query.filter(ValidationLog.timestamp <= end_date)
        
        logs = logs_query.all()
        
        # Calculate statistics
        total_validations = len(logs)
        failed_validations = sum(1 for log in logs if log.validation_result == "failed")
        passed_validations = sum(1 for log in logs if log.validation_result == "passed")
        
        # Common error patterns
        error_patterns = {}
        for log in logs:
            if log.errors:
                for error in log.errors:
                    pattern = error.get("message", "Unknown error")
                    error_patterns[pattern] = error_patterns.get(pattern, 0) + 1
        
        # Sort error patterns by frequency
        top_errors = sorted(
            error_patterns.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            "schema_id": schema_id,
            "schema_name": schema.name,
            "report_period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            },
            "statistics": {
                "total_validations": total_validations,
                "passed": passed_validations,
                "failed": failed_validations,
                "pass_rate": (passed_validations / total_validations * 100) if total_validations > 0 else 0
            },
            "top_errors": [
                {"error": error, "count": count}
                for error, count in top_errors
            ],
            "endpoints": self._get_endpoint_statistics(logs)
        }
    
    # Helper Methods
    def _create_schema_version(
        self,
        schema: SchemaDefinition,
        new_content: Dict[str, Any],
        version_number: str,
        change_description: str,
        breaking_changes: bool,
        migration_guide: Optional[str],
        current_user: User
    ) -> SchemaVersion:
        """Create a new schema version"""
        # Check if version already exists
        existing = self.db.query(SchemaVersion).filter(
            SchemaVersion.schema_id == schema.id,
            SchemaVersion.version_number == version_number
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Version {version_number} already exists"
            )
        
        version = SchemaVersion(
            schema_id=schema.id,
            version_number=version_number,
            change_description=change_description,
            breaking_changes=breaking_changes,
            migration_guide=migration_guide,
            schema_content=new_content,
            created_by=current_user.id
        )
        
        self.db.add(version)
        return version
    
    def _increment_version(self, current_version: str) -> str:
        """Increment semantic version"""
        parts = current_version.split('.')
        if len(parts) != 3:
            return current_version + ".1"
        
        try:
            major, minor, patch = map(int, parts)
            return f"{major}.{minor}.{patch + 1}"
        except ValueError:
            return current_version + ".1"
    
    def _apply_custom_rules(
        self,
        schema_id: str,
        data: Dict[str, Any],
        validation_type: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Apply custom validation rules"""
        errors = []
        warnings = []
        
        schema = self.get_schema(schema_id)
        if not schema:
            return errors, warnings
        
        for rule in schema.validation_rules:
            if not rule.enabled:
                continue
            
            # Check if rule applies to this validation type
            if rule.applies_to != "both" and rule.applies_to != validation_type:
                continue
            
            # Execute rule based on type
            if rule.rule_type == ValidationRuleType.REQUIRED_FIELD:
                if rule.field_path and not self._get_field_value(data, rule.field_path):
                    error = {
                        "rule": rule.name,
                        "field": rule.field_path,
                        "message": rule.error_message,
                        "severity": rule.severity
                    }
                    if rule.severity == ValidationSeverity.ERROR:
                        errors.append(error)
                    else:
                        warnings.append(error)
            
            elif rule.rule_type == ValidationRuleType.CUSTOM_FUNCTION and rule.validator_function:
                try:
                    result = self._execute_custom_validator(
                        rule.validator_function,
                        rule.validator_imports,
                        data
                    )
                    if not result["valid"]:
                        error = {
                            "rule": rule.name,
                            "message": result.get("message", rule.error_message),
                            "severity": rule.severity
                        }
                        if rule.severity == ValidationSeverity.ERROR:
                            errors.append(error)
                        else:
                            warnings.append(error)
                except Exception as e:
                    errors.append({
                        "rule": rule.name,
                        "message": f"Validation rule execution failed: {str(e)}",
                        "severity": ValidationSeverity.ERROR
                    })
        
        return errors, warnings
    
    def _get_field_value(self, data: Dict[str, Any], field_path: str) -> Any:
        """Get value from nested dictionary using dot notation"""
        parts = field_path.split('.')
        value = data
        
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return None
        
        return value
    
    def _validate_custom_function(self, function_code: str, imports: Optional[List[str]]) -> None:
        """Validate custom function code"""
        # Basic security checks
        forbidden_imports = ['os', 'subprocess', 'eval', 'exec', '__import__']
        forbidden_keywords = ['eval', 'exec', 'compile', '__import__', 'open', 'file']
        
        if imports:
            for imp in imports:
                if any(forbidden in imp for forbidden in forbidden_imports):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Forbidden import: {imp}"
                    )
        
        for keyword in forbidden_keywords:
            if keyword in function_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Forbidden keyword in function: {keyword}"
                )
    
    def _execute_custom_validator(
        self,
        function_code: str,
        imports: Optional[List[str]],
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute custom validator function"""
        # Create safe execution environment
        safe_globals = {
            '__builtins__': {
                'len': len,
                'str': str,
                'int': int,
                'float': float,
                'bool': bool,
                'list': list,
                'dict': dict,
                'isinstance': isinstance,
                'type': type,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'any': any,
                'all': all,
                'sum': sum,
                'min': min,
                'max': max
            }
        }
        
        # Add allowed imports
        if imports:
            for imp in imports:
                if imp == 're':
                    safe_globals['re'] = re
                elif imp == 'json':
                    safe_globals['json'] = json
                elif imp == 'datetime':
                    from datetime import datetime as dt
                    safe_globals['datetime'] = dt
        
        # Create function namespace
        namespace = {}
        
        try:
            # Execute function definition
            exec(function_code, safe_globals, namespace)
            
            # Find the validator function
            validator_func = None
            for name, obj in namespace.items():
                if callable(obj) and name.startswith('validate'):
                    validator_func = obj
                    break
            
            if not validator_func:
                return {"valid": False, "message": "No validator function found"}
            
            # Execute validator
            result = validator_func(data)
            
            # Ensure result is in expected format
            if isinstance(result, bool):
                return {"valid": result}
            elif isinstance(result, dict):
                return result
            else:
                return {"valid": False, "message": "Invalid validator return type"}
        
        except Exception as e:
            return {"valid": False, "message": f"Validator execution error: {str(e)}"}
    
    def _get_endpoint_mapping(
        self,
        endpoint_path: str,
        http_method: str,
        api_version: Optional[str]
    ) -> Optional[SchemaEndpointMapping]:
        """Get endpoint mapping for validation"""
        # Try exact match first
        mapping = self.db.query(SchemaEndpointMapping).filter(
            SchemaEndpointMapping.endpoint_path == endpoint_path,
            SchemaEndpointMapping.http_method == http_method.upper(),
            SchemaEndpointMapping.api_version == api_version,
            SchemaEndpointMapping.enabled == True
        ).first()
        
        if mapping:
            return mapping
        
        # Try pattern matching (for parameterized endpoints)
        all_mappings = self.db.query(SchemaEndpointMapping).filter(
            SchemaEndpointMapping.http_method == http_method.upper(),
            SchemaEndpointMapping.api_version == api_version,
            SchemaEndpointMapping.enabled == True
        ).all()
        
        for mapping in all_mappings:
            # Convert path pattern to regex
            pattern = mapping.endpoint_path
            pattern = pattern.replace('{', '(?P<')
            pattern = pattern.replace('}', '>[^/]+)')
            pattern = f"^{pattern}$"
            
            if re.match(pattern, endpoint_path):
                return mapping
        
        return None
    
    def _log_validation(
        self,
        endpoint: str,
        http_method: str,
        schema_id: str,
        validation_type: str,
        validation_result: str,
        errors: List[Dict[str, Any]],
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None,
        response_status: Optional[int] = None
    ) -> None:
        """Log validation result"""
        log = ValidationLog(
            request_id=str(uuid.uuid4()),  # Should be passed from request context
            endpoint=endpoint,
            http_method=http_method,
            schema_id=schema_id,
            validation_type=validation_type,
            validation_result=validation_result,
            errors=errors,
            error_count=len([e for e in errors if e.get("severity") == ValidationSeverity.ERROR]),
            warning_count=len([e for e in errors if e.get("severity") == ValidationSeverity.WARNING]),
            request_body=self._sanitize_data(request_data) if request_data else None,
            response_body=self._sanitize_data(response_data) if response_data else None,
            response_status=response_status
        )
        
        self.db.add(log)
        self.db.commit()
    
    def _sanitize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize sensitive data before logging"""
        sensitive_fields = [
            'password', 'token', 'secret', 'api_key', 'authorization',
            'credit_card', 'ssn', 'private_key'
        ]
        
        def sanitize_dict(d: Dict[str, Any]) -> Dict[str, Any]:
            sanitized = {}
            for key, value in d.items():
                if any(field in key.lower() for field in sensitive_fields):
                    sanitized[key] = "***REDACTED***"
                elif isinstance(value, dict):
                    sanitized[key] = sanitize_dict(value)
                elif isinstance(value, list):
                    sanitized[key] = [
                        sanitize_dict(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    sanitized[key] = value
            return sanitized
        
        return sanitize_dict(data)
    
    def _create_endpoint_mappings_from_openapi(
        self,
        paths: Dict[str, Any],
        schemas: List[SchemaDefinition],
        current_user: User
    ) -> None:
        """Create endpoint mappings from OpenAPI paths"""
        schema_map = {schema.name: schema.id for schema in schemas}
        
        for path, path_item in paths.items():
            for method, operation in path_item.items():
                if method.upper() not in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    continue
                
                # Extract request schema
                request_schema_id = None
                if 'requestBody' in operation:
                    content = operation['requestBody'].get('content', {})
                    if 'application/json' in content:
                        schema_ref = content['application/json'].get('schema', {})
                        if '$ref' in schema_ref:
                            schema_name = schema_ref['$ref'].split('/')[-1]
                            request_schema_id = schema_map.get(schema_name)
                
                # Extract response schemas
                response_schemas_by_status = {}
                responses = operation.get('responses', {})
                
                for status_code, response in responses.items():
                    if 'content' in response:
                        content = response['content']
                        if 'application/json' in content:
                            schema_ref = content['application/json'].get('schema', {})
                            if '$ref' in schema_ref:
                                schema_name = schema_ref['$ref'].split('/')[-1]
                                if schema_name in schema_map:
                                    response_schemas_by_status[status_code] = schema_map[schema_name]
                
                # Create mapping
                try:
                    self.create_endpoint_mapping(
                        endpoint_path=path,
                        http_method=method.upper(),
                        current_user=current_user,
                        request_schema_id=request_schema_id,
                        response_schemas_by_status=response_schemas_by_status,
                        description=operation.get('summary', operation.get('description'))
                    )
                except Exception:
                    # Skip if mapping already exists
                    pass
    
    def _get_endpoint_statistics(self, logs: List[ValidationLog]) -> Dict[str, Any]:
        """Calculate endpoint statistics from validation logs"""
        endpoint_stats = {}
        
        for log in logs:
            endpoint = log.endpoint
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {
                    "total": 0,
                    "passed": 0,
                    "failed": 0,
                    "common_errors": {}
                }
            
            endpoint_stats[endpoint]["total"] += 1
            
            if log.validation_result == "passed":
                endpoint_stats[endpoint]["passed"] += 1
            else:
                endpoint_stats[endpoint]["failed"] += 1
                
                # Track common errors
                if log.errors:
                    for error in log.errors:
                        error_msg = error.get("message", "Unknown")
                        if error_msg not in endpoint_stats[endpoint]["common_errors"]:
                            endpoint_stats[endpoint]["common_errors"][error_msg] = 0
                        endpoint_stats[endpoint]["common_errors"][error_msg] += 1
        
        # Convert to list and add pass rates
        result = []
        for endpoint, stats in endpoint_stats.items():
            stats["endpoint"] = endpoint
            stats["pass_rate"] = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            
            # Get top 3 common errors
            if stats["common_errors"]:
                top_errors = sorted(
                    stats["common_errors"].items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:3]
                stats["top_errors"] = [
                    {"error": error, "count": count}
                    for error, count in top_errors
                ]
            else:
                stats["top_errors"] = []
            
            del stats["common_errors"]
            result.append(stats)
        
        return sorted(result, key=lambda x: x["total"], reverse=True)