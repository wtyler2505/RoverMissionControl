"""
Authentication utilities for JWT tokens, password hashing, and security functions
"""
import os
import secrets
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple, List
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import jwt
from passlib.context import CryptContext
import pyotp
import qrcode
from io import BytesIO

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# JWT configuration
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30
JWT_ALGORITHM = "RS256"
JWT_ISSUER = "RoverMissionControl"
JWT_AUDIENCE = "RoverMissionControl-API"

def generate_rsa_keys() -> Tuple[str, str]:
    """Generate RSA key pair for JWT signing"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Private key in PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    # Public key in PEM format
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem

def get_private_key() -> str:
    """Get private key from environment or generate if not exists"""
    private_key = os.getenv("JWT_PRIVATE_KEY")
    if not private_key:
        # In production, this should be loaded from secure storage
        private_key, _ = generate_rsa_keys()
    else:
        # Decode from base64 if stored encoded
        try:
            private_key = base64.b64decode(private_key).decode('utf-8')
        except:
            pass  # Assume it's already decoded
    return private_key

def get_public_key() -> str:
    """Get public key from environment or derive from private key"""
    public_key = os.getenv("JWT_PUBLIC_KEY")
    if not public_key:
        private_key_str = get_private_key()
        private_key = serialization.load_pem_private_key(
            private_key_str.encode(),
            password=None,
            backend=default_backend()
        )
        public_key = private_key.public_key()
        public_key = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
    else:
        # Decode from base64 if stored encoded
        try:
            public_key = base64.b64decode(public_key).decode('utf-8')
        except:
            pass  # Assume it's already decoded
    return public_key

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with RS256"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "type": "access"
    })
    
    private_key = get_private_key()
    encoded_jwt = jwt.encode(to_encode, private_key, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(user_id: str, device_id: Optional[str] = None) -> Tuple[str, str, datetime]:
    """Create a refresh token and return (token, token_hash, expiry)"""
    # Generate a secure random token
    token = secrets.token_urlsafe(32)
    
    # Create token hash for storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Set expiry
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Create JWT with minimal claims
    claims = {
        "sub": user_id,
        "jti": token_hash,
        "type": "refresh",
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE
    }
    
    if device_id:
        claims["device_id"] = device_id
    
    private_key = get_private_key()
    jwt_token = jwt.encode(claims, private_key, algorithm=JWT_ALGORITHM)
    
    return jwt_token, token_hash, expires_at

def verify_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token"""
    try:
        public_key = get_public_key()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE
        )
        
        # Verify token type
        if payload.get("type") != token_type:
            return None
            
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def generate_totp_secret() -> str:
    """Generate a TOTP secret for 2FA"""
    return pyotp.random_base32()

def generate_totp_uri(secret: str, username: str, issuer: str = "RoverMissionControl") -> str:
    """Generate TOTP URI for QR code"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(username, issuer_name=issuer)

def generate_qr_code(uri: str) -> str:
    """Generate QR code for TOTP URI and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    
    return base64.b64encode(buffer.getvalue()).decode()

def verify_totp(secret: str, token: str, window: int = 1) -> bool:
    """Verify a TOTP token"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=window)

def generate_backup_codes(count: int = 8) -> List[str]:
    """Generate backup codes for 2FA"""
    return [secrets.token_hex(4) + "-" + secrets.token_hex(4) for _ in range(count)]

def hash_token(token: str) -> str:
    """Create SHA256 hash of a token"""
    return hashlib.sha256(token.encode()).hexdigest()

def generate_secure_token(length: int = 32) -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(length)

def generate_csrf_token() -> str:
    """Generate a CSRF token"""
    return secrets.token_hex(32)

def verify_csrf_token(token: str, expected: str) -> bool:
    """Verify CSRF token using constant-time comparison"""
    return secrets.compare_digest(token, expected)

def is_strong_password(password: str) -> bool:
    """Check if password meets strength requirements"""
    # At least 8 characters
    if len(password) < 8:
        return False
    
    # Contains uppercase
    if not any(c.isupper() for c in password):
        return False
    
    # Contains lowercase
    if not any(c.islower() for c in password):
        return False
    
    # Contains digit
    if not any(c.isdigit() for c in password):
        return False
    
    # Contains special character
    if not any(c in '@$!%*?&' for c in password):
        return False
    
    return True

def sanitize_user_agent(user_agent: str) -> str:
    """Extract readable device name from user agent"""
    # Simple extraction - in production, use a proper user agent parser
    if "Chrome" in user_agent:
        browser = "Chrome"
    elif "Firefox" in user_agent:
        browser = "Firefox"
    elif "Safari" in user_agent:
        browser = "Safari"
    elif "Edge" in user_agent:
        browser = "Edge"
    else:
        browser = "Unknown Browser"
    
    if "Windows" in user_agent:
        os_name = "Windows"
    elif "Mac" in user_agent:
        os_name = "macOS"
    elif "Linux" in user_agent:
        os_name = "Linux"
    elif "Android" in user_agent:
        os_name = "Android"
    elif "iOS" in user_agent or "iPhone" in user_agent:
        os_name = "iOS"
    else:
        os_name = "Unknown OS"
    
    return f"{browser} on {os_name}"