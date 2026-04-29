import os
import base64
import json
import re
import shutil
import datetime as dt

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import cv2
import numpy as np
import psycopg2
import pandas as pd
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

from config import DB_PARAMS, TWILIO_CONFIG, CONTINUOUS_ATTENDANCE, ENGAGEMENT_CONFIG, LIVENESS_CONFIG
from Attendance_update_db import process_group_image, process_group_image_with_subject
import gen_embed
from engagement import analyze_engagement
from liveness import quick_liveness_check
from whatsapp_alerts import WhatsAppAlerts, check_and_send_absence_alerts, send_daily_summary_to_all
from continuous_attendance import init_continuous_attendance, get_continuous_attendance

DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
IMAGES_DIR  = os.path.join(BASE_DIR, 'images')

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'college_attendance_secret_key_2026')
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024

# Custom JSON provider to handle numpy types
import json as _json
from flask.json.provider import DefaultJSONProvider

class NumpyJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (dt.date, dt.time, dt.datetime)):
            return str(obj)
        return super().default(obj)

app.json_provider_class = NumpyJSONProvider
app.json = NumpyJSONProvider(app)

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR,  exist_ok=True)

# ── Initialize WhatsApp client ────────────────────────────────────────────────
whatsapp_client = None
if TWILIO_CONFIG.get('account_sid') and TWILIO_CONFIG.get('auth_token'):
    whatsapp_client = WhatsAppAlerts(
        account_sid=TWILIO_CONFIG['account_sid'],
        auth_token=TWILIO_CONFIG['auth_token'],
        from_number=TWILIO_CONFIG['whatsapp_from']
    )

# ── Initialize Continuous Attendance ──────────────────────────────────────────
continuous_attn = init_continuous_attendance(
    db_params=DB_PARAMS,
    dataset_dir=DATASET_DIR,
    images_dir=IMAGES_DIR,
    interval=CONTINUOUS_ATTENDANCE.get('interval_minutes', 15),
    use_webcam=CONTINUOUS_ATTENDANCE.get('use_webcam', True)
)
if CONTINUOUS_ATTENDANCE.get('enabled'):
    for stream_cfg in CONTINUOUS_ATTENDANCE.get('rtsp_streams', []):
        continuous_attn.add_stream(
            stream_key=stream_cfg['key'],
            rtsp_url=stream_cfg.get('url', 'webcam'),
            section_id=stream_cfg['section_id'],
            camera_name=stream_cfg.get('name', '')
        )
    continuous_attn.start()


# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(**DB_PARAMS)


def init_db():
    conn = get_conn()
    cur  = conn.cursor()

    # Users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            name          VARCHAR(100) NOT NULL,
            email         VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin','college'))
        )
    """)

    # Classes table (e.g., Class 10, Class 11, BCA-1)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS class (
            class_id   SERIAL PRIMARY KEY,
            name       VARCHAR(50) NOT NULL UNIQUE
        )
    """)

    # Sections table (e.g., A, B, C, D per class)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS section (
            section_id SERIAL PRIMARY KEY,
            class_id   INTEGER NOT NULL REFERENCES class(class_id) ON DELETE CASCADE,
            name       VARCHAR(20) NOT NULL,
            UNIQUE(class_id, name)
        )
    """)

    # Enhanced student table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS student (
            std_id     SERIAL PRIMARY KEY,
            name       VARCHAR(100) NOT NULL,
            email      VARCHAR(100),
            roll_no    VARCHAR(30),
            class_id   INTEGER REFERENCES class(class_id),
            section_id INTEGER REFERENCES section(section_id),
            dob        DATE
        )
    """)

    # Timetable table (period schedule per section per day)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS timetable (
            tt_id        SERIAL PRIMARY KEY,
            section_id   INTEGER NOT NULL REFERENCES section(section_id) ON DELETE CASCADE,
            day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            period_name  VARCHAR(100) NOT NULL,
            teacher_name VARCHAR(100),
            from_time    TIME NOT NULL,
            to_time      TIME NOT NULL,
            is_recess    BOOLEAN DEFAULT FALSE
        )
    """)

    # Subject table (kept for backward compat, linked to class)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS subject (
            sub_id     SERIAL PRIMARY KEY,
            name       VARCHAR(100) NOT NULL,
            class_id   INTEGER REFERENCES class(class_id),
            faculty_id INTEGER,
            from_time  TIME,
            to_time    TIME
        )
    """)

    # Attendance table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id         SERIAL PRIMARY KEY,
            date       DATE NOT NULL,
            student_id INTEGER REFERENCES student(std_id) ON DELETE CASCADE,
            section_id INTEGER REFERENCES section(section_id),
            period_id  INTEGER REFERENCES timetable(tt_id),
            subject_id INTEGER REFERENCES subject(sub_id),
            image      TEXT
        )
    """)

    # ── Migrations: add columns if missing (for existing tables) ──────────────
    migrations = [
        ("student", "roll_no",    "VARCHAR(30)"),
        ("student", "class_id",   "INTEGER REFERENCES class(class_id)"),
        ("student", "section_id", "INTEGER REFERENCES section(section_id)"),
        ("student", "dob",        "DATE"),
        ("attendance", "section_id", "INTEGER REFERENCES section(section_id)"),
        ("attendance", "period_id",  "INTEGER REFERENCES timetable(tt_id)"),
    ]
    for table, col, col_type in migrations:
        cur.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name=%s AND column_name=%s
        """, (table, col))
        if not cur.fetchone():
            cur.execute(f'ALTER TABLE {table} ADD COLUMN {col} {col_type}')

    # ── Engagement Log table ──────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS engagement_log (
            id             SERIAL PRIMARY KEY,
            date           DATE NOT NULL,
            section_id     INTEGER REFERENCES section(section_id),
            period_id      INTEGER REFERENCES timetable(tt_id),
            timestamp      TIMESTAMP NOT NULL,
            total_faces    INTEGER DEFAULT 0,
            attentive_pct  REAL DEFAULT 0,
            confused_pct   REAL DEFAULT 0,
            distracted_pct REAL DEFAULT 0,
            avg_score      REAL DEFAULT 0
        )
    """)

    # ── WhatsApp Recipients table ─────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS whatsapp_recipients (
            id         SERIAL PRIMARY KEY,
            name       VARCHAR(100) NOT NULL,
            phone      VARCHAR(20) NOT NULL,
            role       VARCHAR(20) NOT NULL CHECK (role IN ('parent','dean','hod','teacher')),
            student_id INTEGER REFERENCES student(std_id) ON DELETE CASCADE,
            class_id   INTEGER REFERENCES class(class_id),
            section_id INTEGER REFERENCES section(section_id)
        )
    """)

    # ── Camera Streams table ──────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS camera_streams (
            id         SERIAL PRIMARY KEY,
            stream_key VARCHAR(50) UNIQUE NOT NULL,
            name       VARCHAR(100) NOT NULL,
            rtsp_url   TEXT NOT NULL,
            section_id INTEGER REFERENCES section(section_id),
            is_active  BOOLEAN DEFAULT TRUE
        )
    """)

    # ── Engagement Sessions table (college user enables/disables monitoring) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS engagement_sessions (
            id             SERIAL PRIMARY KEY,
            section_id     INTEGER NOT NULL REFERENCES section(section_id),
            period_id      INTEGER NOT NULL REFERENCES timetable(tt_id),
            started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
            ended_at       TIMESTAMP,
            capture_interval INTEGER DEFAULT 60,
            is_active      BOOLEAN DEFAULT TRUE,
            started_by     INTEGER REFERENCES users(id)
        )
    """)

    # ── Per-student engagement log (individual student engagement per capture) ─
    cur.execute("""
        CREATE TABLE IF NOT EXISTS engagement_student_log (
            id               SERIAL PRIMARY KEY,
            session_id       INTEGER REFERENCES engagement_sessions(id) ON DELETE CASCADE,
            log_id           INTEGER REFERENCES engagement_log(id) ON DELETE CASCADE,
            student_id       INTEGER REFERENCES student(std_id) ON DELETE CASCADE,
            student_name     VARCHAR(100),
            timestamp        TIMESTAMP NOT NULL,
            engagement_score REAL DEFAULT 0,
            emotion          VARCHAR(30),
            is_attentive     BOOLEAN DEFAULT TRUE,
            gaze_direction   VARCHAR(20),
            liveness_score   REAL DEFAULT 0,
            is_live          BOOLEAN DEFAULT TRUE
        )
    """)

    conn.commit()
    cur.close()
    conn.close()


