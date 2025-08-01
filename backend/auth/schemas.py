"""
Pydantic schemas for authentication requests and responses
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
import re

# Password validation regex (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'
)

class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, regex='^[a-zA-Z0-9_-]+$')
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if not PASSWORD_REGEX.match(v):
            raise ValueError(
                'Password must be at least 8 characters long and contain at least '
                'one uppercase letter, one lowercase letter, one number, and one special character'
            )
        return v

class UserLogin(BaseModel):
    """Schema for user login"""
    username_or_email: str
    password: str
    remember_me: bool = False
    device_name: Optional[str] = None

class TwoFactorVerify(BaseModel):
    """Schema for 2FA verification"""
    code: str = Field(..., regex='^[0-9]{6}$')

class TwoFactorSetup(BaseModel):
    """Schema for 2FA setup"""
    password: str  # Require password confirmation

class PasswordReset(BaseModel):
    """Schema for password reset request"""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if not PASSWORD_REGEX.match(v):
            raise ValueError(
                'Password must be at least 8 characters long and contain at least '
                'one uppercase letter, one lowercase letter, one number, and one special character'
            )
        return v

class PasswordChange(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if not PASSWORD_REGEX.match(v):
            raise ValueError(
                'Password must be at least 8 characters long and contain at least '
                'one uppercase letter, one lowercase letter, one number, and one special character'
            )
        return v

class UserResponse(BaseModel):
    """Schema for user response"""
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    two_factor_enabled: bool
    roles: List[str] = []
    created_at: datetime
    last_login_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserResponse

class RefreshTokenResponse(BaseModel):
    """Schema for refresh token response"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int

class TwoFactorSetupResponse(BaseModel):
    """Schema for 2FA setup response"""
    secret: str
    qr_code: str  # Base64 encoded QR code image
    backup_codes: List[str]

class LoginHistoryResponse(BaseModel):
    """Schema for login history"""
    id: str
    login_at: datetime
    ip_address: Optional[str]
    device_name: Optional[str]
    country: Optional[str]
    city: Optional[str]
    suspicious_activity_detected: bool
    
    class Config:
        orm_mode = True

class SessionInfo(BaseModel):
    """Schema for active session information"""
    token_id: str
    device_name: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    last_used_at: Optional[datetime]
    expires_at: datetime

class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None

class SuccessResponse(BaseModel):
    """Standard success response"""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None