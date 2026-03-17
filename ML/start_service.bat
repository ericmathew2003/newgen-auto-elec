@echo off
echo Starting NewGen Auto ML Service (Unified)...
echo.
echo Service will be available at:
echo   http://localhost:8001
echo   http://localhost:8001/docs  (API docs)
echo   http://localhost:8001/cashflow
echo   http://localhost:8001/fault
echo   http://localhost:8001/parts
echo.
cd /d "%~dp0"
python main.py
pause
