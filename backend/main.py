"""
Main application entry point with integrated security
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging

# Import logging configuration
from .logging_config import setup_logging, CorrelationIdMiddleware, get_audit_logger

# Import routers
from .auth.endpoints import router as auth_router
from .api_security.endpoints import router as api_key_router
from .api_security.rotation_endpoints import router as rotation_router
from .api_security.signing_endpoints import router as signing_router
from .api_security.rate_limit_endpoints import router as rate_limit_router
from .api_security.cors_endpoints import router as cors_router
from .api_security.schema_endpoints import router as schema_router
from .api_security.audit_endpoints import router as audit_router
from .api_security.versioning_endpoints import version_router, encryption_router
from .rover_routes import router as rover_router
from .arduino_routes import router as arduino_router
from .knowledge_routes import router as knowledge_router
from .ai_routes import router as ai_router
from .command_queue.history_api import router as history_router
from .routes.template_routes import router as template_router
from .routes.batch_routes import router as batch_router
from .command_queue.cancellation_api import router as cancellation_router
from .hardware.discovery_routes import router as discovery_router
from .hardware.diagnostics_routes import router as diagnostics_router
from .hardware.firmware_routes import router as firmware_router
from .hardware.logging_routes import router as logging_router
from .hardware.emergency_stop_routes import router as emergency_stop_router
from .routes.simulation_routes import router as simulation_router
from .routes.connection_health_routes import router as connection_health_router
from .routes.compliance_validation_routes import router as compliance_router

# Import middleware
from .api_security.middleware import (
    APIKeyAuthMiddleware,
    InputValidationMiddleware
)
from .api_security.cors_middleware import EnhancedCORSMiddleware
from .api_security.enhanced_middleware import EnhancedRateLimitMiddleware
from .api_security.schema_middleware import SchemaValidationMiddleware
from .rbac.middleware import RBACMiddleware

# Import services
from .database import init_db, get_db
from .rbac.rbac_service import RBACService
from .rbac.audit import AuditLogger
from .api_security.service import APIKeyService
from .api_security.cors_service import CORSService
from .api_security.cors_models import CORSPreset
from .api_security.audit_service import AuditService
from .websocket import WebSocketManager, http_fallback_router, initialize_fallback_manager

# Setup structured logging
setup_logging(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    enable_console=True,
    enable_file=True,
    enable_fluentd=os.getenv('FLUENTD_HOST') is not None,
    log_dir=os.getenv('LOG_DIR', '/app/logs')
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Rover Mission Control API...")
    
    # Initialize database
    init_db()
    
    # Initialize services
    db = next(get_db())
    try:
        # Initialize RBAC
        rbac_service = RBACService(db)
        audit_logger = AuditLogger(db)
        
        # Initialize comprehensive audit service
        audit_service = AuditService(db, audit_logger)
        
        # Initialize API key service and default scopes
        api_key_service = APIKeyService(db, audit_logger)
        api_key_service.create_default_scopes()
        
        # Initialize CORS service and default presets
        cors_service = CORSService(db)
        
        # Create default presets if they don't exist
        existing_presets = db.query(CORSPreset).filter(CORSPreset.is_system == True).count()
        if existing_presets == 0:
            for preset_data in CORSPreset.get_default_presets():
                preset = CORSPreset(**preset_data)
                db.add(preset)
            db.commit()
            logger.info("Created default CORS presets")
        
        # Initialize WebSocket manager
        websocket_manager = WebSocketManager(
            rbac_service=rbac_service,
            audit_service=audit_service,
            api_key_service=api_key_service
        )
        await websocket_manager.initialize()
        
        # Setup WebSocket server with the app
        websocket_manager.setup_server(app)
        
        # Initialize HTTP fallback manager with WebSocket's connection manager
        if websocket_manager.connection_manager:
            initialize_fallback_manager(websocket_manager.connection_manager)
            logger.info("HTTP fallback manager initialized with WebSocket connection manager")
        
        # Add to app state
        app.state.rbac_service = rbac_service
        app.state.audit_logger = audit_logger
        app.state.audit_service = audit_service
        app.state.api_key_service = api_key_service
        app.state.cors_service = cors_service
        app.state.websocket_manager = websocket_manager
        
        logger.info("Services initialized successfully")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Rover Mission Control API...")

# Create FastAPI app
app = FastAPI(
    title="Rover Mission Control API",
    description="Secure API for rover control, Arduino integration, and knowledge management",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

# Add correlation ID middleware (must be first)
app.add_middleware(CorrelationIdMiddleware)

# Add enhanced CORS middleware
app.add_middleware(
    EnhancedCORSMiddleware,
    allowed_origins=cors_origins,
    allowed_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowed_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    allow_credentials=True,
    max_age=3600
)

# Add input validation middleware
app.add_middleware(
    InputValidationMiddleware,
    max_body_size=10 * 1024 * 1024  # 10MB
)

# Add schema validation middleware
app.add_middleware(
    SchemaValidationMiddleware,
    validate_requests=True,
    validate_responses=True,
    strict_mode=False,  # Start with warnings, can enable strict later
    exclude_paths=["/api/health", "/docs", "/redoc", "/openapi.json"]
)

# Add enhanced rate limiting middleware
app.add_middleware(
    EnhancedRateLimitMiddleware,
    exclude_paths=["/api/health", "/docs", "/redoc", "/api/security/rate-limits/metrics"]
)

# Add API key authentication middleware
app.add_middleware(
    APIKeyAuthMiddleware,
    api_key_header="X-API-Key",
    optional_paths=["/api/health", "/api/docs"]
)

# Add RBAC middleware (must be after authentication)
@app.on_event("startup")
async def setup_rbac_middleware():
    """Setup RBAC middleware with app state"""
    app.add_middleware(
        RBACMiddleware,
        rbac_service=app.state.rbac_service,
        audit_logger=app.state.audit_logger
    )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    # Log to audit if possible
    if hasattr(request.app.state, "audit_logger"):
        try:
            user_id = getattr(request.state, "user_id", "anonymous")
            request.app.state.audit_logger.log_action(
                user_id=user_id,
                action="SYSTEM_ERROR",
                details={
                    "error": str(exc),
                    "path": request.url.path,
                    "method": request.method
                },
                success=False,
                error_message=str(exc)
            )
        except:
            pass
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(api_key_router, prefix="/api/keys", tags=["API Keys"])
app.include_router(rotation_router, prefix="/api/keys/rotation", tags=["API Key Rotation"])
app.include_router(signing_router, prefix="/api/security/signing", tags=["Request Signing"])
app.include_router(rate_limit_router, prefix="/api/security/rate-limits", tags=["Rate Limiting"])
app.include_router(cors_router, tags=["CORS Management"])
app.include_router(schema_router, tags=["Schema Management"])
app.include_router(audit_router, tags=["Audit Logging"])
app.include_router(version_router, tags=["API Versioning"])
app.include_router(encryption_router, tags=["Encryption Management"])
app.include_router(rover_router, prefix="/api/rover", tags=["Rover Control"])
app.include_router(arduino_router, prefix="/api/arduino", tags=["Arduino"])
app.include_router(knowledge_router, prefix="/api/knowledge", tags=["Knowledge Base"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI"])
app.include_router(history_router, tags=["Command History"])
app.include_router(template_router, tags=["Command Templates"])
app.include_router(batch_router, prefix="/api/batch", tags=["Batch Commands"])
app.include_router(cancellation_router, tags=["Command Cancellation"])
app.include_router(http_fallback_router, tags=["HTTP Fallback"])
app.include_router(discovery_router, tags=["Hardware Discovery"])
app.include_router(diagnostics_router, tags=["Hardware Diagnostics"])
app.include_router(firmware_router, tags=["Firmware Management"])
app.include_router(logging_router, tags=["Communication Logging"])
app.include_router(emergency_stop_router, tags=["Emergency Stop"])
app.include_router(connection_health_router, tags=["Connection Health"])
app.include_router(simulation_router, prefix="/api", tags=["Simulation"])
app.include_router(compliance_router, tags=["Compliance"])

# Mount WebSocket
@app.on_event("startup")
async def startup_websocket():
    """Initialize WebSocket server on startup"""
    try:
        await app.state.websocket_manager.start_server()
        logger.info("WebSocket server started successfully")
    except Exception as e:
        logger.error(f"Failed to start WebSocket server: {e}")

@app.on_event("shutdown")
async def shutdown_websocket():
    """Cleanup WebSocket server on shutdown"""
    try:
        await app.state.websocket_manager.stop_server()
        logger.info("WebSocket server stopped successfully")
    except Exception as e:
        logger.error(f"Error stopping WebSocket server: {e}")

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket):
    """Main WebSocket endpoint for real-time communication"""
    await app.state.websocket_manager.handle_connection(websocket)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "Rover Mission Control API",
        "version": "2.0.0",
        "security": {
            "authentication": "JWT + API Keys",
            "rbac": "Enabled",
            "audit_logging": "Active",
            "rate_limiting": "Active"
        }
    }

# API documentation
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Rover Mission Control API",
        "version": "2.0.0",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "security": {
            "authentication": "JWT tokens or API keys required",
            "api_key_header": "X-API-Key",
            "jwt_header": "Authorization: Bearer <token>"
        },
        "endpoints": {
            "auth": "/api/auth",
            "api_keys": "/api/keys",
            "key_rotation": "/api/keys/rotation",
            "request_signing": "/api/security/signing",
            "schemas": "/api/schemas",
            "versions": "/api/versions",
            "encryption": "/api/encryption",
            "rover": "/api/rover",
            "arduino": "/api/arduino",
            "knowledge": "/api/knowledge",
            "ai": "/api/ai",
            "templates": "/api/templates",
            "batch": "/api/batch"
        }
    }

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Get configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "4"))
    
    # Run server
    if workers > 1:
        # Production mode with multiple workers
        uvicorn.run(
            "backend.main:app",
            host=host,
            port=port,
            workers=workers,
            log_level="info"
        )
    else:
        # Development mode with auto-reload
        uvicorn.run(
            "backend.main:app",
            host=host,
            port=port,
            reload=True,
            log_level="debug"
        )