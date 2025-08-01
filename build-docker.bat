@echo off
REM Build script for Rover Mission Control Docker images

echo Building Rover Mission Control Docker images...

REM Parse arguments
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=development

set NO_CACHE=%2
if "%NO_CACHE%"=="" set NO_CACHE=false

REM Set build arguments based on environment
if "%ENVIRONMENT%"=="production" (
    echo Building for PRODUCTION environment
    set BUILD_ARGS=--build-arg NODE_ENV=production
    set COMPOSE_FILE=docker-compose.prod.yml
) else (
    echo Building for DEVELOPMENT environment
    set BUILD_ARGS=
    set COMPOSE_FILE=docker-compose.yml
)

REM Add no-cache flag if requested
if "%NO_CACHE%"=="no-cache" (
    echo Building without cache
    set BUILD_ARGS=%BUILD_ARGS% --no-cache
)

REM Build frontend
echo Building frontend image...
docker build %BUILD_ARGS% -t rover-mission-control-frontend:latest ./frontend
if %ERRORLEVEL% neq 0 goto :error

REM Build backend
echo Building backend image...
docker build %BUILD_ARGS% -t rover-mission-control-backend:latest ./backend
if %ERRORLEVEL% neq 0 goto :error

REM Show image sizes
echo.
echo Image sizes:
docker images | findstr rover-mission-control

REM Optional: Run containers
echo.
set /p START_CONTAINERS=Start containers? (y/n): 
if /i "%START_CONTAINERS%"=="y" (
    echo Starting containers...
    docker-compose -f %COMPOSE_FILE% up -d
    echo.
    echo Containers started!
    echo Frontend: http://localhost:3000
    echo Backend: http://localhost:8000
    echo API Docs: http://localhost:8000/docs
)

echo.
echo Build complete!
goto :end

:error
echo.
echo Build failed!
exit /b 1

:end