# ── Auth decorators ───────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*a, **kw)
    return dec

def admin_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            flash('Admin access required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*a, **kw)
    return dec

def college_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'college':
            flash('College staff access required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*a, **kw)
    return dec


# ── Utilities ─────────────────────────────────────────────────────────────────
@app.context_processor
def inject_now():
    return {'now': dt.datetime.now()}


def _save_b64_image(b64_str, path):
    if ',' in b64_str:
        b64_str = b64_str.split(',')[1]
    data  = base64.b64decode(b64_str)
    arr   = np.frombuffer(data, dtype=np.uint8)
    img   = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    cv2.imwrite(path, img)


def _regenerate_embeddings():
    embeddings, names = gen_embed.get_embeddings(DATASET_DIR)
    if embeddings:
        df = pd.DataFrame(embeddings)
        df['name'] = names
        df.to_csv(os.path.join(BASE_DIR, 'embeddings.csv'), index=False)


def _serialize(obj):
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(i) for i in obj]
    if isinstance(obj, (dt.date, dt.time, dt.datetime)):
        return str(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if hasattr(obj, 'item'):
        return obj.item()
    return obj


DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


# ── Auth routes ───────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return redirect(url_for('dashboard') if 'user_id' in session else url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email    = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        conn = get_conn(); cur = conn.cursor()
        cur.execute('SELECT id,name,email,password_hash,role FROM users WHERE email=%s', (email,))
        user = cur.fetchone(); cur.close(); conn.close()
        if user and check_password_hash(user[3], password):
            session.update(user_id=user[0], name=user[1], email=user[2], role=user[4])
            return redirect(url_for('dashboard'))
        flash('Invalid email or password.', 'danger')
    return render_template('login.html')


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name     = request.form.get('name', '').strip()
        email    = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        role     = request.form.get('role', '')
        if role not in ('admin', 'college'):
            flash('Please select a valid role.', 'danger')
            return render_template('signup.html')
        if not all([name, email, password]):
            flash('All fields are required.', 'danger')
            return render_template('signup.html')
        try:
            conn = get_conn(); cur = conn.cursor()
            cur.execute(
                'INSERT INTO users (name,email,password_hash,role) VALUES (%s,%s,%s,%s)',
                (name, email, generate_password_hash(password), role)
            )
            conn.commit(); cur.close(); conn.close()
            flash('Account created! Please log in.', 'success')
            return redirect(url_for('login'))
        except psycopg2.errors.UniqueViolation:
            flash('Email already registered.', 'danger')
        except Exception as e:
            flash(f'Error: {e}', 'danger')
    return render_template('signup.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    return redirect(url_for('admin_dashboard') if session['role'] == 'admin' else url_for('college_dashboard'))


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN PORTAL
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/admin')
@admin_required
def admin_dashboard():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM student')
    student_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM class')
    class_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM section')
    section_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM attendance WHERE date=%s', (dt.date.today(),))
    today_count = cur.fetchone()[0]
    cur.close(); conn.close()
    return render_template('admin/dashboard.html',
                           student_count=student_count,
                           class_count=class_count,
                           section_count=section_count,
                           today_count=today_count)


# ── Class & Section Management ────────────────────────────────────────────────
@app.route('/admin/classes')
@admin_required
def admin_classes():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT c.class_id, c.name,
               (SELECT COUNT(*) FROM section s WHERE s.class_id=c.class_id) as sec_count,
               (SELECT COUNT(*) FROM student st WHERE st.class_id=c.class_id) as stu_count
        FROM class c ORDER BY c.name
    """)
    classes = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/classes.html', classes=classes)


@app.route('/admin/classes/add', methods=['POST'])
@admin_required
def admin_add_class():
    name = request.form.get('name', '').strip()
    if not name:
        flash('Class name is required.', 'danger')
        return redirect(url_for('admin_classes'))
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute('INSERT INTO class (name) VALUES (%s)', (name,))
        conn.commit(); cur.close(); conn.close()
        flash(f'Class "{name}" added.', 'success')
    except psycopg2.errors.UniqueViolation:
        flash(f'Class "{name}" already exists.', 'danger')
    except Exception as e:
        flash(f'Error: {e}', 'danger')
    return redirect(url_for('admin_classes'))


@app.route('/admin/classes/<int:class_id>/delete', methods=['POST'])
@admin_required
def admin_delete_class(class_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('DELETE FROM class WHERE class_id=%s', (class_id,))
    conn.commit(); cur.close(); conn.close()
    flash('Class deleted.', 'success')
    return redirect(url_for('admin_classes'))


@app.route('/admin/classes/<int:class_id>/sections')
@admin_required
def admin_sections(class_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT name FROM class WHERE class_id=%s', (class_id,))
    cls = cur.fetchone()
    if not cls:
        flash('Class not found.', 'danger')
        return redirect(url_for('admin_classes'))
    cur.execute("""
        SELECT s.section_id, s.name,
               (SELECT COUNT(*) FROM student st WHERE st.section_id=s.section_id) as stu_count
        FROM section s WHERE s.class_id=%s ORDER BY s.name
    """, (class_id,))
    sections = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/sections.html', class_id=class_id, class_name=cls[0], sections=sections)


@app.route('/admin/classes/<int:class_id>/sections/add', methods=['POST'])
@admin_required
def admin_add_section(class_id):
    name = request.form.get('name', '').strip()
    if not name:
        flash('Section name is required.', 'danger')
        return redirect(url_for('admin_sections', class_id=class_id))
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute('INSERT INTO section (class_id, name) VALUES (%s, %s)', (class_id, name))
        conn.commit(); cur.close(); conn.close()
        flash(f'Section "{name}" added.', 'success')
    except psycopg2.errors.UniqueViolation:
        flash(f'Section "{name}" already exists in this class.', 'danger')
    except Exception as e:
        flash(f'Error: {e}', 'danger')
    return redirect(url_for('admin_sections', class_id=class_id))


@app.route('/admin/sections/<int:section_id>/delete', methods=['POST'])
@admin_required
def admin_delete_section(section_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT class_id FROM section WHERE section_id=%s', (section_id,))
    row = cur.fetchone()
    class_id = row[0] if row else None
    cur.execute('DELETE FROM section WHERE section_id=%s', (section_id,))
    conn.commit(); cur.close(); conn.close()
    flash('Section deleted.', 'success')
    return redirect(url_for('admin_sections', class_id=class_id) if class_id else url_for('admin_classes'))


# ── Timetable Management ─────────────────────────────────────────────────────
@app.route('/admin/timetable/<int:section_id>')
@admin_required
def admin_timetable(section_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT s.name as sec_name, c.name as cls_name, s.class_id
        FROM section s JOIN class c ON s.class_id=c.class_id
        WHERE s.section_id=%s
    """, (section_id,))
    info = cur.fetchone()
    if not info:
        flash('Section not found.', 'danger')
        return redirect(url_for('admin_classes'))

    cur.execute("""
        SELECT tt_id, day_of_week, period_name, teacher_name, from_time, to_time, is_recess
        FROM timetable WHERE section_id=%s ORDER BY day_of_week, from_time
    """, (section_id,))
    periods = cur.fetchall()
    cur.close(); conn.close()

    # Group by day
    timetable = {i: [] for i in range(7)}
    for p in periods:
        timetable[p[1]].append(p)

    return render_template('admin/timetable.html',
                           section_id=section_id,
                           section_name=info[0],
                           class_name=info[1],
                           class_id=info[2],
                           timetable=timetable,
                           days=DAYS)


@app.route('/admin/timetable/<int:section_id>/add', methods=['POST'])
@admin_required
def admin_add_period(section_id):
    day = int(request.form.get('day_of_week', 0))
    period_name = request.form.get('period_name', '').strip()
    teacher_name = request.form.get('teacher_name', '').strip()
    from_time = request.form.get('from_time', '')
    to_time = request.form.get('to_time', '')
    is_recess = request.form.get('is_recess') == 'on'

    if not period_name or not from_time or not to_time:
        flash('Period name, start time, and end time are required.', 'danger')
        return redirect(url_for('admin_timetable', section_id=section_id))

    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO timetable (section_id, day_of_week, period_name, teacher_name, from_time, to_time, is_recess)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (section_id, day, period_name, teacher_name or None, from_time, to_time, is_recess))
    conn.commit(); cur.close(); conn.close()
    flash(f'Period "{period_name}" added for {DAYS[day]}.', 'success')
    return redirect(url_for('admin_timetable', section_id=section_id))


@app.route('/admin/timetable/delete/<int:tt_id>', methods=['POST'])
@admin_required
def admin_delete_period(tt_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT section_id FROM timetable WHERE tt_id=%s', (tt_id,))
    row = cur.fetchone()
    section_id = row[0] if row else None
    cur.execute('DELETE FROM timetable WHERE tt_id=%s', (tt_id,))
    conn.commit(); cur.close(); conn.close()
    flash('Period deleted.', 'success')
    return redirect(url_for('admin_timetable', section_id=section_id) if section_id else url_for('admin_classes'))


# ── Student Management ────────────────────────────────────────────────────────
@app.route('/admin/students')
@admin_required
def admin_students():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT st.std_id, st.name, st.email, st.roll_no, c.name as class_name, s.name as sec_name, st.dob
        FROM student st
        LEFT JOIN class c ON st.class_id=c.class_id
        LEFT JOIN section s ON st.section_id=s.section_id
        ORDER BY c.name, s.name, st.roll_no, st.name
    """)
    students = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/students.html', students=students)


@app.route('/admin/register', methods=['GET', 'POST'])
@admin_required
def admin_register_student():
    conn = get_conn(); cur = conn.cursor()

    if request.method == 'POST':
        name        = request.form.get('name', '').strip()
        email       = request.form.get('email', '').strip()
        roll_no     = request.form.get('roll_no', '').strip()
        class_id    = request.form.get('class_id', '')
        section_id  = request.form.get('section_id', '')
        dob         = request.form.get('dob', '').strip()
        photos_json = request.form.get('photos', '[]')

        if not name:
            flash('Student name is required.', 'danger')
            cur.execute('SELECT class_id, name FROM class ORDER BY name')
            classes = cur.fetchall(); cur.close(); conn.close()
            return render_template('admin/register_student.html', classes=classes)

        photos = json.loads(photos_json)
        if not photos:
            flash('Please capture at least one photo.', 'danger')
            cur.execute('SELECT class_id, name FROM class ORDER BY name')
            classes = cur.fetchall(); cur.close(); conn.close()
            return render_template('admin/register_student.html', classes=classes)

        try:
            cur.execute("""
                INSERT INTO student (name, email, roll_no, class_id, section_id, dob)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING std_id
            """, (
                name,
                email or None,
                roll_no or None,
                int(class_id) if class_id else None,
                int(section_id) if section_id else None,
                dob or None
            ))
            conn.commit()
        except Exception as e:
            flash(f'Database error: {e}', 'danger')
            cur.execute('SELECT class_id, name FROM class ORDER BY name')
            classes = cur.fetchall(); cur.close(); conn.close()
            return render_template('admin/register_student.html', classes=classes)

        cur.close(); conn.close()

        student_dir = os.path.join(DATASET_DIR, name)
        os.makedirs(student_dir, exist_ok=True)
        for i, b64 in enumerate(photos):
            _save_b64_image(b64, os.path.join(student_dir, f'photo_{i+1}.jpg'))

        try:
            _regenerate_embeddings()
        except Exception as e:
            flash(f'Student saved but embeddings failed: {e}', 'warning')
            return redirect(url_for('admin_students'))

        flash(f'Student "{name}" registered with {len(photos)} photo(s).', 'success')
        return redirect(url_for('admin_students'))

    # GET
    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/register_student.html', classes=classes)


@app.route('/admin/delete/<int:std_id>', methods=['POST'])
@admin_required
def delete_student(std_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT name FROM student WHERE std_id=%s', (std_id,))
    row = cur.fetchone()
    if row:
        name = row[0]
        cur.execute('DELETE FROM attendance WHERE student_id=%s', (std_id,))
        cur.execute('DELETE FROM student WHERE std_id=%s', (std_id,))
        conn.commit()
        d = os.path.join(DATASET_DIR, name)
        if os.path.exists(d):
            shutil.rmtree(d)
        try:
            _regenerate_embeddings()
        except Exception:
            pass
        flash(f'Student "{name}" deleted.', 'success')
    cur.close(); conn.close()
    return redirect(url_for('admin_students'))


# ── API: Sections for a class (AJAX) ─────────────────────────────────────────
@app.route('/api/sections/<int:class_id>')
@login_required
def api_sections(class_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT section_id, name FROM section WHERE class_id=%s ORDER BY name', (class_id,))
    rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify([{'id': r[0], 'name': r[1]} for r in rows])


@app.route('/api/subjects')
@login_required
def api_subjects():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT sub_id, name, from_time, to_time FROM subject ORDER BY from_time')
    rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify([{'id': r[0], 'name': r[1],
                     'time': f"{str(r[2])[:5]} – {str(r[3])[:5]}"} for r in rows])


@app.route('/api/timetable/<int:section_id>')
@login_required
def api_timetable(section_id):
    """Get periods for a section. Shows today's periods first, then all others."""
    today_dow = dt.date.today().weekday()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT ON (period_name) tt_id, period_name, teacher_name, from_time, to_time, is_recess, day_of_week
        FROM timetable WHERE section_id=%s
        ORDER BY period_name, (day_of_week = %s) DESC, from_time
    """, (section_id, today_dow))
    rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify([{
        'id': r[0], 'name': r[1], 'teacher': r[2],
        'time': f"{str(r[3])[:5]} – {str(r[4])[:5]}", 'is_recess': r[5]
    } for r in rows])


# ── Report Sending (Enhanced) ─────────────────────────────────────────────────
@app.route('/admin/reports')
@admin_required
def admin_reports():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/reports.html', classes=classes)


@app.route('/admin/send-report', methods=['POST'])
@admin_required
def admin_send_report():
    report_type = request.form.get('report_type', 'daily')
    date_str    = request.form.get('date', dt.date.today().strftime('%Y-%m-%d'))
    class_id    = request.form.get('class_id', '')
    section_id  = request.form.get('section_id', '')
    recipients  = request.form.get('recipients', '').strip()

    try:
        from send_report import send_filtered_report

        date_obj = dt.datetime.strptime(date_str, '%Y-%m-%d').date()
        recipient_list = [e.strip() for e in recipients.split(',') if e.strip()]

        if not recipient_list:
            from config import faculty_emails, director_email
            recipient_list = list(dict.fromkeys(list(faculty_emails) + [director_email]))

        send_filtered_report(
            report_type=report_type,
            date_obj=date_obj,
            class_id=int(class_id) if class_id else None,
            section_id=int(section_id) if section_id else None,
            recipients=recipient_list
        )
        flash(f'{report_type.capitalize()} report sent successfully!', 'success')
    except Exception as e:
        flash(f'Failed to send report: {e}', 'danger')

    return redirect(url_for('admin_reports'))


# ── Engagement Analytics Routes ───────────────────────────────────────────────
@app.route('/admin/engagement')
@admin_required
def admin_engagement():
    """Admin view: Engagement reports & analytics (read-only)."""
    conn = get_conn(); cur = conn.cursor()

    # Filters
    class_filter = request.args.get('class_id', '')
    section_filter = request.args.get('section_id', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

    query = """
        SELECT e.date, c.name as class_name, s.name as sec_name, t.period_name,
               e.timestamp, e.total_faces, e.attentive_pct, e.confused_pct,
               e.distracted_pct, e.avg_score
        FROM engagement_log e
        LEFT JOIN section s ON e.section_id=s.section_id
        LEFT JOIN class c ON s.class_id=c.class_id
        LEFT JOIN timetable t ON e.period_id=t.tt_id
        WHERE 1=1
    """
    params = []
    if class_filter:
        query += " AND s.class_id = %s"
        params.append(int(class_filter))
    if section_filter:
        query += " AND e.section_id = %s"
        params.append(int(section_filter))
    if date_from:
        query += " AND e.date >= %s"
        params.append(date_from)
    if date_to:
        query += " AND e.date <= %s"
        params.append(date_to)
    query += " ORDER BY e.timestamp DESC LIMIT 100"

    cur.execute(query, params)
    logs = cur.fetchall()

    # Summary stats
    cur.execute("""
        SELECT COUNT(*), COALESCE(AVG(avg_score),0), COALESCE(AVG(attentive_pct),0)
        FROM engagement_log WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    """)
    stats = cur.fetchone()

    # Per-student engagement data (latest 200 records)
    student_query = """
        SELECT esl.student_name, esl.engagement_score, esl.emotion,
               esl.is_attentive, esl.gaze_direction, esl.liveness_score,
               esl.is_live, esl.timestamp,
               c.name as class_name, s.name as sec_name, t.period_name
        FROM engagement_student_log esl
        JOIN engagement_sessions es ON esl.session_id = es.id
        LEFT JOIN section s ON es.section_id = s.section_id
        LEFT JOIN class c ON s.class_id = c.class_id
        LEFT JOIN timetable t ON es.period_id = t.tt_id
        WHERE 1=1
    """
    sparams = []
    if class_filter:
        student_query += " AND s.class_id = %s"
        sparams.append(int(class_filter))
    if section_filter:
        student_query += " AND es.section_id = %s"
        sparams.append(int(section_filter))
    if date_from:
        student_query += " AND esl.timestamp::date >= %s"
        sparams.append(date_from)
    if date_to:
        student_query += " AND esl.timestamp::date <= %s"
        sparams.append(date_to)
    student_query += " ORDER BY esl.timestamp DESC LIMIT 200"
    cur.execute(student_query, sparams)
    student_logs = cur.fetchall()

    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()
    cur.execute('SELECT section_id, name, class_id FROM section ORDER BY name')
    sections = cur.fetchall()
    cur.close(); conn.close()
    return render_template('admin/engagement.html', logs=logs, classes=classes,
                           sections=sections, stats=stats,
                           student_logs=student_logs,
                           class_filter=class_filter, section_filter=section_filter,
                           date_from=date_from, date_to=date_to)


@app.route('/api/engagement/analyze', methods=['POST'])
@login_required
def api_analyze_engagement():
    """Analyze a single image for engagement (used by frontend)."""
    data = request.get_json()
    if not data or 'photo' not in data:
        return jsonify({'error': 'No photo provided'}), 400

    try:
        b64 = data['photo']
        if ',' in b64:
            b64 = b64.split(',')[1]
        img_data = base64.b64decode(b64)
        arr = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        engagement = analyze_engagement(img)
        return jsonify({
            'total_faces': engagement.total_faces,
            'attentive_count': engagement.attentive_count,
            'distracted_count': engagement.distracted_count,
            'attentive_pct': engagement.attentive_pct,
            'confused_pct': engagement.confused_pct,
            'distracted_pct': engagement.distracted_pct,
            'avg_score': round(engagement.avg_engagement_score, 3),
            'emotion_distribution': engagement.emotion_distribution,
            'faces': [{
                'gaze': f.gaze_direction,
                'emotion': f.emotion,
                'attentive': f.is_attentive,
                'score': round(f.engagement_score, 2)
            } for f in engagement.faces]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Liveness Detection Route ─────────────────────────────────────────────────
@app.route('/api/liveness/check', methods=['POST'])
@login_required
def api_liveness_check():
    """Check if a captured photo is of a real person (not a screen/photo)."""
    data = request.get_json()
    if not data or 'photo' not in data:
        return jsonify({'error': 'No photo provided'}), 400

    try:
        b64 = data['photo']
        if ',' in b64:
            b64 = b64.split(',')[1]
        img_data = base64.b64decode(b64)
        arr = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        result = quick_liveness_check(img)
        return jsonify({
            'is_live': result.is_live,
            'confidence': round(result.confidence, 3),
            'texture_pass': result.texture_pass,
            'moiré_pass': result.moiré_pass,
            'reason': result.reason
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Continuous Attendance (RTSP) Routes ───────────────────────────────────────
@app.route('/admin/cameras')
@admin_required
def admin_cameras():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT cs.id, cs.stream_key, cs.name, cs.rtsp_url, cs.section_id, cs.is_active,
               c.name as class_name, s.name as sec_name
        FROM camera_streams cs
        LEFT JOIN section s ON cs.section_id=s.section_id
        LEFT JOIN class c ON s.class_id=c.class_id
        ORDER BY cs.name
    """)
    cameras = cur.fetchall()
    cur.execute("""
        SELECT s.section_id, c.name || ' - ' || s.name as full_name
        FROM section s JOIN class c ON s.class_id=c.class_id ORDER BY c.name, s.name
    """)
    sections = cur.fetchall()
    cur.close(); conn.close()

    ca = get_continuous_attendance()
    status = ca.get_status() if ca else {'running': False, 'streams': {}}

    return render_template('admin/cameras.html', cameras=cameras,
                           sections=sections, ca_status=status)


@app.route('/admin/cameras/add', methods=['POST'])
@admin_required
def admin_add_camera():
    name = request.form.get('name', '').strip()
    rtsp_url = request.form.get('rtsp_url', '').strip()
    section_id = request.form.get('section_id', '')

    if not name or not section_id:
        flash('Camera name and section are required.', 'danger')
        return redirect(url_for('admin_cameras'))

    stream_key = name.lower().replace(' ', '_')

    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO camera_streams (stream_key, name, rtsp_url, section_id)
            VALUES (%s, %s, %s, %s)
        """, (stream_key, name, rtsp_url or 'webcam', int(section_id)))
        conn.commit(); cur.close(); conn.close()

        # Register with continuous attendance
        ca = get_continuous_attendance()
        if ca:
            ca.add_stream(stream_key, rtsp_url or 'webcam', int(section_id), name)

        flash(f'Camera "{name}" added.', 'success')
    except Exception as e:
        flash(f'Error: {e}', 'danger')

    return redirect(url_for('admin_cameras'))


@app.route('/admin/cameras/<int:cam_id>/delete', methods=['POST'])
@admin_required
def admin_delete_camera(cam_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT stream_key FROM camera_streams WHERE id=%s', (cam_id,))
    row = cur.fetchone()
    if row:
        ca = get_continuous_attendance()
        if ca:
            ca.remove_stream(row[0])
    cur.execute('DELETE FROM camera_streams WHERE id=%s', (cam_id,))
    conn.commit(); cur.close(); conn.close()
    flash('Camera removed.', 'success')
    return redirect(url_for('admin_cameras'))


@app.route('/admin/cameras/toggle', methods=['POST'])
@admin_required
def admin_toggle_continuous():
    """Start or stop continuous attendance capture."""
    ca = get_continuous_attendance()
    if not ca:
        flash('Continuous attendance system not initialized.', 'danger')
        return redirect(url_for('admin_cameras'))

    if ca.running:
        ca.stop()
        flash('Continuous attendance stopped.', 'warning')
    else:
        # Load streams from DB
        conn = get_conn(); cur = conn.cursor()
        cur.execute('SELECT stream_key, rtsp_url, section_id, name FROM camera_streams WHERE is_active=TRUE')
        for row in cur.fetchall():
            ca.add_stream(row[0], row[1], row[2], row[3])
        cur.close(); conn.close()
        ca.start()
        flash('Continuous attendance started!', 'success')

    return redirect(url_for('admin_cameras'))


@app.route('/admin/cameras/capture-now', methods=['POST'])
@admin_required
def admin_capture_now():
    """Manually trigger immediate capture from all cameras."""
    ca = get_continuous_attendance()
    if not ca:
        flash('System not initialized.', 'danger')
        return redirect(url_for('admin_cameras'))

    results = ca.capture_now()
    total_students = sum(len(r.get('students', [])) for r in results.values())
    flash(f'Captured from {len(results)} camera(s). {total_students} student(s) detected.', 'success')
    return redirect(url_for('admin_cameras'))


# ── WhatsApp Recipients Management ───────────────────────────────────────────
@app.route('/admin/whatsapp')
@admin_required
def admin_whatsapp():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT wr.id, wr.name, wr.phone, wr.role, wr.student_id, wr.class_id,
               st.name as student_name, c.name as class_name
        FROM whatsapp_recipients wr
        LEFT JOIN student st ON wr.student_id=st.std_id
        LEFT JOIN class c ON wr.class_id=c.class_id
        ORDER BY wr.role, wr.name
    """)
    recipients = cur.fetchall()
    cur.execute('SELECT std_id, name FROM student ORDER BY name')
    students = cur.fetchall()
    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()
    cur.close(); conn.close()

    whatsapp_configured = whatsapp_client is not None
    return render_template('admin/whatsapp.html', recipients=recipients,
                           students=students, classes=classes,
                           whatsapp_configured=whatsapp_configured)


