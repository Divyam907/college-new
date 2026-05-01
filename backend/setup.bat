@echo off
title College Automated Attendance - Setup Script
color 0A
echo ============================================================
echo   College Automated Attendance System - Auto Setup
echo ============================================================
echo.

:: Check Python
echo [1/7] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is NOT installed!
    echo Please download Python 3.11+ from: https://www.python.org/downloads/
    echo IMPORTANT: Check "Add Python to PATH" during installation!
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo    Found Python %PYVER%
echo.

:: Check PostgreSQL
echo [2/7] Checking PostgreSQL...
where psql >nul 2>&1
if errorlevel 1 (
    echo WARNING: PostgreSQL CLI not found in PATH.
    echo If PostgreSQL is installed, add its bin folder to PATH.
    echo Download from: https://www.postgresql.org/download/windows/
    echo.
    echo Press any key to continue anyway ^(if PostgreSQL is installed^)...
    pause >nul
)
echo    PostgreSQL check done.
echo.

:: Create virtual environment
echo [3/7] Creating virtual environment...
if exist venv (
    echo    venv already exists, skipping...
) else (
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment!
        pause
        exit /b 1
    )
)
echo    Virtual environment ready.
echo.

:: Activate venv
echo [4/7] Activating virtual environment...
call venv\Scripts\activate.bat
echo    Activated.
echo.

:: Upgrade pip
echo [5/7] Upgrading pip...
python -m pip install --upgrade pip --quiet
echo    pip upgraded.
echo.

:: Install dependencies
echo [6/7] Installing dependencies (this may take 5-10 minutes)...
echo    Installing core packages first...
pip install Flask Werkzeug Jinja2 --quiet 2>nul
pip install psycopg2-binary --quiet 2>nul
pip install numpy pandas openpyxl --quiet 2>nul
pip install opencv-python Pillow --quiet 2>nul
pip install requests beautifulsoup4 --quiet 2>nul
pip install schedule secure-smtplib --quiet 2>nul
pip install matplotlib --quiet 2>nul

echo    Installing AI/ML packages (heavy, please wait)...
pip install tensorflow --quiet 2>nul
if errorlevel 1 (
    echo    TensorFlow failed, trying tf-nightly...
    pip install tf-nightly --quiet 2>nul
)
pip install tf_keras --quiet 2>nul
pip install keras --quiet 2>nul
pip install deepface --quiet 2>nul
pip install mtcnn --quiet 2>nul
pip install retina-face --quiet 2>nul

echo    All packages installed!
echo.

:: Verify critical imports
echo [7/7] Verifying installation...
python -c "import flask; print('    Flask:', flask.__version__ if hasattr(flask,'__version__') else 'OK')" 2>nul || echo    WARN: Flask not found
python -c "import psycopg2; print('    psycopg2: OK')" 2>nul || echo    WARN: psycopg2 not found
python -c "import cv2; print('    OpenCV:', cv2.__version__)" 2>nul || echo    WARN: OpenCV not found
python -c "import numpy; print('    NumPy:', numpy.__version__)" 2>nul || echo    WARN: NumPy not found
python -c "import pandas; print('    Pandas:', pandas.__version__)" 2>nul || echo    WARN: Pandas not found
python -c "import tensorflow; print('    TensorFlow: OK')" 2>nul || echo    WARN: TensorFlow not found
python -c "from deepface import DeepFace; print('    DeepFace: OK')" 2>nul || echo    WARN: DeepFace not found
echo.

:: Database setup
echo ============================================================
echo   DATABASE SETUP
echo ============================================================
echo.
echo The app needs a PostgreSQL database called "autoattendance".
echo.
set /p CREATEDB="Create database now? (y/n): "
if /i "%CREATEDB%"=="y" (
    set /p PGPASS="Enter PostgreSQL password for user 'postgres': "
    set PGPASSWORD=%PGPASS%
    psql -U postgres -c "CREATE DATABASE autoattendance;" 2>nul
    if errorlevel 1 (
        echo    Database may already exist or PostgreSQL is not running.
    ) else (
        echo    Database 'autoattendance' created successfully!
    )
    set PGPASSWORD=
)
echo.

:: Config reminder
echo ============================================================
echo   CONFIGURATION
echo ============================================================
echo.
echo Before running, update config.py with:
echo   1. Your PostgreSQL password in DB_PARAMS
echo   2. Your Gmail + App Password in EMAIL_CONFIG
echo      (Google Account ^> Security ^> App Passwords)
echo.

:: Run
echo ============================================================
echo   READY TO RUN!
echo ============================================================
echo.
echo To start the application:
echo   1. Open terminal in this folder
echo   2. Run: venv\Scripts\activate
echo   3. Run: python app.py
echo   4. Open: http://127.0.0.1:5000
echo.
set /p RUNNOW="Start the application now? (y/n): "
if /i "%RUNNOW%"=="y" (
    echo Starting server...
    python app.py
)

pause
