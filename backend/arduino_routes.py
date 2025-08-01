"""
Arduino integration API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from ..auth.dependencies import get_current_user
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action

router = APIRouter()

# Import existing Arduino endpoints from server.py
# This is a placeholder - in production, move all Arduino endpoints here