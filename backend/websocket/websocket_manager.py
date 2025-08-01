"""
WebSocket Manager - High-level manager for WebSocket server integration
"""

import logging
from typing import Optional, Any
from fastapi import WebSocket

from .websocket_server import WebSocketServer, ServerConfig, create_websocket_server
from .connection_manager import ConnectionManager

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    High-level WebSocket manager that integrates with FastAPI application
    """
    
    def __init__(
        self,
        rbac_service: Optional[Any] = None,
        audit_service: Optional[Any] = None,
        api_key_service: Optional[Any] = None,
        config: Optional[ServerConfig] = None
    ):
        self.rbac_service = rbac_service
        self.audit_service = audit_service
        self.api_key_service = api_key_service
        self.config = config or ServerConfig()
        self.ws_server: Optional[WebSocketServer] = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the WebSocket manager"""
        if self._initialized:
            return
        
        # WebSocket server will be created when app is passed
        self._initialized = True
        logger.info("WebSocket manager initialized")
    
    def setup_server(self, app):
        """Setup WebSocket server with FastAPI app"""
        if not self._initialized:
            raise RuntimeError("WebSocket manager not initialized")
        
        # Create WebSocket server
        self.ws_server = create_websocket_server(app, self.config)
        
        # Store services in server if needed
        if hasattr(self.ws_server, 'rbac_service'):
            self.ws_server.rbac_service = self.rbac_service
        if hasattr(self.ws_server, 'audit_service'):
            self.ws_server.audit_service = self.audit_service
        if hasattr(self.ws_server, 'api_key_service'):
            self.ws_server.api_key_service = self.api_key_service
        
        logger.info("WebSocket server setup complete")
    
    async def start_server(self):
        """Start the WebSocket server"""
        if self.ws_server:
            await self.ws_server.start_background_tasks()
            logger.info("WebSocket server started")
        else:
            logger.warning("WebSocket server not setup")
    
    async def stop_server(self):
        """Stop the WebSocket server"""
        if self.ws_server:
            await self.ws_server.shutdown()
            logger.info("WebSocket server stopped")
    
    async def handle_connection(self, websocket: WebSocket):
        """Handle incoming WebSocket connections"""
        if not self.ws_server:
            logger.error("WebSocket server not setup")
            await websocket.close(code=1011, reason="Server not ready")
            return
        
        # The actual connection handling is done by Socket.IO
        # This is just a placeholder for the raw WebSocket endpoint
        await websocket.accept()
        await websocket.send_text("Please use Socket.IO client for connection")
        await websocket.close()
    
    @property
    def connection_manager(self) -> Optional[ConnectionManager]:
        """Get the connection manager from WebSocket server"""
        if self.ws_server:
            return self.ws_server.connection_manager
        return None
    
    def get_stats(self) -> dict:
        """Get WebSocket server statistics"""
        if self.ws_server:
            return self.ws_server.get_stats()
        return {
            "status": "not_initialized",
            "current_connections": 0,
            "total_connections": 0,
            "total_messages": 0,
            "total_errors": 0
        }