"""
Command Template API Routes
Provides endpoints for managing command templates
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from ..database import get_db
from ..models.command_template import (
    CommandTemplate, TemplateParameter, TemplateExecution,
    TemplateCategory, SharedTemplate
)
from ..auth.dependencies import get_current_user, check_permission
from ..schemas.template_schemas import (
    TemplateCreate, TemplateUpdate, TemplateResponse,
    TemplateParameterCreate, TemplateExecuteRequest,
    TemplateCategoryCreate, TemplateShareRequest,
    TemplateListResponse, TemplateExportData
)
from ..command_queue.command_factory import CommandFactory
from ..command_queue.command_schemas import CommandValidator

router = APIRouter(prefix="/api/templates", tags=["templates"])

# Initialize command factory and validator
command_factory = CommandFactory()
command_validator = CommandValidator()


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = Query(None),
    command_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_shared: bool = Query(True),
    include_system: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("name", regex="^(name|created_at|usage_count|last_used_at)$"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List command templates accessible to the current user
    """
    query = db.query(CommandTemplate).filter(CommandTemplate.is_active == True)
    
    # Filter by ownership and sharing
    if not include_system:
        query = query.filter(CommandTemplate.is_system == False)
    
    # Access control - user can see:
    # 1. Their own templates
    # 2. Public templates
    # 3. Organization templates (if they belong to an org)
    # 4. Shared templates
    # 5. System templates
    access_filter = db.query(CommandTemplate.id).filter(
        db.or_(
            CommandTemplate.created_by == current_user.id,
            CommandTemplate.is_public == True,
            CommandTemplate.is_system == True,
            db.and_(
                CommandTemplate.organization_id == current_user.organization_id,
                current_user.organization_id != None
            )
        )
    )
    
    if include_shared:
        # Include templates shared with user
        shared_query = db.query(SharedTemplate.template_id).filter(
            db.and_(
                SharedTemplate.shared_with_user_id == current_user.id,
                SharedTemplate.is_active == True,
                db.or_(
                    SharedTemplate.expires_at == None,
                    SharedTemplate.expires_at > datetime.utcnow()
                )
            )
        )
        access_filter = access_filter.union(shared_query)
    
    query = query.filter(CommandTemplate.id.in_(access_filter))
    
    # Apply filters
    if category:
        query = query.filter(CommandTemplate.category == category)
    
    if command_type:
        query = query.filter(CommandTemplate.command_type == command_type)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                CommandTemplate.name.ilike(search_pattern),
                CommandTemplate.description.ilike(search_pattern),
                CommandTemplate.tags.contains([search])
            )
        )
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    order_column = getattr(CommandTemplate, sort_by)
    if sort_order == "desc":
        order_column = order_column.desc()
    query = query.order_by(order_column)
    
    # Apply pagination
    offset = (page - 1) * page_size
    templates = query.offset(offset).limit(page_size).all()
    
    return TemplateListResponse(
        templates=[TemplateResponse.from_orm(t) for t in templates],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.get("/categories", response_model=List[TemplateCategoryCreate])
async def list_categories(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List available template categories
    """
    categories = db.query(TemplateCategory).order_by(
        TemplateCategory.display_order,
        TemplateCategory.name
    ).all()
    
    # Filter by role access if needed
    accessible_categories = []
    for cat in categories:
        if not cat.allowed_roles or any(role in current_user.roles for role in cat.allowed_roles):
            accessible_categories.append(cat)
    
    return accessible_categories


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get a specific template by ID
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check access
    if not _can_access_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment view count could be added here
    
    return TemplateResponse.from_orm(template)


@router.post("/", response_model=TemplateResponse)
async def create_template(
    template_data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Create a new command template
    """
    # Validate command type
    if template_data.command_type not in command_factory.get_registered_types():
        raise HTTPException(status_code=400, detail="Invalid command type")
    
    # Validate parameters against command schema
    try:
        test_command = {
            "id": str(uuid.uuid4()),
            "commandType": template_data.command_type,
            "parameters": template_data.parameters,
            "metadata": {
                "source": "template_validation",
                "tags": []
            }
        }
        command_validator.validate_command(test_command)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameters: {str(e)}")
    
    # Create template
    template = CommandTemplate(
        name=template_data.name,
        description=template_data.description,
        command_type=template_data.command_type,
        parameters=template_data.parameters,
        parameter_schema=template_data.parameter_schema,
        validation_rules=template_data.validation_rules,
        category=template_data.category,
        tags=template_data.tags,
        icon=template_data.icon,
        created_by=current_user.id,
        organization_id=current_user.organization_id,
        is_public=template_data.is_public,
        allowed_roles=template_data.allowed_roles
    )
    
    db.add(template)
    
    # Add parameter definitions if provided
    if template_data.parameter_definitions:
        for idx, param_def in enumerate(template_data.parameter_definitions):
            param = TemplateParameter(
                template_id=template.id,
                name=param_def.name,
                display_name=param_def.display_name,
                description=param_def.description,
                parameter_type=param_def.parameter_type,
                default_value=param_def.default_value,
                required=param_def.required,
                min_value=param_def.min_value,
                max_value=param_def.max_value,
                enum_values=param_def.enum_values,
                pattern=param_def.pattern,
                ui_component=param_def.ui_component,
                ui_config=param_def.ui_config,
                placeholder=param_def.placeholder,
                help_text=param_def.help_text,
                display_order=idx
            )
            db.add(param)
    
    db.commit()
    db.refresh(template)
    
    return TemplateResponse.from_orm(template)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template_update: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update an existing template
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check permissions
    if not _can_edit_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Cannot edit this template")
    
    # If parameters changed, validate them
    if template_update.parameters is not None:
        try:
            test_command = {
                "id": str(uuid.uuid4()),
                "commandType": template.command_type,
                "parameters": template_update.parameters,
                "metadata": {
                    "source": "template_validation",
                    "tags": []
                }
            }
            command_validator.validate_command(test_command)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid parameters: {str(e)}")
    
    # Update fields
    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(template, field):
            setattr(template, field, value)
    
    template.updated_at = datetime.utcnow()
    template.version += 1
    
    db.commit()
    db.refresh(template)
    
    return TemplateResponse.from_orm(template)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete a template (soft delete)
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check permissions
    if not _can_delete_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Cannot delete this template")
    
    # Soft delete
    template.is_active = False
    template.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Template deleted successfully"}


@router.post("/{template_id}/execute", response_model=Dict[str, Any])
async def execute_template(
    template_id: str,
    execution_request: TemplateExecuteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Execute a command template with provided parameters
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check access
    if not _can_access_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Merge template parameters with provided parameters
    final_parameters = template.parameters.copy()
    final_parameters.update(execution_request.parameter_values)
    
    # Validate final parameters
    try:
        command_data = {
            "commandType": template.command_type,
            "parameters": final_parameters,
            "priority": execution_request.priority,
            "metadata": {
                "source": f"template:{template.id}",
                "userId": current_user.id,
                "templateName": template.name,
                "tags": template.tags + execution_request.tags
            },
            "timeoutMs": execution_request.timeout_ms,
            "maxRetries": execution_request.max_retries
        }
        
        # Create command using factory
        command = command_factory.create_command(
            command_type=template.command_type,
            parameters=final_parameters,
            priority=execution_request.priority,
            metadata=command_data["metadata"],
            timeout_ms=execution_request.timeout_ms,
            max_retries=execution_request.max_retries
        )
        
        # Record execution
        execution = TemplateExecution(
            template_id=template.id,
            executed_by=current_user.id,
            command_id=command.id,
            final_parameters=final_parameters,
            execution_status="pending"
        )
        db.add(execution)
        
        # Update template usage
        template.usage_count += 1
        template.last_used_at = datetime.utcnow()
        
        db.commit()
        
        # Queue command (would integrate with command queue)
        # For now, return command details
        return {
            "command_id": command.id,
            "execution_id": execution.id,
            "status": "queued",
            "command": command_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to execute template: {str(e)}")


@router.post("/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(
    template_id: str,
    new_name: str = Body(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Create a copy of an existing template
    """
    original = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check access
    if not _can_access_template(original, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create duplicate
    duplicate = CommandTemplate(
        name=new_name,
        description=f"Copy of {original.description}" if original.description else None,
        command_type=original.command_type,
        parameters=original.parameters.copy(),
        parameter_schema=original.parameter_schema.copy(),
        validation_rules=original.validation_rules.copy(),
        category=original.category,
        tags=original.tags.copy(),
        icon=original.icon,
        created_by=current_user.id,
        organization_id=current_user.organization_id,
        is_public=False,  # Duplicates start as private
        allowed_roles=original.allowed_roles.copy(),
        parent_template_id=original.id
    )
    
    db.add(duplicate)
    
    # Copy parameter definitions
    for param in original.parameter_definitions:
        new_param = TemplateParameter(
            template_id=duplicate.id,
            name=param.name,
            display_name=param.display_name,
            description=param.description,
            parameter_type=param.parameter_type,
            default_value=param.default_value,
            required=param.required,
            min_value=param.min_value,
            max_value=param.max_value,
            enum_values=param.enum_values,
            pattern=param.pattern,
            ui_component=param.ui_component,
            ui_config=param.ui_config,
            placeholder=param.placeholder,
            help_text=param.help_text,
            display_order=param.display_order
        )
        db.add(new_param)
    
    db.commit()
    db.refresh(duplicate)
    
    return TemplateResponse.from_orm(duplicate)


@router.post("/{template_id}/share")
async def share_template(
    template_id: str,
    share_request: TemplateShareRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Share a template with another user or organization
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check permissions
    if not _can_share_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Cannot share this template")
    
    # Create share record
    share = SharedTemplate(
        template_id=template.id,
        shared_by=current_user.id,
        shared_with_user_id=share_request.user_id,
        shared_with_organization_id=share_request.organization_id,
        can_edit=share_request.can_edit,
        can_share=share_request.can_share,
        can_delete=share_request.can_delete,
        expires_at=share_request.expires_at
    )
    
    db.add(share)
    db.commit()
    
    return {"message": "Template shared successfully", "share_id": share.id}


@router.get("/{template_id}/export", response_model=TemplateExportData)
async def export_template(
    template_id: str,
    include_parameters: bool = Query(True),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export a template for backup or sharing
    """
    template = db.query(CommandTemplate).filter(
        CommandTemplate.id == template_id,
        CommandTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check access
    if not _can_access_template(template, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    export_data = TemplateExportData(
        template=TemplateResponse.from_orm(template),
        parameter_definitions=[
            TemplateParameterCreate.from_orm(p) 
            for p in template.parameter_definitions
        ] if include_parameters else [],
        export_version="1.0",
        exported_at=datetime.utcnow(),
        exported_by=current_user.id
    )
    
    return export_data


@router.post("/import", response_model=TemplateResponse)
async def import_template(
    import_data: TemplateExportData,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Import a template from export data
    """
    # Create new template from import
    template = CommandTemplate(
        name=f"{import_data.template.name} (Imported)",
        description=import_data.template.description,
        command_type=import_data.template.command_type,
        parameters=import_data.template.parameters,
        parameter_schema=import_data.template.parameter_schema,
        validation_rules=import_data.template.validation_rules,
        category=import_data.template.category,
        tags=import_data.template.tags + ["imported"],
        icon=import_data.template.icon,
        created_by=current_user.id,
        organization_id=current_user.organization_id,
        is_public=False,
        allowed_roles=[]
    )
    
    db.add(template)
    
    # Import parameter definitions
    for param_def in import_data.parameter_definitions:
        param = TemplateParameter(
            template_id=template.id,
            name=param_def.name,
            display_name=param_def.display_name,
            description=param_def.description,
            parameter_type=param_def.parameter_type,
            default_value=param_def.default_value,
            required=param_def.required,
            min_value=param_def.min_value,
            max_value=param_def.max_value,
            enum_values=param_def.enum_values,
            pattern=param_def.pattern,
            ui_component=param_def.ui_component,
            ui_config=param_def.ui_config,
            placeholder=param_def.placeholder,
            help_text=param_def.help_text,
            display_order=param_def.display_order
        )
        db.add(param)
    
    db.commit()
    db.refresh(template)
    
    return TemplateResponse.from_orm(template)


# Helper functions
def _can_access_template(template: CommandTemplate, user: Any, db: Session) -> bool:
    """Check if user can access a template"""
    # User owns it
    if template.created_by == user.id:
        return True
    
    # Template is public or system
    if template.is_public or template.is_system:
        return True
    
    # Same organization
    if template.organization_id and template.organization_id == user.organization_id:
        return True
    
    # Shared with user
    share = db.query(SharedTemplate).filter(
        SharedTemplate.template_id == template.id,
        SharedTemplate.shared_with_user_id == user.id,
        SharedTemplate.is_active == True
    ).first()
    
    if share and (not share.expires_at or share.expires_at > datetime.utcnow()):
        return True
    
    # Check role-based access
    if template.allowed_roles:
        return any(role in user.roles for role in template.allowed_roles)
    
    return False


def _can_edit_template(template: CommandTemplate, user: Any, db: Session) -> bool:
    """Check if user can edit a template"""
    # User owns it
    if template.created_by == user.id:
        return True
    
    # System templates cannot be edited
    if template.is_system:
        return False
    
    # Check share permissions
    share = db.query(SharedTemplate).filter(
        SharedTemplate.template_id == template.id,
        SharedTemplate.shared_with_user_id == user.id,
        SharedTemplate.is_active == True,
        SharedTemplate.can_edit == True
    ).first()
    
    return share is not None


def _can_delete_template(template: CommandTemplate, user: Any, db: Session) -> bool:
    """Check if user can delete a template"""
    # Only owner can delete
    if template.created_by == user.id:
        return True
    
    # System templates cannot be deleted
    if template.is_system:
        return False
    
    # Check share permissions
    share = db.query(SharedTemplate).filter(
        SharedTemplate.template_id == template.id,
        SharedTemplate.shared_with_user_id == user.id,
        SharedTemplate.is_active == True,
        SharedTemplate.can_delete == True
    ).first()
    
    return share is not None


def _can_share_template(template: CommandTemplate, user: Any, db: Session) -> bool:
    """Check if user can share a template"""
    # Owner can share
    if template.created_by == user.id:
        return True
    
    # Check share permissions
    share = db.query(SharedTemplate).filter(
        SharedTemplate.template_id == template.id,
        SharedTemplate.shared_with_user_id == user.id,
        SharedTemplate.is_active == True,
        SharedTemplate.can_share == True
    ).first()
    
    return share is not None