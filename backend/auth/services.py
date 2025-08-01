"""
Authentication service for handling user authentication, registration, and token management
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status

from .models import User, Role, RefreshToken, LoginHistory
from .schemas import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    TwoFactorSetupResponse, PasswordReset, PasswordResetConfirm
)
from .utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    verify_token, generate_totp_secret, generate_totp_uri, generate_qr_code,
    verify_totp, generate_backup_codes, hash_token, generate_secure_token,
    sanitize_user_agent
)

class AuthService:
    """Service class for authentication operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def register_user(self, user_data: UserCreate) -> User:
        """Register a new user"""
        # Check if user already exists
        existing_user = self.db.query(User).filter(
            or_(User.email == user_data.email, User.username == user_data.username)
        ).first()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Create new user
        user = User(
            id=str(uuid.uuid4()),
            email=user_data.email,
            username=user_data.username,
            password_hash=hash_password(user_data.password),
            full_name=user_data.full_name
        )
        
        # Assign default role
        default_role = self.db.query(Role).filter(Role.name == "user").first()
        if default_role:
            user.roles.append(default_role)
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    async def authenticate_user(
        self, 
        login_data: UserLogin, 
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[User, str, str]:
        """Authenticate user and return user, access token, and refresh token"""
        # Find user by username or email
        user = self.db.query(User).filter(
            or_(
                User.username == login_data.username_or_email,
                User.email == login_data.username_or_email
            )
        ).first()
        
        # Track login attempt
        login_history = LoginHistory(
            id=str(uuid.uuid4()),
            user_id=user.id if user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=sanitize_user_agent(user_agent) if user_agent else None
        )
        
        if not user:
            login_history.login_successful = False
            login_history.failure_reason = "user_not_found"
            self.db.add(login_history)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            login_history.login_successful = False
            login_history.failure_reason = "account_locked"
            self.db.add(login_history)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Account locked until {user.locked_until.isoformat()}"
            )
        
        # Verify password
        if not verify_password(login_data.password, user.password_hash):
            # Increment failed login attempts
            user.failed_login_attempts += 1
            
            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
                login_history.failure_reason = "too_many_attempts"
            else:
                login_history.failure_reason = "invalid_password"
            
            login_history.login_successful = False
            self.db.add(login_history)
            self.db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if account is active
        if not user.is_active:
            login_history.login_successful = False
            login_history.failure_reason = "account_inactive"
            self.db.add(login_history)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive"
            )
        
        # Reset failed login attempts on successful login
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        user.last_login_ip = ip_address
        
        # Create tokens
        access_token = create_access_token({
            "sub": user.id,
            "username": user.username,
            "email": user.email,
            "roles": [role.name for role in user.roles]
        })
        
        # Create refresh token
        device_name = sanitize_user_agent(user_agent) if user_agent else None
        refresh_token, token_hash, expires_at = create_refresh_token(
            user.id, 
            device_id=login_data.device_name
        )
        
        # Store refresh token
        refresh_token_record = RefreshToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token_hash=token_hash,
            device_id=login_data.device_name,
            device_name=device_name,
            ip_address=ip_address,
            expires_at=expires_at
        )
        
        self.db.add(refresh_token_record)
        self.db.add(login_history)
        self.db.commit()
        
        return user, access_token, refresh_token
    
    async def refresh_access_token(
        self, 
        refresh_token: str,
        ip_address: Optional[str] = None
    ) -> str:
        """Validate refresh token and issue new access token"""
        # Verify refresh token
        payload = verify_token(refresh_token, token_type="refresh")
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get token hash from JWT
        token_hash = payload.get("jti")
        if not token_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Find refresh token record
        token_record = self.db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash
        ).first()
        
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found"
            )
        
        # Check if token is revoked
        if token_record.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked"
            )
        
        # Check if token is expired
        if token_record.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )
        
        # Get user
        user = self.db.query(User).filter(User.id == token_record.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Update token usage
        token_record.last_used_at = datetime.now(timezone.utc)
        
        # Create new access token
        access_token = create_access_token({
            "sub": user.id,
            "username": user.username,
            "email": user.email,
            "roles": [role.name for role in user.roles]
        })
        
        self.db.commit()
        
        return access_token
    
    async def setup_2fa(self, user_id: str, password: str) -> TwoFactorSetupResponse:
        """Setup 2FA for user"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify password
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password"
            )
        
        # Generate TOTP secret
        secret = generate_totp_secret()
        uri = generate_totp_uri(secret, user.username)
        qr_code = generate_qr_code(uri)
        
        # Generate backup codes
        backup_codes = generate_backup_codes()
        
        # Store encrypted secret and backup codes
        user.two_factor_secret = secret  # In production, encrypt this
        user.two_factor_backup_codes = ",".join(backup_codes)  # In production, encrypt this
        
        self.db.commit()
        
        return TwoFactorSetupResponse(
            secret=secret,
            qr_code=qr_code,
            backup_codes=backup_codes
        )
    
    async def verify_2fa(self, user_id: str, code: str) -> bool:
        """Verify 2FA code"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.two_factor_secret:
            return False
        
        # Verify TOTP code
        if verify_totp(user.two_factor_secret, code):
            if not user.two_factor_enabled:
                user.two_factor_enabled = True
                self.db.commit()
            return True
        
        # Check backup codes
        if user.two_factor_backup_codes:
            backup_codes = user.two_factor_backup_codes.split(",")
            if code in backup_codes:
                # Remove used backup code
                backup_codes.remove(code)
                user.two_factor_backup_codes = ",".join(backup_codes)
                self.db.commit()
                return True
        
        return False
    
    async def logout(self, user_id: str, refresh_token: Optional[str] = None):
        """Logout user and revoke refresh tokens"""
        if refresh_token:
            # Revoke specific refresh token
            payload = verify_token(refresh_token, token_type="refresh")
            if payload:
                token_hash = payload.get("jti")
                token_record = self.db.query(RefreshToken).filter(
                    RefreshToken.token_hash == token_hash
                ).first()
                if token_record:
                    token_record.is_revoked = True
                    token_record.revoked_at = datetime.now(timezone.utc)
                    token_record.revoked_reason = "user_logout"
        else:
            # Revoke all user's refresh tokens
            self.db.query(RefreshToken).filter(
                and_(
                    RefreshToken.user_id == user_id,
                    RefreshToken.is_revoked == False
                )
            ).update({
                "is_revoked": True,
                "revoked_at": datetime.now(timezone.utc),
                "revoked_reason": "user_logout_all"
            })
        
        self.db.commit()
    
    async def request_password_reset(self, email: str) -> str:
        """Generate password reset token"""
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            # Don't reveal if user exists
            return "If the email exists, a reset link has been sent"
        
        # Generate reset token
        reset_token = generate_secure_token()
        user.password_reset_token = hash_token(reset_token)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        
        self.db.commit()
        
        # In production, send email with reset link
        # For now, return the token (DO NOT DO THIS IN PRODUCTION)
        return reset_token
    
    async def reset_password(self, token: str, new_password: str):
        """Reset password using token"""
        token_hash = hash_token(token)
        
        user = self.db.query(User).filter(
            and_(
                User.password_reset_token == token_hash,
                User.password_reset_expires > datetime.now(timezone.utc)
            )
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        # Update password
        user.password_hash = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        
        # Revoke all refresh tokens for security
        self.db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id
        ).update({
            "is_revoked": True,
            "revoked_at": datetime.now(timezone.utc),
            "revoked_reason": "password_reset"
        })
        
        self.db.commit()
    
    async def get_user_sessions(self, user_id: str) -> List[RefreshToken]:
        """Get all active sessions for a user"""
        return self.db.query(RefreshToken).filter(
            and_(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        ).all()
    
    async def revoke_session(self, user_id: str, token_id: str):
        """Revoke a specific session"""
        token = self.db.query(RefreshToken).filter(
            and_(
                RefreshToken.id == token_id,
                RefreshToken.user_id == user_id
            )
        ).first()
        
        if token:
            token.is_revoked = True
            token.revoked_at = datetime.now(timezone.utc)
            token.revoked_reason = "user_revoked"
            self.db.commit()