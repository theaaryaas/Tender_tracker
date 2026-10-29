@echo off
setlocal enabledelayedexpansion

title BitVivid Tender Intelligence - Launcher
echo ============================================================
echo   BITVIVID TENDER INTELLIGENCE & TRACKING SYSTEM
echo ============================================================
echo.

cd /d "%~dp0"

:: 1. Check Python
echo [1/4] Checking Python environment...
set "PY_CMD="

python --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
  set "PY_CMD=python"
) else (
  py --version >nul 2>&1
  if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py"
  )
)

if "%PY_CMD%"=="" (
  echo.
  echo [ERROR] A working Python 3.10+ installation was not found!
  echo If you have not installed Python yet, download and install it from:
  echo   https://www.python.org/downloads/
  echo IMPORTANT: During setup, be sure to check the box "Add Python to PATH".
  echo.
  echo If you installed it via the Microsoft Store, please disable "App execution aliases" 
  echo for Python in Windows Settings, or install the official Python from python.org.
  echo.
  pause
  exit /b 1
)

echo Found Python: %PY_CMD%
echo.

:: 2. Check Node.js
echo [2/4] Checking Node.js environment...
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Node.js / npm was not found in PATH!
  echo Please install Node.js from https://nodejs.org/
  echo.
  pause
  exit /b 1
)
echo Found Node.js & npm.
echo.

:: 3. Setup Backend
echo [3/4] Initializing Backend dependencies...
cd /d "%~dp0"
"%PY_CMD%" -m pip install -r backend\requirements.txt --quiet
if %ERRORLEVEL% neq 0 (
  echo [WARNING] Some Python packages failed to install, proceeding with launch...
)

:: 4. Setup Frontend
echo [4/4] Initializing Frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules\" (
  echo Installing frontend packages (one-time setup)...
  call npm install
)

:: 5. Launch Backend & Frontend
echo.
echo ============================================================
echo   Starting Backend (port 8000) and Frontend (port 5173)...
echo ============================================================
cd /d "%~dp0"
start "BitVivid Tender Backend" cmd /k ""%PY_CMD%" -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

cd /d "%~dp0frontend"
start "BitVivid Tender Frontend" cmd /k "npm run dev"

timeout /t 3 >nul
start http://localhost:5173

echo.
echo Application launched! Opening http://localhost:5173 in browser...
echo Keep the terminal windows open while using the application.
echo.
pause

