"""
Integration module to connect authentication system with existing FastAPI application
"""
from fastapi import FastAPI, Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
import os

from .router import router as auth_router
from .models import Base
from .utils import generate_rsa_keys

def get_database_url() -> str:
    """Get database URL from environment or use default"""
    db_path = os.getenv("DATABASE_URL")
    if not db_path:
        # Default path
        db_path = Path(__file__).parent.parent.parent / "shared" / "data" / "rover_platform.db"
        db_path = db_path.resolve()
    return f"sqlite:///{db_path}"

def create_db_session():
    """Create database session"""
    database_url = get_database_url()
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    return SessionLocal

# Create session factory
SessionLocal = create_db_session()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def integrate_auth(app: FastAPI):
    """Integrate authentication into existing FastAPI app"""
    
    # Generate RSA keys if not present
    if not os.getenv("JWT_PRIVATE_KEY"):
        private_key, public_key = generate_rsa_keys()
        os.environ["JWT_PRIVATE_KEY"] = private_key
        os.environ["JWT_PUBLIC_KEY"] = public_key
        print("[AUTH] Generated RSA key pair for JWT signing")
    
    # Override the get_db dependency in auth router
    auth_router.dependency_overrides[lambda: None] = get_db
    
    # Include auth router
    app.include_router(auth_router)
    
    print("[AUTH] Authentication system integrated successfully")
    print("[AUTH] Available endpoints:")
    print("  - POST   /api/auth/register")
    print("  - POST   /api/auth/login")
    print("  - POST   /api/auth/refresh")
    print("  - POST   /api/auth/logout")
    print("  - GET    /api/auth/me")
    print("  - POST   /api/auth/2fa/setup")
    print("  - POST   /api/auth/2fa/verify")
    print("  - POST   /api/auth/password/reset")
    print("  - POST   /api/auth/password/change")
    print("  - GET    /api/auth/sessions")
    print("  - GET    /api/auth/login-history")
    
    return app

def protect_endpoint(roles: list = None):
    """Decorator to protect endpoints with authentication"""
    from .dependencies import get_current_user, require_roles
    
    if roles:
        return Depends(require_roles(roles))
    return Depends(get_current_user)

# Export common dependencies
from .dependencies import (
    get_current_user,
    get_current_verified_user,
    require_2fa,
    require_admin,
    require_operator,
    require_viewer,
    can_control_rover,
    can_view_telemetry,
    can_manage_users
)