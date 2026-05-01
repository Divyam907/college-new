# College Automated Attendance System — Complete Setup Guide

> **For a brand new Windows PC with nothing installed.**
> Follow every step exactly. Do not skip anything.

---

## Table of Contents

1. [Prerequisites (What You Need Before Starting)](#1-prerequisites)
2. [Download the Project](#2-download-the-project)
3. [One-Click Automated Setup](#3-one-click-automated-setup)
4. [Manual Setup (Step by Step)](#4-manual-setup-step-by-step)
5. [Running the Application](#5-running-the-application)
6. [First Time Usage](#6-first-time-usage)
7. [Gmail App Password Setup](#7-gmail-app-password-setup)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have:

- A **Windows 10 or 11** computer (64-bit)
- An **internet connection** (you will download ~2 GB of data)
- A **webcam** (built-in or USB — needed for student registration & attendance)
- At least **8 GB RAM** (16 GB recommended)
- At least **5 GB free disk space**
- A **Gmail account** (for sending attendance reports — optional but recommended)

---

## 2. Download the Project

If you already have the project folder, skip to Step 3.

### Option A: Download as ZIP
1. Go to the project GitHub/source page
2. Click **"Code" → "Download ZIP"**
3. Extract the ZIP to your Desktop
4. You should have a folder like: `C:\Users\YourName\Desktop\College_Automated_Attendance-master`

### Option B: Using Git (if installed)
```
git clone <repository-url>
```

---

## 3. One-Click Automated Setup

> **This is the easiest method. One script installs everything.**

### Step 3.1 — Open PowerShell as Administrator

1. Press **Windows key** on your keyboard
2. Type **PowerShell**
3. Right-click on **"Windows PowerShell"**
4. Click **"Run as administrator"**
5. Click **"Yes"** when Windows asks for permission

### Step 3.2 — Allow Script Execution

In the PowerShell window, type this command and press Enter:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Step 3.3 — Navigate to Project Folder

Type this command (change the path to match where you extracted the project):

```powershell
cd "$env:USERPROFILE\Desktop\College_Automated_Attendance-master\College_Automated_Attendance-master"
```

### Step 3.4 — Run the Setup Script

```powershell
.\setup.ps1
```

### Step 3.5 — Answer the Questions

The script will ask you these questions one by one:

| Question | What to Enter | Example |
|----------|--------------|---------|
| PostgreSQL password | Any password you want (remember it!) | `MySecurePass123` |
| Gmail address | Your Gmail address | `john@gmail.com` |
| Gmail App Password | 16-character app password ([see Section 7](#7-gmail-app-password-setup)) | `abcd efgh ijkl mnop` |
| Faculty email | Email to receive reports (press Enter to use your Gmail) | `faculty@college.edu` |
| Director email | Email to receive reports (press Enter to use your Gmail) | `director@college.edu` |

### Step 3.6 — Wait

The script will automatically:
1. Install Chocolatey (package manager)
2. Install Python 3.12
3. Install PostgreSQL (database)
4. Install Visual Studio Build Tools (for compiling packages)
5. Install CMake
6. Create the database and all required tables
7. Create a Python virtual environment at `C:\av`
8. Install all Python packages
9. Configure the project with your settings
10. Create a `START_APP.bat` launcher

**This takes 15-30 minutes** depending on your internet speed. Do not close the window.

### Step 3.7 — Done!

When you see **"SETUP COMPLETE!"**, everything is installed. Skip to [Section 5: Running the Application](#5-running-the-application).

---

## 4. Manual Setup (Commands Only)

> **Only follow this if the automated setup (Section 3) failed.**
> Open **PowerShell as Administrator** and run commands in order. Restart PowerShell after each install step.

---

### Step 4.1 — Install Software

Download & install these. **Check "Add to PATH"** during each installation:

| # | Software | Download Link | Important |
|---|----------|--------------|-----------|
| 1 | Python 3.12 | https://www.python.org/downloads/ | ⚠️ Check **"Add python.exe to PATH"** |
| 2 | PostgreSQL | https://www.postgresql.org/download/windows/ | ⚠️ Remember the password you set! |
| 3 | VS Build Tools | https://visualstudio.microsoft.com/visual-cpp-build-tools/ | Select **"Desktop development with C++"** |
| 4 | CMake | https://cmake.org/download/ | ⚠️ Select **"Add CMake to PATH"** |

After installing PostgreSQL, add its bin to PATH:
```powershell
# Add PostgreSQL to PATH (change 17 to your version)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\PostgreSQL\17\bin", "Machine")
```

Verify installs (open a **new** PowerShell window):
```powershell
python --version
psql --version
cmake --version
```

---

### Step 4.2 — Create Database & Tables

```powershell
# Connect to PostgreSQL (enter your PostgreSQL password when prompted)
psql -U postgres -h localhost
```

Then paste all of this into the `postgres=#` prompt:

```sql
CREATE DATABASE autoattendance;
\c autoattendance

CREATE TABLE IF NOT EXISTS student (
    std_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS subject (
    sub_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, faculty_id INTEGER,
    from_time TIME NOT NULL, to_time TIME NOT NULL
);
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY, date DATE NOT NULL,
    subject_id INTEGER REFERENCES subject(sub_id),
    student_id INTEGER REFERENCES student(std_id), image TEXT
);
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','college'))
);

\q
```

---

### Step 4.3 — Python Environment & Packages

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

python -m venv C:\av

C:\av\Scripts\python.exe -m pip install --upgrade pip

cd "$env:USERPROFILE\Desktop\College_Automated_Attendance-master\College_Automated_Attendance-master"

C:\av\Scripts\python.exe -m pip install -r requirements_py313.txt
```

---

### Step 4.4 — Configure config.py

Open `config.py` in Notepad and set your values:

```python
DB_PARAMS = {
    "dbname": "autoattendance",
    "user": "postgres",
    "password": "YOUR_POSTGRESQL_PASSWORD",   # ← change this
    "host": "localhost"
}

EMAIL_CONFIG = {
    "sender_email": "you@gmail.com",          # ← change this
    "sender_password": "xxxx xxxx xxxx xxxx"  # ← Gmail App Password (Section 7)
}

faculty_emails = ["faculty@college.edu"]      # ← change this
director_email = "director@college.edu"       # ← change this
```

---

## 5. Running the Application

### Option A: Using the launcher (automated setup only)

1. Open the project folder in File Explorer
2. Double-click **`START_APP.bat`**
3. A black terminal window will open
4. Wait until you see: `* Running on http://127.0.0.1:5000`
5. Open your web browser (Chrome, Edge, Firefox — any will work)
6. Type in the address bar: **http://127.0.0.1:5000** and press Enter

### Option B: From PowerShell

```powershell
cd "$env:USERPROFILE\Desktop\College_Automated_Attendance-master\College_Automated_Attendance-master"
C:\av\Scripts\python.exe app.py
```

Then open your browser and go to: **http://127.0.0.1:5000**

### About the First Run

> **⚠️ The very first time you run the app, it will automatically download a face recognition model. This file is about 580 MB. This is completely normal and happens only once. Do NOT close the terminal while it downloads. After the first run, the app will start much faster.**

### Stopping the Application

- Go to the terminal/command window and press **Ctrl+C**
- Or simply close the terminal window

---

## 6. First Time Usage

### Step 6.1 — Create an Admin Account

1. Open your browser and go to: **http://127.0.0.1:5000/signup**
2. Fill in the form:
   - **Name:** Your full name
   - **Email:** Your email address
   - **Password:** Choose a strong password
   - **Role:** Select **admin**
3. Click **Sign Up**

### Step 6.2 — Login

1. Go to: **http://127.0.0.1:5000/login**
2. Enter the email and password you just created
3. Click **Login**
4. You'll see the **Admin Dashboard**

### Step 6.3 — Register Students

1. From the Admin Dashboard, click **"Register Student"**
2. Enter the student's **name** and **email**
3. Your webcam will turn on — look at the camera
4. Capture **3 to 5 photos** of the student's face from different angles
5. Click **Register**
6. Repeat for every student you want to enroll

### Step 6.4 — Generate Face Embeddings

After registering students through the web portal, embeddings are processed automatically. If you need to regenerate them manually (e.g., after adding photos directly to the `dataset/` folder):

```powershell
cd "$env:USERPROFILE\Desktop\College_Automated_Attendance-master\College_Automated_Attendance-master"
C:\av\Scripts\python.exe gen_embed.py
```

### Step 6.5 — Create a College Staff Account (Optional)

1. Go to **http://127.0.0.1:5000/signup**
2. Create another account with role set to **college**
3. College staff can mark attendance but cannot manage students

### Step 6.6 — Mark Attendance

1. Login as **college** staff (or admin)
2. Click **"Mark Attendance"**
3. Select the subject from the dropdown
4. Point your webcam at the classroom
5. Capture a photo — the system will automatically detect and identify all visible faces
6. Attendance is marked for recognized students

### Step 6.7 — View Records

1. Click **"Records"** in the navigation
2. View attendance records filtered by date
3. Admins can also generate and email reports from the dashboard

---

## 7. Gmail App Password Setup

> **This is needed if you want the system to send attendance reports via email. If you don't need email reports, you can skip this entire section.**

### Step 7.1 — Enable 2-Step Verification on Your Google Account

1. Open your browser and go to: **https://myaccount.google.com/security**
2. Sign in with your Gmail account
3. Scroll down to find **"2-Step Verification"** (under "How you sign in to Google")
4. Click on it
5. Click **"Get started"**
6. Follow the instructions (you'll need your phone to receive a code)
7. Complete the setup

### Step 7.2 — Generate an App Password

1. Go to: **https://myaccount.google.com/apppasswords**
2. Sign in if asked
3. In the **"App name"** field, type: `Attendance System`
4. Click **"Create"**
5. Google will show you a **16-character password** like: `abcd efgh ijkl mnop`
6. **Copy this password immediately** — you will need it for config.py
7. Click **"Done"**

> **⚠️ You will only see this password ONCE.** If you lose it, you'll need to generate a new one.

### Step 7.3 — Put the App Password in config.py

Open `config.py` and update the EMAIL_CONFIG section:

```python
EMAIL_CONFIG = {
    "sender_email": "your_real_email@gmail.com",
    "sender_password": "abcd efgh ijkl mnop"
}
```

Replace `abcd efgh ijkl mnop` with the 16-character password Google gave you.

---

## 8. Troubleshooting

### "python is not recognized as an internal or external command"
**Cause:** Python is not in your system PATH.
**Fix:** Uninstall Python, reinstall it, and make sure to **check "Add python.exe to PATH"** during installation.

### "psql is not recognized as an internal or external command"
**Cause:** PostgreSQL bin folder is not in your PATH.
**Fix:** Add `C:\Program Files\PostgreSQL\17\bin` to your system PATH (see Step 4.2). Change `17` to your PostgreSQL version number.

### "pip install" fails with red error text about "Microsoft Visual C++ 14.0"
**Cause:** Visual Studio Build Tools not installed.
**Fix:** Install Visual Studio Build Tools with "Desktop development with C++" workload (Step 4.3).

### "FATAL: password authentication failed for user postgres"
**Cause:** Wrong password in config.py.
**Fix:** Make sure the password in `config.py` matches the one you set during PostgreSQL installation.

### "connection refused" or "could not connect to server"
**Cause:** PostgreSQL service is not running.
**Fix:**
1. Press **Win+R**, type `services.msc`, press Enter
2. Find **"postgresql-x64-17"** (or similar) in the list
3. Right-click → **Start**

### "ModuleNotFoundError: No module named '...'"
**Cause:** You're running Python without the virtual environment.
**Fix:** Always use `C:\av\Scripts\python.exe` instead of just `python`.

### "Address already in use" when starting the app
**Cause:** The app is already running in another terminal.
**Fix:** Close all other terminal windows, then try again.

### "No face detected" when registering a student
**Cause:** Poor lighting or camera angle.
**Fix:** Make sure the student's face is clearly visible, well-lit, and directly facing the camera. Remove glasses or hats if needed.

### First run is very slow (takes several minutes to start)
**Cause:** Normal behavior — the app downloads a 580 MB face recognition model.
**Fix:** Wait for it to finish. This only happens once.

### Windows Firewall popup appears
**Cause:** The web server needs network access.
**Fix:** Click **"Allow access"** — this only allows connections on your local machine.

### "cannot execute scripts" or "execution policy" error
**Fix:** Run this in PowerShell:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Virtual environment not working
**Fix:** Delete and recreate it:
```powershell
Remove-Item -Recurse -Force C:\av
python -m venv C:\av
C:\av\Scripts\Activate.ps1
pip install -r requirements_py313.txt
```

---

## Quick Reference

| What | How |
|------|-----|
| **Start the app** | Double-click `START_APP.bat` or run `C:\av\Scripts\python.exe app.py` |
| **Open in browser** | http://127.0.0.1:5000 |
| **Sign up page** | http://127.0.0.1:5000/signup |
| **Login page** | http://127.0.0.1:5000/login |
| **Regenerate embeddings** | `C:\av\Scripts\python.exe gen_embed.py` |
| **Run scheduled mode** | `C:\av\Scripts\python.exe Schedule.py` |
| **Stop the app** | Press `Ctrl+C` in the terminal |
| **Project folder** | Desktop\College_Automated_Attendance-master |
| **Virtual environment** | `C:\av` |
| **Database** | PostgreSQL → database `autoattendance` → port `5432` |
| **Config file** | `config.py` (database password, email settings) |
