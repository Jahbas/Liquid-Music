@echo off
setlocal enableextensions

REM Change to the directory of this script
cd /d "%~dp0"

echo.
echo ==============================================
echo   Liquid Music - Startup
echo   Installing dependencies and starting server
echo ==============================================
echo.

REM Detect Python launcher or python.exe
set "PYTHON=py"
"%PYTHON%" -V >nul 2>&1 || set "PYTHON=python"

echo Using Python interpreter: %PYTHON%

REM Upgrade pip (best effort)
"%PYTHON%" -m pip install --upgrade pip >nul 2>&1

REM Install project requirements
if exist requirements.txt (
    echo Installing requirements from requirements.txt ...
    "%PYTHON%" -m pip install -r requirements.txt
) else (
    echo requirements.txt not found, skipping requirements installation.
)

REM Run metadata dependencies installer (if present)
if exist install_dependencies.py (
    echo Running install_dependencies.py to ensure metadata reader deps are installed ...
    "%PYTHON%" install_dependencies.py
) else (
    echo install_dependencies.py not found, skipping metadata dependency installer.
)

echo.
echo Starting development server (server.py)...
echo.
"%PYTHON%" server.py

REM If server exits, keep window open so messages are visible when double-clicked
echo.
echo Server exited. Press any key to close this window.
pause >nul


