@echo off
REM Quick start script for Parts Vision System (Windows)

echo ============================================================
echo   AUTOMOBILE PARTS VISION SYSTEM - QUICK START
echo ============================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

echo [1/4] Checking dependencies...
python -c "import tensorflow" >nul 2>&1
if errorlevel 1 (
    echo Installing TensorFlow...
    pip install tensorflow
)

python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo Installing FastAPI...
    pip install fastapi uvicorn python-multipart
)

echo.
echo [2/4] Creating directories...
if not exist "uploads" mkdir uploads
if not exist "models" mkdir models
if not exist "data" mkdir data

echo.
echo [3/4] Checking database...
echo Please ensure PostgreSQL is running and database is created.
echo Run: psql -U postgres -d your_database -f ../backend/migrations/create_parts_vision_tables.sql
echo.

echo [4/4] Starting ML Service...
echo.
echo ============================================================
echo   ML Service will start on http://localhost:8002
echo   API Documentation: http://localhost:8002/docs
echo ============================================================
echo.

python parts_vision_service.py

pause
