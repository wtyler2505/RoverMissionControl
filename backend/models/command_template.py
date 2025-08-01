"""
Command Template Models for Database Storage
"""

from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


class CommandTemplate(Base):
    """
    Command template storage model
    Stores reusable command configurations with parameterization
    """
    __tablename__ = 'command_templates'
    
    # Primary fields
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    command_type = Column(String(50), nullable=False)  # Maps to CommandType enum
    
    # Template configuration
    parameters = Column(JSON, nullable=False, default=dict)  # Pre-filled parameters
    parameter_schema = Column(JSON, nullable=False, default=dict)  # Schema defining variable parameters
    validation_rules = Column(JSON, default=dict)  # Custom validation rules
    
    # Categorization
    category = Column(String(50), default='general')
    tags = Column(JSON, default=list)  # Array of tags
    icon = Column(String(50))  # Icon identifier for UI
    
    # Access control
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    organization_id = Column(String, ForeignKey('organizations.id'))
    is_public = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)  # System-provided templates
    
    # Role-based access
    allowed_roles = Column(JSON, default=list)  # Array of role IDs
    
    # Version control
    version = Column(Integer, default=1)
    parent_template_id = Column(String, ForeignKey('command_templates.id'))
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    
    # Relationships
    creator = relationship("User", back_populates="command_templates")
    organization = relationship("Organization", back_populates="command_templates")
    versions = relationship("CommandTemplate", backref="parent_template")
    executions = relationship("TemplateExecution", back_populates="template")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_template_category', 'category'),
        Index('idx_template_type', 'command_type'),
        Index('idx_template_org', 'organization_id'),
        Index('idx_template_creator', 'created_by'),
        Index('idx_template_active', 'is_active'),
    )


class TemplateParameter(Base):
    """
    Defines variable parameters within a template
    """
    __tablename__ = 'template_parameters'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey('command_templates.id'), nullable=False)
    
    # Parameter definition
    name = Column(String(50), nullable=False)  # Parameter name/key
    display_name = Column(String(100))  # Human-readable name
    description = Column(Text)
    
    # Type and validation
    parameter_type = Column(String(20), nullable=False)  # string, number, boolean, enum, date
    default_value = Column(JSON)
    required = Column(Boolean, default=True)
    
    # Constraints
    min_value = Column(JSON)  # For numeric types
    max_value = Column(JSON)
    enum_values = Column(JSON)  # For enum types
    pattern = Column(String)  # Regex pattern for strings
    
    # UI hints
    ui_component = Column(String(50))  # text, number, select, slider, date-picker
    ui_config = Column(JSON)  # Component-specific configuration
    placeholder = Column(String(200))
    help_text = Column(Text)
    
    # Ordering
    display_order = Column(Integer, default=0)
    
    # Relationships
    template = relationship("CommandTemplate", backref="parameter_definitions")
    
    __table_args__ = (
        Index('idx_param_template', 'template_id'),
    )


class TemplateExecution(Base):
    """
    Tracks template usage and execution history
    """
    __tablename__ = 'template_executions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey('command_templates.id'), nullable=False)
    
    # Execution details
    executed_by = Column(String, ForeignKey('users.id'), nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow)
    
    # Command details
    command_id = Column(String, nullable=False)  # ID of generated command
    final_parameters = Column(JSON, nullable=False)  # Parameters used in execution
    
    # Result tracking
    execution_status = Column(String(20))  # pending, success, failed
    error_message = Column(Text)
    
    # Relationships
    template = relationship("CommandTemplate", back_populates="executions")
    executor = relationship("User", back_populates="template_executions")
    
    __table_args__ = (
        Index('idx_exec_template', 'template_id'),
        Index('idx_exec_user', 'executed_by'),
        Index('idx_exec_time', 'executed_at'),
    )


class TemplateCategory(Base):
    """
    Categories for organizing templates
    """
    __tablename__ = 'template_categories'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100))
    description = Column(Text)
    icon = Column(String(50))
    color = Column(String(7))  # Hex color
    
    # Hierarchy
    parent_category_id = Column(String, ForeignKey('template_categories.id'))
    display_order = Column(Integer, default=0)
    
    # Access control
    is_system = Column(Boolean, default=False)
    allowed_roles = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent_category = relationship("TemplateCategory", remote_side=[id])
    
    __table_args__ = (
        Index('idx_category_parent', 'parent_category_id'),
    )


class SharedTemplate(Base):
    """
    Tracks template sharing between users/organizations
    """
    __tablename__ = 'shared_templates'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey('command_templates.id'), nullable=False)
    
    # Sharing details
    shared_by = Column(String, ForeignKey('users.id'), nullable=False)
    shared_with_user_id = Column(String, ForeignKey('users.id'))
    shared_with_organization_id = Column(String, ForeignKey('organizations.id'))
    
    # Permissions
    can_edit = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    
    # Validity
    shared_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    template = relationship("CommandTemplate", backref="shares")
    sharer = relationship("User", foreign_keys=[shared_by])
    shared_user = relationship("User", foreign_keys=[shared_with_user_id])
    shared_organization = relationship("Organization")
    
    __table_args__ = (
        Index('idx_share_template', 'template_id'),
        Index('idx_share_user', 'shared_with_user_id'),
        Index('idx_share_org', 'shared_with_organization_id'),
    )