@app.route('/admin/whatsapp/add', methods=['POST'])
@admin_required
def admin_add_whatsapp_recipient():
    name = request.form.get('name', '').strip()
    phone = request.form.get('phone', '').strip()
    role = request.form.get('role', '').strip()
    student_id = request.form.get('student_id', '') or None
    class_id = request.form.get('class_id', '') or None

    if not name or not phone or not role:
        flash('Name, phone, and role are required.', 'danger')
        return redirect(url_for('admin_whatsapp'))

    # Ensure phone has country code
    if not phone.startswith('+'):
        phone = '+91' + phone  # Default to India

    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO whatsapp_recipients (name, phone, role, student_id, class_id)
            VALUES (%s, %s, %s, %s, %s)
        """, (name, phone, role,
              int(student_id) if student_id else None,
              int(class_id) if class_id else None))
        conn.commit(); cur.close(); conn.close()
        flash(f'Recipient "{name}" ({role}) added.', 'success')
    except Exception as e:
        flash(f'Error: {e}', 'danger')

    return redirect(url_for('admin_whatsapp'))


@app.route('/admin/whatsapp/<int:rec_id>/delete', methods=['POST'])
@admin_required
def admin_delete_whatsapp_recipient(rec_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute('DELETE FROM whatsapp_recipients WHERE id=%s', (rec_id,))
    conn.commit(); cur.close(); conn.close()
    flash('Recipient removed.', 'success')
    return redirect(url_for('admin_whatsapp'))


@app.route('/admin/whatsapp/test', methods=['POST'])
@admin_required
def admin_test_whatsapp():
    """Send a test message to verify Twilio setup."""
    phone = request.form.get('phone', '').strip()
    if not phone:
        flash('Enter a phone number to test.', 'danger')
        return redirect(url_for('admin_whatsapp'))

    if not whatsapp_client:
        flash('WhatsApp not configured. Set Twilio credentials in config.py.', 'danger')
        return redirect(url_for('admin_whatsapp'))

    if not phone.startswith('+'):
        phone = '+91' + phone

    result = whatsapp_client.send_message(phone, "✅ Test message from AttendanceAI. WhatsApp integration is working!")
    if result['success']:
        flash(f'Test message sent! SID: {result["sid"]}', 'success')
    else:
        flash(f'Failed: {result["error"]}', 'danger')

    return redirect(url_for('admin_whatsapp'))


@app.route('/admin/whatsapp/send-summary', methods=['POST'])
@admin_required
def admin_send_whatsapp_summary():
    """Manually trigger daily summary to all registered recipients."""
    if not whatsapp_client:
        flash('WhatsApp not configured.', 'danger')
        return redirect(url_for('admin_whatsapp'))

    try:
        send_daily_summary_to_all(DB_PARAMS, whatsapp_client)
        flash('Daily summary sent via WhatsApp!', 'success')
    except Exception as e:
        flash(f'Error: {e}', 'danger')

    return redirect(url_for('admin_whatsapp'))


# ══════════════════════════════════════════════════════════════════════════════
# COLLEGE PORTAL
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/college')
@college_required
def college_dashboard():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM attendance WHERE date=%s', (dt.date.today(),))
    today_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM student')
    total_students = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM class')
    class_count = cur.fetchone()[0]
    cur.close(); conn.close()
    return render_template('college/dashboard.html',
                           today_count=today_count,
                           total_students=total_students,
                           class_count=class_count)


@app.route('/college/mark', methods=['GET', 'POST'])
@college_required
def mark_attendance():
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'photo' not in data:
            return jsonify({'error': 'No photo provided'}), 400

        section_id = data.get('section_id')
        period_id = data.get('period_id')

        if not section_id:
            return jsonify({'error': 'Please select a class and section.'}), 400

        filename = dt.datetime.now().strftime('%H-%M-%S') + '.jpg'
        img_path = os.path.join(IMAGES_DIR, filename)
        try:
            _save_b64_image(data['photo'], img_path)

            # ── Liveness Detection ────────────────────────────────────────
            liveness_result = None
            if LIVENESS_CONFIG.get('enabled'):
                img_for_liveness = cv2.imread(img_path)
                liveness_result = quick_liveness_check(img_for_liveness)
                if LIVENESS_CONFIG.get('strict_mode') and not liveness_result.is_live:
                    return jsonify({
                        'error': f'Liveness check failed: {liveness_result.reason}',
                        'liveness': {
                            'is_live': False,
                            'confidence': liveness_result.confidence,
                            'reason': liveness_result.reason
                        }
                    }), 403

            # Get subject_id from period if available (for legacy compat)
            subject_id = None
            if period_id:
                conn = get_conn(); cur = conn.cursor()
                cur.execute('SELECT period_name FROM timetable WHERE tt_id=%s', (int(period_id),))
                period_row = cur.fetchone()
                if period_row:
                    cur.execute('SELECT sub_id FROM subject WHERE name ILIKE %s', (period_row[0] + '%',))
                    sub_row = cur.fetchone()
                    if sub_row:
                        subject_id = sub_row[0]
                cur.close(); conn.close()

            # ── Face Recognition ──────────────────────────────────────────
            # Always do face recognition regardless of subject matching
            embeddings_csv = os.path.join(BASE_DIR, 'embeddings.csv')
            if not os.path.exists(embeddings_csv):
                return jsonify({'error': 'No embeddings found. Register students first and run gen_embed.py'}), 400

            import pandas as pd_local
            embeddings_df = pd_local.read_csv(embeddings_csv)
            emb_names = embeddings_df['name'].values
            emb_vectors = embeddings_df.drop(columns=['name']).values

            from Attendance_update_db import identify_persons_in_group_photo, get_student_ids
            img, identified_persons = identify_persons_in_group_photo(img_path, emb_vectors, emb_names)

            if img is None:
                return jsonify({'error': 'Could not process image. Try again with better lighting.'}), 400

            # Build result
            identified_names = [p['name'] for p in identified_persons]
            student_id_map = get_student_ids(identified_names) if identified_names else {}
            identified_student_ids = [student_id_map[n] for n in identified_names if n in student_id_map]

            # Mark attendance in DB
            if identified_student_ids:
                conn = get_conn(); cur = conn.cursor()
                for std_id in identified_student_ids:
                    # Check if already marked today for this section/period or subject
                    if subject_id:
                        cur.execute("""
                            SELECT 1 FROM attendance
                            WHERE date=%s AND student_id=%s AND subject_id=%s
                        """, (dt.date.today(), std_id, subject_id))
                    else:
                        cur.execute("""
                            SELECT 1 FROM attendance
                            WHERE date=%s AND student_id=%s AND section_id=%s AND period_id=%s
                        """, (dt.date.today(), std_id, int(section_id), int(period_id) if period_id else None))

                    if not cur.fetchone():
                        cur.execute("""
                            INSERT INTO attendance (date, student_id, subject_id, image, section_id, period_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            dt.date.today(), std_id,
                            subject_id,  # may be None
                            img_path,
                            int(section_id),
                            int(period_id) if period_id else None
                        ))
                conn.commit(); cur.close(); conn.close()

            # Fetch student details for response
            students_present = []
            if identified_student_ids:
                conn = get_conn(); cur = conn.cursor()
                cur.execute('SELECT std_id, name, email FROM student WHERE std_id = ANY(%s)', (identified_student_ids,))
                students_present = [{'id': r[0], 'name': r[1], 'email': r[2]} for r in cur.fetchall()]
                cur.close(); conn.close()

            result = {
                'image_name': filename,
                'students_present': students_present,
                'identified_persons': [
                    {'name': p['name'], 'confidence_score': float(p['confidence_score'])}
                    for p in identified_persons
                ],
                'total_faces_detected': len(identified_persons),
                'total_matched': len(identified_student_ids),
            }

            # ── WhatsApp Absence Alerts ───────────────────────────────────
            if whatsapp_client and period_id:
                try:
                    import threading
                    t = threading.Thread(
                        target=check_and_send_absence_alerts,
                        args=(DB_PARAMS, whatsapp_client, int(section_id), int(period_id)),
                        daemon=True
                    )
                    t.start()
                except Exception:
                    pass

            # Build response (no engagement here - engagement is separate)
            response = _serialize(result)
            if liveness_result:
                response['liveness'] = {
                    'is_live': bool(liveness_result.is_live),
                    'confidence': float(round(liveness_result.confidence, 3))
                }

            # Cleanup
            for f in os.listdir(IMAGES_DIR):
                if not re.match(r'^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png)$', f, re.IGNORECASE):
                    try: os.remove(os.path.join(IMAGES_DIR, f))
                    except: pass

            return jsonify(_serialize(response))
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # GET – fetch classes for selection
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()
    cur.close(); conn.close()
    return render_template('college/mark_attendance.html', classes=classes)


