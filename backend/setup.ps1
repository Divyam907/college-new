# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║   College Automated Attendance System - ONE-CLICK SETUP SCRIPT (Windows)   ║
# ║   Run this script in PowerShell as Administrator                           ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

param(
    [string]$PostgresPassword = "",
    [string]$GmailAddress = "",
    [string]$GmailAppPassword = "",
    [string]$FacultyEmail = "",
    [string]$DirectorEmail = ""
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  College Automated Attendance System - Setup Script" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ── Check if running as Administrator ─────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell -> 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Collect user inputs if not provided as parameters ─────────────────────────
Write-Host ""
Write-Host "--- Step 0: Configuration ---" -ForegroundColor Yellow
Write-Host ""

if (-not $PostgresPassword) {
    $PostgresPassword = Read-Host "Enter a password for PostgreSQL (remember this!)"
    if (-not $PostgresPassword) {
        Write-Host "[ERROR] PostgreSQL password cannot be empty." -ForegroundColor Red
        exit 1
    }
}

if (-not $GmailAddress) {
    $GmailAddress = Read-Host "Enter your Gmail address (for sending reports)"
    if (-not $GmailAddress) {
        Write-Host "[WARNING] Gmail not configured. Email features won't work." -ForegroundColor Yellow
        $GmailAddress = "your_email@gmail.com"
    }
}

if (-not $GmailAppPassword) {
    $GmailAppPassword = Read-Host "Enter your Gmail App Password (16 characters, see guide)"
    if (-not $GmailAppPassword) {
        Write-Host "[WARNING] Gmail App Password not configured. Email features won't work." -ForegroundColor Yellow
        $GmailAppPassword = "xxxx xxxx xxxx xxxx"
    }
}

if (-not $FacultyEmail) {
    $FacultyEmail = Read-Host "Enter faculty email (for receiving reports, press Enter to use Gmail)"
    if (-not $FacultyEmail) { $FacultyEmail = $GmailAddress }
}

if (-not $DirectorEmail) {
    $DirectorEmail = Read-Host "Enter director email (for receiving reports, press Enter to use Gmail)"
    if (-not $DirectorEmail) { $DirectorEmail = $GmailAddress }
}

Write-Host ""
Write-Host "[OK] Configuration collected." -ForegroundColor Green
Write-Host ""

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Check Requirements
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "--- Step 1/8: Checking requirements ---" -ForegroundColor Yellow
Write-Host ""

$reqFailed = $false

# Check internet connectivity
Write-Host "  Checking internet connection..." -ForegroundColor White
try {
    $null = Invoke-WebRequest -Uri "https://www.google.com" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    Write-Host "  [OK] Internet connection available." -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] No internet connection. Required for downloading packages." -ForegroundColor Red
    $reqFailed = $true
}

# Check PostgreSQL is installed and add to PATH if needed
Write-Host "  Checking PostgreSQL installation..." -ForegroundColor White
$psqlExe = "psql"
$pgFound = $false
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $pgFound = $true
} else {
    foreach ($p in @("C:\Program Files\PostgreSQL\17\bin","C:\Program Files\PostgreSQL\16\bin","C:\Program Files\PostgreSQL\15\bin","C:\Program Files\PostgreSQL\14\bin")) {
        if (Test-Path "$p\psql.exe") {
            $env:Path += ";$p"
            $psqlExe = "$p\psql.exe"
            $pgFound = $true
            break
        }
    }
}
if ($pgFound) {
    Write-Host "  [OK] PostgreSQL (psql) found." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] PostgreSQL not found. Install it from https://www.postgresql.org/download/windows/ then re-run this script." -ForegroundColor Red
    $reqFailed = $true
}

# Check PostgreSQL service is running
Write-Host "  Checking PostgreSQL service..." -ForegroundColor White
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    if ($pgService.Status -ne "Running") {
        Start-Service $pgService.Name
        Write-Host "  [OK] PostgreSQL service started." -ForegroundColor Green
    } else {
        Write-Host "  [OK] PostgreSQL service is running." -ForegroundColor Green
    }
} else {
    Write-Host "  [ERROR] PostgreSQL service not found. Check your PostgreSQL installation." -ForegroundColor Red
    $reqFailed = $true
}

