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

:: Download files
echo [INFO] Downloading files...

:: Download index.html
echo [INFO] Downloading index.html...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yourusername/manga_anilist/main/index.html' -OutFile 'index.html'"

:: Download styles.css
echo [INFO] Downloading styles.css...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yourusername/manga_anilist/main/styles.css' -OutFile 'styles.css'"

:: Download script.js
echo [INFO] Downloading script.js...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yourusername/manga_anilist/main/script.js' -OutFile 'script.js'"

:: Download server.py
echo [INFO] Downloading server.py...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yourusername/manga_anilist/main/server.py' -OutFile 'server.py'"

:: Download README.md
echo [INFO] Downloading README.md...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yourusername/manga_anilist/main/README.md' -OutFile 'README.md'"

echo.
echo [SUCCESS] All files downloaded successfully!
echo.

:: Check if files were downloaded
if not exist "index.html" (
    echo [ERROR] Failed to download index.html
    pause
    exit /b 1
)

if not exist "styles.css" (
    echo [ERROR] Failed to download styles.css
    pause
    exit /b 1
)

if not exist "script.js" (
    echo [ERROR] Failed to download script.js
    pause
    exit /b 1
)

if not exist "server.py" (
    echo [ERROR] Failed to download server.py
    pause
    exit /b 1
)

echo [INFO] All files verified successfully!
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
