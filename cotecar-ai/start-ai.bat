@echo off
setlocal

REM Always run from this folder
cd /d "%~dp0"

REM If AI is already running on port 8001, do nothing (prevents "only one usage of each socket")
netstat -ano | findstr ":8001" | findstr "LISTENING" >nul
if %errorlevel%==0 exit /b 0

REM Activate venv (CMD)
call ".venv\Scripts\activate.bat"

REM Start AI server and keep it running
python -m uvicorn main:app --host 127.0.0.1 --port 8001