# Test PostgreSQL connection with provided password
if ($pgFound -and -not $reqFailed) {
    Write-Host "  Testing PostgreSQL connection with provided password..." -ForegroundColor White
    $env:PGPASSWORD = $PostgresPassword
    $testOut = & $psqlExe -U postgres -h localhost -c "SELECT 1;" 2>&1
    $env:PGPASSWORD = ""
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] PostgreSQL connection successful." -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Cannot connect to PostgreSQL. Wrong password or server not accepting connections." -ForegroundColor Red
        Write-Host "  Detail: $testOut" -ForegroundColor Red
        $reqFailed = $true
    }
}

# Check available disk space (need at least 5 GB)
Write-Host "  Checking disk space..." -ForegroundColor White
try {
    $driveLetter = (Get-Item $ProjectDir).PSDrive.Name
    $freeGB = [math]::Round((Get-PSDrive $driveLetter).Free / 1GB, 1)
    if ($freeGB -ge 5) {
        Write-Host "  [OK] Disk space: ${freeGB} GB free." -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Only ${freeGB} GB free. At least 5 GB recommended." -ForegroundColor Yellow
    }
} catch {}

if ($reqFailed) {
    Write-Host ""
    Write-Host "[ERROR] One or more requirements not met. Fix the errors above and run this script again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[OK] All requirements satisfied. Proceeding with setup..." -ForegroundColor Green
Write-Host ""

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Install Chocolatey (package manager for Windows)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "--- Step 2/8: Installing Chocolatey package manager ---" -ForegroundColor Yellow

if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "[SKIP] Chocolatey already installed." -ForegroundColor Green
} else {
    Write-Host "Installing Chocolatey..." -ForegroundColor White
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "[OK] Chocolatey installed." -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Install Python 3.12
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 3/8: Installing Python 3.12 ---" -ForegroundColor Yellow

$pythonCmd = $null
# Check if Python 3.10-3.13 is already installed
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "3\.(1[0-3])") {
            $pythonCmd = $cmd
            Write-Host "[SKIP] Python already installed: $ver" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Host "Installing Python 3.12 via Chocolatey..." -ForegroundColor White
    choco install python312 -y --no-progress
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $pythonCmd = "python"
    Write-Host "[OK] Python 3.12 installed." -ForegroundColor Green
}

