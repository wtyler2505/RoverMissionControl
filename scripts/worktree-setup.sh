#!/bin/bash

# Worktree Setup Script for RoverMissionControl
# This script helps initialize a new worktree with all dependencies

WORKTREE_PATH=$1

if [ -z "$WORKTREE_PATH" ]; then
    echo "Usage: ./worktree-setup.sh <worktree-path>"
    echo "Example: ./worktree-setup.sh ../rover-auth"
    exit 1
fi

echo "🚀 Setting up worktree at: $WORKTREE_PATH"

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree directory not found: $WORKTREE_PATH"
    exit 1
fi

cd "$WORKTREE_PATH"

echo "📋 Copying environment files..."
# Copy .env files if they exist in main
if [ -f "../RoverMissionControl/.env" ]; then
    cp ../RoverMissionControl/.env .
fi
if [ -f "../RoverMissionControl/frontend/.env" ]; then
    cp ../RoverMissionControl/frontend/.env frontend/
fi
if [ -f "../RoverMissionControl/backend/.env" ]; then
    cp ../RoverMissionControl/backend/.env backend/
fi

echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo "🐍 Setting up backend virtual environment..."
cd ../backend
python -m venv venv
source venv/Scripts/activate || source venv/bin/activate
pip install -r requirements.txt

echo "✅ Worktree setup complete!"
echo ""
echo "To start working in this worktree:"
echo "  cd $WORKTREE_PATH"
echo "  claude"
echo ""
echo "To run the application:"
echo "  Frontend: cd frontend && npm start"
echo "  Backend: cd backend && python server.py"