@echo off
echo Starting Intelligent Traffic Routing System...
echo ==================================================

if not exist "frontend\node_modules" (
    echo Frontend dependencies not found!
    echo Please run setup_windows.bat first
    pause
    exit /b 1
)

echo Cleaning up existing processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo Starting Python backend on http://localhost:8000
cd backend
start /B python main.py > ..\backend.log 2>&1
cd ..

timeout /t 3 /nobreak >nul

echo.
echo Starting React frontend on http://localhost:3000
cd frontend
set BROWSER=none
start /B npm start > ..\frontend.log 2>&1
cd ..

echo.
echo Application is starting!
echo.
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:3000
echo.
echo Frontend is starting... (takes about 30 seconds)
echo Your browser will open automatically
echo.
echo To stop: Press any key or run stop_windows.bat
pause >nul

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1