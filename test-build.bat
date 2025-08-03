@echo off
echo 🐳 Testing Docker Build Status
echo ===============================

echo Checking if Docker image was built...
docker images | findstr "hire-ai-insights-dashboard"

if %errorlevel% equ 0 (
    echo ✅ Docker image built successfully!
    echo.
    echo 🚀 Ready to start the container:
    echo    docker-compose up
    echo    docker-compose up -d     (background)
    echo.
    echo 🌐 Once started, access at:
    echo    https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net
echo    https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net/docs
) else (
    echo ❌ Docker image not found. Build may still be in progress or failed.
    echo.
    echo 📋 Check build status with:
    echo    docker images
    echo    docker-compose build
)

pause 