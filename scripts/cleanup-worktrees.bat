@echo off
REM Worktree Cleanup Script for RoverMissionControl
REM Safely removes completed worktrees

echo ========================================
echo Git Worktrees Cleanup Tool
echo ========================================
echo.

REM First, prune any stale references
echo Pruning stale worktree references...
git worktree prune
echo.

echo Current worktrees:
git worktree list
echo.

echo ========================================
echo Options:
echo 1. Remove specific worktree
echo 2. Remove all worktrees (except main)
echo 3. Exit
echo ========================================
echo.

set /p CHOICE="Enter choice (1-3): "

if "%CHOICE%"=="1" goto REMOVE_SPECIFIC
if "%CHOICE%"=="2" goto REMOVE_ALL
if "%CHOICE%"=="3" goto END
goto END

:REMOVE_SPECIFIC
echo.
set /p WORKTREE_PATH="Enter worktree path to remove (e.g., ../rover-auth): "

if "%WORKTREE_PATH%"=="" (
    echo ERROR: No path provided
    goto END
)

echo.
echo Checking worktree status...
cd /d %WORKTREE_PATH% 2>nul
if errorlevel 1 (
    echo ERROR: Cannot access worktree at %WORKTREE_PATH%
    goto END
)

REM Check for uncommitted changes
for /f %%a in ('git status --porcelain 2^>nul ^| find /c /v ""') do (
    if not %%a==0 (
        echo WARNING: This worktree has %%a uncommitted changes!
        set /p CONFIRM="Are you sure you want to remove it? (y/n): "
        if /i not "!CONFIRM!"=="y" goto END
    )
)

cd /d %~dp0\..
echo.
echo Removing worktree...
git worktree remove %WORKTREE_PATH%
if errorlevel 1 (
    echo.
    echo Failed to remove normally. Trying force removal...
    git worktree remove --force %WORKTREE_PATH%
)
echo.
echo Worktree removed successfully!
goto END

:REMOVE_ALL
echo.
echo WARNING: This will remove ALL worktrees except main!
set /p CONFIRM="Are you sure? (y/n): "
if /i not "%CONFIRM%"=="y" goto END

echo.
for /f "tokens=1" %%a in ('git worktree list ^| findstr /v "RoverMissionControl"') do (
    echo Removing: %%a
    git worktree remove %%a 2>nul
    if errorlevel 1 (
        git worktree remove --force %%a 2>nul
    )
)
echo.
echo All worktrees removed!

:END
echo.
echo Final worktree status:
git worktree list
echo.
pause