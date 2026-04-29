# 🎓 College Automated Attendance System

## AI-Powered Smart Attendance & Classroom Engagement Monitoring

---

## 📌 Project Overview

The **College Automated Attendance System** is an AI-powered web application that automates student attendance using **face recognition** technology. It eliminates manual roll calls by identifying students from a group photograph and marking their attendance automatically. Beyond attendance, the system also provides **real-time classroom engagement analysis**, **liveness/anti-spoofing detection**, and **automated report generation** with email delivery.

### Who is it for?
- **College Administration (Admin)** — Manage students, classes, timetables, generate reports
- **College Faculty/Staff** — Mark attendance using camera, monitor classroom engagement

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                        │
│  Bootstrap 5 + Jinja2 Templates + JavaScript (AJAX)            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (REST API)
┌──────────────────────────────▼──────────────────────────────────┐
│                     BACKEND (Flask 3.x)                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Auth &  │ │Attendance│ │Engagement│ │  Reports & Alerts  │  │
│  │ Routing │ │  Module  │ │  Module  │ │  (Email/WhatsApp)  │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│   PostgreSQL    │  │    DeepFace     │  │   OpenCV + Haar     │
│   Database      │  │  (VGG-Face)     │  │   Cascade + MTCNN   │
│                 │  │  Face Matching  │  │   Face Detection    │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## ✨ Features

### 1. 📸 Automated Face Recognition Attendance
| Feature | Description |
|---------|-------------|
| Group Photo Processing | Upload one class photo → all students identified automatically |
| Face Detection | MTCNN (Multi-task Cascaded Convolutional Networks) detects faces |
| Face Recognition | VGG-Face model generates 4096-dimensional embeddings |
| Matching Algorithm | Euclidean distance comparison against enrolled embeddings |
| Accuracy | Threshold-based matching (distance < 0.9 = match) |
| Duplicate Prevention | Same student cannot be marked twice for same period/day |
| Multi-student | Handles multiple students in a single image |

### 2. 🔐 Liveness Detection (Anti-Spoofing)
Prevents cheating by detecting if a **real person** is in front of the camera vs. a printed photo or phone screen.

| Check | How it Works |
|-------|-------------|
| Texture Analysis | Laplacian variance — real faces have more texture detail than flat photos |
| Moiré Pattern Detection | FFT analysis — screens/prints show interference patterns |
| Blink Detection | Eye Aspect Ratio tracking — real people blink naturally |
| Head Movement | Micro-movement tracking — static photos don't move |
| 3D Depth Cues | Validates natural face structure presence |

**Confidence Score**: `checks_passed / total_checks` (threshold: 66%)

### 3. 📊 Real-Time Engagement Monitoring
Analyzes classroom engagement during lectures in real-time:

| Metric | How it's Measured |
|--------|-------------------|
| Gaze Direction | Eye position relative to face center (center/left/right/down) |
| Emotion | DeepFace emotion recognition (7 emotions) |
| Face Orientation | Gradient symmetry analysis (frontal vs turned) |
| Engagement Score | 0.0–1.0 per student based on gaze + emotion + eye visibility |
| Classification | Attentive / Confused / Distracted |

**How it works on College Side:**
1. Faculty selects Class → Section → Period → Capture Interval
2. Clicks "Start" → Camera opens and captures frames at set intervals
3. Each capture shows: photo snapshot + aggregate class metrics
4. Data stored in database for admin analysis

**Admin Side:** Full per-student breakdown — individual engagement score, emotion, gaze, liveness for each identified student.

### 4. 📧 Automated Report Generation
| Type | Contents |
|------|----------|
| Daily Report | Today's attendance per section/period |
| Weekly Report | 7-day aggregated data |
| Monthly Report | Full month statistics |
| Custom Report | Filtered by class, section, date range |

- Excel attachment with 2 sheets (raw data + summary)
- Email body includes student names grouped by section/period
- Sent via Gmail SMTP with App Password

### 5. 📱 WhatsApp Alerts (Optional)
- Absence notifications sent to parents/teachers
- Daily summary reports via WhatsApp
- Engagement alerts (low engagement detection)
- Multiple recipient roles: Parent, Teacher, Dean, HOD

### 6. 🎥 Continuous Camera Capture (Optional)
- RTSP stream support (IP cameras)
- Webcam support for local deployment
- Configurable capture intervals
- Background processing with multi-threading

### 7. 📅 Timetable & Class Management
- Class → Section → Period hierarchy
- Day-wise timetable scheduling
- Teacher assignment per period
- Dynamic period selection in attendance marking

