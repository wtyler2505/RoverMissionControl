"""
Enhanced FastAPI server with integrated authentication system
"""
from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect, File, UploadFile, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import asyncio
import json
import random
import time
import os
import httpx
import subprocess
import tempfile
import aiofiles
from datetime import datetime
from typing import Dict, Any, List, Optional, AsyncGenerator
import uvicorn
import serial
import serial.tools.list_ports
from pathlib import Path
import markdown
import sqlite3
from threading import Thread
import queue
import math
import logging
from contextlib import asynccontextmanager

# Import authentication modules
from auth.router import router as auth_router
from auth.dependencies import get_current_user, get_optional_user, require_roles, require_admin, require_operator
from auth.models import Base, User
import auth.router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = "sqlite:///./shared/data/rover_platform.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override the auth router's get_db dependency
auth.router.get_db = get_db

# App initialization
app = FastAPI(
    title="Rover Development Platform API",
    description="Secure API for Rover Mission Control with authentication",
    version="2.0.0"
)

# CORS configuration - More restrictive for production
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include authentication router
app.include_router(auth_router)

# Claude API configuration - Now from environment
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
if not CLAUDE_API_KEY:
    logger.warning("CLAUDE_API_KEY not found in environment variables")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Directories
BASE_DIR = Path("/app")
PROJECTS_DIR = BASE_DIR / "projects"
SKETCHES_DIR = PROJECTS_DIR / "sketches"
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = BASE_DIR / "docs"
LIBRARIES_DIR = BASE_DIR / "libraries"

# Create directories
for dir_path in [PROJECTS_DIR, SKETCHES_DIR, DATA_DIR, DOCS_DIR, LIBRARIES_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# WebSocket connections management with authentication
class AuthenticatedConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # user_id -> connections
        self.connection_users: Dict[WebSocket, str] = {}  # connection -> user_id
        self.last_heartbeat = {}
        self.watchdog_timeout = 500  # 500ms watchdog timeout
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        self.connection_users[websocket] = user_id
        self.last_heartbeat[websocket] = time.time() * 1000
        
        logger.info(f"WebSocket connected for user: {user_id}")
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.connection_users:
            user_id = self.connection_users[websocket]
            
            if user_id in self.active_connections:
                self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            
            del self.connection_users[websocket]
            
        if websocket in self.last_heartbeat:
            del self.last_heartbeat[websocket]
            
    async def broadcast(self, message: dict, user_id: Optional[str] = None):
        """Broadcast to all connections or specific user"""
        if user_id:
            connections = self.active_connections.get(user_id, [])
        else:
            connections = [ws for ws_list in self.active_connections.values() for ws in ws_list]
        
        for connection in connections.copy():
            try:
                await connection.send_text(json.dumps(message))
            except:
                self.disconnect(connection)
    
    async def broadcast_to_role(self, message: dict, role: str, db: Session):
        """Broadcast to all users with a specific role"""
        for user_id, connections in self.active_connections.items():
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.has_role(role):
                for connection in connections.copy():
                    try:
                        await connection.send_text(json.dumps(message))
                    except:
                        self.disconnect(connection)
    
    def update_heartbeat(self, websocket: WebSocket):
        """Update heartbeat timestamp"""
        self.last_heartbeat[websocket] = time.time() * 1000
    
    def check_watchdog(self) -> bool:
        """Check if any connection has timed out"""
        current_time = time.time() * 1000
        for ws, last_beat in self.last_heartbeat.items():
            if current_time - last_beat > self.watchdog_timeout:
                return True  # Watchdog timeout
        return len(self.last_heartbeat) == 0  # No active connections

manager = AuthenticatedConnectionManager()

# Copy all the existing code from server.py but with authentication decorators
# ... (RoverSimulator, SerialManager, etc. - keeping them as is)

# Protected endpoints - Rover Control
@app.post("/api/rover/control")
async def control_rover(
    command: dict, 
    current_user: User = Depends(require_operator),
    db: Session = Depends(get_db)
):
    """Control rover movement - requires operator role"""
    # Log the command for audit
    logger.info(f"User {current_user.username} executing rover command: {command}")
    
    # Original control logic here...
    return {"status": "success", "message": f"Command executed by {current_user.username}"}

@app.post("/api/rover/emergency-stop")
async def emergency_stop(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Emergency stop - any authenticated user can trigger"""
    logger.warning(f"EMERGENCY STOP triggered by {current_user.username}")
    
    # Broadcast emergency stop to all operators
    await manager.broadcast_to_role({
        "type": "emergency_stop",
        "triggered_by": current_user.username,
        "timestamp": datetime.now().isoformat()
    }, "operator", db)
    
    return {"status": "success", "message": "Emergency stop activated"}

# Public endpoints - Read only
@app.get("/api/rover/status")
async def get_rover_status(current_user: Optional[User] = Depends(get_optional_user)):
    """Get rover status - public endpoint but logs authenticated users"""
    if current_user:
        logger.info(f"Rover status requested by {current_user.username}")
    
    # Return rover status...
    return {"status": "operational", "battery": 85, "temperature": 22}

# Protected WebSocket endpoint
@app.websocket("/api/ws/telemetry")
async def websocket_telemetry(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for telemetry - requires authentication"""
    from auth.utils import verify_token
    
    # Verify token
    payload = verify_token(token, token_type="access")
    if not payload:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        await websocket.close(code=1008, reason="User not found or inactive")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Receive and process messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "heartbeat":
                manager.update_heartbeat(websocket)
                await websocket.send_text(json.dumps({"type": "heartbeat_ack"}))
            else:
                # Process other messages based on user permissions
                if user.has_role("operator"):
                    # Operators can send commands
                    logger.info(f"Command from {user.username}: {message}")
                else:
                    # Viewers can only receive data
                    logger.info(f"Read-only user {user.username} attempted command")
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected for user: {user.username}")

# Admin endpoints
@app.get("/api/admin/users")
async def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List all users - admin only"""
    users = db.query(User).offset(skip).limit(limit).all()
    return {
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "roles": [role.name for role in user.roles],
                "is_active": user.is_active,
                "last_login": user.last_login_at
            }
            for user in users
        ]
    }

@app.put("/api/admin/users/{user_id}/roles")
async def update_user_roles(
    user_id: str,
    roles: List[str],
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user roles - admin only"""
    from auth.models import Role
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clear existing roles
    user.roles.clear()
    
    # Add new roles
    for role_name in roles:
        role = db.query(Role).filter(Role.name == role_name).first()
        if role:
            user.roles.append(role)
    
    db.commit()
    
    logger.info(f"Admin {current_user.username} updated roles for user {user.username}: {roles}")
    
    return {"status": "success", "roles": roles}

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "authentication": "enabled"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Rover Development Platform API",
        "version": "2.0.0",
        "authentication": "required",
        "docs": "/docs",
        "health": "/health",
        "login": "/api/auth/login"
    }

if __name__ == "__main__":
    # Initialize database tables
    from auth.simple_init_db import init_auth_tables
    init_auth_tables()
    
    # Run the server
    uvicorn.run(
        "server_with_auth:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )