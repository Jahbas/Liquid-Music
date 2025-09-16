@echo off
setlocal enableextensions

REM Change to the directory of this script
cd /d "%~dp0"

REM Relaunch hidden to system tray unless already in minimized mode
if /I not "%1"=="min" (
    set "ME=%~f0"
    set "VBS=%TEMP%\lm_start_hidden.vbs"
    >"%VBS%" echo Set WshShell = CreateObject("WScript.Shell")
    >>"%VBS%" echo WshShell.Run """%ME%"" min", 0
    cscript //nologo "%VBS%" >nul 2>&1
    del /q "%VBS%" >nul 2>&1
    exit /b
)

:MIN_MODE
REM Minimized mode: use pythonw to hide console and pass --minimized to server
set "PYTHONW=py -w"
"%PYTHONW%" -V >nul 2>&1 || set "PYTHONW=pythonw"

REM Ensure pip and requirements as in normal mode (best effort, silent)
set "PYTHON=py"
"%PYTHON%" -V >nul 2>&1 || set "PYTHON=python"
"%PYTHON%" -m pip --version >nul 2>&1 || "%PYTHON%" -m ensurepip --upgrade >nul 2>&1
"%PYTHON%" -m pip --version >nul 2>&1 || (
    set "GETPIP=%TEMP%\get-pip.py"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $env:TEMP+'\\get-pip.py' } catch { $_; exit 1 }" >nul 2>&1 && "%PYTHON%" "%GETPIP%" >nul 2>&1 && del /q "%GETPIP%" >nul 2>&1
)
if exist requirements.txt (
    "%PYTHON%" -m pip install -r requirements.txt >nul 2>&1
)
if exist install_dependencies.py (
    "%PYTHON%" install_dependencies.py >nul 2>&1
)

REM Launch server minimized to system tray
start "Liquid Music" /min "%PYTHONW%" server.py --minimized

goto :EOF

:AFTER_SERVER