---

## 🛠️ Technologies Used

### Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| Python | Core programming language | 3.13 |
| Flask | Web framework | 3.x |
| PostgreSQL | Relational database | — |
| psycopg2 | PostgreSQL adapter | 2.9.9 |

### AI/ML & Computer Vision
| Technology | Purpose |
|-----------|---------|
| DeepFace | Face recognition & emotion analysis |
| VGG-Face | 4096-dim face embedding model |
| MTCNN | Face detection (multi-task CNN) |
| OpenCV | Image processing, Haar cascades |
| TensorFlow/Keras | Deep learning framework |
| NumPy | Numerical computations |

### Frontend
| Technology | Purpose |
|-----------|---------|
| Bootstrap 5.3 | Responsive CSS framework |
| Bootstrap Icons | Icon library |
| Jinja2 | HTML templating |
| JavaScript (Vanilla) | AJAX, Camera API, Dynamic UI |

### Communication
| Technology | Purpose |
|-----------|---------|
| SMTP (Gmail) | Email report delivery |
| Twilio API | WhatsApp messaging |
| OpenPyXL | Excel report generation |
| Pandas | Data manipulation & analysis |

---

## 🗄️ Database Design

The system uses **PostgreSQL** with the following tables:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    class     │────▶│   section    │────▶│    timetable     │
│ (BCA-1, etc) │     │  (A, B, C)   │     │ (period/day/time)│
└──────────────┘     └──────┬───────┘     └──────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   student    │
                     │(name,roll,dob)│
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────────┐
              ▼             ▼                  ▼
       ┌────────────┐ ┌───────────────┐ ┌──────────────────────┐
       │ attendance │ │engagement_log │ │engagement_student_log │
       │(date,period)│ │(class-level)  │ │  (per-student)       │
       └────────────┘ └───────────────┘ └──────────────────────┘
```

**10 Tables**: users, class, section, student, subject, timetable, attendance, engagement_log, engagement_student_log, engagement_sessions, whatsapp_recipients, camera_streams

---

## 🔄 How Face Recognition Works

### Step 1: Student Enrollment
```
Admin registers student → Captures 3-5 photos → Saved to dataset/StudentName/
                                                           ↓
                                              gen_embed.py runs DeepFace
                                                           ↓
                                              4096-dim embedding per photo
                                                           ↓
                                              Stored in embeddings.csv
```

### Step 2: Attendance Marking
```
Faculty captures class photo
         ↓
MTCNN detects all faces in image
         ↓
For each face:
  → DeepFace generates 4096-dim embedding
  → Euclidean distance calculated against ALL embeddings in CSV
  → Closest match selected
  → If distance < 0.9 → MATCH (student identified)
  → Confidence = 1 / (1 + distance)
         ↓
All matched students marked PRESENT in database
```

### Confidence Scoring Example:
| Distance | Confidence | Result |
|----------|-----------|--------|
| 0.30 | 76.9% | ✅ Strong match |
| 0.60 | 62.5% | ✅ Good match |
| 0.85 | 54.1% | ✅ Acceptable |
| 0.95 | 51.3% | ❌ Rejected (above threshold) |

---

## 📊 Engagement Analysis Algorithm

```
For each detected face:
  1. Detect eyes → Compute gaze (center/left/right/down)
  2. DeepFace → Detect emotion (neutral/happy/sad/angry/fear/surprise/disgust)
  3. Gradient analysis → Face orientation (frontal/turned)

  Engagement Score (0 to 1):
    Start at 1.0
    − 0.4 if gaze ≠ center (looking away)
    − 0.3 if no eyes visible (looking down/covered)
    − 0.2 if emotion is distracted (angry/disgust/sad)
    − 0.1 if emotion is confused (fear/surprise)

  Classification:
    Score ≥ 0.7 → ATTENTIVE 🟢
    Score 0.4-0.7 → MODERATE 🟡
    Score < 0.4 → DISTRACTED 🔴