@app.route('/college/records')
@college_required
def attendance_records():
    date_str = request.args.get('date', dt.date.today().strftime('%Y-%m-%d'))
    class_id = request.args.get('class_id', '')
    section_id = request.args.get('section_id', '')

    conn = get_conn(); cur = conn.cursor()

    query = """
        SELECT st.name, st.roll_no, c.name as class_name, sec.name as sec_name,
               t.period_name, a.date
        FROM attendance a
        JOIN student st ON a.student_id=st.std_id
        LEFT JOIN class c ON st.class_id=c.class_id
        LEFT JOIN section sec ON a.section_id=sec.section_id
        LEFT JOIN timetable t ON a.period_id=t.tt_id
        WHERE a.date=%s
    """
    params = [date_str]

    if class_id:
        query += " AND st.class_id=%s"
        params.append(int(class_id))
    if section_id:
        query += " AND a.section_id=%s"
        params.append(int(section_id))

    query += " ORDER BY c.name, sec.name, st.roll_no, st.name"
    cur.execute(query, params)
    records = cur.fetchall()

    cur.execute('SELECT DISTINCT date FROM attendance ORDER BY date DESC LIMIT 30')
    dates = [r[0].strftime('%Y-%m-%d') for r in cur.fetchall()]

    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()

    cur.close(); conn.close()
    return render_template('college/records.html', records=records, date=date_str,
                           dates=dates, classes=classes,
                           selected_class=class_id, selected_section=section_id)


