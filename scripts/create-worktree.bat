@echo off
REM Quick Worktree Creator for RoverMissionControl
REM Usage: create-worktree.bat <name> <task-id>

set TASK_NAME=%1
set TASK_ID=%2

if "%TASK_NAME%"=="" (
    echo Usage: create-worktree.bat ^<name^> ^<task-id^>
    echo Example: create-worktree.bat gamepad 15
    echo.
    echo This will create:
    echo   - Worktree: ../rover-gamepad
    echo   - Branch: feature/gamepad
    echo   - Setup environment automatically
    exit /b 1
)

echo ========================================
echo Creating worktree for: %TASK_NAME%
if not "%TASK_ID%"=="" echo Task ID: %TASK_ID%
echo ========================================
echo.

REM Create the worktree
echo Step 1: Creating worktree...
git worktree add ../rover-%TASK_NAME% -b feature/%TASK_NAME%
if errorlevel 1 (
    echo ERROR: Failed to create worktree
    echo Possible reasons:
    echo - Branch already exists
    echo - Worktree already exists
    echo - Invalid name
    exit /b 1
)

echo.
echo Step 2: Setting up environment...
call scripts\worktree-setup.bat ../rover-%TASK_NAME%
if errorlevel 1 (
    echo WARNING: Environment setup had issues
    echo You may need to run setup manually
)

echo.
echo ========================================
echo ✅ Worktree created successfully!
echo ========================================
echo.
echo Next steps:
echo   1. cd ../rover-%TASK_NAME%
echo   2. claude
if not "%TASK_ID%"=="" (
    echo   3. Tell Claude: "I'm working on Task %TASK_ID% in the %TASK_NAME% worktree"
) else (
    echo   3. Tell Claude what you're working on in this worktree
)
echo.
echo To remove when done:
echo   git worktree remove ../rover-%TASK_NAME%