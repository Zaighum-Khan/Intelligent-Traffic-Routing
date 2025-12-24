@echo off
echo Starting Intelligent Traffic Routing System - Windows Setup
echo ==================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python is not installed. Please install Python 3.11+ first.
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

echo.
echo Installing Python dependencies globally...
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo.
echo Setting up React frontend...
cd frontend
call npm install
call npm install -D tailwindcss postcss autoprefixer
call npx tailwindcss init -p
cd ..

echo.
echo Setup complete!
echo.
echo To run the application:
echo   run_windows.bat
pause