# Verify Python
try {
    $pyVer = & $pythonCmd --version 2>&1
    Write-Host "Using: $pyVer" -ForegroundColor White
} catch {
    Write-Host "[ERROR] Python not found after installation. Please restart PowerShell and try again." -ForegroundColor Red
    exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Install Visual Studio Build Tools (needed for some Python packages)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 4/8: Installing Visual Studio Build Tools ---" -ForegroundColor Yellow

# Check if Build Tools are available
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false
if (Test-Path $vsWhere) {
    $vsInstalls = & $vsWhere -all -format json 2>$null | ConvertFrom-Json
    if ($vsInstalls.Count -gt 0) { $hasBuildTools = $true }
}

if ($hasBuildTools) {
    Write-Host "[SKIP] Visual Studio Build Tools already installed." -ForegroundColor Green
} else {
    Write-Host "Installing Visual Studio Build Tools (this may take 5-10 minutes)..." -ForegroundColor White
    choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive" -y --no-progress
    Write-Host "[OK] Visual Studio Build Tools installed." -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Install CMake (needed for dlib/face_recognition)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 5/8: Installing CMake ---" -ForegroundColor Yellow

if (Get-Command cmake -ErrorAction SilentlyContinue) {
    Write-Host "[SKIP] CMake already installed." -ForegroundColor Green
} else {
    Write-Host "Installing CMake..." -ForegroundColor White
    choco install cmake --installargs 'ADD_CMAKE_TO_PATH=System' -y --no-progress
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "[OK] CMake installed." -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Create Database & Tables
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 6/8: Setting up PostgreSQL database ---" -ForegroundColor Yellow

$env:PGPASSWORD = $PostgresPassword

# Use psql found during requirements check
$psqlCmd = $psqlExe

Write-Host "Creating database 'autoattendance'..." -ForegroundColor White

# Create database (ignore error if it already exists)
try {
    & $psqlCmd -U postgres -h localhost -c "CREATE DATABASE autoattendance;" 2>$null
    Write-Host "[OK] Database created." -ForegroundColor Green
} catch {
    Write-Host "[OK] Database already exists (or created)." -ForegroundColor Green
}

# Create tables
$sqlSetup = @"
CREATE TABLE IF NOT EXISTS student (
    std_id  SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    email   VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS subject (
    sub_id      SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    faculty_id  INTEGER,
    from_time   TIME NOT NULL,
    to_time     TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
    id          SERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    subject_id  INTEGER REFERENCES subject(sub_id),
    student_id  INTEGER REFERENCES student(std_id),
    image       TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('admin','college'))
);
"@

$sqlSetup | & $psqlCmd -U postgres -h localhost -d autoattendance -f -
Write-Host "[OK] Database tables created." -ForegroundColor Green

$env:PGPASSWORD = ""

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Create Python Virtual Environment & Install Dependencies
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 7/8: Setting up Python environment ---" -ForegroundColor Yellow

Set-Location $ProjectDir

# Create venv at C:\av to avoid Windows long-path issues
$venvPath = "C:\av"
if (Test-Path "$venvPath\Scripts\python.exe") {
    Write-Host "[SKIP] Virtual environment already exists at $venvPath" -ForegroundColor Green
} else {
    Write-Host "Creating virtual environment at $venvPath ..." -ForegroundColor White
    & $pythonCmd -m venv $venvPath
    Write-Host "[OK] Virtual environment created." -ForegroundColor Green
}

# Activate and install
Write-Host "Installing Python packages (this may take 5-15 minutes)..." -ForegroundColor White
& "$venvPath\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "$venvPath\Scripts\python.exe" -m pip install -r "$ProjectDir\requirements_py313.txt" --quiet
Write-Host "[OK] All Python packages installed." -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Configure the project (config.py)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "--- Step 8/8: Writing project configuration ---" -ForegroundColor Yellow

$configContent = @"
DB_PARAMS = {
    "dbname": "autoattendance",
    "user": "postgres",
    "password": "$PostgresPassword",
    "host": "localhost"
}

EMAIL_CONFIG = {
    "sender_email": "$GmailAddress",
    "sender_password": "$GmailAppPassword"
}

faculty_emails = ["$FacultyEmail"]
director_email = "$DirectorEmail"
"@

Set-Content -Path "$ProjectDir\config.py" -Value $configContent -Encoding UTF8
Write-Host "[OK] config.py updated with your settings." -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════════════
# Create a launcher script
# ══════════════════════════════════════════════════════════════════════════════
$launcherContent = @"
@echo off
echo ============================================
echo   College Automated Attendance System
echo ============================================
echo.
echo Starting the application...
echo Open your browser and go to: http://127.0.0.1:5000
echo.
echo Press Ctrl+C to stop the server.
echo.
cd /d "$ProjectDir"
C:\av\Scripts\python.exe app.py
pause
"@

Set-Content -Path "$ProjectDir\START_APP.bat" -Value $launcherContent -Encoding ASCII
Write-Host "[OK] Created START_APP.bat launcher." -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════════════
# DONE!
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Virtual Environment : C:\av" -ForegroundColor White
Write-Host "  Database            : autoattendance (PostgreSQL)" -ForegroundColor White
Write-Host "  Project Folder      : $ProjectDir" -ForegroundColor White
Write-Host ""
Write-Host "  HOW TO RUN:" -ForegroundColor Yellow
Write-Host "    Option 1: Double-click START_APP.bat" -ForegroundColor White
Write-Host "    Option 2: Open PowerShell and run:" -ForegroundColor White
Write-Host "              cd `"$ProjectDir`"" -ForegroundColor Cyan
Write-Host "              C:\av\Scripts\python.exe app.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Then open browser: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  FIRST TIME:" -ForegroundColor Yellow
Write-Host "    1. Go to http://127.0.0.1:5000/signup" -ForegroundColor White
Write-Host "    2. Create an admin account" -ForegroundColor White
Write-Host "    3. Login and register students with webcam" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: First run downloads a ~580MB face recognition model." -ForegroundColor Yellow
Write-Host "        This is normal and happens only once." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
