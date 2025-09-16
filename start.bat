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

REM Ensure pip is available; try pip, then ensurepip, then get-pip.py as fallback
"%PYTHON%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo pip not found. Attempting to bootstrap with ensurepip...
    "%PYTHON%" -m ensurepip --upgrade >nul 2>&1
)

"%PYTHON%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo ensurepip did not succeed. Downloading get-pip.py as fallback...
    set "GETPIP=%TEMP%\get-pip.py"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $env:TEMP+'\\get-pip.py' } catch { $_; exit 1 }" || (
        echo Failed to download get-pip.py. Please install pip manually.
        goto :AFTER_SERVER
    )
    "%PYTHON%" "%GETPIP%"
    del /q "%GETPIP%" >nul 2>&1
)

REM Upgrade pip (best effort once available)
"%PYTHON%" -m pip install --upgrade pip

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

:AFTER_SERVER