# ══════════════════════════════════════════════════════════════════════════════
#  COLLEGE – ENGAGEMENT MONITORING
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/college/engagement')
@college_required
def college_engagement():
    """College view: configure & monitor engagement for class/section/period."""
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT class_id, name FROM class ORDER BY name')
    classes = cur.fetchall()

    # Get any currently active sessions
    cur.execute("""
        SELECT es.id, c.name, s.name, t.period_name, es.started_at, es.capture_interval
        FROM engagement_sessions es
        JOIN section s ON es.section_id = s.section_id
        JOIN class c ON s.class_id = c.class_id
        JOIN timetable t ON es.period_id = t.tt_id
        WHERE es.is_active = TRUE
        ORDER BY es.started_at DESC
    """)
    active_sessions = cur.fetchall()

    # Recent logs for this user's sessions (last 24h)
    cur.execute("""
        SELECT e.timestamp, c.name, s.name, t.period_name,
               e.total_faces, e.attentive_pct, e.confused_pct, e.distracted_pct, e.avg_score
        FROM engagement_log e
        LEFT JOIN section s ON e.section_id=s.section_id
        LEFT JOIN class c ON s.class_id=c.class_id
        LEFT JOIN timetable t ON e.period_id=t.tt_id
        WHERE e.timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY e.timestamp DESC LIMIT 30
    """)
    recent_logs = cur.fetchall()

    cur.close(); conn.close()
    return render_template('college/engagement.html', classes=classes,
                           active_sessions=active_sessions, recent_logs=recent_logs)


