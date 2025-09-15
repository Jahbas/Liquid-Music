@echo off
title Liquid Glass Music Player - Setup
color 0A

echo.
echo ========================================
echo   Liquid Glass Music Player Setup
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

echo [INFO] Python found!
echo.

:: Create project directory
set PROJECT_DIR=LiquidGlassMusicPlayer
if not exist "%PROJECT_DIR%" mkdir "%PROJECT_DIR%"
cd "%PROJECT_DIR%"

echo [INFO] Created project directory: %PROJECT_DIR%
echo.

:: Copy files from current directory (if they exist)
echo [INFO] Copying files...

if exist "..\index.html" (
    copy "..\index.html" "index.html" >nul
    echo [INFO] Copied index.html
) else (
    echo [WARNING] index.html not found in parent directory
)

if exist "..\styles.css" (
    copy "..\styles.css" "styles.css" >nul
    echo [INFO] Copied styles.css
) else (
    echo [WARNING] styles.css not found in parent directory
)

if exist "..\script.js" (
    copy "..\script.js" "script.js" >nul
    echo [INFO] Copied script.js
) else (
    echo [WARNING] script.js not found in parent directory
)

if exist "..\server.py" (
    copy "..\server.py" "server.py" >nul
    echo [INFO] Copied server.py
) else (
    echo [WARNING] server.py not found in parent directory
)

if exist "..\README.md" (
    copy "..\README.md" "README.md" >nul
    echo [INFO] Copied README.md
) else (
    echo [WARNING] README.md not found in parent directory
)

echo.

:: Check if essential files exist
if not exist "index.html" (
    echo [ERROR] index.html is missing!
    echo Please ensure all files are in the same directory as this batch file.
    pause
    exit /b 1
)

if not exist "styles.css" (
    echo [ERROR] styles.css is missing!
    echo Please ensure all files are in the same directory as this batch file.
    pause
    exit /b 1
)

if not exist "script.js" (
    echo [ERROR] script.js is missing!
    echo Please ensure all files are in the same directory as this batch file.
    pause
    exit /b 1
)

if not exist "server.py" (
    echo [ERROR] server.py is missing!
    echo Please ensure all files are in the same directory as this batch file.
    pause
    exit /b 1
)

echo [SUCCESS] All files found successfully!
echo.

:: Start the server
echo [INFO] Starting Liquid Glass Music Player...
echo [INFO] The player will open in your default browser
echo [INFO] Press Ctrl+C to stop the server
echo.

python server.py

echo.
echo [INFO] Server stopped. Thank you for using Liquid Glass Music Player!
echo.
pause
