#!/bin/bash

# Worktree Manager for RoverMissionControl
# Helps create, list, and manage git worktrees

case "$1" in
    "create")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: ./worktree-manager.sh create <name> <branch-name>"
            echo "Example: ./worktree-manager.sh create gamepad feature/gamepad-control"
            exit 1
        fi
        WORKTREE_NAME=$2
        BRANCH_NAME=$3
        WORKTREE_PATH="../rover-$WORKTREE_NAME"
        
        echo "Creating worktree: $WORKTREE_PATH with branch: $BRANCH_NAME"
        git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
        
        echo "Setting up environment..."
        ./scripts/worktree-setup.sh "$WORKTREE_PATH"
        ;;
        
    "list")
        echo "📁 Current Worktrees:"
        git worktree list
        ;;
        
    "remove")
        if [ -z "$2" ]; then
            echo "Usage: ./worktree-manager.sh remove <name>"
            echo "Example: ./worktree-manager.sh remove gamepad"
            exit 1
        fi
        WORKTREE_NAME=$2
        WORKTREE_PATH="../rover-$WORKTREE_NAME"
        
        echo "Removing worktree: $WORKTREE_PATH"
        git worktree remove "$WORKTREE_PATH"
        ;;
        
    "switch")
        if [ -z "$2" ]; then
            echo "Usage: ./worktree-manager.sh switch <name>"
            echo "Example: ./worktree-manager.sh switch auth"
            exit 1
        fi
        WORKTREE_NAME=$2
        WORKTREE_PATH="../rover-$WORKTREE_NAME"
        
        if [ -d "$WORKTREE_PATH" ]; then
            cd "$WORKTREE_PATH"
            echo "Switched to worktree: $WORKTREE_PATH"
            echo "Run 'claude' to start a new session"
        else
            echo "❌ Worktree not found: $WORKTREE_PATH"
            exit 1
        fi
        ;;
        
    "status")
        echo "📊 Worktree Status Overview:"
        for worktree in $(git worktree list --porcelain | grep "worktree" | cut -d' ' -f2); do
            echo ""
            echo "Worktree: $worktree"
            cd "$worktree"
            BRANCH=$(git branch --show-current)
            echo "Branch: $BRANCH"
            CHANGES=$(git status --porcelain | wc -l)
            echo "Uncommitted changes: $CHANGES"
            cd - > /dev/null
        done
        ;;
        
    *)
        echo "Worktree Manager for RoverMissionControl"
        echo ""
        echo "Commands:"
        echo "  create <name> <branch>  - Create new worktree"
        echo "  list                    - List all worktrees"
        echo "  remove <name>           - Remove a worktree"
        echo "  switch <name>           - Switch to a worktree"
        echo "  status                  - Show status of all worktrees"
        echo ""
        echo "Examples:"
        echo "  ./worktree-manager.sh create auth feature/authentication"
        echo "  ./worktree-manager.sh list"
        echo "  ./worktree-manager.sh switch auth"
        ;;
esac