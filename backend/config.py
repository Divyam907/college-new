import os

# ── Database ─────────────────────────────────────────────────────────────────
# On Render, set DATABASE_URL env variable (provided automatically with managed Postgres)
# Locally, falls back to localhost defaults
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    # Render provides postgresql:// but psycopg2 needs postgresql://
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # Parse the URL into DB_PARAMS for psycopg2
    import urllib.parse
    parsed = urllib.parse.urlparse(DATABASE_URL)
    DB_PARAMS = {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": str(parsed.port or 5432),
        "sslmode": "require",
        "connect_timeout": 10,
    }
else:
    DB_PARAMS = {
        "dbname": "autoattendance",
        "user": "postgres",
        "password": "Divyam@208011",
        "host": "localhost"
    }

EMAIL_CONFIG = {
    "sender_email": os.environ.get("EMAIL_USER", "divyamverma90@gmail.com"),
    "sender_password": os.environ.get("EMAIL_PASSWORD", "qoor heke libw pfqy")
}

faculty_emails = ["divyamverma90@gmail.com"]
director_email = "divyamverma90@gmail.com"

# ── Twilio WhatsApp Configuration ────────────────────────────────────────────
# Sign up at https://www.twilio.com/ and get these from your dashboard
# For testing: use sandbox mode (https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
TWILIO_CONFIG = {
    "account_sid": "",         # e.g. "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    "auth_token": "",          # e.g. "your_auth_token_here"
    "whatsapp_from": "+14155238886",  # Twilio sandbox number (change for production)
}

# ── Continuous Attendance (RTSP/Camera) ──────────────────────────────────────
CONTINUOUS_ATTENDANCE = {
    "enabled": False,           # Set True to start background captures
    "interval_minutes": 15,    # Capture every N minutes
    "use_webcam": True,        # True = laptop webcam, False = RTSP streams
    "rtsp_streams": [
        # Add your camera streams here:
        # {"key": "room101", "url": "rtsp://admin:pass@192.168.1.100:554/stream", "section_id": 1, "name": "Room 101"},
    ]
}

# ── Engagement Analytics ─────────────────────────────────────────────────────
ENGAGEMENT_CONFIG = {
    "enabled": True,           # Enable engagement analysis during attendance
    "low_engagement_threshold": 0.4,  # Alert if avg score drops below this
    "alert_via_whatsapp": True,       # Send WhatsApp alert on low engagement
}

# ── Liveness Detection ───────────────────────────────────────────────────────
LIVENESS_CONFIG = {
    "enabled": True,           # Enable anti-spoofing liveness check
    "strict_mode": False,      # If True, block attendance if liveness fails
    "confidence_threshold": 0.5,  # Minimum liveness confidence to pass
}