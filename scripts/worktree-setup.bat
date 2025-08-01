@echo off
REM Worktree Setup Script for RoverMissionControl (Windows)
REM This script helps initialize a new worktree with all dependencies

set WORKTREE_PATH=%1

if "%WORKTREE_PATH%"=="" (
    echo Usage: worktree-setup.bat ^<worktree-path^>
    echo Example: worktree-setup.bat ..\rover-auth
    exit /b 1
)

echo 🚀 Setting up worktree at: %WORKTREE_PATH%

REM Check if worktree exists
if not exist "%WORKTREE_PATH%" (
    echo ❌ Worktree directory not found: %WORKTREE_PATH%
    exit /b 1
)

cd /d "%WORKTREE_PATH%"

echo 📋 Copying environment files...
REM Copy .env files if they exist in main
if exist "..\RoverMissionControl\.env" (
    copy "..\RoverMissionControl\.env" . >nul
)
if exist "..\RoverMissionControl\frontend\.env" (
    copy "..\RoverMissionControl\frontend\.env" frontend\ >nul
)
if exist "..\RoverMissionControl\backend\.env" (
    copy "..\RoverMissionControl\backend\.env" backend\ >nul
)

echo 📦 Installing frontend dependencies...
cd frontend
call npm install

echo 🐍 Setting up backend virtual environment...
cd ..\backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt

echo ✅ Worktree setup complete!
echo.
echo To start working in this worktree:
echo   cd %WORKTREE_PATH%
echo   claude
echo.
echo To run the application:
echo   Frontend: cd frontend ^&^& npm start
echo   Backend: cd backend ^&^& python server.py