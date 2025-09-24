@echo off
setlocal enableextensions

REM Change to the directory of this script
cd /d "%~dp0"

echo.
echo ==============================================
echo   Liquid Glass Music Player v5.2.0
echo   Automatic Setup and Startup
echo ==============================================
echo.

REM Detect Python launcher or python.exe
set "PYTHON=py"
"%PYTHON%" -V >nul 2>&1 || set "PYTHON=python"

echo Using Python interpreter: %PYTHON%
echo.

REM Step 1: Ensure pip is available (automatic installation)
echo [1/4] Checking pip installation...
"%PYTHON%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo   pip not found. Installing pip automatically...
    "%PYTHON%" -m ensurepip --upgrade >nul 2>&1
    if errorlevel 1 (
        echo   ensurepip failed. Downloading pip installer...
        set "GETPIP=%TEMP%\get-pip.py"
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $env:TEMP+'\\get-pip.py' } catch { $_; exit 1 }" || (
            echo   Failed to download pip installer. Continuing without pip...
            echo   Note: Some features may be limited without pip dependencies.
            goto :SKIP_PIP_DEPS
        )
        "%PYTHON%" "%GETPIP%" --user
        del /q "%GETPIP%" >nul 2>&1
    )
) else (
    echo   pip is already installed ✓
)

REM Step 2: Upgrade pip (best effort)
echo [2/4] Upgrading pip...
"%PYTHON%" -m pip install --upgrade pip --user >nul 2>&1

REM Step 3: Install project requirements
echo [3/4] Installing audio metadata libraries...
if exist requirements.txt (
    echo   Installing mutagen and Pillow for metadata extraction...
    "%PYTHON%" -m pip install -r requirements.txt --user
    if errorlevel 1 (
        echo   Warning: Failed to install some dependencies. Continuing anyway...
    ) else (
        echo   Dependencies installed successfully ✓
    )
) else (
    echo   requirements.txt not found, installing basic dependencies...
    "%PYTHON%" -m pip install mutagen Pillow --user >nul 2>&1
)

REM Step 4: Run metadata dependencies installer (if present)
echo [4/4] Finalizing setup...
if exist install_dependencies.py (
    echo   Running metadata dependency installer...
    "%PYTHON%" install_dependencies.py
) else (
    echo   Setup complete ✓
)

:SKIP_PIP_DEPS

echo.
echo ==============================================
echo   Starting Liquid Glass Music Player...
echo ==============================================
echo.
echo The music player will open in your browser automatically.
echo If it doesn't open, go to: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server when you're done.
echo.

"%PYTHON%" server.py

REM If server exits, keep window open so messages are visible when double-clicked
echo.
echo ==============================================
echo   Server stopped.
echo ==============================================
echo.
echo Thank you for using Liquid Glass Music Player!
echo Press any key to close this window.
pause >nul

:AFTER_SERVER

