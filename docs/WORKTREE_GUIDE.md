# Git Worktrees Guide for RoverMissionControl

## 🚨 CRITICAL: This is THE DEFINITIVE GUIDE for Git Worktrees in This Project

> **MANDATORY READING**: Every developer and Claude instance MUST understand this guide before working with worktrees.

## Table of Contents
1. [What Are Git Worktrees?](#what-are-git-worktrees)
2. [Quick Start](#quick-start)
3. [Current Worktree Setup](#current-worktree-setup)
4. [Essential Commands](#essential-commands)
5. [Step-by-Step Workflows](#step-by-step-workflows)
6. [Task-Specific Usage](#task-specific-usage)
7. [Environment Management](#environment-management)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Patterns](#advanced-patterns)

## What Are Git Worktrees?

Git worktrees are a powerful feature that allows you to have multiple branches checked out simultaneously in separate directories. Think of it as having multiple independent copies of your repository, each on a different branch, but all sharing the same Git history.

### Why Use Worktrees for RoverMissionControl?

1. **Parallel Claude Sessions**: Run multiple AI assistants working on different features simultaneously
2. **No Context Switching**: Never lose work by switching branches
3. **Immediate Bug Fixes**: Fix critical issues without interrupting feature work
4. **A/B Testing**: Compare different implementation approaches side-by-side
5. **Task Isolation**: Each Taskmaster task gets its own isolated environment

## 🚀 Quick Start

### Create Your First Worktree in 30 Seconds

```bash
# 1. Create worktree for authentication work
git worktree add ../rover-auth -b feature/authentication

# 2. Setup environment (MANDATORY!)
./scripts/worktree-setup.bat ../rover-auth

# 3. Start working
cd ../rover-auth
claude
```

### Current Worktree Setup

| Worktree | Location | Branch | Purpose | Taskmaster Tasks |
|----------|----------|--------|---------|------------------|
| **Main** | `C:/Users/wtyle/RoverMissionControl` | `main` | Primary development | Various |
| **Auth** | `C:/Users/wtyle/rover-auth` | `feature/authentication` | User authentication system | Task 27 (all subtasks) |
| **Telemetry** | `C:/Users/wtyle/rover-telemetry` | `feature/telemetry-improvements` | Real-time data visualization | Task 23, Task 24 |
| **Hotfix** | `C:/Users/wtyle/rover-hotfix` | `hotfix/urgent-fixes` | Emergency bug fixes | Critical issues only |

## Essential Commands

### Basic Worktree Operations

```bash
# List all worktrees with their locations and branches
git worktree list

# Create new worktree with new branch
git worktree add ../rover-<name> -b <branch-name>

# Create worktree from existing branch
git worktree add ../rover-<name> <existing-branch-name>

# Remove worktree (after work is complete)
git worktree remove ../rover-<name>

# Clean up stale worktree references
git worktree prune

# Lock worktree to prevent accidental deletion
git worktree lock ../rover-<name>

# Unlock worktree
git worktree unlock ../rover-<name>
```

### Environment Setup Commands

```bash
# Windows - Full environment setup
./scripts/worktree-setup.bat ../rover-<name>

# Unix/Mac - Full environment setup
./scripts/worktree-setup.sh ../rover-<name>

# Manual setup if scripts fail
cd ../rover-<name>
# Copy environment files
cp ../RoverMissionControl/.env .
cp ../RoverMissionControl/frontend/.env frontend/
cp ../RoverMissionControl/backend/.env backend/
# Install dependencies
cd frontend && npm install
cd ../backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
```

## Step-by-Step Workflows

### Workflow 1: Starting a New Feature

```bash
# Step 1: Check Taskmaster for your assigned task
# In main worktree
claude
# Tell Claude: "What's my next task from Taskmaster?"

# Step 2: Create worktree for the task
# Example: Task 15 - Gamepad Control
git worktree add ../rover-gamepad -b feature/gamepad-control

# Step 3: Setup environment
./scripts/worktree-setup.bat ../rover-gamepad

# Step 4: Navigate to worktree
cd ../rover-gamepad

# Step 5: Start Claude with task context
claude
# Tell Claude: "I'm working on Task 15 (Gamepad Control) in the gamepad worktree. Check the task status and begin work."

# Step 6: Work on the feature
# Claude will:
# - Check task status via Taskmaster
# - Set task to in-progress
# - Implement the feature
# - Update Taskmaster with progress
# - Mark subtasks as complete

# Step 7: Commit and push
git add -A
git commit -m "feat: implement gamepad control system"
git push -u origin feature/gamepad-control

# Step 8: Create PR (from any worktree)
gh pr create --title "Feature: Gamepad Control System" --body "Implements Task 15"
```

### Workflow 2: Emergency Hotfix During Feature Work

```bash
# Scenario: You're working on telemetry, but a critical bug is reported

# Terminal 1: Continue telemetry work
cd ../rover-telemetry
# Claude session continues uninterrupted

# Terminal 2: Handle the hotfix
cd ../rover-hotfix
git checkout main
git pull origin main
git checkout -b hotfix/websocket-crash

# Start new Claude session for hotfix
claude
# "Critical bug: WebSocket crashes on disconnect. Fix the issue in backend/websocket/manager.py"

# After fix
git add -A
git commit -m "fix: prevent WebSocket crash on client disconnect"
git push origin hotfix/websocket-crash

# Create and merge PR quickly
gh pr create --title "Hotfix: WebSocket crash" --body "Fixes critical crash"
```

### Workflow 3: Parallel Frontend/Backend Development

```bash
# Create separate worktrees for frontend and backend work
git worktree add ../rover-frontend -b feature/ui-improvements
git worktree add ../rover-backend -b feature/api-enhancements

# Setup both
./scripts/worktree-setup.bat ../rover-frontend
./scripts/worktree-setup.bat ../rover-backend

# Terminal 1: Frontend development
cd ../rover-frontend
claude
# "Work on Task 23.4 - Implement telemetry visualization components"

# Terminal 2: Backend development  
cd ../rover-backend
claude
# "Work on Task 23.2 - Create telemetry streaming endpoints"

# Both can run simultaneously without conflicts
```

## Task-Specific Usage

### Authentication System (Task 27)
```bash
cd ../rover-auth
claude

# Claude commands for auth work:
# "Check all subtasks for Task 27"
# "Implement JWT authentication (Task 27.1)"
# "Add role-based access control (Task 27.2)"
# "Create password reset flow (Task 27.3)"
# "Build login/logout UI (Task 27.4)"
```

### Telemetry Improvements (Task 23)
```bash
cd ../rover-telemetry
claude

# Focus areas:
# - Real-time data streaming
# - D3.js visualizations
# - Performance optimization
# - WebSocket stability
```

### Hardware Integration
```bash
# Create new worktree for hardware work
git worktree add ../rover-hardware -b feature/arduino-integration
./scripts/worktree-setup.bat ../rover-hardware

cd ../rover-hardware
claude
# "Work on Task 12 - Arduino sensor integration"
```

## Environment Management

### Critical Environment Files

Each worktree needs these files configured:

1. **Root `.env`**
   ```env
   # General environment variables
   NODE_ENV=development
   ```

2. **Frontend `.env`**
   ```env
   REACT_APP_API_URL=http://localhost:8000
   REACT_APP_WS_URL=ws://localhost:8000
   ```

3. **Backend `.env`**
   ```env
   DATABASE_URL=sqlite:///C:/Users/wtyle/RoverMissionControl/shared/data/rover_platform.db
   JWT_SECRET=your-secret-key
   CORS_ORIGINS=http://localhost:3000
   ```

### Shared Resources

These resources are SHARED across all worktrees:
- SQLite database: `shared/data/rover_platform.db`
- Git hooks: `.git/hooks/`
- Git configuration: `.git/config`
- Stash entries: `git stash list`

### Independent Resources

Each worktree has its own:
- Working directory files
- `node_modules/` directory
- Python `venv/` directory
- Build artifacts
- Uncommitted changes

## Best Practices

### 1. One Task Per Worktree
```bash
# ✅ GOOD: Clear purpose
git worktree add ../rover-auth -b feature/authentication  # Task 27
git worktree add ../rover-telemetry -b feature/telemetry  # Task 23

# ❌ BAD: Mixed purposes
git worktree add ../rover-misc -b feature/various-fixes  # Multiple tasks
```

### 2. Descriptive Branch Names
```bash
# ✅ GOOD: Clear and descriptive
feature/authentication-system
feature/gamepad-control
bugfix/websocket-memory-leak
hotfix/critical-crash

# ❌ BAD: Vague or unclear
feature/stuff
fix-things
new-feature
```

### 3. Regular Cleanup
```bash
# After PR is merged
cd ../rover-auth
git checkout main
git pull origin main
git branch -d feature/authentication
cd ../RoverMissionControl
git worktree remove ../rover-auth

# Periodic cleanup
git worktree prune
git remote prune origin
```

### 4. Taskmaster Synchronization

**EVERY worktree session MUST:**
```bash
# Start of session
mcp__taskmaster-ai__get_task --id=<task-id>
mcp__taskmaster-ai__set_task_status --id=<task-id> --status=in-progress

# During work (every 15-30 min)
mcp__taskmaster-ai__update_task --id=<task-id> --prompt="Progress update..."

# End of session
mcp__taskmaster-ai__set_task_status --id=<task-id> --status=done
```

### 5. Database Considerations

Since the database is shared:
```bash
# Before running migrations in any worktree
# 1. Communicate with other sessions
# 2. Backup database
cp shared/data/rover_platform.db shared/data/rover_platform.db.backup

# 3. Run migration
cd backend
alembic upgrade head

# 4. Verify in other worktrees
cd ../../rover-frontend/backend
alembic current  # Should show same version
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "fatal: '<branch>' is already checked out at '<path>'"
```bash
# Solution 1: Use different branch
git worktree add ../rover-feature -b feature/new-branch

# Solution 2: Remove existing worktree
git worktree remove <path>
git worktree add ../rover-feature <branch>
```

#### Issue: "Module not found" or "Cannot find package"
```bash
# Solution: Run setup script
cd <worktree-path>
../RoverMissionControl/scripts/worktree-setup.bat .

# Or manually install
cd frontend && npm install
cd ../backend && pip install -r requirements.txt
```

#### Issue: "Database locked" errors
```bash
# Solution 1: Ensure only one process accesses DB
# Stop other backend servers

# Solution 2: Use DB connection pooling
# Check backend/database.py configuration
```

#### Issue: Worktree shows as "prunable"
```bash
# Check why
git worktree list --verbose

# If directory was deleted manually
git worktree prune

# Force remove if needed
git worktree remove --force <path>
```

#### Issue: Environment variables not loading
```bash
# Verify .env files exist
ls -la .env frontend/.env backend/.env

# Check file contents
cat .env

# Ensure proper line endings (Windows)
dos2unix .env
```

#### Issue: Port conflicts between worktrees
```bash
# Frontend (React) - Change in package.json
"start": "PORT=3001 react-scripts start"  # rover-auth
"start": "PORT=3002 react-scripts start"  # rover-telemetry

# Backend (FastAPI) - Change in startup command
uvicorn main:app --port 8001  # rover-auth
uvicorn main:app --port 8002  # rover-telemetry
```

## Advanced Patterns

### Pattern 1: Feature Branch Strategy
```bash
# Main feature branch
git worktree add ../rover-telemetry -b feature/telemetry

# Sub-features in separate worktrees
git worktree add ../rover-telemetry-ui -b feature/telemetry-ui
git worktree add ../rover-telemetry-api -b feature/telemetry-api
git worktree add ../rover-telemetry-perf -b feature/telemetry-performance

# Develop in parallel, then merge
cd ../rover-telemetry
git merge --no-ff feature/telemetry-ui
git merge --no-ff feature/telemetry-api
git merge --no-ff feature/telemetry-performance
```

### Pattern 2: A/B Testing Implementations
```bash
# Test different libraries/approaches
git worktree add ../rover-socketio -b experiment/socketio-telemetry
git worktree add ../rover-websocket -b experiment/native-websocket

# Implement both approaches
# Measure performance, stability, complexity
# Choose best approach
# Merge winner, abandon other
```

### Pattern 3: Version Management
```bash
# Active development
git worktree add ../rover-v2 -b develop

# Current release maintenance  
git worktree add ../rover-v1-stable -b release/v1.x

# Emergency patches
git worktree add ../rover-v1-hotfix -b hotfix/v1.5.2
```

### Pattern 4: Code Review Workflow
```bash
# Reviewer creates worktree for PR branch
git fetch origin
git worktree add ../rover-review-pr123 origin/feature/some-feature

# Test the PR locally
cd ../rover-review-pr123
./scripts/worktree-setup.bat .
npm test
npm run lint

# Make review comments with full context
```

### Pattern 5: Continuous Integration Testing
```bash
# Create worktrees for different test scenarios
git worktree add ../rover-test-unit -b test/unit-tests
git worktree add ../rover-test-e2e -b test/e2e-tests
git worktree add ../rover-test-integration -b test/integration

# Run different test suites in parallel
```

## Automation Scripts

### Quick Worktree Creator (save as create-worktree.bat)
```bash
@echo off
set TASK_NAME=%1
set TASK_ID=%2

if "%TASK_NAME%"=="" (
    echo Usage: create-worktree.bat ^<name^> ^<task-id^>
    exit /b 1
)

echo Creating worktree for %TASK_NAME% (Task %TASK_ID%)...
git worktree add ../rover-%TASK_NAME% -b feature/%TASK_NAME%
call scripts\worktree-setup.bat ../rover-%TASK_NAME%

echo.
echo Worktree created! To start:
echo   cd ../rover-%TASK_NAME%
echo   claude
echo   "Working on Task %TASK_ID% in %TASK_NAME% worktree"
```

### Worktree Status Checker (save as check-worktrees.bat)
```bash
@echo off
echo Checking all worktrees status...
echo.

for /f "tokens=1,3" %%a in ('git worktree list') do (
    echo Worktree: %%a
    cd %%a
    echo Branch: %%b
    for /f %%c in ('git status --porcelain ^| find /c /v ""') do echo Changes: %%c
    echo.
)
```

## Final Checklist

Before starting work in ANY worktree:

- [ ] Worktree created with descriptive branch name
- [ ] Environment setup script completed successfully  
- [ ] Claude started with task context
- [ ] Taskmaster task status checked
- [ ] Task set to in-progress in Taskmaster
- [ ] Understand which files are shared vs independent
- [ ] Know your ports if running multiple services
- [ ] Have a plan for database migrations
- [ ] Ready to update Taskmaster regularly

## Need Help?

1. Check this guide first
2. Run `git worktree list` to see current state
3. Check `git status` in the problematic worktree
4. Verify environment setup with `ls -la node_modules .env`
5. Ask Claude: "Help me troubleshoot my worktree setup"

---

**Remember**: Worktrees are powerful but require discipline. Always keep Taskmaster synchronized, maintain clean branch names, and regularly clean up completed work.