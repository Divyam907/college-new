"""
RTSP / Continuous Attendance Module
Captures frames from cameras at intervals, processes face recognition,
and auto-marks attendance. Uses APScheduler for background scheduling.
"""

import os
import cv2
import datetime as dt
import threading
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# State management
_scheduler = None
_active_streams: Dict[int, dict] = {}  # section_id -> stream info
_lock = threading.Lock()


class ContinuousAttendance:
    """
    Manages continuous attendance capture for one or more camera streams.
    Integrates with existing face recognition and engagement analytics.
    """

    def __init__(self, db_params: dict, dataset_dir: str, images_dir: str,
                 capture_interval_minutes: int = 15, use_webcam: bool = True):
        self.db_params = db_params
        self.dataset_dir = dataset_dir
        self.images_dir = images_dir
        self.interval = capture_interval_minutes
        self.use_webcam = use_webcam
        self.running = False
        self._scheduler = None
        self._streams: Dict[str, dict] = {}  # stream_key -> {url, section_id, camera_name}

    def add_stream(self, stream_key: str, rtsp_url: str, section_id: int, camera_name: str = ""):
        """Register a camera stream for a section."""
        self._streams[stream_key] = {
            'url': rtsp_url,
            'section_id': section_id,
            'camera_name': camera_name or f"Camera-{stream_key}",
            'last_capture': None,
            'status': 'registered'
        }

    def remove_stream(self, stream_key: str):
        """Remove a camera stream."""
        self._streams.pop(stream_key, None)

    def start(self):
        """Start the background scheduler for continuous captures."""
        if self.running:
            return

        from apscheduler.schedulers.background import BackgroundScheduler
        self._scheduler = BackgroundScheduler(daemon=True)
        self._scheduler.add_job(
            self._capture_all_streams,
            'interval',
            minutes=self.interval,
            id='continuous_attendance',
            next_run_time=dt.datetime.now() + dt.timedelta(seconds=10)
        )
        self._scheduler.start()
        self.running = True
        logger.info(f"Continuous attendance started (interval: {self.interval} min)")

    def stop(self):
        """Stop the background scheduler."""
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            self._scheduler = None
        self.running = False
        logger.info("Continuous attendance stopped")

    def capture_now(self, section_id: Optional[int] = None) -> Dict:
        """Manually trigger a capture for one or all sections."""
        if section_id:
            streams = {k: v for k, v in self._streams.items() if v['section_id'] == section_id}
        else:
            streams = self._streams

        results = {}
        for key, stream in streams.items():
            result = self._capture_stream(key, stream)
            results[key] = result
        return results

    def get_status(self) -> Dict:
        """Get current status of all streams."""
        return {
            'running': self.running,
            'interval_minutes': self.interval,
            'streams': {k: {
                'camera_name': v['camera_name'],
                'section_id': v['section_id'],
                'status': v['status'],
                'last_capture': str(v['last_capture']) if v['last_capture'] else None
            } for k, v in self._streams.items()}
        }

    def _capture_all_streams(self):
        """Background job: capture from all registered streams."""
        now = dt.datetime.now()
        today_dow = now.weekday()

        for key, stream in self._streams.items():
            section_id = stream['section_id']

            # Check if there's a scheduled period right now
            if not self._has_active_period(section_id, today_dow, now.time()):
                stream['status'] = 'no_active_period'
                continue

            try:
                self._capture_stream(key, stream)
            except Exception as e:
                logger.error(f"Capture failed for {key}: {e}")
                stream['status'] = f'error: {str(e)[:50]}'

    def _capture_stream(self, key: str, stream: dict) -> Dict:
        """Capture a frame from a single stream and process it."""
        import psycopg2
        from Attendance_update_db import process_group_image

        url = stream['url']
        section_id = stream['section_id']
        result = {'success': False, 'students': [], 'engagement': None}

        # Open camera
        if self.use_webcam or url == 'webcam':
            cap = cv2.VideoCapture(0)
        else:
            cap = cv2.VideoCapture(url)

        if not cap.isOpened():
            stream['status'] = 'camera_unavailable'
            result['error'] = 'Could not open camera stream'
            cap.release()
            return result

        # Capture frame
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            stream['status'] = 'capture_failed'
            result['error'] = 'Could not read frame'
            return result

        # Save frame
        timestamp = dt.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"continuous_{key}_{timestamp}.jpg"
        filepath = os.path.join(self.images_dir, filename)
        cv2.imwrite(filepath, frame)

        # Process face recognition
        try:
            fr_result = process_group_image(filepath)
            identified = fr_result.get('identified', [])
            result['students'] = [p.get('name', '') for p in identified]
            result['success'] = True
        except Exception as e:
            result['error'] = f'Recognition failed: {e}'
            stream['status'] = 'recognition_error'
            return result

        # Mark attendance in DB
        if identified:
            now = dt.datetime.now()
            today_dow = now.weekday()
            period_id = self._get_current_period(section_id, today_dow, now.time())

            try:
                conn = psycopg2.connect(**self.db_params)
                cur = conn.cursor()
                for person in identified:
                    name = person.get('name', '')
                    cur.execute('SELECT std_id FROM student WHERE name=%s', (name,))
                    stu = cur.fetchone()
                    if stu:
                        # Check if already marked today for this period
                        cur.execute("""
                            SELECT id FROM attendance
                            WHERE student_id=%s AND date=%s AND period_id=%s
                        """, (stu[0], dt.date.today(), period_id))
                        if not cur.fetchone():
                            cur.execute("""
                                INSERT INTO attendance (date, student_id, section_id, period_id, image)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (dt.date.today(), stu[0], section_id, period_id, filename))
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e:
                logger.error(f"DB error during continuous attendance: {e}")

        # Engagement analysis
        try:
            from engagement import analyze_engagement
            engagement = analyze_engagement(frame)
            result['engagement'] = {
                'total_faces': engagement.total_faces,
                'attentive_pct': engagement.attentive_pct,
                'confused_pct': engagement.confused_pct,
                'distracted_pct': engagement.distracted_pct,
                'avg_score': engagement.avg_engagement_score
            }

            # Store engagement in DB
            if engagement.total_faces > 0:
                self._store_engagement(section_id, engagement)
        except Exception as e:
            logger.warning(f"Engagement analysis failed: {e}")

        # Update stream status
        stream['last_capture'] = dt.datetime.now()
        stream['status'] = f'ok ({len(identified)} students)'
        result['success'] = True

        # Cleanup old capture file
        try:
            os.remove(filepath)
        except:
            pass

        return result

    def _has_active_period(self, section_id: int, day_of_week: int, current_time) -> bool:
        """Check if there's a scheduled period happening right now."""
        import psycopg2
        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            cur.execute("""
                SELECT tt_id FROM timetable
                WHERE section_id=%s AND day_of_week=%s
                  AND from_time <= %s AND to_time >= %s AND is_recess=FALSE
            """, (section_id, day_of_week, current_time, current_time))
            has = cur.fetchone() is not None
            cur.close()
            conn.close()
            return has
        except:
            return False

    def _get_current_period(self, section_id: int, day_of_week: int, current_time) -> Optional[int]:
        """Get the tt_id of the currently active period."""
        import psycopg2
        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            cur.execute("""
                SELECT tt_id FROM timetable
                WHERE section_id=%s AND day_of_week=%s
                  AND from_time <= %s AND to_time >= %s AND is_recess=FALSE
                ORDER BY from_time LIMIT 1
            """, (section_id, day_of_week, current_time, current_time))
            row = cur.fetchone()
            cur.close()
            conn.close()
            return row[0] if row else None
        except:
            return None

    def _store_engagement(self, section_id: int, engagement):
        """Store engagement metrics in the database."""
        import psycopg2
        now = dt.datetime.now()
        period_id = self._get_current_period(section_id, now.weekday(), now.time())

        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO engagement_log
                (date, section_id, period_id, timestamp, total_faces,
                 attentive_pct, confused_pct, distracted_pct, avg_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                dt.date.today(), section_id, period_id, now,
                engagement.total_faces, engagement.attentive_pct,
                engagement.confused_pct, engagement.distracted_pct,
                engagement.avg_engagement_score
            ))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to store engagement: {e}")


# Module-level instance (initialized from app.py)
_instance: Optional[ContinuousAttendance] = None


def get_continuous_attendance() -> Optional[ContinuousAttendance]:
    """Get the module-level ContinuousAttendance instance."""
    return _instance


def init_continuous_attendance(db_params, dataset_dir, images_dir,
                               interval=15, use_webcam=True) -> ContinuousAttendance:
    """Initialize and return the global ContinuousAttendance instance."""
    global _instance
    _instance = ContinuousAttendance(
        db_params=db_params,
        dataset_dir=dataset_dir,
        images_dir=images_dir,
        capture_interval_minutes=interval,
        use_webcam=use_webcam
    )
    return _instance
