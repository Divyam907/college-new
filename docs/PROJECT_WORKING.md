# How the Project Works — Automated Attendance System Using Facial Recognition

This document explains the internal working of each component, the data flow between modules, and how the system processes attendance end to end.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Authentication & Role System](#authentication--role-system)
3. [Student Registration (Admin Portal)](#student-registration-admin-portal)
4. [Embedding Generation](#embedding-generation)
5. [Face Detection & Recognition](#face-detection--recognition)
6. [Attendance Marking — Portal Mode](#attendance-marking--portal-mode)
7. [Attendance Marking — Scheduled Batch Mode](#attendance-marking--scheduled-batch-mode)
8. [Subject Association](#subject-association)
9. [Duplicate Prevention](#duplicate-prevention)
10. [Report Generation](#report-generation)
11. [Email Delivery](#email-delivery)
12. [Database Schema](#database-schema)
13. [Module Responsibilities](#module-responsibilities)
14. [Data Flow Diagrams](#data-flow-diagrams)

---

## High-Level Architecture

The system is a **Flask web application** backed by a **PostgreSQL database** and a **DeepFace-based recognition engine**. It operates in two modes:

| Mode | Entry Point | How It Works |
|------|-------------|--------------|
| **Web Portal** | `app.py` | Users interact via browser — admin registers students, college staff marks attendance |
| **Batch Scheduler** | `Schedule.py` | Reads images from the `images/` folder and processes them at scheduled times |

Both modes share the same recognition engine (`Attendance_update_db.py`), the same database, and the same embedding file (`embeddings.csv`).

```
Browser (Admin/College)
        │
        ▼
   Flask (app.py)
        │
        ├──► Student Registration ──► dataset/ ──► gen_embed.py ──► embeddings.csv
        │
        ├──► Attendance Marking ──► Attendance_update_db.py
        │       │                         │
        │       ▼                         ▼
        │   DeepFace + VGG-Face     PostgreSQL (attendance table)
        │
        └──► Report Sending ──► generate_report.py ──► send_report.py ──► send_email.py ──► Gmail SMTP
```

---

## Authentication & Role System

### How Login Works

1. User opens `http://127.0.0.1:5000` → redirected to `/login`
2. Enters email and password
3. `app.py` queries the `users` table, retrieves the hashed password
4. `werkzeug.security.check_password_hash()` compares the entered password with the stored hash
5. If valid → Flask session is set with `user_id`, `name`, `email`, `role`
6. User is redirected to `/admin` or `/college` based on role

### How Signup Works

1. User fills name, email, password, and selects role (`admin` or `college`)
2. Password is hashed with `werkzeug.security.generate_password_hash()`
3. A new row is inserted into the `users` table
4. User is redirected to login

### Role Enforcement

- `@admin_required` decorator: checks `session['role'] == 'admin'`
- `@college_required` decorator: checks `session['role'] == 'college'`
- Unauthorized access redirects to the dashboard with an error flash message

---

## Student Registration (Admin Portal)

### Step-by-Step Flow

```
Admin clicks "Register Student"
        │
        ▼
Browser opens webcam → admin captures 1+ photos
        │
        ▼
Photos sent as base64 JSON to POST /admin/register
        │
        ▼
app.py decodes base64 → saves as JPG files
        │
        ├──► INSERT INTO student (name, email) → PostgreSQL
        │
        ├──► Creates folder: dataset/<Student Name>/
        │    Saves: photo_1.jpg, photo_2.jpg, ...
        │
        └──► Calls _regenerate_embeddings()
             │
             └──► gen_embed.get_embeddings() → reads all dataset/ folders
                  → extracts VGG-Face embeddings → writes embeddings.csv
```

### Key Details

- Each student gets a dedicated folder inside `dataset/` named after them
- The folder name **must match** the `name` column in the `student` table
- `embeddings.csv` is regenerated after every registration so the new student is immediately recognizable
- Photos are decoded from base64, converted to NumPy arrays via OpenCV, and saved as `.jpg`

---

## Embedding Generation

### What Are Embeddings?

An embedding is a **2622-dimensional numerical vector** that represents a face's identity-related features. The VGG-Face model converts a face image into this vector. Two images of the same person produce similar vectors; different people produce distant vectors.

### How `gen_embed.py` Works

```python
for each student folder in dataset/:
    for each image in the folder:
        embedding = DeepFace.represent(image, model_name='VGG-Face')
        store embedding + student name
save all embeddings to embeddings.csv
```

### Output Format — `embeddings.csv`

| Column 0 | Column 1 | ... | Column 2621 | name |
|----------|----------|-----|-------------|------|
| 0.0234 | -0.0891 | ... | 0.1456 | John Doe |
| 0.0512 | -0.0234 | ... | 0.0789 | Jane Smith |

- 2622 numerical columns (VGG-Face embedding dimensions)
- 1 `name` column (student identity label)
- One row per image (a student with 3 photos has 3 rows)

---

## Face Detection & Recognition

### Detection

The system uses **MTCNN** (Multi-Task Cascaded Convolutional Network) as the face detector:

```python
faces = DeepFace.extract_faces(img_path=image_path, detector_backend='mtcnn')
```

This returns a list of detected face regions with coordinates (`x`, `y`, `w`, `h`).

### Recognition (Matching)

For each detected face:

1. **Crop** the face region from the image
2. **Extract embedding** using VGG-Face:
   ```python
   face_embedding = DeepFace.represent(face_img, model_name='VGG-Face', enforce_detection=False)
   ```
3. **Compare** with all stored embeddings using Euclidean distance:
   ```
   distance = ||face_embedding - stored_embedding||₂
   ```
4. **Select** the stored identity with the smallest distance
5. **Apply threshold**: if `distance > 0.9`, reject the match (face is unknown)
6. If accepted, compute confidence: `confidence = 1 / (1 + distance)`

### Why Threshold Matters

Without a threshold, every detected face would be force-matched to the nearest known student — even if the face belongs to a visitor or is a false detection. The threshold of `0.9` prevents weak matches from being recorded.

---

## Attendance Marking — Portal Mode

### User Flow

1. College staff logs in → opens **Mark Attendance** page
2. Selects a **subject** from the dropdown (fetched from `subject` table)
3. Captures a **classroom photo** via webcam (browser camera)
4. Browser sends the base64 image + `subject_id` as JSON to `POST /college/mark`

### Backend Processing

```
POST /college/mark
        │
        ▼
Decode base64 → save as images/HH-MM-SS.jpg
        │
        ▼
process_group_image_with_subject(image_path, subject_id)
        │
        ├──► Load embeddings.csv
        │
        ├──► DeepFace.extract_faces() → detect all faces
        │
        ├──► For each face:
        │       DeepFace.represent() → get embedding
        │       Compare with all stored embeddings
        │       If distance < 0.9 → accept match
        │
        ├──► get_student_ids(matched_names) → look up std_ids from DB
        │
        ├──► mark_attendance(student_ids, subject_id, date, image_path)
        │       │
        │       └──► For each student:
        │               Check if attendance already exists for (date, subject, student)
        │               If not → INSERT INTO attendance
        │
        └──► Return JSON result to browser
                {recognized students, confidence scores, subject info}
```

### Response to Browser

The browser displays:
- Names of recognized students
- Confidence scores
- Number of faces detected vs matched
- Any errors (e.g., no faces found)

---

## Attendance Marking — Scheduled Batch Mode

### How It Works

`Schedule.py` runs as a long-lived process that checks the `images/` folder.

```
Schedule.py starts
        │
        ├──► Runs job() immediately on startup
        │
        └──► Runs job() at configured times (e.g., 19:24, 19:25)
                │
                ▼
        For each file in images/ matching HH-MM-SS.ext:
                │
                ├──► process_group_image(image_path)
                │       │
                │       ├──► Extract time from filename (e.g., 09-30-00 → 09:30:00)
                │       ├──► Query subject table: which subject runs at this time?
                │       ├──► Detect faces → match embeddings → mark attendance
                │       └──► Return result
                │
                └──► send_daily_report(image_path) → email the report
```

### Automatic Report Triggers

- **Every run**: sends daily report
- **Sunday** (`weekday == 6`): sends weekly report
- **5th of month** (`day == 5`): sends monthly report

---

## Subject Association

The system supports **two methods** for linking attendance to a subject:

### Method 1 — Time-Based (Batch Mode)

- Image filename encodes the time: `09-30-00.jpg` → 09:30:00
- The system queries the `subject` table:
  ```sql
  SELECT * FROM subject WHERE '09:30:00' BETWEEN from_time AND to_time
  ```
- If a match is found, that subject is used
- If no match → error (no subject at this time)

### Method 2 — Manual Selection (Portal Mode)

- College staff selects the subject from a dropdown before capturing the photo
- The selected `subject_id` is passed directly to `process_group_image_with_subject()`
- This avoids the time-based lookup entirely

**Why both?** Time-based works for automated processing during class hours. Manual selection works for testing, demos, or capturing attendance outside the fixed schedule.

---

## Duplicate Prevention

Before inserting an attendance record, the system checks:

```sql
SELECT 1 FROM attendance
WHERE date = %s AND subject_id = %s AND student_id = %s
```

If a row already exists → skip insertion. This prevents:
- Double-marking when the same image is processed again
- Inflation of attendance counts in reports

---

## Report Generation

### Daily Report (`generate_daily_report(date)`)

- Queries all attendance records for a specific date
- Pivots data: rows = students, columns = subjects
- Output: which students attended which subjects on that date

### Weekly Report (`generate_weekly_report(start_date, end_date)`)

- Queries attendance between two dates
- Groups by student + subject
- Counts number of days present per student per subject

### Monthly Report (`generate_monthly_report(year, month)`)

- Queries attendance for a given month
- Calculates per student per subject:
  - Total classes (assumed 20 per subject)
  - Days present
  - Days absent
  - Attendance percentage

### Output Format

All reports are exported as **Excel (.xlsx)** files using `pandas` + `openpyxl`.

---

## Email Delivery

### How Emails Are Sent

```
send_report.py
    │
    ├──► generate_report.py → creates the report DataFrame
    │
    ├──► Exports to .xlsx file
    │
    └──► send_email.py → sends via SMTP
            │
            ├──► Connects to smtp.gmail.com:587
            ├──► Authenticates with app password
            ├──► Attaches .xlsx file(s) and optional image
            └──► Sends to each recipient in faculty_emails + director_email
```

### Admin Dashboard Trigger

The admin can also send reports on-demand from the dashboard:
1. Choose report type (daily / weekly / monthly)
2. Pick a date
3. Click "Send Report"
4. `app.py` calls the appropriate `send_*_report()` function
5. Email is dispatched to configured recipients

### Error Handling

Email failures are wrapped in `try/except` so that:
- A failed email does not crash the attendance pipeline
- The error is logged/flashed to the user
- Other recipients still receive their copy

---

## Database Schema

### `users` Table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | SERIAL PK | Auto-increment user ID |
| `name` | VARCHAR(100) | Display name |
| `email` | VARCHAR(100) UNIQUE | Login email |
| `password_hash` | VARCHAR(255) | Werkzeug-hashed password |
| `role` | VARCHAR(20) | `admin` or `college` |

### `student` Table

| Column | Type | Purpose |
|--------|------|---------|
| `std_id` | SERIAL PK | Student ID |
| `name` | VARCHAR(100) | Must match the dataset folder name |
| `email` | VARCHAR(100) | Optional contact email |

### `subject` Table

| Column | Type | Purpose |
|--------|------|---------|
| `sub_id` | SERIAL PK | Subject ID |
| `name` | VARCHAR(100) | Subject name (e.g., Mathematics) |
| `faculty_id` | INTEGER | Faculty reference |
| `from_time` | TIME | Class start time |
| `to_time` | TIME | Class end time |

### `attendance` Table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | SERIAL PK | Record ID |
| `date` | DATE | Attendance date |
| `subject_id` | INTEGER FK → subject | Which subject |
| `student_id` | INTEGER FK → student | Which student |
| `image` | TEXT | Path to the source image |

### Relationships

```
users (standalone — portal access)

student ◄──── attendance ────► subject
  (1:N)         record          (1:N)
```

---

## Module Responsibilities

| File | What It Does |
|------|-------------|
| `app.py` | Flask web server — handles all HTTP routes, login/signup, admin operations, college operations, API endpoints |
| `Attendance_update_db.py` | Core recognition engine — face detection, embedding matching, subject lookup, attendance DB insertion |
| `gen_embed.py` | Reads student photos from `dataset/`, extracts VGG-Face embeddings, saves to `embeddings.csv` |
| `generate_report.py` | SQL queries that produce daily/weekly/monthly attendance DataFrames |
| `send_report.py` | Wraps report generation + Excel export + email sending into callable functions |
| `send_email.py` | Low-level SMTP email utility — connects to Gmail, attaches files, sends message |
| `Schedule.py` | Runs the batch pipeline on a timer — processes images, generates reports, sends emails |
| `config.py` | Central configuration — DB credentials, email credentials, recipient lists |
| `connection.py` | SQLAlchemy engine and session management (handles special characters in DB password) |
| `Monoface.py` | Utility for single-face detection (standalone script) |
| `Multiface.py` | Utility for multi-face detection (standalone script) |

---

## Data Flow Diagrams

### Flow 1: Student Registration

```
Admin (browser)
   │
   │ POST /admin/register
   │ {name, email, photos[base64]}
   ▼
app.py
   │
   ├──► PostgreSQL: INSERT INTO student
   │
   ├──► Filesystem: dataset/<name>/photo_1.jpg, photo_2.jpg
   │
   └──► gen_embed.py: regenerate embeddings.csv
```

### Flow 2: Attendance Marking (Portal)

```
College Staff (browser)
   │
   │ POST /college/mark
   │ {photo: base64, subject_id: 3}
   ▼
app.py
   │
   └──► Attendance_update_db.process_group_image_with_subject()
           │
           ├──► Load embeddings.csv
           ├──► DeepFace: detect faces (MTCNN)
           ├──► DeepFace: extract embeddings (VGG-Face)
           ├──► NumPy: compute Euclidean distances
           ├──► Filter by threshold (0.9)
           ├──► PostgreSQL: get student IDs by name
           ├──► PostgreSQL: check duplicates + INSERT INTO attendance
           └──► Return: {recognized students, counts, subject}
```

### Flow 3: Report Generation

```
Admin (browser)                    Schedule.py (cron)
   │                                    │
   │ POST /admin/send-report           │ job() triggers at scheduled time
   │ {type: monthly, date: 2026-04}    │
   ▼                                    ▼
send_report.py
   │
   ├──► generate_report.py → SQL query → pandas DataFrame
   │
   ├──► Export to .xlsx
   │
   └──► send_email.py → SMTP → Gmail → recipient inbox
```

### Flow 4: Complete Attendance Lifecycle

```
                    ┌──────────────┐
                    │  Admin signs  │
                    │  in to portal │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Register     │
                    │  student via  │◄─── Webcam capture
                    │  webcam       │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Photos saved │
                    │  to dataset/  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Embeddings   │
                    │  regenerated  │──── embeddings.csv updated
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  College staff│
                    │  captures     │◄─── Selects subject + webcam
                    │  classroom    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Faces        │
                    │  detected &   │──── MTCNN + VGG-Face
                    │  matched      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Attendance   │
                    │  inserted     │──── PostgreSQL
                    │  into DB      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Reports      │
                    │  generated &  │──── Excel + Email
                    │  emailed      │
                    └──────────────┘
```

---

## Key Technical Decisions

| Decision | Reason |
|----------|--------|
| VGG-Face model | Proven accuracy for face verification; supported natively by DeepFace |
| MTCNN detector | Handles multiple faces in a single image; more robust than Haar cascades |
| Euclidean distance (threshold 0.9) | Simple, effective; prevents forced matching of unknown faces |
| PostgreSQL over SQLite | Supports concurrent access, better for multi-user web apps |
| `URL.create()` in connection.py | Safely handles special characters (`@`, `#`, etc.) in DB passwords |
| Embeddings stored in CSV | Fast to load into NumPy; no model re-inference needed at runtime |
| Dual mode (portal + scheduler) | Portal for interactive use; scheduler for automated institutional use |
| Subject selected manually in portal | Removes dependency on strict class schedules during testing |
| Reports as Excel files | Familiar format for faculty; easy to print/forward |
| Gmail SMTP with app password | Free, widely available; app passwords avoid 2FA issues |