```

---

## 👥 User Roles & Access

### Admin Portal (`/admin`)
| Module | Capabilities |
|--------|-------------|
| Dashboard | View KPIs (total students, classes, today's attendance) |
| Classes & Sections | Create/delete classes and sections |
| Timetable | Schedule periods per section per day |
| Students | Register with face photos, manage records |
| Engagement Reports | View per-student engagement, emotion, liveness data |
| Cameras | Manage RTSP/webcam streams for auto-capture |
| WhatsApp | Configure recipients, send alerts |
| Reports | Generate and email attendance reports |

### College Staff Portal (`/college`)
| Module | Capabilities |
|--------|-------------|
| Dashboard | Today's attendance stats |
| Mark Attendance | Camera capture → face recognition → auto-mark |
| Records | View attendance by date/class/section |
| Engagement | Start/stop monitoring sessions, view class-level metrics |

---

## 📁 Project Structure

```
College_Automated_Attendance/
├── app.py                    # Main Flask application (all routes)
├── config.py                 # Configuration (DB, Email, WhatsApp, etc.)
├── connection.py             # Database connection helper
├── Attendance_update_db.py   # Face recognition & attendance functions
├── gen_embed.py              # Generate face embeddings from photos
├── engagement.py             # Engagement analysis module
├── liveness.py               # Liveness/anti-spoofing detection
├── send_email.py             # Email sending utility
├── send_report.py            # Report generation & delivery
├── Schedule.py               # Scheduled report automation
├── embeddings.csv            # Stored face embeddings (4096-dim)
├── requirements.txt          # Python dependencies
├── dataset/                  # Student face photos
│   ├── Student Name/
│   │   ├── photo_1.jpg
│   │   ├── photo_2.jpg
│   │   └── photo_3.jpg
├── images/                   # Captured attendance images
├── templates/                # HTML templates
│   ├── base.html             # Base layout (sidebar + header)
│   ├── login.html            # Login page
│   ├── signup.html           # Signup page
│   ├── admin/                # Admin portal pages
│   │   ├── dashboard.html
│   │   ├── students.html
│   │   ├── register_student.html
│   │   ├── engagement.html
│   │   └── ...
│   └── college/              # College staff portal pages
│       ├── dashboard.html
│       ├── mark_attendance.html
│       ├── records.html
│       └── engagement.html
└── figures/                  # Documentation images
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+ (tested on 3.13)
- PostgreSQL installed and running
- Webcam (for attendance capture)
- Gmail account with App Password (for reports)

### Steps
```bash
# 1. Clone repository
git clone <repository-url>
cd College_Automated_Attendance

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt
# For Python 3.13: pip install -r requirements_py313.txt

# 4. Configure database (config.py)
# Update DB_PARAMS with your PostgreSQL credentials

# 5. Run the application
python app.py

# 6. Open browser
# http://localhost:5000
```

### First-Time Setup
1. Create admin account via `/signup`
2. Create classes and sections (`/admin/classes`)
3. Set up timetable (`/admin/timetable`)
4. Register students with face photos (`/admin/register`)
5. Generate embeddings (automatic on registration)
6. Start marking attendance! (`/college/mark`)

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| Password Hashing | Werkzeug PBKDF2-SHA256 |
| Session Management | Flask server-side sessions |
| Role-Based Access | Decorators (`@admin_required`, `@college_required`) |
| Liveness Detection | Prevents photo/video spoofing |
| Input Validation | Server-side validation on all forms |
| CSRF Protection | Flask session-based protection |
| SQL Injection Prevention | Parameterized queries (psycopg2) |

---

## 📈 Performance & Scalability

| Aspect | Detail |
|--------|--------|
| Face Detection | ~200ms per face (MTCNN) |
| Face Matching | ~100ms per face against all embeddings |
| Engagement Analysis | ~500ms per frame (includes emotion detection) |
| Concurrent Users | Supports multiple simultaneous sessions |
| Database | PostgreSQL with indexes for fast lookups |
| Multi-threading | Background camera capture and alert sending |

---

## 🚀 Future Enhancements

- Mobile app integration
- Real-time video streaming attendance
- Parent portal for viewing child's attendance
- Push notifications
- Advanced analytics dashboard with charts
- Export to college ERP systems
- Multi-campus support

---

## 📝 Summary

This project demonstrates a **complete end-to-end solution** for automated college attendance using modern AI technologies. It combines:

1. **Deep Learning** (VGG-Face, MTCNN) for accurate face recognition
2. **Computer Vision** (OpenCV) for image processing and analysis
3. **NLP/Emotion AI** (DeepFace) for engagement monitoring
4. **Web Development** (Flask + Bootstrap) for user interface
5. **Database Management** (PostgreSQL) for data persistence
6. **Communication APIs** (SMTP, Twilio) for alerts and reports

The system is **production-ready** with security features, anti-spoofing detection, and automated scheduling — making it suitable for real-world deployment in educational institutions.

---

*Developed as a college project demonstrating AI/ML integration in web applications.*
