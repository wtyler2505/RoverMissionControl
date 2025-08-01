"""
FastAPI router for authentication endpoints
"""
from datetime import timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from .schemas import (
    UserCreate, UserLogin, UserResponse, TokenResponse, RefreshTokenResponse,
    TwoFactorVerify, TwoFactorSetup, TwoFactorSetupResponse,
    PasswordReset, PasswordResetConfirm, PasswordChange,
    LoginHistoryResponse, SessionInfo, ErrorResponse, SuccessResponse
)
from .services import AuthService
from .dependencies import get_current_user, get_current_verified_user, require_2fa
from .models import User
from .utils import ACCESS_TOKEN_EXPIRE_MINUTES, generate_csrf_token, verify_csrf_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Dependency to get database session (to be injected from main app)
def get_db():
    # This will be overridden when router is included in main app
    raise NotImplementedError("Database dependency not configured")

@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user account"""
    service = AuthService(db)
    try:
        user = await service.register_user(user_data)
        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            is_verified=user.is_verified,
            two_factor_enabled=user.two_factor_enabled,
            roles=[role.name for role in user.roles],
            created_at=user.created_at,
            last_login_at=user.last_login_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Login with username/email and password"""
    service = AuthService(db)
    
    # Get client IP and user agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    
    try:
        user, access_token, refresh_token = await service.authenticate_user(
            login_data, 
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Set refresh token in httpOnly cookie
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,  # Set to False for development without HTTPS
            samesite="strict",
            max_age=30 * 24 * 60 * 60  # 30 days
        )
        
        # Set CSRF token in regular cookie
        csrf_token = generate_csrf_token()
        response.set_cookie(
            key="csrf_token",
            value=csrf_token,
            secure=True,  # Set to False for development without HTTPS
            samesite="strict",
            max_age=30 * 24 * 60 * 60  # 30 days
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                is_verified=user.is_verified,
                two_factor_enabled=user.two_factor_enabled,
                roles=[role.name for role in user.roles],
                created_at=user.created_at,
                last_login_at=user.last_login_at
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token from cookie"""
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    # Verify CSRF token
    csrf_token_cookie = request.cookies.get("csrf_token")
    csrf_token_header = request.headers.get("X-CSRF-Token")
    
    if not csrf_token_cookie or not csrf_token_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing"
        )
    
    if not verify_csrf_token(csrf_token_header, csrf_token_cookie):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token"
        )
    
    # Get client IP
    client_ip = request.client.host if request.client else None
    
    service = AuthService(db)
    try:
        access_token = await service.refresh_access_token(refresh_token, ip_address=client_ip)
        return RefreshTokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/logout", response_model=SuccessResponse)
async def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout current session"""
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    
    service = AuthService(db)
    try:
        await service.logout(current_user.id, refresh_token)
        
        # Clear cookies
        response.delete_cookie("refresh_token")
        response.delete_cookie("csrf_token")
        
        return SuccessResponse(message="Logged out successfully")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/logout-all", response_model=SuccessResponse)
async def logout_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout all sessions for current user"""
    service = AuthService(db)
    try:
        await service.logout(current_user.id)
        return SuccessResponse(message="All sessions logged out successfully")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        two_factor_enabled=current_user.two_factor_enabled,
        roles=[role.name for role in current_user.roles],
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at
    )

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(
    setup_data: TwoFactorSetup,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Setup two-factor authentication"""
    service = AuthService(db)
    try:
        return await service.setup_2fa(current_user.id, setup_data.password)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/2fa/verify", response_model=SuccessResponse)
async def verify_two_factor(
    verify_data: TwoFactorVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify two-factor authentication code"""
    service = AuthService(db)
    try:
        is_valid = await service.verify_2fa(current_user.id, verify_data.code)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        return SuccessResponse(message="Two-factor authentication verified successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/2fa/disable", response_model=SuccessResponse)
async def disable_two_factor(
    setup_data: TwoFactorSetup,
    current_user: User = Depends(require_2fa),
    db: Session = Depends(get_db)
):
    """Disable two-factor authentication"""
    # Verify password
    service = AuthService(db)
    from .utils import verify_password
    
    if not verify_password(setup_data.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Disable 2FA
    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    current_user.two_factor_backup_codes = None
    db.commit()
    
    return SuccessResponse(message="Two-factor authentication disabled successfully")

@router.post("/password/reset", response_model=SuccessResponse)
async def request_password_reset(
    reset_data: PasswordReset,
    db: Session = Depends(get_db)
):
    """Request password reset token"""
    service = AuthService(db)
    try:
        message = await service.request_password_reset(reset_data.email)
        return SuccessResponse(
            message="If the email exists, a reset link has been sent",
            data={"reset_token": message}  # REMOVE THIS IN PRODUCTION
        )
    except Exception as e:
        # Don't reveal errors for security
        return SuccessResponse(
            message="If the email exists, a reset link has been sent"
        )

@router.post("/password/reset/confirm", response_model=SuccessResponse)
async def confirm_password_reset(
    confirm_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password with token"""
    service = AuthService(db)
    try:
        await service.reset_password(confirm_data.token, confirm_data.new_password)
        return SuccessResponse(message="Password reset successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/password/change", response_model=SuccessResponse)
async def change_password(
    change_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password for authenticated user"""
    from .utils import verify_password, hash_password
    
    # Verify current password
    if not verify_password(change_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid current password"
        )
    
    # Update password
    current_user.password_hash = hash_password(change_data.new_password)
    db.commit()
    
    # Revoke all refresh tokens except current session
    service = AuthService(db)
    await service.logout(current_user.id)
    
    return SuccessResponse(message="Password changed successfully")

@router.get("/sessions", response_model=List[SessionInfo])
async def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active sessions for current user"""
    service = AuthService(db)
    sessions = await service.get_user_sessions(current_user.id)
    
    return [
        SessionInfo(
            token_id=session.id,
            device_name=session.device_name,
            ip_address=session.ip_address,
            created_at=session.created_at,
            last_used_at=session.last_used_at,
            expires_at=session.expires_at
        )
        for session in sessions
    ]

@router.delete("/sessions/{session_id}", response_model=SuccessResponse)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific session"""
    service = AuthService(db)
    try:
        await service.revoke_session(current_user.id, session_id)
        return SuccessResponse(message="Session revoked successfully")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/login-history", response_model=List[LoginHistoryResponse])
async def get_login_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """Get login history for current user"""
    history = db.query(current_user.login_history).order_by(
        current_user.login_history.login_at.desc()
    ).limit(limit).all()
    
    return [
        LoginHistoryResponse(
            id=entry.id,
            login_at=entry.login_at,
            ip_address=entry.ip_address,
            device_name=entry.device_fingerprint,
            country=entry.country,
            city=entry.city,
            suspicious_activity_detected=entry.suspicious_activity_detected
        )
        for entry in history
    ]