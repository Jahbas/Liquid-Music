@echo off
title Liquid Glass Music Player
color 0A

echo.
echo ========================================
echo   Liquid Glass Music Player
echo ========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python from https://python.org
    echo.
    pause
    exit /b 1
)

:: Check if server.py exists
if not exist "server.py" (
    echo [ERROR] server.py not found!
    echo Please run setup.bat first to download all files.
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting Liquid Glass Music Player...
echo [INFO] The player will open in your default browser
echo [INFO] Press Ctrl+C to stop the server
echo.

python server.py

echo.
echo [INFO] Server stopped. Thank you for using Liquid Glass Music Player!
echo.
pause