@app.route('/college/engagement/start', methods=['POST'])
@college_required
def college_engagement_start():
    """Start an engagement monitoring session for a class/section/period."""
    section_id = request.form.get('section_id')
    period_id = request.form.get('period_id')
    interval = request.form.get('interval', 60, type=int)

    if not section_id or not period_id:
        flash('Please select a section and period.', 'warning')
        return redirect(url_for('college_engagement'))

    conn = get_conn(); cur = conn.cursor()

    # Check if already active for this section/period
    cur.execute("""
        SELECT id FROM engagement_sessions
        WHERE section_id=%s AND period_id=%s AND is_active=TRUE
    """, (section_id, period_id))
    existing = cur.fetchone()
    if existing:
        flash('Engagement monitoring is already active for this section/period.', 'info')
        cur.close(); conn.close()
        return redirect(url_for('college_engagement'))

    cur.execute("""
        INSERT INTO engagement_sessions (section_id, period_id, capture_interval, started_by)
        VALUES (%s, %s, %s, %s)
    """, (section_id, period_id, interval, session.get('user_id')))
    conn.commit()
    cur.close(); conn.close()

    flash('Engagement monitoring started! Captures will begin automatically.', 'success')
    return redirect(url_for('college_engagement'))


@app.route('/college/engagement/stop', methods=['POST'])
@college_required
def college_engagement_stop():
    """Stop an active engagement monitoring session."""
    session_id = request.form.get('session_id')
    if not session_id:
        flash('Invalid session.', 'danger')
        return redirect(url_for('college_engagement'))

    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        UPDATE engagement_sessions SET is_active=FALSE, ended_at=NOW()
        WHERE id=%s
    """, (session_id,))
    conn.commit()
    cur.close(); conn.close()

    flash('Engagement monitoring stopped.', 'success')
    return redirect(url_for('college_engagement'))


@app.route('/college/engagement/capture', methods=['POST'])
@college_required
def college_engagement_capture():
    """Capture a frame: identify each student, compute per-student engagement + liveness."""
    data = request.get_json()
    if not data or 'photo' not in data:
        return jsonify({'error': 'No photo provided'}), 400

    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'error': 'No session_id provided'}), 400

    try:
        b64 = data['photo']
        if ',' in b64:
            b64 = b64.split(',')[1]
        img_data = base64.b64decode(b64)
        arr = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Could not decode image'}), 400

        # ── Verify session is active ──────────────────────────────────────
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT section_id, period_id FROM engagement_sessions
            WHERE id=%s AND is_active=TRUE
        """, (session_id,))
        sess = cur.fetchone()
        if not sess:
            cur.close(); conn.close()
            return jsonify({'error': 'Session not active or not found'}), 404
        section_id, period_id = sess

        # ── Engagement analysis (class-level) ─────────────────────────────
        engagement = analyze_engagement(img)

        # ── Face recognition: identify who each face is ───────────────────
        embeddings_csv = os.path.join(BASE_DIR, 'embeddings.csv')
        student_details = []  # per-student results

        if os.path.exists(embeddings_csv):
            import pandas as pd_local
            from Attendance_update_db import identify_persons_in_group_photo, get_student_ids

            embeddings_df = pd_local.read_csv(embeddings_csv)
            emb_names = embeddings_df['name'].values
            emb_vectors = embeddings_df.drop(columns=['name']).values

            _, identified_persons = identify_persons_in_group_photo(
                img, emb_vectors, emb_names, is_path=False
            )

            # Map names → student IDs
            id_names = [p['name'] for p in identified_persons]
            student_id_map = get_student_ids(id_names) if id_names else {}

            # ── Per-student liveness (single-frame check on each face crop) ─
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            for idx, person in enumerate(identified_persons):
                name = person['name']
                confidence = float(person['confidence_score'])
                std_id = student_id_map.get(name)

                # Match identified person to an engagement face by bbox overlap
                face_eng = None
                if idx < len(engagement.faces):
                    face_eng = engagement.faces[idx]

                # Per-face liveness on the cropped face region
                liveness_score = 0.0
                is_live = False
                if face_eng:
                    x1, y1, x2, y2 = face_eng.bbox
                    face_crop = img[y1:y2, x1:x2]
                    if face_crop.size > 0:
                        lr = quick_liveness_check(face_crop)
                        liveness_score = round(float(lr.confidence), 3)
                        is_live = bool(lr.is_live)

                eng_score = round(float(face_eng.engagement_score), 3) if face_eng else 0.0
                emotion = face_eng.emotion if face_eng else 'unknown'
                gaze = face_eng.gaze_direction if face_eng else 'unknown'
                attentive = bool(face_eng.is_attentive) if face_eng else False

                student_details.append({
                    'name': name,
                    'student_id': std_id,
                    'confidence': confidence,
                    'engagement_score': eng_score,
                    'emotion': emotion,
                    'gaze': gaze,
                    'is_attentive': attentive,
                    'liveness_score': liveness_score,
                    'is_live': is_live,
                })

        # ── Save class-level engagement_log ───────────────────────────────
        now = dt.datetime.now()
        cur.execute("""
            INSERT INTO engagement_log (date, section_id, period_id, timestamp,
                                        total_faces, attentive_pct, confused_pct,
                                        distracted_pct, avg_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            dt.date.today(), section_id, period_id, now,
            engagement.total_faces, engagement.attentive_pct,
            engagement.confused_pct, engagement.distracted_pct,
            engagement.avg_engagement_score
        ))
        log_id = cur.fetchone()[0]

        # ── Save per-student engagement ───────────────────────────────────
        for sd in student_details:
            cur.execute("""
                INSERT INTO engagement_student_log
                    (session_id, log_id, student_id, student_name, timestamp,
                     engagement_score, emotion, is_attentive, gaze_direction,
                     liveness_score, is_live)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                int(session_id), log_id, sd['student_id'], sd['name'], now,
                sd['engagement_score'], sd['emotion'], sd['is_attentive'],
                sd['gaze'], sd['liveness_score'], sd['is_live']
            ))

        conn.commit(); cur.close(); conn.close()

        # Response for college: class-level stats + identified count only
        # Per-student details are stored in DB and visible only to admin
        return jsonify(_serialize({
            'success': True,
            'total_faces': engagement.total_faces,
            'attentive_count': engagement.attentive_count,
            'distracted_count': engagement.distracted_count,
            'attentive_pct': engagement.attentive_pct,
            'confused_pct': engagement.confused_pct,
            'distracted_pct': engagement.distracted_pct,
            'avg_score': round(engagement.avg_engagement_score, 3),
            'identified_count': len(student_details),
            'timestamp': now.strftime('%H:%M:%S')
        }))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
else:
    # When imported by gunicorn, still initialize DB tables
    init_db()
