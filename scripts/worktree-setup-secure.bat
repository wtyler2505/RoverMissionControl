@echo off
setlocal enabledelayedexpansion

REM Secure Worktree Setup Script for RoverMissionControl
REM This script safely sets up a worktree with proper validation and error handling

set WORKTREE_PATH=%1
set TASK_ID=%2
set ERROR_COUNT=0

if "%WORKTREE_PATH%"=="" (
    echo ERROR: Worktree path is required
    echo Usage: worktree-setup-secure.bat ^<worktree-path^> [task-id]
    exit /b 1
)

echo ========================================
echo Secure Worktree Setup
echo Path: %WORKTREE_PATH%
if not "%TASK_ID%"=="" echo Task: %TASK_ID%
echo ========================================
echo.

REM Step 1: Validate worktree exists and is accessible
echo [1/7] Validating worktree...
if not exist "%WORKTREE_PATH%" (
    echo ERROR: Worktree directory not found: %WORKTREE_PATH%
    exit /b 1
)

cd /d "%WORKTREE_PATH%" 2>nul
if errorlevel 1 (
    echo ERROR: Cannot access worktree directory
    exit /b 1
)

REM Verify it's a git worktree
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not a valid git worktree
    exit /b 1
)

REM Step 2: Check for required directories
echo [2/7] Checking project structure...
set REQUIRED_DIRS=frontend backend scripts docs
for %%d in (%REQUIRED_DIRS%) do (
    if not exist "%%d" (
        echo ERROR: Required directory missing: %%d
        echo This doesn't appear to be a complete RoverMissionControl worktree
        exit /b 1
    )
)

REM Step 3: Environment file security check
echo [3/7] Performing security checks...
set ENV_WARNING=0

REM Check if source .env files exist and warn about copying
if exist "..\RoverMissionControl\.env" (
    echo WARNING: .env file will be copied - ensure it doesn't contain production secrets!
    set /a ENV_WARNING+=1
)
if exist "..\RoverMissionControl\frontend\.env" (
    echo WARNING: frontend\.env will be copied - review for sensitive data!
    set /a ENV_WARNING+=1
)
if exist "..\RoverMissionControl\backend\.env" (
    echo WARNING: backend\.env will be copied - review for sensitive data!
    set /a ENV_WARNING+=1
)

if %ENV_WARNING% GTR 0 (
    echo.
    echo SECURITY WARNING: %ENV_WARNING% environment file(s) will be copied
    echo Ensure these files don't contain production secrets!
    set /p CONTINUE="Continue with setup? (y/n): "
    if /i not "!CONTINUE!"=="y" (
        echo Setup cancelled by user
        exit /b 0
    )
)

REM Step 4: Create .env files with validation
echo [4/7] Setting up environment files...

REM Root .env
if exist "..\RoverMissionControl\.env" (
    copy "..\RoverMissionControl\.env" . >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Failed to copy root .env file
        set /a ERROR_COUNT+=1
    ) else (
        echo ✓ Root .env copied
    )
) else (
    echo Creating default .env file...
    (
        echo # Worktree environment configuration
        echo NODE_ENV=development
        echo WORKTREE_NAME=%WORKTREE_PATH%
        if not "%TASK_ID%"=="" echo TASK_ID=%TASK_ID%
    ) > .env
)

REM Frontend .env
if exist "..\RoverMissionControl\frontend\.env" (
    copy "..\RoverMissionControl\frontend\.env" "frontend\" >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Failed to copy frontend .env file
        set /a ERROR_COUNT+=1
    ) else (
        echo ✓ Frontend .env copied
    )
) else (
    echo Creating default frontend\.env...
    (
        echo REACT_APP_API_URL=http://localhost:8000
        echo REACT_APP_WS_URL=ws://localhost:8000
        echo REACT_APP_WORKTREE=%WORKTREE_PATH%
    ) > frontend\.env
)

