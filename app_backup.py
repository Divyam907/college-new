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

from config import DB_PARAMS
from Attendance_update_db import process_group_image, process_group_image_with_subject
import gen_embed

DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
IMAGES_DIR  = os.path.join(BASE_DIR, 'images')

app = Flask(__name__)
app.secret_key = 'college_attendance_secret_key_2026'
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR,  exist_ok=True)


# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(**DB_PARAMS)


def init_db():
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            name          VARCHAR(100) NOT NULL,
            email         VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin','college'))
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
    if hasattr(obj, 'item'):       # numpy scalar
        return obj.item()
    return obj


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


# ── Admin Portal ──────────────────────────────────────────────────────────────
@app.route('/admin')
@admin_required
def admin_dashboard():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM student');            student_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM subject');            subject_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM attendance WHERE date=%s', (dt.date.today(),))
    today_count = cur.fetchone()[0]
    cur.close(); conn.close()
    return render_template('admin/dashboard.html',
                           student_count=student_count,
                           subject_count=subject_count,
                           today_count=today_count)


@app.route('/admin/send-report', methods=['POST'])
@admin_required
def admin_send_report():
    report_type = request.form.get('report_type', 'daily')
    date_str    = request.form.get('date', dt.date.today().strftime('%Y-%m-%d'))

    try:
        from send_report import send_daily_report_by_date, send_weekly_report, send_monthly_report

        if report_type == 'daily':
            date_obj = dt.datetime.strptime(date_str, '%Y-%m-%d').date()
            send_daily_report_by_date(date_obj)
            flash(f'Daily report for {date_obj} sent successfully!', 'success')

        elif report_type == 'weekly':
            # week containing chosen date
            date_obj      = dt.datetime.strptime(date_str, '%Y-%m-%d').date()
            start_of_week = date_obj - dt.timedelta(days=date_obj.weekday())
            end_of_week   = start_of_week + dt.timedelta(days=6)
            send_weekly_report(start_of_week, end_of_week)
            flash(f'Weekly report ({start_of_week} – {end_of_week}) sent!', 'success')

        elif report_type == 'monthly':
            date_obj = dt.datetime.strptime(date_str, '%Y-%m-%d').date()
            send_monthly_report(date_obj.year, date_obj.month)
            flash(f'Monthly report for {date_obj.strftime("%B %Y")} sent!', 'success')

    except Exception as e:
        flash(f'Failed to send report: {e}', 'danger')

    return redirect(url_for('admin_dashboard'))


@app.route('/admin/send-report/preview')
@admin_required
def admin_send_report_preview():
    from config import faculty_emails, director_email
    recipients = list(dict.fromkeys(list(faculty_emails) + [director_email]))
    return jsonify({'recipients': recipients})


@app.route('/admin/students')
@admin_required
def admin_students():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT std_id,name,email FROM student ORDER BY name')
    students = cur.fetchall(); cur.close(); conn.close()
    return render_template('admin/students.html', students=students)


@app.route('/admin/register', methods=['GET', 'POST'])
@admin_required
def admin_register_student():
    if request.method == 'POST':
        name        = request.form.get('name', '').strip()
        email       = request.form.get('email', '').strip()
        photos_json = request.form.get('photos', '[]')

        if not name:
            flash('Student name is required.', 'danger')
            return render_template('admin/register_student.html')

        photos = json.loads(photos_json)
        if not photos:
            flash('Please capture at least one photo.', 'danger')
            return render_template('admin/register_student.html')

        try:
            conn = get_conn(); cur = conn.cursor()
            cur.execute('INSERT INTO student (name,email) VALUES (%s,%s) RETURNING std_id',
                        (name, email or None))
            conn.commit(); cur.close(); conn.close()
        except Exception as e:
            flash(f'Database error: {e}', 'danger')
            return render_template('admin/register_student.html')

        student_dir = os.path.join(DATASET_DIR, name)
        os.makedirs(student_dir, exist_ok=True)
        for i, b64 in enumerate(photos):
            _save_b64_image(b64, os.path.join(student_dir, f'photo_{i+1}.jpg'))

        try:
            _regenerate_embeddings()
        except Exception as e:
            flash(f'Student saved but embeddings failed to update: {e}', 'warning')
            return redirect(url_for('admin_students'))

        flash(f'Student "{name}" registered with {len(photos)} photo(s). Embeddings updated!', 'success')
        return redirect(url_for('admin_students'))

    return render_template('admin/register_student.html')


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


@app.route('/api/subjects')
@login_required
def api_subjects():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT sub_id, name, from_time, to_time FROM subject ORDER BY from_time')
    rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify([{'id': r[0], 'name': r[1],
                     'time': f"{str(r[2])[:5]} – {str(r[3])[:5]}"} for r in rows])


# ── College Portal ────────────────────────────────────────────────────────────
@app.route('/college')
@college_required
def college_dashboard():
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM attendance WHERE date=%s', (dt.date.today(),))
    today_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM student')
    total_students = cur.fetchone()[0]
    cur.execute("""
        SELECT sub.name, COUNT(DISTINCT a.student_id)
        FROM attendance a JOIN subject sub ON a.subject_id=sub.sub_id
        WHERE a.date=%s GROUP BY sub.name ORDER BY sub.name
    """, (dt.date.today(),))
    subject_stats = cur.fetchall()
    cur.close(); conn.close()
    return render_template('college/dashboard.html',
                           today_count=today_count,
                           total_students=total_students,
                           subject_stats=subject_stats)


@app.route('/college/mark', methods=['GET', 'POST'])
@college_required
def mark_attendance():
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'photo' not in data:
            return jsonify({'error': 'No photo provided'}), 400
        subject_id = data.get('subject_id')
        if not subject_id:
            return jsonify({'error': 'Please select a subject before capturing.'}), 400

        filename = dt.datetime.now().strftime('%H-%M-%S') + '.jpg'
        img_path = os.path.join(IMAGES_DIR, filename)
        try:
            _save_b64_image(data['photo'], img_path)
            result = process_group_image_with_subject(img_path, int(subject_id))
            # Clean up prefixed copies
            for f in os.listdir(IMAGES_DIR):
                if not re.match(r'^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png)$', f, re.IGNORECASE):
                    try: os.remove(os.path.join(IMAGES_DIR, f))
                    except: pass
            return jsonify(_serialize(result))
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # GET – fetch subjects for the dropdown
    conn = get_conn(); cur = conn.cursor()
    cur.execute('SELECT sub_id, name, from_time, to_time FROM subject ORDER BY from_time')
    subjects = [{'id': r[0], 'name': r[1],
                 'time': f"{str(r[2])[:5]} – {str(r[3])[:5]}"} for r in cur.fetchall()]
    cur.close(); conn.close()
    return render_template('college/mark_attendance.html', subjects=subjects)


@app.route('/college/records')
@college_required
def attendance_records():
    date_str = request.args.get('date', dt.date.today().strftime('%Y-%m-%d'))
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT s.name, sub.name, a.date
        FROM attendance a
        JOIN student s  ON a.student_id  = s.std_id
        JOIN subject sub ON a.subject_id = sub.sub_id
        WHERE a.date=%s ORDER BY sub.name, s.name
    """, (date_str,))
    records = cur.fetchall()
    cur.execute('SELECT DISTINCT date FROM attendance ORDER BY date DESC LIMIT 30')
    dates = [r[0].strftime('%Y-%m-%d') for r in cur.fetchall()]
    cur.close(); conn.close()
    return render_template('college/records.html', records=records, date=date_str, dates=dates)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
