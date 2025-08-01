@echo off
REM Worktree Status Checker for RoverMissionControl
REM Shows status of all worktrees

echo ========================================
echo Git Worktrees Status Report
echo ========================================
echo.

set CURRENT_DIR=%CD%

REM Parse and display worktree information
for /f "tokens=1,2,3 delims= " %%a in ('git worktree list') do (
    echo 📁 Worktree: %%a
    echo 🌿 Branch: %%c
    
    REM Navigate to worktree to check status
    cd /d %%a 2>nul
    if not errorlevel 1 (
        REM Count uncommitted changes
        for /f %%d in ('git status --porcelain 2^>nul ^| find /c /v ""') do (
            if %%d==0 (
                echo ✅ Status: Clean (no changes^)
            ) else (
                echo ⚠️  Status: %%d uncommitted changes
            )
        )
        
        REM Check if behind/ahead of remote
        for /f "tokens=*" %%e in ('git status -sb 2^>nul ^| findstr "\["') do (
            echo 🔄 Remote: %%e
        )
    ) else (
        echo ❌ Status: Cannot access directory
    )
    echo.
)

REM Return to original directory
cd /d %CURRENT_DIR%

echo ========================================
echo Summary:
git worktree list | find /c /v "" | findstr "." && echo worktree(s^) configured
echo.
echo Commands:
echo - Create: create-worktree.bat ^<name^> ^<task-id^>
echo - Remove: git worktree remove ^<path^>
echo - List: git worktree list
echo ========================================