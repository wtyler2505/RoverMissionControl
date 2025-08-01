"""
Comprehensive API Versioning and Encryption Management Service
Handles version lifecycle, encryption configuration, key management, and compliance
"""
import uuid
import json
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from enum import Enum
import semver
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from sqlalchemy.exc import SQLAlchemyError
import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os

from ..database import get_db
from ..rbac.rbac_service import RBACService
from ..rbac.permissions import Resource, Action
from ..rbac.models import AuditAction
from ..auth.models import User
from .audit_service import EnhancedAuditService, SecurityEventType
from .versioning_models import (
    APIVersion, APIFeature, VersionStrategy, VersionMigration,
    MigrationExecutionLog, EncryptionConfig, EncryptionKey,
    EncryptionKeyUsage, ComplianceRequirement, VersionUsageMetrics,
    VersionStatus, VersioningStrategy, MigrationStatus,
    EncryptionAlgorithm, EncryptionPurpose, KeyType
)

logger = structlog.get_logger()


class VersioningError(Exception):
    """Base exception for versioning operations"""
    pass


class EncryptionError(Exception):
    """Base exception for encryption operations"""
    pass


class ComplianceError(Exception):
    """Base exception for compliance violations"""
    pass


class VersioningService:
    """
    Comprehensive service for API versioning and encryption management
    """
    
    def __init__(
        self,
        db: Session,
        rbac_service: RBACService,
        audit_service: EnhancedAuditService
    ):
        self.db = db
        self.rbac_service = rbac_service
        self.audit_service = audit_service
        self._encryption_cache = {}
        self._version_cache = {}
    
    # ==================== Version Management ====================
    
    async def create_version(
        self,
        user: User,
        version_number: str,
        description: str,
        breaking_changes: Optional[List[str]] = None,
        features: Optional[List[str]] = None,
        strategy_type: VersioningStrategy = VersioningStrategy.URI_PATH,
        **kwargs
    ) -> APIVersion:
        """Create a new API version with strategy configuration"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.API_VERSION,
                Action.CREATE
            )
            if not has_permission:
                raise VersioningError("Insufficient permissions to create API version")
            
            # Validate version number
            if not self._validate_version_number(version_number):
                raise VersioningError(f"Invalid version number: {version_number}")
            
            # Check for duplicate
            existing = self.db.query(APIVersion).filter_by(
                version_number=version_number
            ).first()
            if existing:
                raise VersioningError(f"Version {version_number} already exists")
            
            # Create version
            version = APIVersion(
                version_number=version_number,
                semantic_version=self._normalize_semantic_version(version_number),
                description=description,
                breaking_changes=breaking_changes or [],
                created_by=user.id,
                **kwargs
            )
            
            # Add features
            if features:
                for feature_name in features:
                    feature = self.db.query(APIFeature).filter_by(
                        name=feature_name
                    ).first()
                    if feature:
                        version.supported_features.append(feature)
            
            self.db.add(version)
            
            # Create default strategy
            strategy = VersionStrategy(
                version_id=version.id,
                strategy_type=strategy_type,
                is_primary=True,
                path_prefix=f"/api/{version_number}" if strategy_type == VersioningStrategy.URI_PATH else None,
                header_name="API-Version" if strategy_type == VersioningStrategy.HEADER else None,
                query_param_name="version" if strategy_type == VersioningStrategy.QUERY_PARAM else None
            )
            self.db.add(strategy)
            
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.API_VERSION_CREATED,
                user=user,
                details={
                    "version_id": version.id,
                    "version_number": version_number,
                    "strategy": strategy_type
                }
            )
            
            logger.info(
                "API version created",
                version_id=version.id,
                version_number=version_number,
                created_by=user.email
            )
            
            return version
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error creating version: {str(e)}")
            raise VersioningError(f"Failed to create version: {str(e)}")
    
    async def update_version_status(
        self,
        user: User,
        version_id: str,
        new_status: VersionStatus,
        **status_dates
    ) -> APIVersion:
        """Update version lifecycle status"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.API_VERSION,
                Action.UPDATE
            )
            if not has_permission:
                raise VersioningError("Insufficient permissions to update version")
            
            version = self.db.query(APIVersion).filter_by(id=version_id).first()
            if not version:
                raise VersioningError(f"Version not found: {version_id}")
            
            # Validate status transition
            if not self._validate_status_transition(version.status, new_status):
                raise VersioningError(
                    f"Invalid status transition from {version.status} to {new_status}"
                )
            
            # Update status and dates
            old_status = version.status
            version.status = new_status
            version.updated_by = user.id
            version.updated_at = datetime.now(timezone.utc)
            
            # Set lifecycle dates based on status
            if new_status == VersionStatus.PREVIEW:
                version.preview_start_date = status_dates.get(
                    'preview_start_date',
                    datetime.now(timezone.utc)
                )
            elif new_status == VersionStatus.ACTIVE:
                version.release_date = status_dates.get(
                    'release_date',
                    datetime.now(timezone.utc)
                )
            elif new_status == VersionStatus.DEPRECATED:
                version.deprecation_date = status_dates.get(
                    'deprecation_date',
                    datetime.now(timezone.utc)
                )
                # Set default sunset date if not provided
                if not version.sunset_date:
                    version.sunset_date = version.deprecation_date + timedelta(days=180)
            elif new_status == VersionStatus.SUNSET:
                version.sunset_date = status_dates.get(
                    'sunset_date',
                    datetime.now(timezone.utc)
                )
                # Set default end of life if not provided
                if not version.end_of_life_date:
                    version.end_of_life_date = version.sunset_date + timedelta(days=30)
            elif new_status == VersionStatus.RETIRED:
                version.end_of_life_date = status_dates.get(
                    'end_of_life_date',
                    datetime.now(timezone.utc)
                )
            
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.API_VERSION_STATUS_CHANGED,
                user=user,
                details={
                    "version_id": version_id,
                    "old_status": old_status,
                    "new_status": new_status,
                    "status_dates": status_dates
                }
            )
            
            # Clear cache
            self._version_cache.pop(version_id, None)
            
            return version
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error updating version status: {str(e)}")
            raise VersioningError(f"Failed to update version status: {str(e)}")
    
    async def deprecate_version(
        self,
        user: User,
        version_id: str,
        deprecation_reason: str,
        sunset_date: Optional[datetime] = None,
        migration_guide: Optional[str] = None
    ) -> APIVersion:
        """Deprecate an API version with migration guidance"""
        try:
            version = await self.update_version_status(
                user,
                version_id,
                VersionStatus.DEPRECATED,
                deprecation_date=datetime.now(timezone.utc),
                sunset_date=sunset_date or datetime.now(timezone.utc) + timedelta(days=180)
            )
            
            # Update migration guide
            if migration_guide:
                version.migration_guide = migration_guide
                self.db.commit()
            
            # Notify consumers (implementation depends on notification system)
            await self._notify_version_deprecation(version, deprecation_reason)
            
            return version
            
        except Exception as e:
            logger.error(f"Error deprecating version: {str(e)}")
            raise
    
    async def retire_version(
        self,
        user: User,
        version_id: str,
        force: bool = False
    ) -> APIVersion:
        """Retire an API version, making it unavailable"""
        try:
            version = self.db.query(APIVersion).filter_by(id=version_id).first()
            if not version:
                raise VersioningError(f"Version not found: {version_id}")
            
            # Check if version can be retired
            if not force and version.status not in [VersionStatus.DEPRECATED, VersionStatus.SUNSET]:
                raise VersioningError(
                    "Version must be deprecated or in sunset before retirement"
                )
            
            # Check active usage
            if not force:
                recent_usage = self.db.query(VersionUsageMetrics).filter(
                    and_(
                        VersionUsageMetrics.version_id == version_id,
                        VersionUsageMetrics.metric_date >= datetime.now(timezone.utc) - timedelta(days=7),
                        VersionUsageMetrics.total_requests > 0
                    )
                ).first()
                
                if recent_usage:
                    raise VersioningError(
                        "Version still has active usage in the last 7 days"
                    )
            
            # Update status
            version = await self.update_version_status(
                user,
                version_id,
                VersionStatus.RETIRED,
                end_of_life_date=datetime.now(timezone.utc)
            )
            
            return version
            
        except Exception as e:
            logger.error(f"Error retiring version: {str(e)}")
            raise
    
    # ==================== Version Strategy Configuration ====================
    
    async def configure_version_strategy(
        self,
        user: User,
        version_id: str,
        strategy_type: VersioningStrategy,
        config: Dict[str, Any],
        is_primary: bool = False
    ) -> VersionStrategy:
        """Configure versioning strategy for a version"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.API_VERSION,
                Action.UPDATE
            )
            if not has_permission:
                raise VersioningError("Insufficient permissions to configure strategy")
            
            version = self.db.query(APIVersion).filter_by(id=version_id).first()
            if not version:
                raise VersioningError(f"Version not found: {version_id}")
            
            # Check for existing strategy
            existing = self.db.query(VersionStrategy).filter_by(
                version_id=version_id,
                strategy_type=strategy_type
            ).first()
            
            if existing:
                # Update existing
                strategy = existing
            else:
                # Create new
                strategy = VersionStrategy(
                    version_id=version_id,
                    strategy_type=strategy_type
                )
                self.db.add(strategy)
            
            # Apply configuration based on strategy type
            if strategy_type == VersioningStrategy.URI_PATH:
                strategy.path_pattern = config.get('path_pattern', f"/api/v{version.version_number}/*")
                strategy.path_prefix = config.get('path_prefix', f"/api/{version.version_number}")
            elif strategy_type == VersioningStrategy.HEADER:
                strategy.header_name = config.get('header_name', 'API-Version')
                strategy.header_format = config.get('header_format')
            elif strategy_type == VersioningStrategy.QUERY_PARAM:
                strategy.query_param_name = config.get('query_param_name', 'version')
            elif strategy_type == VersioningStrategy.CONTENT_TYPE:
                strategy.content_type_template = config.get(
                    'content_type_template',
                    f"application/vnd.api+json;version={version.version_number}"
                )
            elif strategy_type == VersioningStrategy.CUSTOM:
                strategy.custom_config = config
            
            # Update primary flag
            if is_primary:
                # Remove primary from others
                self.db.query(VersionStrategy).filter(
                    and_(
                        VersionStrategy.version_id == version_id,
                        VersionStrategy.id != strategy.id
                    )
                ).update({"is_primary": False})
                strategy.is_primary = True
            
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.API_VERSION_STRATEGY_CONFIGURED,
                user=user,
                details={
                    "version_id": version_id,
                    "strategy_type": strategy_type,
                    "is_primary": is_primary,
                    "config": config
                }
            )
            
            return strategy
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error configuring strategy: {str(e)}")
            raise VersioningError(f"Failed to configure strategy: {str(e)}")
    
    # ==================== Version Migration ====================
    
    async def create_migration_plan(
        self,
        user: User,
        source_version_id: str,
        target_version_id: str,
        migration_type: str = "automatic",
        steps: Optional[List[Dict[str, Any]]] = None
    ) -> VersionMigration:
        """Create a migration plan between versions"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.API_VERSION,
                Action.CREATE
            )
            if not has_permission:
                raise VersioningError("Insufficient permissions to create migration")
            
            # Validate versions
            source = self.db.query(APIVersion).filter_by(id=source_version_id).first()
            target = self.db.query(APIVersion).filter_by(id=target_version_id).first()
            
            if not source or not target:
                raise VersioningError("Source or target version not found")
            
            # Check for existing migration
            existing = self.db.query(VersionMigration).filter_by(
                source_version_id=source_version_id,
                target_version_id=target_version_id
            ).first()
            
            if existing:
                raise VersioningError("Migration already exists between these versions")
            
            # Analyze compatibility
            compatibility = await self._analyze_version_compatibility(source, target)
            
            # Generate migration steps if not provided
            if not steps:
                steps = await self._generate_migration_steps(source, target, compatibility)
            
            # Create migration
            migration = VersionMigration(
                source_version_id=source_version_id,
                target_version_id=target_version_id,
                migration_type=migration_type,
                migration_steps=steps,
                compatibility_level=compatibility['level'],
                compatibility_notes=compatibility['notes'],
                data_transformation_required=compatibility['requires_transformation'],
                schema_changes=compatibility['schema_changes'],
                created_by=user.id,
                estimated_duration_minutes=self._estimate_migration_duration(steps)
            )
            
            self.db.add(migration)
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.API_MIGRATION_CREATED,
                user=user,
                details={
                    "migration_id": migration.id,
                    "source_version": source.version_number,
                    "target_version": target.version_number,
                    "migration_type": migration_type,
                    "compatibility_level": compatibility['level']
                }
            )
            
            return migration
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error creating migration: {str(e)}")
            raise VersioningError(f"Failed to create migration: {str(e)}")
    
    async def execute_migration(
        self,
        user: User,
        migration_id: str,
        api_key_id: Optional[str] = None,
        dry_run: bool = False
    ) -> MigrationExecutionLog:
        """Execute a version migration"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.API_VERSION,
                Action.EXECUTE
            )
            if not has_permission:
                raise VersioningError("Insufficient permissions to execute migration")
            
            migration = self.db.query(VersionMigration).filter_by(id=migration_id).first()
            if not migration:
                raise VersioningError(f"Migration not found: {migration_id}")
            
            # Create execution log
            execution_log = MigrationExecutionLog(
                migration_id=migration_id,
                initiated_by=user.id,
                api_key_id=api_key_id,
                started_at=datetime.now(timezone.utc)
            )
            
            if not dry_run:
                self.db.add(execution_log)
                self.db.flush()
            
            # Execute migration steps
            step_results = []
            errors = []
            warnings = []
            affected_resources = 0
            
            for i, step in enumerate(migration.migration_steps):
                try:
                    if dry_run:
                        result = await self._simulate_migration_step(step)
                    else:
                        result = await self._execute_migration_step(step, execution_log.id)
                    
                    step_results.append({
                        "step": i + 1,
                        "name": step.get('name'),
                        "status": "success",
                        "result": result
                    })
                    affected_resources += result.get('affected_count', 0)
                    warnings.extend(result.get('warnings', []))
                    
                except Exception as e:
                    error_detail = {
                        "step": i + 1,
                        "name": step.get('name'),
                        "error": str(e)
                    }
                    errors.append(error_detail)
                    step_results.append({
                        "step": i + 1,
                        "name": step.get('name'),
                        "status": "failed",
                        "error": str(e)
                    })
                    
                    # Rollback on error if not dry run
                    if not dry_run and migration.is_reversible:
                        await self._rollback_migration(execution_log.id, step_results)
                        execution_log.rollback_performed = True
                    break
            
            # Update execution log
            execution_log.completed_at = datetime.now(timezone.utc)
            execution_log.duration_ms = int(
                (execution_log.completed_at - execution_log.started_at).total_seconds() * 1000
            )
            execution_log.status = "failed" if errors else "success"
            execution_log.affected_resources = affected_resources
            execution_log.error_count = len(errors)
            execution_log.warning_count = len(warnings)
            execution_log.execution_logs = step_results
            execution_log.error_details = errors
            
            if not dry_run:
                # Update migration statistics
                migration.execution_count += 1
                if execution_log.status == "success":
                    migration.success_count += 1
                else:
                    migration.failure_count += 1
                migration.last_execution_at = datetime.now(timezone.utc)
                
                # Update average execution time
                if migration.average_execution_time_ms:
                    migration.average_execution_time_ms = (
                        migration.average_execution_time_ms + execution_log.duration_ms
                    ) / 2
                else:
                    migration.average_execution_time_ms = execution_log.duration_ms
                
                self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.API_MIGRATION_EXECUTED,
                user=user,
                details={
                    "migration_id": migration_id,
                    "execution_id": execution_log.id if not dry_run else None,
                    "dry_run": dry_run,
                    "status": execution_log.status,
                    "affected_resources": affected_resources,
                    "errors": len(errors),
                    "warnings": len(warnings)
                }
            )
            
            return execution_log
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error executing migration: {str(e)}")
            raise VersioningError(f"Failed to execute migration: {str(e)}")
    
    async def generate_migration_guide(
        self,
        source_version_id: str,
        target_version_id: str,
        format: str = "markdown"
    ) -> str:
        """Generate a migration guide between versions"""
        try:
            source = self.db.query(APIVersion).filter_by(id=source_version_id).first()
            target = self.db.query(APIVersion).filter_by(id=target_version_id).first()
            
            if not source or not target:
                raise VersioningError("Source or target version not found")
            
            migration = self.db.query(VersionMigration).filter_by(
                source_version_id=source_version_id,
                target_version_id=target_version_id
            ).first()
            
            # Generate guide based on format
            if format == "markdown":
                return await self._generate_markdown_migration_guide(
                    source, target, migration
                )
            elif format == "html":
                return await self._generate_html_migration_guide(
                    source, target, migration
                )
            elif format == "json":
                return await self._generate_json_migration_guide(
                    source, target, migration
                )
            else:
                raise VersioningError(f"Unsupported format: {format}")
                
        except Exception as e:
            logger.error(f"Error generating migration guide: {str(e)}")
            raise
    
    # ==================== Encryption Configuration ====================
    
    async def create_encryption_config(
        self,
        user: User,
        name: str,
        purpose: EncryptionPurpose,
        algorithm: EncryptionAlgorithm,
        key_size_bits: int,
        **config_params
    ) -> EncryptionConfig:
        """Create a new encryption configuration"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.ENCRYPTION,
                Action.CREATE
            )
            if not has_permission:
                raise EncryptionError("Insufficient permissions to create encryption config")
            
            # Validate algorithm and key size
            if not self._validate_encryption_params(algorithm, key_size_bits):
                raise EncryptionError(
                    f"Invalid algorithm {algorithm} or key size {key_size_bits}"
                )
            
            # Check compliance requirements
            compliance_issues = await self._check_encryption_compliance(
                algorithm, key_size_bits, purpose
            )
            if compliance_issues:
                raise ComplianceError(
                    f"Encryption configuration does not meet compliance: {compliance_issues}"
                )
            
            # Create configuration
            config = EncryptionConfig(
                name=name,
                purpose=purpose,
                algorithm=algorithm,
                key_size_bits=key_size_bits,
                **config_params
            )
            
            # Set purpose-specific defaults
            if purpose == EncryptionPurpose.IN_TRANSIT:
                config.tls_version = config_params.get('tls_version', '1.3')
                config.cipher_suites = config_params.get('cipher_suites', [
                    'TLS_AES_256_GCM_SHA384',
                    'TLS_CHACHA20_POLY1305_SHA256',
                    'TLS_AES_128_GCM_SHA256'
                ])
            elif purpose == EncryptionPurpose.AT_REST:
                config.transparent_encryption = config_params.get('transparent_encryption', True)
                config.field_level_encryption = config_params.get('field_level_encryption', False)
            
            self.db.add(config)
            
            # Create initial encryption key
            initial_key = await self._generate_encryption_key(
                config.id,
                KeyType.MASTER if purpose == EncryptionPurpose.AT_REST else KeyType.DATA,
                algorithm,
                key_size_bits
            )
            self.db.add(initial_key)
            
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.ENCRYPTION_CONFIG_CREATED,
                user=user,
                details={
                    "config_id": config.id,
                    "name": name,
                    "purpose": purpose,
                    "algorithm": algorithm,
                    "key_size_bits": key_size_bits
                }
            )
            
            return config
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error creating encryption config: {str(e)}")
            raise EncryptionError(f"Failed to create encryption config: {str(e)}")
    
    async def update_encryption_config(
        self,
        user: User,
        config_id: str,
        updates: Dict[str, Any]
    ) -> EncryptionConfig:
        """Update encryption configuration"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.ENCRYPTION,
                Action.UPDATE
            )
            if not has_permission:
                raise EncryptionError("Insufficient permissions to update encryption config")
            
            config = self.db.query(EncryptionConfig).filter_by(id=config_id).first()
            if not config:
                raise EncryptionError(f"Encryption config not found: {config_id}")
            
            # Validate updates
            if 'algorithm' in updates or 'key_size_bits' in updates:
                algorithm = updates.get('algorithm', config.algorithm)
                key_size = updates.get('key_size_bits', config.key_size_bits)
                
                if not self._validate_encryption_params(algorithm, key_size):
                    raise EncryptionError(f"Invalid algorithm or key size")
                
                # Check compliance
                compliance_issues = await self._check_encryption_compliance(
                    algorithm, key_size, config.purpose
                )
                if compliance_issues:
                    raise ComplianceError(
                        f"Updates do not meet compliance: {compliance_issues}"
                    )
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
            
            config.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            
            # Clear cache
            self._encryption_cache.pop(config_id, None)
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.ENCRYPTION_CONFIG_UPDATED,
                user=user,
                details={
                    "config_id": config_id,
                    "updates": updates
                }
            )
            
            return config
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error updating encryption config: {str(e)}")
            raise EncryptionError(f"Failed to update encryption config: {str(e)}")
    
    # ==================== Key Lifecycle Management ====================
    
    async def generate_encryption_key(
        self,
        user: User,
        config_id: str,
        key_type: KeyType,
        key_alias: Optional[str] = None
    ) -> EncryptionKey:
        """Generate a new encryption key"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.ENCRYPTION,
                Action.CREATE
            )
            if not has_permission:
                raise EncryptionError("Insufficient permissions to generate key")
            
            config = self.db.query(EncryptionConfig).filter_by(id=config_id).first()
            if not config:
                raise EncryptionError(f"Encryption config not found: {config_id}")
            
            # Generate key
            key = await self._generate_encryption_key(
                config_id,
                key_type,
                config.algorithm,
                config.key_size_bits,
                key_alias
            )
            key.created_by = user.id
            
            self.db.add(key)
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.ENCRYPTION_KEY_GENERATED,
                user=user,
                details={
                    "key_id": key.id,
                    "config_id": config_id,
                    "key_type": key_type,
                    "algorithm": config.algorithm
                }
            )
            
            return key
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error generating key: {str(e)}")
            raise EncryptionError(f"Failed to generate key: {str(e)}")
    
    async def rotate_encryption_key(
        self,
        user: User,
        key_id: str,
        rotation_reason: str,
        grace_period_hours: int = 24
    ) -> EncryptionKey:
        """Rotate an encryption key"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.ENCRYPTION,
                Action.UPDATE
            )
            if not has_permission:
                raise EncryptionError("Insufficient permissions to rotate key")
            
            old_key = self.db.query(EncryptionKey).filter_by(id=key_id).first()
            if not old_key:
                raise EncryptionError(f"Encryption key not found: {key_id}")
            
            if not old_key.is_active:
                raise EncryptionError("Cannot rotate inactive key")
            
            # Generate new key
            new_key = await self._generate_encryption_key(
                old_key.config_id,
                old_key.key_type,
                old_key.algorithm,
                old_key.key_size_bits,
                old_key.key_alias
            )
            new_key.key_version = old_key.key_version + 1
            new_key.rotated_from_key_id = old_key.id
            new_key.rotation_reason = rotation_reason
            new_key.created_by = user.id
            
            # Set as primary if old key was primary
            if old_key.is_primary:
                new_key.is_primary = True
                old_key.is_primary = False
            
            # Schedule old key deactivation
            old_key.expiration_date = datetime.now(timezone.utc) + timedelta(hours=grace_period_hours)
            
            self.db.add(new_key)
            self.db.commit()
            
            # Update configuration
            config = self.db.query(EncryptionConfig).filter_by(
                id=old_key.config_id
            ).first()
            config.last_rotation_at = datetime.now(timezone.utc)
            config.next_rotation_at = datetime.now(timezone.utc) + timedelta(
                days=config.key_rotation_days
            )
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.ENCRYPTION_KEY_ROTATED,
                user=user,
                details={
                    "old_key_id": key_id,
                    "new_key_id": new_key.id,
                    "rotation_reason": rotation_reason,
                    "grace_period_hours": grace_period_hours
                }
            )
            
            return new_key
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error rotating key: {str(e)}")
            raise EncryptionError(f"Failed to rotate key: {str(e)}")
    
    async def revoke_encryption_key(
        self,
        user: User,
        key_id: str,
        reason: str,
        immediate: bool = False
    ) -> EncryptionKey:
        """Revoke an encryption key"""
        try:
            # Check permissions
            has_permission = await self.rbac_service.check_permission(
                user,
                Resource.ENCRYPTION,
                Action.DELETE
            )
            if not has_permission:
                raise EncryptionError("Insufficient permissions to revoke key")
            
            key = self.db.query(EncryptionKey).filter_by(id=key_id).first()
            if not key:
                raise EncryptionError(f"Encryption key not found: {key_id}")
            
            # Mark as compromised if immediate revocation
            if immediate:
                key.is_compromised = True
                key.compromise_date = datetime.now(timezone.utc)
                key.compromise_reason = reason
                key.is_active = False
                key.deletion_date = datetime.now(timezone.utc)
            else:
                # Schedule for deletion
                key.is_active = False
                key.deletion_date = datetime.now(timezone.utc) + timedelta(days=7)
            
            self.db.commit()
            
            # Audit log
            await self.audit_service.log_security_event(
                SecurityEventType.ENCRYPTION_KEY_REVOKED,
                user=user,
                details={
                    "key_id": key_id,
                    "reason": reason,
                    "immediate": immediate
                }
            )
            
            return key
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error revoking key: {str(e)}")
            raise EncryptionError(f"Failed to revoke key: {str(e)}")
    
    # ==================== Usage Metrics ====================
    
    async def collect_version_metrics(
        self,
        version_id: str,
        window_start: datetime,
        window_end: datetime
    ) -> VersionUsageMetrics:
        """Collect and aggregate version usage metrics"""
        try:
            # Aggregate metrics from various sources
            metrics_data = await self._aggregate_version_metrics(
                version_id, window_start, window_end
            )
            
            # Create or update metrics record
            metric_date = window_start.replace(hour=0, minute=0, second=0, microsecond=0)
            metric_hour = window_start.hour if (window_end - window_start).seconds < 3600 else None
            
            existing = self.db.query(VersionUsageMetrics).filter_by(
                version_id=version_id,
                metric_date=metric_date,
                metric_hour=metric_hour
            ).first()
            
            if existing:
                metrics = existing
            else:
                metrics = VersionUsageMetrics(
                    version_id=version_id,
                    metric_date=metric_date,
                    metric_hour=metric_hour
                )
                self.db.add(metrics)
            
            # Update metrics
            for key, value in metrics_data.items():
                if hasattr(metrics, key):
                    setattr(metrics, key, value)
            
            self.db.commit()
            
            # Update version aggregate metrics
            await self._update_version_aggregate_metrics(version_id)
            
            return metrics
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error collecting metrics: {str(e)}")
            raise VersioningError(f"Failed to collect metrics: {str(e)}")
    
    async def analyze_version_usage(
        self,
        version_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        granularity: str = "daily"
    ) -> Dict[str, Any]:
        """Analyze version usage patterns and trends"""
        try:
            if not start_date:
                start_date = datetime.now(timezone.utc) - timedelta(days=30)
            if not end_date:
                end_date = datetime.now(timezone.utc)
            
            # Query metrics
            query = self.db.query(VersionUsageMetrics).filter(
                and_(
                    VersionUsageMetrics.version_id == version_id,
                    VersionUsageMetrics.metric_date >= start_date,
                    VersionUsageMetrics.metric_date <= end_date
                )
            )
            
            if granularity == "hourly":
                query = query.filter(VersionUsageMetrics.metric_hour.isnot(None))
            else:
                query = query.filter(VersionUsageMetrics.metric_hour.is_(None))
            
            metrics = query.order_by(VersionUsageMetrics.metric_date).all()
            
            # Analyze patterns
            analysis = {
                "version_id": version_id,
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "granularity": granularity
                },
                "summary": self._calculate_usage_summary(metrics),
                "trends": self._calculate_usage_trends(metrics),
                "performance": self._analyze_performance_metrics(metrics),
                "errors": self._analyze_error_patterns(metrics),
                "feature_usage": self._analyze_feature_usage(metrics),
                "geographic_distribution": self._analyze_geographic_distribution(metrics),
                "client_distribution": self._analyze_client_distribution(metrics),
                "recommendations": await self._generate_usage_recommendations(version_id, metrics)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing version usage: {str(e)}")
            raise
    
    # ==================== Compatibility Checking ====================
    
    async def check_version_compatibility(
        self,
        source_version_id: str,
        target_version_id: str
    ) -> Dict[str, Any]:
        """Check compatibility between two API versions"""
        try:
            source = self.db.query(APIVersion).filter_by(id=source_version_id).first()
            target = self.db.query(APIVersion).filter_by(id=target_version_id).first()
            
            if not source or not target:
                raise VersioningError("Source or target version not found")
            
            compatibility = await self._analyze_version_compatibility(source, target)
            
            # Generate compatibility report
            report = {
                "source_version": {
                    "id": source.id,
                    "version": source.version_number,
                    "status": source.status
                },
                "target_version": {
                    "id": target.id,
                    "version": target.version_number,
                    "status": target.status
                },
                "compatibility_level": compatibility['level'],
                "is_compatible": compatibility['level'] in ['full', 'partial'],
                "breaking_changes": compatibility['breaking_changes'],
                "deprecated_features": compatibility['deprecated_features'],
                "new_features": compatibility['new_features'],
                "schema_changes": compatibility['schema_changes'],
                "requires_transformation": compatibility['requires_transformation'],
                "migration_complexity": compatibility['migration_complexity'],
                "recommendations": compatibility['recommendations']
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Error checking compatibility: {str(e)}")
            raise
    
    # ==================== Encryption Status Monitoring ====================
    
    async def monitor_encryption_status(self) -> Dict[str, Any]:
        """Monitor overall encryption status and health"""
        try:
            # Get all active configurations
            active_configs = self.db.query(EncryptionConfig).filter_by(
                is_active=True
            ).all()
            
            # Get all active keys
            active_keys = self.db.query(EncryptionKey).filter_by(
                is_active=True
            ).all()
            
            # Analyze status
            status = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "configurations": {
                    "total": len(active_configs),
                    "by_purpose": self._group_configs_by_purpose(active_configs),
                    "by_algorithm": self._group_configs_by_algorithm(active_configs)
                },
                "keys": {
                    "total_active": len(active_keys),
                    "by_type": self._group_keys_by_type(active_keys),
                    "expiring_soon": self._find_expiring_keys(active_keys, days=30),
                    "rotation_due": self._find_rotation_due_keys(active_keys),
                    "hsm_backed": sum(1 for k in active_keys if k.hsm_backed)
                },
                "compliance": {
                    "compliant_configs": await self._check_all_configs_compliance(active_configs),
                    "issues": await self._find_compliance_issues(active_configs)
                },
                "performance": {
                    "average_operation_time_ms": self._calculate_avg_encryption_time(),
                    "error_rate": self._calculate_encryption_error_rate(),
                    "key_usage_stats": self._get_key_usage_statistics()
                },
                "alerts": await self._generate_encryption_alerts(active_configs, active_keys)
            }
            
            return status
            
        except Exception as e:
            logger.error(f"Error monitoring encryption status: {str(e)}")
            raise
    
    # ==================== Compliance Reporting ====================
    
    async def generate_compliance_report(
        self,
        framework: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate compliance report for encryption standards"""
        try:
            # Get compliance requirement
            requirement = self.db.query(ComplianceRequirement).filter_by(
                name=framework
            ).first()
            
            if not requirement:
                raise ComplianceError(f"Compliance framework not found: {framework}")
            
            if not start_date:
                start_date = datetime.now(timezone.utc) - timedelta(days=90)
            if not end_date:
                end_date = datetime.now(timezone.utc)
            
            # Get configurations meeting requirements
            compliant_configs = []
            non_compliant_configs = []
            
            configs = self.db.query(EncryptionConfig).filter_by(is_active=True).all()
            
            for config in configs:
                if await self._check_config_compliance(config, requirement):
                    compliant_configs.append(config)
                else:
                    non_compliant_configs.append(config)
            
            # Generate report
            report = {
                "framework": framework,
                "report_period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "summary": {
                    "total_configurations": len(configs),
                    "compliant": len(compliant_configs),
                    "non_compliant": len(non_compliant_configs),
                    "compliance_percentage": (
                        len(compliant_configs) / len(configs) * 100 
                        if configs else 0
                    )
                },
                "requirements": {
                    "min_key_size_bits": requirement.min_key_size_bits,
                    "allowed_algorithms": requirement.allowed_algorithms,
                    "key_rotation_days": requirement.required_key_rotation_days,
                    "requires_hsm": requirement.requires_hsm,
                    "requires_key_escrow": requirement.requires_key_escrow
                },
                "compliant_configurations": [
                    self._format_config_for_report(c) for c in compliant_configs
                ],
                "non_compliant_configurations": [
                    {
                        **self._format_config_for_report(c),
                        "compliance_issues": await self._identify_compliance_issues(c, requirement)
                    }
                    for c in non_compliant_configs
                ],
                "key_management": await self._generate_key_management_report(
                    requirement, start_date, end_date
                ),
                "audit_trail": await self._generate_encryption_audit_trail(
                    start_date, end_date
                ),
                "recommendations": await self._generate_compliance_recommendations(
                    requirement, non_compliant_configs
                )
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating compliance report: {str(e)}")
            raise
    
    # ==================== Helper Methods ====================
    
    def _validate_version_number(self, version_number: str) -> bool:
        """Validate version number format"""
        # Support various formats: v1, 1.0, 1.0.0, etc.
        import re
        patterns = [
            r'^v?\d+$',  # v1, 1
            r'^v?\d+\.\d+$',  # v1.0, 1.0
            r'^v?\d+\.\d+\.\d+$',  # v1.0.0, 1.0.0
            r'^v?\d+\.\d+\.\d+[-+][\w.]+$'  # v1.0.0-beta.1
        ]
        return any(re.match(pattern, version_number) for pattern in patterns)
    
    def _normalize_semantic_version(self, version_number: str) -> Optional[str]:
        """Normalize version to semantic version format"""
        try:
            # Remove 'v' prefix if present
            clean_version = version_number.lstrip('v')
            
            # Try to parse as semver
            parsed = semver.VersionInfo.parse(clean_version)
            return str(parsed)
        except:
            # If not valid semver, try to convert
            parts = clean_version.split('.')
            if len(parts) == 1:
                return f"{parts[0]}.0.0"
            elif len(parts) == 2:
                return f"{parts[0]}.{parts[1]}.0"
            return None
    
    def _validate_status_transition(
        self, 
        current_status: VersionStatus, 
        new_status: VersionStatus
    ) -> bool:
        """Validate version status transition"""
        valid_transitions = {
            VersionStatus.DEVELOPMENT: [
                VersionStatus.PREVIEW, 
                VersionStatus.ACTIVE, 
                VersionStatus.RETIRED
            ],
            VersionStatus.PREVIEW: [
                VersionStatus.ACTIVE, 
                VersionStatus.DEPRECATED,
                VersionStatus.RETIRED
            ],
            VersionStatus.ACTIVE: [
                VersionStatus.DEPRECATED,
                VersionStatus.SUNSET,
                VersionStatus.RETIRED
            ],
            VersionStatus.DEPRECATED: [
                VersionStatus.SUNSET,
                VersionStatus.RETIRED
            ],
            VersionStatus.SUNSET: [
                VersionStatus.RETIRED
            ],
            VersionStatus.RETIRED: []  # No transitions from retired
        }
        
        return new_status in valid_transitions.get(current_status, [])
    
    async def _notify_version_deprecation(
        self, 
        version: APIVersion, 
        reason: str
    ) -> None:
        """Send deprecation notifications to API consumers"""
        # This would integrate with your notification system
        # For now, just log
        logger.info(
            "Version deprecation notification",
            version_id=version.id,
            version_number=version.version_number,
            reason=reason
        )
    
    async def _analyze_version_compatibility(
        self,
        source: APIVersion,
        target: APIVersion
    ) -> Dict[str, Any]:
        """Analyze compatibility between versions"""
        compatibility = {
            "level": "full",  # full, partial, breaking, incompatible
            "notes": [],
            "breaking_changes": [],
            "deprecated_features": [],
            "new_features": [],
            "schema_changes": [],
            "requires_transformation": False,
            "migration_complexity": "low",  # low, medium, high
            "recommendations": []
        }
        
        # Check breaking changes
        if target.breaking_changes:
            compatibility["level"] = "breaking"
            compatibility["breaking_changes"] = target.breaking_changes
            compatibility["requires_transformation"] = True
            compatibility["migration_complexity"] = "high"
        
        # Compare features
        source_features = {f.name for f in source.supported_features}
        target_features = {f.name for f in target.supported_features}
        
        removed = source_features - target_features
        added = target_features - source_features
        
        if removed:
            compatibility["deprecated_features"] = list(removed)
            if compatibility["level"] == "full":
                compatibility["level"] = "partial"
        
        if added:
            compatibility["new_features"] = list(added)
        
        # Check backwards compatibility
        if not target.backwards_compatible:
            compatibility["level"] = "breaking"
            compatibility["notes"].append("Target version is not backwards compatible")
        
        # Generate recommendations
        if compatibility["level"] == "breaking":
            compatibility["recommendations"].append(
                "Review breaking changes and update client code accordingly"
            )
            compatibility["recommendations"].append(
                "Test thoroughly in a staging environment before migration"
            )
        
        return compatibility
    
    async def _generate_migration_steps(
        self,
        source: APIVersion,
        target: APIVersion,
        compatibility: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate migration steps based on version differences"""
        steps = []
        
        # Step 1: Validation
        steps.append({
            "name": "Validate current version",
            "description": "Ensure client is using the source version correctly",
            "type": "validation",
            "automated": True,
            "script": f"validate_version('{source.version_number}')"
        })
        
        # Step 2: Feature deprecation handling
        if compatibility['deprecated_features']:
            steps.append({
                "name": "Handle deprecated features",
                "description": f"Update code to remove usage of: {', '.join(compatibility['deprecated_features'])}",
                "type": "code_update",
                "automated": False,
                "manual_guide": "Review and update feature usage"
            })
        
        # Step 3: Breaking changes
        if compatibility['breaking_changes']:
            for i, change in enumerate(compatibility['breaking_changes']):
                steps.append({
                    "name": f"Handle breaking change {i+1}",
                    "description": change,
                    "type": "breaking_change",
                    "automated": False,
                    "manual_guide": "Update implementation to handle change"
                })
        
        # Step 4: Schema updates
        if compatibility['schema_changes']:
            steps.append({
                "name": "Update data schemas",
                "description": "Apply schema transformations",
                "type": "schema_update",
                "automated": True,
                "script": "apply_schema_migrations()"
            })
        
        # Step 5: Test new features
        if compatibility['new_features']:
            steps.append({
                "name": "Enable new features",
                "description": f"Optional: Enable new features: {', '.join(compatibility['new_features'])}",
                "type": "feature_enablement",
                "automated": False,
                "optional": True
            })
        
        # Step 6: Update version
        steps.append({
            "name": "Update to target version",
            "description": f"Switch to version {target.version_number}",
            "type": "version_switch",
            "automated": True,
            "script": f"switch_version('{target.version_number}')"
        })
        
        # Step 7: Validation
        steps.append({
            "name": "Validate migration",
            "description": "Ensure all functionality works with new version",
            "type": "validation",
            "automated": True,
            "script": "validate_migration()"
        })
        
        return steps
    
    def _estimate_migration_duration(self, steps: List[Dict[str, Any]]) -> int:
        """Estimate migration duration in minutes"""
        # Base estimates per step type
        step_durations = {
            "validation": 5,
            "code_update": 30,
            "breaking_change": 45,
            "schema_update": 20,
            "feature_enablement": 15,
            "version_switch": 10
        }
        
        total_minutes = 0
        for step in steps:
            step_type = step.get('type', 'validation')
            total_minutes += step_durations.get(step_type, 10)
        
        return total_minutes
    
    async def _execute_migration_step(
        self,
        step: Dict[str, Any],
        execution_log_id: str
    ) -> Dict[str, Any]:
        """Execute a single migration step"""
        # This would contain actual migration logic
        # For now, simulate execution
        result = {
            "status": "success",
            "affected_count": 0,
            "warnings": [],
            "duration_ms": 1000
        }
        
        # Log step execution
        logger.info(
            "Executing migration step",
            step_name=step.get('name'),
            execution_log_id=execution_log_id
        )
        
        return result
    
    async def _simulate_migration_step(
        self,
        step: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Simulate migration step for dry run"""
        return {
            "status": "simulated",
            "affected_count": 0,
            "warnings": ["This is a dry run simulation"],
            "duration_ms": 0
        }
    
    async def _rollback_migration(
        self,
        execution_log_id: str,
        completed_steps: List[Dict[str, Any]]
    ) -> None:
        """Rollback migration steps"""
        logger.warning(
            "Rolling back migration",
            execution_log_id=execution_log_id,
            completed_steps=len(completed_steps)
        )
        # Implement rollback logic
    
    async def _generate_markdown_migration_guide(
        self,
        source: APIVersion,
        target: APIVersion,
        migration: Optional[VersionMigration]
    ) -> str:
        """Generate markdown format migration guide"""
        guide = f"""# Migration Guide: {source.version_number} → {target.version_number}

## Overview
This guide helps you migrate from API version {source.version_number} to {target.version_number}.

## Status
- **Source Version Status**: {source.status}
- **Target Version Status**: {target.status}
- **Migration Type**: {migration.migration_type if migration else 'Manual'}
- **Estimated Duration**: {migration.estimated_duration_minutes if migration else 'Unknown'} minutes

## Breaking Changes
"""
        if target.breaking_changes:
            for change in target.breaking_changes:
                guide += f"- {change}\n"
        else:
            guide += "No breaking changes.\n"
        
        guide += "\n## Migration Steps\n"
        
        if migration and migration.migration_steps:
            for i, step in enumerate(migration.migration_steps):
                guide += f"\n### Step {i+1}: {step['name']}\n"
                guide += f"{step['description']}\n"
                if step.get('automated'):
                    guide += f"\n**Automated**: Yes\n"
                    if step.get('script'):
                        guide += f"```\n{step['script']}\n```\n"
                else:
                    guide += f"\n**Manual Action Required**\n"
                    if step.get('manual_guide'):
                        guide += f"{step['manual_guide']}\n"
        else:
            guide += "Please follow the general migration process.\n"
        
        guide += f"\n## New Features\n"
        if target.new_features:
            for feature in target.new_features:
                guide += f"- {feature}\n"
        else:
            guide += "No new features.\n"
        
        guide += f"\n## Support\n"
        guide += f"For assistance, refer to the [API documentation]({target.documentation_url}).\n"
        
        return guide
    
    async def _generate_html_migration_guide(
        self,
        source: APIVersion,
        target: APIVersion,
        migration: Optional[VersionMigration]
    ) -> str:
        """Generate HTML format migration guide"""
        # Convert markdown to HTML or generate directly
        markdown_guide = await self._generate_markdown_migration_guide(
            source, target, migration
        )
        # Use markdown to HTML converter
        return f"<html><body>{markdown_guide}</body></html>"
    
    async def _generate_json_migration_guide(
        self,
        source: APIVersion,
        target: APIVersion,
        migration: Optional[VersionMigration]
    ) -> str:
        """Generate JSON format migration guide"""
        guide_data = {
            "source_version": source.version_number,
            "target_version": target.version_number,
            "migration_type": migration.migration_type if migration else "manual",
            "estimated_duration_minutes": migration.estimated_duration_minutes if migration else None,
            "breaking_changes": target.breaking_changes or [],
            "new_features": target.new_features or [],
            "migration_steps": migration.migration_steps if migration else [],
            "documentation_url": target.documentation_url
        }
        return json.dumps(guide_data, indent=2)
    
    def _validate_encryption_params(
        self,
        algorithm: EncryptionAlgorithm,
        key_size_bits: int
    ) -> bool:
        """Validate encryption algorithm and key size"""
        valid_key_sizes = {
            EncryptionAlgorithm.AES_256_GCM: [256],
            EncryptionAlgorithm.AES_256_CBC: [256],
            EncryptionAlgorithm.AES_128_GCM: [128],
            EncryptionAlgorithm.CHACHA20_POLY1305: [256],
            EncryptionAlgorithm.RSA_2048: [2048],
            EncryptionAlgorithm.RSA_4096: [4096],
            EncryptionAlgorithm.ECC_P256: [256],
            EncryptionAlgorithm.ECC_P384: [384]
        }
        
        return key_size_bits in valid_key_sizes.get(algorithm, [])
    
    async def _check_encryption_compliance(
        self,
        algorithm: EncryptionAlgorithm,
        key_size_bits: int,
        purpose: EncryptionPurpose
    ) -> List[str]:
        """Check if encryption meets compliance requirements"""
        issues = []
        
        # Get all compliance requirements
        requirements = self.db.query(ComplianceRequirement).all()
        
        for req in requirements:
            # Check minimum key size
            if req.min_key_size_bits and key_size_bits < req.min_key_size_bits:
                issues.append(
                    f"{req.name} requires minimum {req.min_key_size_bits} bit keys"
                )
            
            # Check allowed algorithms
            if req.allowed_algorithms and algorithm not in req.allowed_algorithms:
                issues.append(
                    f"{req.name} does not allow {algorithm} algorithm"
                )
        
        return issues
    
    async def _generate_encryption_key(
        self,
        config_id: str,
        key_type: KeyType,
        algorithm: EncryptionAlgorithm,
        key_size_bits: int,
        key_alias: Optional[str] = None
    ) -> EncryptionKey:
        """Generate a new encryption key"""
        # Generate key material based on algorithm
        if algorithm in [EncryptionAlgorithm.AES_256_GCM, EncryptionAlgorithm.AES_256_CBC]:
            # Generate AES key
            key_material = os.urandom(key_size_bits // 8)
        elif algorithm.startswith('rsa'):
            # Generate RSA key pair
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=key_size_bits,
                backend=default_backend()
            )
            key_material = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
        else:
            # Default to random bytes
            key_material = os.urandom(key_size_bits // 8)
        
        # Encrypt key material (using master key or HSM)
        encrypted_key = self._encrypt_key_material(key_material)
        
        # Calculate fingerprint
        fingerprint = hashlib.sha256(key_material).hexdigest()
        
        # Create key record
        key = EncryptionKey(
            config_id=config_id,
            key_id=str(uuid.uuid4()),
            key_alias=key_alias,
            key_type=key_type,
            algorithm=algorithm,
            key_size_bits=key_size_bits,
            encrypted_key_material=encrypted_key,
            key_fingerprint=fingerprint,
            activation_date=datetime.now(timezone.utc),
            expiration_date=datetime.now(timezone.utc) + timedelta(days=365)
        )
        
        return key
    
    def _encrypt_key_material(self, key_material: bytes) -> str:
        """Encrypt key material for storage"""
        # In production, use HSM or KMS
        # For now, use Fernet encryption
        master_key = os.environ.get('MASTER_ENCRYPTION_KEY', Fernet.generate_key())
        f = Fernet(master_key)
        return f.encrypt(key_material).decode('utf-8')
    
    async def _aggregate_version_metrics(
        self,
        version_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, Any]:
        """Aggregate metrics from various sources"""
        # This would pull from your metrics collection system
        return {
            "total_requests": 1000,
            "successful_requests": 950,
            "failed_requests": 50,
            "avg_response_time_ms": 125.5,
            "p50_response_time_ms": 100,
            "p95_response_time_ms": 250,
            "p99_response_time_ms": 500,
            "unique_api_keys": 25,
            "unique_users": 100,
            "total_bandwidth_bytes": 1024 * 1024 * 100  # 100MB
        }
    
    async def _update_version_aggregate_metrics(self, version_id: str) -> None:
        """Update aggregate metrics for a version"""
        # Calculate and update version-level metrics
        version = self.db.query(APIVersion).filter_by(id=version_id).first()
        if version:
            # Update from recent metrics
            recent_metrics = self.db.query(VersionUsageMetrics).filter(
                and_(
                    VersionUsageMetrics.version_id == version_id,
                    VersionUsageMetrics.metric_date >= datetime.now(timezone.utc) - timedelta(days=7)
                )
            ).all()
            
            if recent_metrics:
                version.total_requests = sum(m.total_requests for m in recent_metrics)
                version.average_response_time_ms = sum(
                    m.avg_response_time_ms for m in recent_metrics
                ) / len(recent_metrics)
                self.db.commit()
    
    def _calculate_usage_summary(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Calculate usage summary from metrics"""
        if not metrics:
            return {}
        
        return {
            "total_requests": sum(m.total_requests for m in metrics),
            "successful_requests": sum(m.successful_requests for m in metrics),
            "failed_requests": sum(m.failed_requests for m in metrics),
            "average_daily_requests": sum(m.total_requests for m in metrics) / len(metrics),
            "unique_users": max(m.unique_users for m in metrics),
            "unique_api_keys": max(m.unique_api_keys for m in metrics)
        }
    
    def _calculate_usage_trends(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Calculate usage trends"""
        if len(metrics) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate trend
        first_half = metrics[:len(metrics)//2]
        second_half = metrics[len(metrics)//2:]
        
        first_avg = sum(m.total_requests for m in first_half) / len(first_half)
        second_avg = sum(m.total_requests for m in second_half) / len(second_half)
        
        trend_percentage = ((second_avg - first_avg) / first_avg * 100) if first_avg > 0 else 0
        
        return {
            "trend": "increasing" if trend_percentage > 10 else "decreasing" if trend_percentage < -10 else "stable",
            "trend_percentage": trend_percentage,
            "peak_day": max(metrics, key=lambda m: m.total_requests).metric_date.isoformat(),
            "lowest_day": min(metrics, key=lambda m: m.total_requests).metric_date.isoformat()
        }
    
    def _analyze_performance_metrics(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Analyze performance metrics"""
        if not metrics:
            return {}
        
        return {
            "average_response_time_ms": sum(m.avg_response_time_ms for m in metrics) / len(metrics),
            "p95_response_time_ms": sum(m.p95_response_time_ms for m in metrics) / len(metrics),
            "p99_response_time_ms": sum(m.p99_response_time_ms for m in metrics) / len(metrics),
            "performance_trend": self._calculate_performance_trend(metrics)
        }
    
    def _calculate_performance_trend(self, metrics: List[VersionUsageMetrics]) -> str:
        """Calculate performance trend"""
        if len(metrics) < 2:
            return "insufficient_data"
        
        # Compare recent vs older performance
        recent = metrics[-7:] if len(metrics) >= 7 else metrics[-len(metrics)//2:]
        older = metrics[:7] if len(metrics) >= 14 else metrics[:len(metrics)//2]
        
        recent_avg = sum(m.avg_response_time_ms for m in recent) / len(recent)
        older_avg = sum(m.avg_response_time_ms for m in older) / len(older)
        
        if recent_avg < older_avg * 0.9:
            return "improving"
        elif recent_avg > older_avg * 1.1:
            return "degrading"
        else:
            return "stable"
    
    def _analyze_error_patterns(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Analyze error patterns"""
        if not metrics:
            return {}
        
        total_requests = sum(m.total_requests for m in metrics)
        total_errors = sum(m.error_4xx_count + m.error_5xx_count for m in metrics)
        
        return {
            "total_errors": total_errors,
            "error_rate": (total_errors / total_requests * 100) if total_requests > 0 else 0,
            "client_errors_4xx": sum(m.error_4xx_count for m in metrics),
            "server_errors_5xx": sum(m.error_5xx_count for m in metrics),
            "timeout_errors": sum(m.timeout_count for m in metrics),
            "error_trend": self._calculate_error_trend(metrics)
        }
    
    def _calculate_error_trend(self, metrics: List[VersionUsageMetrics]) -> str:
        """Calculate error trend"""
        if len(metrics) < 2:
            return "insufficient_data"
        
        # Compare recent vs older errors
        recent = metrics[-7:] if len(metrics) >= 7 else metrics[-len(metrics)//2:]
        older = metrics[:7] if len(metrics) >= 14 else metrics[:len(metrics)//2]
        
        recent_rate = sum(m.error_4xx_count + m.error_5xx_count for m in recent) / sum(m.total_requests for m in recent) if sum(m.total_requests for m in recent) > 0 else 0
        older_rate = sum(m.error_4xx_count + m.error_5xx_count for m in older) / sum(m.total_requests for m in older) if sum(m.total_requests for m in older) > 0 else 0
        
        if recent_rate < older_rate * 0.8:
            return "improving"
        elif recent_rate > older_rate * 1.2:
            return "worsening"
        else:
            return "stable"
    
    def _analyze_feature_usage(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Analyze feature usage patterns"""
        feature_usage = {}
        
        for metric in metrics:
            if metric.feature_usage:
                for feature, count in metric.feature_usage.items():
                    feature_usage[feature] = feature_usage.get(feature, 0) + count
        
        # Sort by usage
        sorted_features = sorted(
            feature_usage.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return {
            "most_used_features": sorted_features[:10],
            "least_used_features": sorted_features[-10:] if len(sorted_features) > 10 else [],
            "total_features_used": len(feature_usage)
        }
    
    def _analyze_geographic_distribution(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Analyze geographic distribution"""
        country_usage = {}
        
        for metric in metrics:
            if metric.country_distribution:
                for country, count in metric.country_distribution.items():
                    country_usage[country] = country_usage.get(country, 0) + count
        
        # Sort by usage
        sorted_countries = sorted(
            country_usage.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        total_requests = sum(count for _, count in sorted_countries)
        
        return {
            "top_countries": [
                {
                    "country": country,
                    "requests": count,
                    "percentage": (count / total_requests * 100) if total_requests > 0 else 0
                }
                for country, count in sorted_countries[:10]
            ],
            "total_countries": len(country_usage)
        }
    
    def _analyze_client_distribution(self, metrics: List[VersionUsageMetrics]) -> Dict[str, Any]:
        """Analyze client distribution"""
        client_versions = {}
        user_agents = {}
        
        for metric in metrics:
            if metric.client_version_distribution:
                for version, count in metric.client_version_distribution.items():
                    client_versions[version] = client_versions.get(version, 0) + count
            
            if metric.user_agent_distribution:
                for agent, count in metric.user_agent_distribution.items():
                    user_agents[agent] = user_agents.get(agent, 0) + count
        
        return {
            "client_versions": sorted(
                client_versions.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10],
            "user_agents": sorted(
                user_agents.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
        }
    
    async def _generate_usage_recommendations(
        self,
        version_id: str,
        metrics: List[VersionUsageMetrics]
    ) -> List[str]:
        """Generate recommendations based on usage analysis"""
        recommendations = []
        
        if not metrics:
            return ["Insufficient data for recommendations"]
        
        # Check usage trends
        trends = self._calculate_usage_trends(metrics)
        if trends.get('trend') == 'decreasing' and trends.get('trend_percentage', 0) < -20:
            recommendations.append(
                "Usage is declining significantly. Consider investigating user migration patterns."
            )
        
        # Check performance
        perf = self._analyze_performance_metrics(metrics)
        if perf.get('performance_trend') == 'degrading':
            recommendations.append(
                "Performance is degrading. Consider optimizing endpoints or scaling resources."
            )
        
        # Check errors
        errors = self._analyze_error_patterns(metrics)
        if errors.get('error_rate', 0) > 5:
            recommendations.append(
                f"High error rate ({errors['error_rate']:.1f}%). Investigate error patterns and fixes."
            )
        
        # Check version status
        version = self.db.query(APIVersion).filter_by(id=version_id).first()
        if version and version.status == VersionStatus.DEPRECATED:
            recommendations.append(
                "This version is deprecated. Encourage users to migrate to newer versions."
            )
        
        return recommendations
    
    def _group_configs_by_purpose(self, configs: List[EncryptionConfig]) -> Dict[str, int]:
        """Group encryption configs by purpose"""
        purpose_counts = {}
        for config in configs:
            purpose_counts[config.purpose] = purpose_counts.get(config.purpose, 0) + 1
        return purpose_counts
    
    def _group_configs_by_algorithm(self, configs: List[EncryptionConfig]) -> Dict[str, int]:
        """Group encryption configs by algorithm"""
        algo_counts = {}
        for config in configs:
            algo_counts[config.algorithm] = algo_counts.get(config.algorithm, 0) + 1
        return algo_counts
    
    def _group_keys_by_type(self, keys: List[EncryptionKey]) -> Dict[str, int]:
        """Group encryption keys by type"""
        type_counts = {}
        for key in keys:
            type_counts[key.key_type] = type_counts.get(key.key_type, 0) + 1
        return type_counts
    
    def _find_expiring_keys(self, keys: List[EncryptionKey], days: int = 30) -> List[Dict[str, Any]]:
        """Find keys expiring within specified days"""
        expiring = []
        cutoff_date = datetime.now(timezone.utc) + timedelta(days=days)
        
        for key in keys:
            if key.expiration_date and key.expiration_date <= cutoff_date:
                expiring.append({
                    "key_id": key.id,
                    "key_alias": key.key_alias,
                    "expiration_date": key.expiration_date.isoformat(),
                    "days_until_expiration": (key.expiration_date - datetime.now(timezone.utc)).days
                })
        
        return expiring
    
    def _find_rotation_due_keys(self, keys: List[EncryptionKey]) -> List[Dict[str, Any]]:
        """Find keys due for rotation"""
        rotation_due = []
        
        for key in keys:
            config = self.db.query(EncryptionConfig).filter_by(id=key.config_id).first()
            if config and config.key_rotation_enabled:
                days_since_creation = (datetime.now(timezone.utc) - key.creation_date).days
                if days_since_creation >= config.key_rotation_days:
                    rotation_due.append({
                        "key_id": key.id,
                        "key_alias": key.key_alias,
                        "days_overdue": days_since_creation - config.key_rotation_days
                    })
        
        return rotation_due
    
    async def _check_all_configs_compliance(
        self,
        configs: List[EncryptionConfig]
    ) -> Dict[str, int]:
        """Check compliance for all configurations"""
        compliant = 0
        non_compliant = 0
        
        for config in configs:
            issues = await self._check_encryption_compliance(
                config.algorithm,
                config.key_size_bits,
                config.purpose
            )
            if issues:
                non_compliant += 1
            else:
                compliant += 1
        
        return {
            "compliant": compliant,
            "non_compliant": non_compliant,
            "compliance_rate": (compliant / len(configs) * 100) if configs else 0
        }
    
    async def _find_compliance_issues(
        self,
        configs: List[EncryptionConfig]
    ) -> List[Dict[str, Any]]:
        """Find specific compliance issues"""
        all_issues = []
        
        for config in configs:
            issues = await self._check_encryption_compliance(
                config.algorithm,
                config.key_size_bits,
                config.purpose
            )
            if issues:
                all_issues.append({
                    "config_id": config.id,
                    "config_name": config.name,
                    "issues": issues
                })
        
        return all_issues
    
    def _calculate_avg_encryption_time(self) -> float:
        """Calculate average encryption operation time"""
        # Query recent key usage logs
        recent_usage = self.db.query(EncryptionKeyUsage).filter(
            and_(
                EncryptionKeyUsage.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24),
                EncryptionKeyUsage.operation_status == "success"
            )
        ).all()
        
        if not recent_usage:
            return 0.0
        
        total_time = sum(u.operation_duration_ms for u in recent_usage if u.operation_duration_ms)
        return total_time / len(recent_usage)
    
    def _calculate_encryption_error_rate(self) -> float:
        """Calculate encryption error rate"""
        recent_usage = self.db.query(EncryptionKeyUsage).filter(
            EncryptionKeyUsage.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24)
        ).all()
        
        if not recent_usage:
            return 0.0
        
        error_count = sum(1 for u in recent_usage if u.operation_status == "failed")
        return (error_count / len(recent_usage) * 100)
    
    def _get_key_usage_statistics(self) -> Dict[str, Any]:
        """Get key usage statistics"""
        # Aggregate key usage data
        usage_stats = self.db.query(
            EncryptionKeyUsage.operation,
            func.count(EncryptionKeyUsage.id).label('count'),
            func.avg(EncryptionKeyUsage.operation_duration_ms).label('avg_duration')
        ).filter(
            EncryptionKeyUsage.timestamp >= datetime.now(timezone.utc) - timedelta(days=7)
        ).group_by(EncryptionKeyUsage.operation).all()
        
        return {
            stat.operation: {
                "count": stat.count,
                "avg_duration_ms": float(stat.avg_duration) if stat.avg_duration else 0
            }
            for stat in usage_stats
        }
    
    async def _generate_encryption_alerts(
        self,
        configs: List[EncryptionConfig],
        keys: List[EncryptionKey]
    ) -> List[Dict[str, Any]]:
        """Generate alerts for encryption issues"""
        alerts = []
        
        # Check for expiring keys
        expiring_keys = self._find_expiring_keys(keys, days=7)
        for key_info in expiring_keys:
            alerts.append({
                "type": "key_expiring_soon",
                "severity": "high",
                "message": f"Key {key_info['key_alias'] or key_info['key_id']} expires in {key_info['days_until_expiration']} days",
                "key_id": key_info['key_id']
            })
        
        # Check for overdue rotations
        rotation_due = self._find_rotation_due_keys(keys)
        for key_info in rotation_due:
            alerts.append({
                "type": "key_rotation_overdue",
                "severity": "medium",
                "message": f"Key {key_info['key_alias'] or key_info['key_id']} is {key_info['days_overdue']} days overdue for rotation",
                "key_id": key_info['key_id']
            })
        
        # Check for high error rates
        error_rate = self._calculate_encryption_error_rate()
        if error_rate > 5:
            alerts.append({
                "type": "high_error_rate",
                "severity": "high",
                "message": f"Encryption error rate is {error_rate:.1f}%",
                "metric": "error_rate"
            })
        
        # Check for compliance issues
        compliance_issues = await self._find_compliance_issues(configs)
        if compliance_issues:
            alerts.append({
                "type": "compliance_issues",
                "severity": "high",
                "message": f"{len(compliance_issues)} configurations have compliance issues",
                "affected_configs": [issue['config_id'] for issue in compliance_issues]
            })
        
        return alerts
    
    async def _check_config_compliance(
        self,
        config: EncryptionConfig,
        requirement: ComplianceRequirement
    ) -> bool:
        """Check if a config meets a specific compliance requirement"""
        # Check algorithm
        if requirement.allowed_algorithms and config.algorithm not in requirement.allowed_algorithms:
            return False
        
        # Check key size
        if requirement.min_key_size_bits and config.key_size_bits < requirement.min_key_size_bits:
            return False
        
        # Check rotation
        if requirement.required_key_rotation_days and config.key_rotation_days > requirement.required_key_rotation_days:
            return False
        
        # Check HSM
        if requirement.requires_hsm and not config.hsm_enabled:
            return False
        
        return True
    
    def _format_config_for_report(self, config: EncryptionConfig) -> Dict[str, Any]:
        """Format encryption config for compliance report"""
        return {
            "id": config.id,
            "name": config.name,
            "purpose": config.purpose,
            "algorithm": config.algorithm,
            "key_size_bits": config.key_size_bits,
            "key_rotation_days": config.key_rotation_days,
            "hsm_enabled": config.hsm_enabled,
            "created_at": config.created_at.isoformat(),
            "last_rotation_at": config.last_rotation_at.isoformat() if config.last_rotation_at else None
        }
    
    async def _identify_compliance_issues(
        self,
        config: EncryptionConfig,
        requirement: ComplianceRequirement
    ) -> List[str]:
        """Identify specific compliance issues for a config"""
        issues = []
        
        if requirement.allowed_algorithms and config.algorithm not in requirement.allowed_algorithms:
            issues.append(f"Algorithm {config.algorithm} not allowed by {requirement.name}")
        
        if requirement.min_key_size_bits and config.key_size_bits < requirement.min_key_size_bits:
            issues.append(f"Key size {config.key_size_bits} bits below minimum {requirement.min_key_size_bits} required by {requirement.name}")
        
        if requirement.required_key_rotation_days and config.key_rotation_days > requirement.required_key_rotation_days:
            issues.append(f"Key rotation period {config.key_rotation_days} days exceeds maximum {requirement.required_key_rotation_days} required by {requirement.name}")
        
        if requirement.requires_hsm and not config.hsm_enabled:
            issues.append(f"HSM required by {requirement.name} but not enabled")
        
        return issues
    
    async def _generate_key_management_report(
        self,
        requirement: ComplianceRequirement,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate key management report for compliance"""
        # Get all keys used during period
        keys_used = self.db.query(EncryptionKey).join(EncryptionKeyUsage).filter(
            and_(
                EncryptionKeyUsage.timestamp >= start_date,
                EncryptionKeyUsage.timestamp <= end_date
            )
        ).distinct().all()
        
        return {
            "total_keys_used": len(keys_used),
            "key_types": self._group_keys_by_type(keys_used),
            "hsm_backed_keys": sum(1 for k in keys_used if k.hsm_backed),
            "rotation_compliance": await self._check_rotation_compliance(keys_used, requirement),
            "key_usage_audit": requirement.requires_key_usage_logging
        }
    
    async def _check_rotation_compliance(
        self,
        keys: List[EncryptionKey],
        requirement: ComplianceRequirement
    ) -> Dict[str, Any]:
        """Check key rotation compliance"""
        if not requirement.required_key_rotation_days:
            return {"applicable": False}
        
        compliant_keys = 0
        non_compliant_keys = 0
        
        for key in keys:
            config = self.db.query(EncryptionConfig).filter_by(id=key.config_id).first()
            if config and config.key_rotation_days <= requirement.required_key_rotation_days:
                compliant_keys += 1
            else:
                non_compliant_keys += 1
        
        return {
            "applicable": True,
            "compliant_keys": compliant_keys,
            "non_compliant_keys": non_compliant_keys,
            "compliance_rate": (compliant_keys / len(keys) * 100) if keys else 0
        }
    
    async def _generate_encryption_audit_trail(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate encryption audit trail for compliance"""
        # Get audit events
        key_events = await self.audit_service.get_security_events_by_category(
            start_date=start_date,
            end_date=end_date,
            category="encryption"
        )
        
        return {
            "total_events": len(key_events),
            "event_types": self._group_events_by_type(key_events),
            "key_generations": sum(1 for e in key_events if e.event_type == SecurityEventType.ENCRYPTION_KEY_GENERATED),
            "key_rotations": sum(1 for e in key_events if e.event_type == SecurityEventType.ENCRYPTION_KEY_ROTATED),
            "key_revocations": sum(1 for e in key_events if e.event_type == SecurityEventType.ENCRYPTION_KEY_REVOKED)
        }
    
    def _group_events_by_type(self, events: List[Any]) -> Dict[str, int]:
        """Group events by type"""
        type_counts = {}
        for event in events:
            type_counts[event.event_type] = type_counts.get(event.event_type, 0) + 1
        return type_counts
    
    async def _generate_compliance_recommendations(
        self,
        requirement: ComplianceRequirement,
        non_compliant_configs: List[EncryptionConfig]
    ) -> List[str]:
        """Generate recommendations for compliance"""
        recommendations = []
        
        if non_compliant_configs:
            recommendations.append(
                f"Update {len(non_compliant_configs)} non-compliant configurations to meet {requirement.name} requirements"
            )
        
        # Check for specific issues
        for config in non_compliant_configs:
            issues = await self._identify_compliance_issues(config, requirement)
            for issue in issues:
                if "Algorithm" in issue:
                    recommendations.append(
                        f"Migrate {config.name} from {config.algorithm} to a compliant algorithm"
                    )
                elif "Key size" in issue:
                    recommendations.append(
                        f"Increase key size for {config.name} to meet minimum requirements"
                    )
                elif "rotation" in issue:
                    recommendations.append(
                        f"Reduce key rotation period for {config.name} to {requirement.required_key_rotation_days} days or less"
                    )
                elif "HSM" in issue:
                    recommendations.append(
                        f"Enable HSM backing for {config.name}"
                    )
        
        if requirement.requires_key_escrow:
            recommendations.append(
                "Implement key escrow procedures as required by " + requirement.name
            )
        
        return recommendations