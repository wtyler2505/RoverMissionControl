@echo off
setlocal enabledelayedexpansion

REM Task-Oriented Worktree Creator with Taskmaster Integration
REM This ensures every worktree is properly linked to a Taskmaster task

echo ========================================
echo Task-Oriented Worktree Creator
echo ========================================
echo.

REM Check if we're in the main repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not in a git repository
    echo Please run this from the RoverMissionControl directory
    exit /b 1
)

REM Get task information
set /p TASK_ID="Enter Taskmaster Task ID (e.g., 27, 15.2): "
if "%TASK_ID%"=="" (
    echo ERROR: Task ID is required for worktree creation
    echo Every worktree must be linked to a task!
    exit /b 1
)

REM Query Taskmaster for task details (simulated - would use MCP in Claude)
echo.
echo Fetching task details from Taskmaster...
echo Task %TASK_ID%: [You should query Taskmaster for actual task title]
echo.

set /p WORKTREE_NAME="Enter worktree name (e.g., auth, gamepad, telemetry): "
if "%WORKTREE_NAME%"=="" (
    echo ERROR: Worktree name is required
    exit /b 1
)

REM Sanitize worktree name
set WORKTREE_NAME=%WORKTREE_NAME: =-%
set WORKTREE_PATH=../rover-%WORKTREE_NAME%
set BRANCH_NAME=feature/%WORKTREE_NAME%-task-%TASK_ID%

echo.
echo Configuration:
echo - Worktree: %WORKTREE_PATH%
echo - Branch: %BRANCH_NAME%
echo - Task ID: %TASK_ID%
echo.

set /p CONFIRM="Create this task-linked worktree? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled by user
    exit /b 0
)

REM Step 1: Create the worktree
echo.
echo Creating worktree...
git worktree add "%WORKTREE_PATH%" -b "%BRANCH_NAME%"
if errorlevel 1 (
    echo ERROR: Failed to create worktree
    echo Possible reasons:
    echo - Branch already exists
    echo - Worktree path already exists
    echo - Invalid characters in name
    exit /b 1
)

REM Step 2: Run secure setup with task ID
echo.
echo Running secure setup...
call scripts\worktree-setup-secure.bat "%WORKTREE_PATH%" %TASK_ID%
if errorlevel 1 (
    echo WARNING: Setup completed with errors
    echo You may need to fix issues manually
)

REM Step 3: Create task context file
echo.
echo Creating task context...
cd /d "%WORKTREE_PATH%"
(
    echo # Task Context for This Worktree
    echo TASK_ID=%TASK_ID%
    echo CREATED=%date% %time%
    echo.
    echo ## Claude Instructions
    echo When starting work in this worktree, immediately:
    echo 1. Check task status: mcp__taskmaster-ai__get_task --id=%TASK_ID%
    echo 2. Set to in-progress: mcp__taskmaster-ai__set_task_status --id=%TASK_ID% --status=in-progress
    echo 3. Update regularly: mcp__taskmaster-ai__update_task --id=%TASK_ID% --prompt="progress..."
    echo 4. Mark complete when done: mcp__taskmaster-ai__set_task_status --id=%TASK_ID% --status=done
    echo.
    echo ## Quick Commands
    echo claude --task %TASK_ID%  # Start with task context
) > TASK_CONTEXT.md

REM Step 4: Create git commit message template
(
    echo # Task %TASK_ID%: 
    echo # 
    echo # Type: feat/fix/docs/style/refactor/test/chore
    echo # 
    echo # Remember to reference the task in your commit:
    echo # - Implements Task %TASK_ID%
    echo # - Partially addresses Task %TASK_ID%
    echo # - Fixes issue in Task %TASK_ID%
) > .gitmessage

git config --local commit.template .gitmessage

REM Return to main directory
cd /d "%~dp0\.."

echo.
echo ========================================
echo ✅ Task-linked worktree created!
echo ========================================
echo.
echo Next steps:
echo 1. cd %WORKTREE_PATH%
echo 2. claude
echo 3. Tell Claude: "I'm working on Task %TASK_ID% in the %WORKTREE_NAME% worktree"
echo.
echo The worktree is configured to:
echo - Track Task %TASK_ID% progress
echo - Use task-aware commit messages
echo - Maintain Taskmaster synchronization
echo.
echo Remember: ALWAYS update Taskmaster as you work!
echo ========================================