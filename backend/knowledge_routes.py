"""
Knowledge base API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from ..auth.dependencies import get_current_user
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action

router = APIRouter()

# Import existing knowledge base endpoints from server.py
# This is a placeholder - in production, move all knowledge endpoints here