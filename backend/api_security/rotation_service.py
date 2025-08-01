"""
Service for managing API key rotation policies and execution
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .rotation_models import (
    RotationPolicy, APIKeyRotationPolicy, RotationJob, RotationNotification,
    RotationStatus, RotationFrequency, NotificationChannel, RotationMetrics
)
from .models import APIKey, APIKeyRotation
from .service import APIKeyService
from ..auth.models import User
from ..rbac.audit import AuditLogger

class RotationService:
    """Service for managing API key rotations"""
    
    def __init__(self, db: Session, api_key_service: APIKeyService, audit_logger: AuditLogger):
        self.db = db
        self.api_key_service = api_key_service
        self.audit_logger = audit_logger
        self.scheduler = AsyncIOScheduler()
        self.notification_handlers = {}
        
    def start_scheduler(self):
        """Start the rotation scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            self._schedule_all_active_policies()
            
    def stop_scheduler(self):
        """Stop the rotation scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
    
    def create_rotation_policy(
        self,
        user: User,
        name: str,
        frequency: RotationFrequency,
        **kwargs
    ) -> RotationPolicy:
        """Create a new rotation policy"""
        policy = RotationPolicy(
            name=name,
            frequency=frequency,
            created_by=user.id,
            **kwargs
        )
        
        self.db.add(policy)
        self.db.commit()
        
        # Schedule if active
        if policy.is_active:
            self._schedule_policy(policy)
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user.id,
            action="ROTATION_POLICY_CREATED",
            resource_type="rotation_policy",
            resource_id=policy.id,
            details={
                "name": name,
                "frequency": frequency.value,
                "grace_period_hours": policy.grace_period_hours
            }
        )
        
        return policy
    
    def apply_policy_to_keys(
        self,
        policy_id: str,
        api_key_ids: List[str],
        user: User
    ) -> List[APIKeyRotationPolicy]:
        """Apply a rotation policy to API keys"""
        policy = self.db.query(RotationPolicy).filter(
            RotationPolicy.id == policy_id
        ).first()
        
        if not policy:
            raise ValueError("Rotation policy not found")
        
        applications = []
        for key_id in api_key_ids:
            # Check if already applied
            existing = self.db.query(APIKeyRotationPolicy).filter(
                and_(
                    APIKeyRotationPolicy.api_key_id == key_id,
                    APIKeyRotationPolicy.policy_id == policy_id,
                    APIKeyRotationPolicy.is_active == True
                )
            ).first()
            
            if not existing:
                application = APIKeyRotationPolicy(
                    api_key_id=key_id,
                    policy_id=policy_id
                )
                self.db.add(application)
                applications.append(application)
        
        self.db.commit()
        
        # Schedule next rotation check
        self._schedule_next_rotation_check(policy)
        
        return applications
    
    def schedule_rotation(
        self,
        policy_id: str,
        scheduled_at: datetime,
        api_key_ids: Optional[List[str]] = None
    ) -> RotationJob:
        """Schedule a rotation job"""
        policy = self.db.query(RotationPolicy).filter(
            RotationPolicy.id == policy_id
        ).first()
        
        if not policy:
            raise ValueError("Rotation policy not found")
        
        # Determine target keys
        if api_key_ids is None:
            api_key_ids = self._get_policy_target_keys(policy)
        
        job = RotationJob(
            policy_id=policy_id,
            scheduled_at=scheduled_at,
            target_api_keys=api_key_ids,
            approval_required=policy.require_approval
        )
        
        self.db.add(job)
        self.db.commit()
        
        # Schedule notifications
        self._schedule_rotation_notifications(job, policy)
        
        return job
    
    async def execute_rotation_job(self, job_id: str) -> RotationJob:
        """Execute a scheduled rotation job"""
        job = self.db.query(RotationJob).filter(
            RotationJob.id == job_id
        ).first()
        
        if not job:
            raise ValueError("Rotation job not found")
        
        if job.status != RotationStatus.SCHEDULED:
            raise ValueError(f"Job is not in scheduled state: {job.status}")
        
        # Check approval if required
        if job.approval_required and not job.approved_by:
            await self._send_approval_request(job)
            return job
        
        # Start rotation
        job.status = RotationStatus.IN_PROGRESS
        job.started_at = datetime.now(timezone.utc)
        job.execution_log = []
        job.rotated_keys = []
        job.failed_keys = []
        
        self.db.commit()
        
        policy = job.policy
        
        # Rotate each key
        for key_id in job.target_api_keys:
            try:
                # Get the key
                api_key = self.db.query(APIKey).filter(
                    APIKey.id == key_id
                ).first()
                
                if not api_key:
                    job.failed_keys.append({
                        "key_id": key_id,
                        "error": "Key not found"
                    })
                    continue
                
                # Perform rotation
                new_key, new_key_string, rotation = self.api_key_service.rotate_api_key(
                    api_key_id=key_id,
                    initiated_by=api_key.user,
                    grace_period_hours=policy.grace_period_hours
                )
                
                job.rotated_keys.append({
                    "old_key_id": key_id,
                    "new_key_id": new_key.id,
                    "rotation_id": rotation.id
                })
                
                # Log execution
                job.execution_log.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "action": "key_rotated",
                    "key_id": key_id,
                    "new_key_id": new_key.id
                })
                
                # Auto-update if enabled
                if policy.auto_update_enabled:
                    await self._auto_update_key(api_key, new_key, new_key_string, policy)
                
            except Exception as e:
                job.failed_keys.append({
                    "key_id": key_id,
                    "error": str(e)
                })
                job.execution_log.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "action": "rotation_failed",
                    "key_id": key_id,
                    "error": str(e)
                })
        
        # Complete job
        job.status = RotationStatus.COMPLETED if not job.failed_keys else RotationStatus.FAILED
        job.completed_at = datetime.now(timezone.utc)
        
        self.db.commit()
        
        # Send completion notifications
        await self._send_completion_notifications(job)
        
        # Update metrics
        self._update_rotation_metrics(job)
        
        return job
    
    def get_upcoming_rotations(
        self,
        days_ahead: int = 30,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get upcoming scheduled rotations"""
        cutoff_date = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        query = self.db.query(RotationJob).filter(
            and_(
                RotationJob.status == RotationStatus.SCHEDULED,
                RotationJob.scheduled_at <= cutoff_date
            )
        )
        
        if user_id:
            # Filter by user's keys
            user_key_ids = self.db.query(APIKey.id).filter(
                APIKey.user_id == user_id
            ).subquery()
            
            query = query.filter(
                RotationJob.target_api_keys.contains(user_key_ids)
            )
        
        jobs = query.order_by(RotationJob.scheduled_at).all()
        
        upcoming = []
        for job in jobs:
            policy = job.policy
            affected_keys = self.db.query(APIKey).filter(
                APIKey.id.in_(job.target_api_keys)
            ).all()
            
            upcoming.append({
                "job_id": job.id,
                "scheduled_at": job.scheduled_at,
                "policy_name": policy.name,
                "policy_frequency": policy.frequency,
                "affected_keys": [
                    {
                        "id": key.id,
                        "name": key.name,
                        "hint": f"{key.key_prefix}...{key.key_hint}"
                    }
                    for key in affected_keys
                ],
                "requires_approval": job.approval_required,
                "approved": job.approved_by is not None
            })
        
        return upcoming
    
    def get_rotation_history(
        self,
        api_key_id: Optional[str] = None,
        policy_id: Optional[str] = None,
        days_back: int = 90
    ) -> List[Dict[str, Any]]:
        """Get rotation history"""
        since_date = datetime.now(timezone.utc) - timedelta(days=days_back)
        
        query = self.db.query(APIKeyRotation)
        
        if api_key_id:
            query = query.filter(APIKeyRotation.api_key_id == api_key_id)
        
        if policy_id:
            # Join with rotation jobs
            query = query.join(
                RotationJob,
                RotationJob.rotated_keys.contains(APIKeyRotation.id)
            ).filter(RotationJob.policy_id == policy_id)
        
        query = query.filter(APIKeyRotation.initiated_at >= since_date)
        
        rotations = query.order_by(APIKeyRotation.initiated_at.desc()).all()
        
        history = []
        for rotation in rotations:
            api_key = rotation.api_key
            
            history.append({
                "rotation_id": rotation.id,
                "api_key": {
                    "id": api_key.id,
                    "name": api_key.name,
                    "hint": f"{api_key.key_prefix}...{api_key.key_hint}"
                },
                "initiated_at": rotation.initiated_at,
                "completed_at": rotation.completed_at,
                "initiated_by": rotation.initiator.username if rotation.initiator else "System",
                "old_key_hint": rotation.old_key_hint,
                "new_key_id": rotation.new_key_id,
                "status": rotation.status,
                "grace_period_end": rotation.old_key_expires_at
            })
        
        return history
    
    def get_rotation_metrics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> RotationMetrics:
        """Get rotation metrics for a period"""
        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)
        
        # Calculate metrics
        jobs = self.db.query(RotationJob).filter(
            and_(
                RotationJob.scheduled_at >= start_date,
                RotationJob.scheduled_at <= end_date
            )
        ).all()
        
        metrics = RotationMetrics(
            period_start=start_date,
            period_end=end_date,
            total_rotations_scheduled=len(jobs),
            total_rotations_completed=len([j for j in jobs if j.status == RotationStatus.COMPLETED]),
            total_rotations_failed=len([j for j in jobs if j.status == RotationStatus.FAILED])
        )
        
        # Calculate timing metrics
        completed_jobs = [j for j in jobs if j.completed_at and j.started_at]
        if completed_jobs:
            durations = [
                (j.completed_at - j.started_at).total_seconds()
                for j in completed_jobs
            ]
            metrics.average_rotation_time_seconds = int(sum(durations) / len(durations))
            metrics.max_rotation_time_seconds = int(max(durations))
            metrics.min_rotation_time_seconds = int(min(durations))
        
        # Calculate compliance metrics
        rotations = self.db.query(APIKeyRotation).filter(
            APIKeyRotation.initiated_at.between(start_date, end_date)
        ).all()
        
        if rotations:
            # Group by API key to calculate average days between rotations
            key_rotations = {}
            for r in rotations:
                if r.api_key_id not in key_rotations:
                    key_rotations[r.api_key_id] = []
                key_rotations[r.api_key_id].append(r.initiated_at)
            
            intervals = []
            for key_id, dates in key_rotations.items():
                dates.sort()
                for i in range(1, len(dates)):
                    interval = (dates[i] - dates[i-1]).days
                    intervals.append(interval)
            
            if intervals:
                metrics.average_days_between_rotations = int(sum(intervals) / len(intervals))
        
        self.db.add(metrics)
        self.db.commit()
        
        return metrics
    
    def _schedule_policy(self, policy: RotationPolicy):
        """Schedule a policy for execution"""
        if policy.frequency == RotationFrequency.DAILY:
            trigger = CronTrigger(
                hour=policy.rotation_hour_utc,
                timezone="UTC"
            )
        elif policy.frequency == RotationFrequency.WEEKLY:
            trigger = CronTrigger(
                day_of_week=policy.rotation_day_of_week or 0,
                hour=policy.rotation_hour_utc,
                timezone="UTC"
            )
        elif policy.frequency == RotationFrequency.MONTHLY:
            trigger = CronTrigger(
                day=policy.rotation_day_of_month or 1,
                hour=policy.rotation_hour_utc,
                timezone="UTC"
            )
        elif policy.frequency == RotationFrequency.CUSTOM:
            trigger = IntervalTrigger(
                days=policy.custom_interval_days,
                timezone="UTC"
            )
        else:
            # For quarterly, semi-annual, annual - calculate next date
            next_date = self._calculate_next_rotation_date(policy)
            trigger = CronTrigger(
                year=next_date.year,
                month=next_date.month,
                day=next_date.day,
                hour=policy.rotation_hour_utc,
                timezone="UTC"
            )
        
        self.scheduler.add_job(
            self._execute_policy_rotation,
            trigger,
            args=[policy.id],
            id=f"rotation_policy_{policy.id}",
            replace_existing=True
        )
    
    def _calculate_next_rotation_date(self, policy: RotationPolicy) -> datetime:
        """Calculate next rotation date for non-standard frequencies"""
        now = datetime.now(timezone.utc)
        
        if policy.frequency == RotationFrequency.QUARTERLY:
            # Next quarter start
            quarter = (now.month - 1) // 3
            next_quarter = (quarter + 1) % 4
            year = now.year if next_quarter > quarter else now.year + 1
            month = next_quarter * 3 + 1
            return datetime(year, month, 1, policy.rotation_hour_utc, tzinfo=timezone.utc)
        
        elif policy.frequency == RotationFrequency.SEMI_ANNUALLY:
            # Next half-year
            if now.month <= 6:
                return datetime(now.year, 7, 1, policy.rotation_hour_utc, tzinfo=timezone.utc)
            else:
                return datetime(now.year + 1, 1, 1, policy.rotation_hour_utc, tzinfo=timezone.utc)
        
        elif policy.frequency == RotationFrequency.ANNUALLY:
            # Next year
            return datetime(now.year + 1, 1, 1, policy.rotation_hour_utc, tzinfo=timezone.utc)
        
        return now + timedelta(days=30)  # Default fallback
    
    def _get_policy_target_keys(self, policy: RotationPolicy) -> List[str]:
        """Get API keys targeted by a policy"""
        if policy.applies_to_all_keys:
            query = self.db.query(APIKey.id).filter(
                APIKey.status == "active"
            )
            
            if policy.excluded_api_keys:
                query = query.filter(
                    ~APIKey.id.in_(policy.excluded_api_keys)
                )
            
            return [key_id[0] for key_id in query.all()]
        
        else:
            # Get keys with matching tags or explicit policy application
            key_ids = set()
            
            # Keys with matching tags
            if policy.api_key_tags:
                tagged_keys = self.db.query(APIKey.id).filter(
                    and_(
                        APIKey.status == "active",
                        APIKey.tags.op("@>")(policy.api_key_tags)
                    )
                ).all()
                key_ids.update([k[0] for k in tagged_keys])
            
            # Keys with explicit policy application
            applications = self.db.query(APIKeyRotationPolicy.api_key_id).filter(
                and_(
                    APIKeyRotationPolicy.policy_id == policy.id,
                    APIKeyRotationPolicy.is_active == True
                )
            ).all()
            key_ids.update([a[0] for a in applications])
            
            # Remove excluded keys
            if policy.excluded_api_keys:
                key_ids -= set(policy.excluded_api_keys)
            
            return list(key_ids)
    
    async def _execute_policy_rotation(self, policy_id: str):
        """Execute rotation for a policy"""
        policy = self.db.query(RotationPolicy).filter(
            RotationPolicy.id == policy_id
        ).first()
        
        if not policy or not policy.is_active:
            return
        
        # Create rotation job
        job = self.schedule_rotation(
            policy_id=policy_id,
            scheduled_at=datetime.now(timezone.utc)
        )
        
        # Execute if no approval required
        if not policy.require_approval:
            await self.execute_rotation_job(job.id)
    
    def _schedule_next_rotation_check(self, policy: RotationPolicy):
        """Schedule next rotation check for a policy"""
        self._schedule_policy(policy)
    
    def _schedule_rotation_notifications(self, job: RotationJob, policy: RotationPolicy):
        """Schedule notifications for upcoming rotation"""
        for days_before in policy.notify_days_before:
            notify_at = job.scheduled_at - timedelta(days=days_before)
            
            if notify_at > datetime.now(timezone.utc):
                self.scheduler.add_job(
                    self._send_rotation_reminder,
                    'date',
                    run_date=notify_at,
                    args=[job.id, days_before],
                    id=f"rotation_reminder_{job.id}_{days_before}d"
                )
    
    async def _send_rotation_reminder(self, job_id: str, days_before: int):
        """Send rotation reminder notification"""
        job = self.db.query(RotationJob).filter(
            RotationJob.id == job_id
        ).first()
        
        if not job or job.status != RotationStatus.SCHEDULED:
            return
        
        policy = job.policy
        
        # Get affected keys
        affected_keys = self.db.query(APIKey).filter(
            APIKey.id.in_(job.target_api_keys)
        ).all()
        
        # Send notifications
        for channel in policy.notification_channels:
            await self._send_notification(
                channel=NotificationChannel(channel),
                recipients=policy.notification_recipients,
                subject=f"API Key Rotation Reminder - {days_before} days",
                message=f"The following API keys are scheduled for rotation in {days_before} days:\n" +
                       "\n".join([f"- {key.name} ({key.key_prefix}...{key.key_hint})" for key in affected_keys]),
                job=job,
                metadata={
                    "days_before": days_before,
                    "affected_keys": [key.id for key in affected_keys]
                }
            )
    
    async def _send_approval_request(self, job: RotationJob):
        """Send approval request for rotation"""
        policy = job.policy
        
        # Get approvers
        approvers = self.db.query(User).join(
            User.roles
        ).filter(
            User.roles.any(name.in_(policy.approver_roles))
        ).all()
        
        for approver in approvers:
            await self._send_notification(
                channel=NotificationChannel.EMAIL,
                recipients=[approver.email],
                subject="API Key Rotation Approval Required",
                message=f"Rotation job {job.id} requires approval. Please review and approve.",
                job=job,
                metadata={
                    "approval_required": True,
                    "job_id": job.id
                }
            )
    
    async def _send_completion_notifications(self, job: RotationJob):
        """Send notifications after rotation completion"""
        policy = job.policy
        status = "completed successfully" if job.status == RotationStatus.COMPLETED else "failed"
        
        message = f"API Key rotation {status}.\n\n"
        if job.rotated_keys:
            message += f"Successfully rotated {len(job.rotated_keys)} keys.\n"
        if job.failed_keys:
            message += f"Failed to rotate {len(job.failed_keys)} keys.\n"
        
        for channel in policy.notification_channels:
            await self._send_notification(
                channel=NotificationChannel(channel),
                recipients=policy.notification_recipients,
                subject=f"API Key Rotation {status.title()}",
                message=message,
                job=job,
                metadata={
                    "status": job.status.value,
                    "rotated_count": len(job.rotated_keys),
                    "failed_count": len(job.failed_keys)
                }
            )
    
    async def _send_notification(
        self,
        channel: NotificationChannel,
        recipients: List[str],
        subject: str,
        message: str,
        job: RotationJob,
        metadata: Dict[str, Any]
    ):
        """Send a notification through specified channel"""
        for recipient in recipients:
            notification = RotationNotification(
                job_id=job.id,
                channel=channel,
                recipient=recipient,
                subject=subject,
                message=message,
                metadata=metadata,
                sent_at=datetime.now(timezone.utc)
            )
            
            try:
                # Send through appropriate handler
                handler = self.notification_handlers.get(channel)
                if handler:
                    response = await handler(recipient, subject, message, metadata)
                    notification.delivered = True
                    notification.response_code = response.get("code", 200)
                    notification.response_body = json.dumps(response)
                else:
                    notification.error_message = f"No handler for channel: {channel}"
            
            except Exception as e:
                notification.error_message = str(e)
                notification.delivered = False
            
            self.db.add(notification)
            self.db.commit()
    
    async def _auto_update_key(
        self,
        old_key: APIKey,
        new_key: APIKey,
        new_key_string: str,
        policy: RotationPolicy
    ):
        """Automatically update key in external systems"""
        if not policy.auto_update_config:
            return
        
        connector_id = policy.auto_update_config.get("connector_id")
        if not connector_id:
            return
        
        # Get connector (implementation would connect to external systems)
        # This is a placeholder for the actual implementation
        pass
    
    def _update_rotation_metrics(self, job: RotationJob):
        """Update rotation metrics after job completion"""
        # This would update the metrics table
        # Implementation depends on specific metric requirements
        pass
    
    def _schedule_all_active_policies(self):
        """Schedule all active policies on startup"""
        active_policies = self.db.query(RotationPolicy).filter(
            RotationPolicy.is_active == True
        ).all()
        
        for policy in active_policies:
            self._schedule_policy(policy)