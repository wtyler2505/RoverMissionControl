"""
HTTP Long-Polling Fallback Service for WebSocket-incompatible clients

This module provides an HTTP-based fallback mechanism for clients that cannot
establish WebSocket connections, ensuring compatibility across all network environments.
"""

import asyncio
import json
import time
import uuid
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import logging

from fastapi import APIRouter, Request, Response, HTTPException, Depends, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..auth.dependencies import get_current_user, get_optional_user
from ..auth.models import User
from .message_protocols import MessageProtocolManager, ProtocolType
from .connection_manager import ConnectionManager, ConnectionInfo

logger = logging.getLogger(__name__)

# HTTP Long-Polling Configuration
POLL_TIMEOUT = 30  # seconds
MESSAGE_RETENTION = 60  # seconds
MAX_MESSAGES_PER_POLL = 100
SESSION_TIMEOUT = 300  # 5 minutes

router = APIRouter(prefix="/api/fallback", tags=["fallback"])


class PollRequest(BaseModel):
    """Long-polling request model"""
    session_id: Optional[str] = None
    last_message_id: Optional[str] = None
    timeout: Optional[int] = Field(default=POLL_TIMEOUT, ge=1, le=60)


class PollResponse(BaseModel):
    """Long-polling response model"""
    session_id: str
    messages: List[Dict[str, Any]]
    last_message_id: Optional[str]
    compression_enabled: bool = False
    transport: str = "http-longpoll"


class SendMessageRequest(BaseModel):
    """Message sending request model"""
    session_id: str
    type: str
    payload: Dict[str, Any]
    compression: Optional[bool] = False


@dataclass
class HttpSession:
    """HTTP fallback session information"""
    id: str
    user_id: Optional[int]
    user: Optional[User]
    created_at: datetime
    last_activity: datetime
    messages: List[Dict[str, Any]] = field(default_factory=list)
    subscriptions: Set[str] = field(default_factory=set)
    waiting_response: Optional[asyncio.Future] = None
    compression_supported: bool = False
    stats: Dict[str, int] = field(default_factory=lambda: {
        "messages_sent": 0,
        "messages_received": 0,
        "polls_count": 0
    })