REM Backend .env with relative database path
if exist "..\RoverMissionControl\backend\.env" (
    copy "..\RoverMissionControl\backend\.env" "backend\" >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Failed to copy backend .env file
        set /a ERROR_COUNT+=1
    ) else (
        echo ✓ Backend .env copied
        echo NOTE: Database path should use relative path to main worktree
    )
) else (
    echo Creating default backend\.env...
    (
        echo # Use relative path to shared database
        echo DATABASE_URL=sqlite:///../RoverMissionControl/shared/data/rover_platform.db
        echo JWT_SECRET=CHANGE_THIS_IN_PRODUCTION_%RANDOM%
        echo CORS_ORIGINS=http://localhost:3000
    ) > backend\.env
)

REM Step 5: Taskmaster integration
if not "%TASK_ID%"=="" (
    echo [5/7] Configuring Taskmaster integration...
    (
        echo # Taskmaster Configuration for Worktree
        echo WORKTREE_TASK_ID=%TASK_ID%
        echo WORKTREE_BRANCH=%%cd%%
        echo # This worktree is linked to Task %TASK_ID%
        echo # Remember to update task status when starting work
    ) > .taskmaster
    echo ✓ Taskmaster configuration created for Task %TASK_ID%
) else (
    echo [5/7] Skipping Taskmaster integration (no task ID provided)
)

REM Step 6: Install dependencies with error handling
echo [6/7] Installing dependencies...

REM Frontend dependencies
echo Installing frontend dependencies...
cd frontend
call npm install --no-audit --no-fund >install.log 2>&1
if errorlevel 1 (
    echo ERROR: Frontend dependency installation failed!
    echo Check frontend\install.log for details
    set /a ERROR_COUNT+=1
) else (
    echo ✓ Frontend dependencies installed
    del install.log 2>nul
)
cd ..

REM Backend dependencies
echo Installing backend dependencies...
cd backend

REM Create virtual environment
python -m venv venv >venv_create.log 2>&1
if errorlevel 1 (
    echo ERROR: Failed to create Python virtual environment
    echo Check backend\venv_create.log for details
    set /a ERROR_COUNT+=1
    cd ..
    goto :summary
) else (
    del venv_create.log 2>nul
)

REM Activate venv and install requirements
call venv\Scripts\activate.bat >nul 2>&1
if errorlevel 1 (
    echo WARNING: Failed to activate virtual environment
    set /a ERROR_COUNT+=1
) else (
    pip install -r requirements.txt >pip_install.log 2>&1
    if errorlevel 1 (
        echo ERROR: Backend dependency installation failed!
        echo Check backend\pip_install.log for details
        set /a ERROR_COUNT+=1
    ) else (
        echo ✓ Backend dependencies installed
        del pip_install.log 2>nul
    )
)
cd ..

REM Step 7: Create worktree info file
:summary
echo [7/7] Creating worktree information...
(
    echo Worktree Setup Information
    echo ==========================
    echo Created: %date% %time%
    echo Path: %cd%
    echo Branch: 
    git branch --show-current
    if not "%TASK_ID%"=="" echo Task ID: %TASK_ID%
    echo.
    echo Setup completed with %ERROR_COUNT% error(s)
    echo.
    echo Quick Commands:
    echo - Start Claude: claude
    if not "%TASK_ID%"=="" (
        echo - Update task status: mcp__taskmaster-ai__set_task_status --id=%TASK_ID% --status=in-progress
    )
    echo - Run frontend: cd frontend ^&^& npm start
    echo - Run backend: cd backend ^&^& venv\Scripts\activate ^&^& python server.py
) > WORKTREE_INFO.txt

echo.
echo ========================================
if %ERROR_COUNT% EQU 0 (
    echo ✅ Setup completed successfully!
) else (
    echo ⚠️  Setup completed with %ERROR_COUNT% warning(s)/error(s)
    echo Check the logs for details
)
echo ========================================
echo.
type WORKTREE_INFO.txt

exit /b %ERROR_COUNT%