class HttpFallbackManager:
    """
    Manages HTTP long-polling sessions and message delivery
    """
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.sessions: Dict[str, HttpSession] = {}
        self.message_queue: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.protocol_manager = MessageProtocolManager()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start background cleanup task"""
        async def cleanup_expired():
            while True:
                try:
                    await asyncio.sleep(60)  # Check every minute
                    await self._cleanup_expired_sessions()
                except Exception as e:
                    logger.error(f"Cleanup task error: {e}")
        
        self._cleanup_task = asyncio.create_task(cleanup_expired())
    
    async def _cleanup_expired_sessions(self):
        """Remove expired sessions and old messages"""
        now = datetime.utcnow()
        expired_sessions = []
        
        for session_id, session in self.sessions.items():
            if (now - session.last_activity).total_seconds() > SESSION_TIMEOUT:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            await self.close_session(session_id)
            logger.info(f"Cleaned up expired session: {session_id}")
        
        # Clean old messages from queue
        for session_id, messages in self.message_queue.items():
            cutoff_time = time.time() - MESSAGE_RETENTION
            self.message_queue[session_id] = [
                msg for msg in messages 
                if msg.get("timestamp", 0) > cutoff_time
            ]
    
    async def create_session(self, user: Optional[User] = None) -> str:
        """Create a new HTTP fallback session"""
        session_id = f"http_{uuid.uuid4().hex}"
        
        session = HttpSession(
            id=session_id,
            user_id=user.id if user else None,
            user=user,
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        self.sessions[session_id] = session
        
        # Register with connection manager for consistency
        connection_info = ConnectionInfo(
            sid=session_id,
            user_id=user.id if user else None,
            user=user,
            client_type="http-fallback",
            protocol=ProtocolType.JSON,
            remote_addr="",
            user_agent="",
            subprotocols=[],
            connect_time=datetime.utcnow()
        )
        
        await self.connection_manager.register_connection(connection_info)
        
        logger.info(f"Created HTTP fallback session: {session_id}")
        return session_id
    
    async def close_session(self, session_id: str):
        """Close an HTTP fallback session"""
        session = self.sessions.get(session_id)
        if not session:
            return
        
        # Cancel any waiting poll
        if session.waiting_response:
            session.waiting_response.cancel()
        
        # Unregister from connection manager
        await self.connection_manager.unregister_connection(session_id)
        
        # Remove session
        del self.sessions[session_id]
        
        # Clean up message queue
        if session_id in self.message_queue:
            del self.message_queue[session_id]
        
        logger.info(f"Closed HTTP fallback session: {session_id}")
    
    async def poll_messages(
        self, 
        session_id: str, 
        last_message_id: Optional[str] = None,
        timeout: int = POLL_TIMEOUT
    ) -> List[Dict[str, Any]]:
        """
        Long-poll for messages with timeout
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session: {session_id}")
        
        session.last_activity = datetime.utcnow()
        session.stats["polls_count"] += 1
        
        # Check for existing messages
        messages = self._get_pending_messages(session_id, last_message_id)
        if messages:
            return messages
        
        # Wait for new messages
        future = asyncio.Future()
        session.waiting_response = future
        
        try:
            # Wait with timeout
            await asyncio.wait_for(future, timeout=timeout)
            messages = self._get_pending_messages(session_id, last_message_id)
        except asyncio.TimeoutError:
            # Return empty list on timeout
            messages = []
        except asyncio.CancelledError:
            # Session closed during poll
            raise
        finally:
            session.waiting_response = None
        
        return messages
    
    def _get_pending_messages(
        self, 
        session_id: str, 
        after_message_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get pending messages for a session"""
        messages = self.message_queue.get(session_id, [])
        
        if after_message_id:
            # Find index of last received message
            last_index = -1
            for i, msg in enumerate(messages):
                if msg.get("id") == after_message_id:
                    last_index = i
                    break
            
            # Return messages after the last received one
            messages = messages[last_index + 1:]
        
        # Limit number of messages per poll
        return messages[:MAX_MESSAGES_PER_POLL]
    
    async def send_message(
        self, 
        session_id: str,
        message_type: str,
        payload: Dict[str, Any],
        compress: bool = False
    ) -> str:
        """Send a message from HTTP client"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session: {session_id}")
        
        session.last_activity = datetime.utcnow()
        session.stats["messages_sent"] += 1
        
        # Create message
        message_id = f"msg_{uuid.uuid4().hex}"
        message = {
            "id": message_id,
            "type": message_type,
            "payload": payload,
            "timestamp": time.time(),
            "session_id": session_id,
            "compressed": compress
        }
        
        # Process message (could forward to WebSocket server or handle directly)
        # For now, just echo back to demonstrate
        await self.deliver_message(session_id, message)
        
        return message_id
    
    async def deliver_message(self, session_id: str, message: Dict[str, Any]):
        """Deliver a message to an HTTP session"""
        if session_id not in self.sessions:
            return
        
        session = self.sessions[session_id]
        session.stats["messages_received"] += 1
        
        # Add to message queue
        self.message_queue[session_id].append(message)
        
        # Wake up any waiting poll
        if session.waiting_response and not session.waiting_response.done():
            session.waiting_response.set_result(True)
    
    async def broadcast_to_channel(
        self, 
        channel: str, 
        event: str,
        data: Any
    ):
        """Broadcast message to all sessions subscribed to a channel"""
        message = {
            "id": f"msg_{uuid.uuid4().hex}",
            "type": "broadcast",
            "event": event,
            "channel": channel,
            "payload": data,
            "timestamp": time.time()
        }
        
        for session_id, session in self.sessions.items():
            if channel in session.subscriptions:
                await self.deliver_message(session_id, message)
    
    async def subscribe(self, session_id: str, channels: List[str]):
        """Subscribe session to channels"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session: {session_id}")
        
        session.subscriptions.update(channels)
        
        # Update connection manager subscriptions
        await self.connection_manager.update_subscriptions(
            session_id, 
            list(session.subscriptions), 
            {}
        )
    
    async def unsubscribe(self, session_id: str, channels: List[str]):
        """Unsubscribe session from channels"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Invalid session: {session_id}")
        
        for channel in channels:
            session.subscriptions.discard(channel)
        
        # Update connection manager subscriptions
        await self.connection_manager.update_subscriptions(
            session_id,
            list(session.subscriptions),
            {}
        )
    
    def get_session_stats(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a session"""
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        return {
            "session_id": session_id,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "user_id": session.user_id,
            "subscriptions": list(session.subscriptions),
            "stats": session.stats,
            "pending_messages": len(self.message_queue.get(session_id, []))
        }
    
    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Get information about all active sessions"""
        return [
            self.get_session_stats(session_id) 
            for session_id in self.sessions.keys()
        ]


# Create global instance
fallback_manager: Optional[HttpFallbackManager] = None


def get_fallback_manager() -> HttpFallbackManager:
    """Get the global fallback manager instance"""
    if not fallback_manager:
        raise RuntimeError("HTTP fallback manager not initialized")
    return fallback_manager


@router.post("/session")
async def create_session(
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Create a new HTTP fallback session"""
    try:
        manager = get_fallback_manager()
        session_id = await manager.create_session(user)
        
        return JSONResponse({
            "success": True,
            "session_id": session_id,
            "transport": "http-longpoll",
            "compression_supported": True,
            "poll_endpoint": f"/api/fallback/poll",
            "send_endpoint": f"/api/fallback/send"
        })
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/poll")
async def poll_messages(
    request: PollRequest,
    user: Optional[User] = Depends(get_optional_user)
) -> PollResponse:
    """Long-poll for messages"""
    try:
        manager = get_fallback_manager()
        
        # Create session if not exists
        session_id = request.session_id
        if not session_id or session_id not in manager.sessions:
            session_id = await manager.create_session(user)
        
        # Poll for messages
        messages = await manager.poll_messages(
            session_id,
            request.last_message_id,
            request.timeout or POLL_TIMEOUT
        )
        
        # Get last message ID
        last_message_id = messages[-1]["id"] if messages else request.last_message_id
        
        return PollResponse(
            session_id=session_id,
            messages=messages,
            last_message_id=last_message_id,
            compression_enabled=False,  # Could check Accept-Encoding
            transport="http-longpoll"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Poll error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_message(
    request: SendMessageRequest,
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Send a message via HTTP"""
    try:
        manager = get_fallback_manager()
        
        # Verify session ownership
        session = manager.sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if user and session.user_id and session.user_id != user.id:
            raise HTTPException(status_code=403, detail="Session access denied")
        
        # Send message
        message_id = await manager.send_message(
            request.session_id,
            request.type,
            request.payload,
            request.compression or False
        )
        
        return JSONResponse({
            "success": True,
            "message_id": message_id
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscribe")
async def subscribe_channels(
    session_id: str = Body(...),
    channels: List[str] = Body(...),
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Subscribe to channels"""
    try:
        manager = get_fallback_manager()
        await manager.subscribe(session_id, channels)
        
        return JSONResponse({
            "success": True,
            "subscribed": channels
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Subscribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unsubscribe")
async def unsubscribe_channels(
    session_id: str = Body(...),
    channels: List[str] = Body(...),
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Unsubscribe from channels"""
    try:
        manager = get_fallback_manager()
        await manager.unsubscribe(session_id, channels)
        
        return JSONResponse({
            "success": True,
            "unsubscribed": channels
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def close_session(
    session_id: str,
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Close an HTTP fallback session"""
    try:
        manager = get_fallback_manager()
        
        # Verify session ownership
        session = manager.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if user and session.user_id and session.user_id != user.id:
            raise HTTPException(status_code=403, detail="Session access denied")
        
        await manager.close_session(session_id)
        
        return JSONResponse({
            "success": True,
            "message": "Session closed"
        })
    except Exception as e:
        logger.error(f"Close session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{session_id}")
async def get_session_stats(
    session_id: str,
    user: Optional[User] = Depends(get_optional_user)
) -> JSONResponse:
    """Get session statistics"""
    try:
        manager = get_fallback_manager()
        stats = manager.get_session_stats(session_id)
        
        if not stats:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return JSONResponse(stats)
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user)
) -> JSONResponse:
    """List all active sessions (admin only)"""
    try:
        # Check admin permission
        is_admin = any(role.name == "admin" for role in user.roles)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        manager = get_fallback_manager()
        sessions = manager.get_all_sessions()
        
        return JSONResponse({
            "sessions": sessions,
            "total": len(sessions)
        })
    except Exception as e:
        logger.error(f"List sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def initialize_fallback_manager(connection_manager: ConnectionManager):
    """Initialize the HTTP fallback manager"""
    global fallback_manager
    fallback_manager = HttpFallbackManager(connection_manager)
    logger.info("HTTP fallback manager initialized")