"""
WhatsApp Alerts Module (Twilio)
Sends WhatsApp messages to parents, dean, HOD, and teachers
for attendance notifications and summaries.
"""

import datetime as dt
import logging
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)


class WhatsAppAlerts:
    """
    Manages WhatsApp notifications via Twilio API.
    Sends absence alerts, daily summaries, and custom messages.
    """

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        """
        Args:
            account_sid: Twilio Account SID
            auth_token: Twilio Auth Token
            from_number: Twilio WhatsApp number (e.g. 'whatsapp:+14155238886')
        """
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number if from_number.startswith('whatsapp:') else f'whatsapp:{from_number}'
        self._client = None

    @property
    def client(self):
        """Lazy-load Twilio client."""
        if self._client is None:
            from twilio.rest import Client
            self._client = Client(self.account_sid, self.auth_token)
        return self._client

    def send_message(self, to_number: str, message: str) -> Dict:
        """
        Send a WhatsApp message to a single recipient.

        Args:
            to_number: Recipient phone with country code (e.g. '+919876543210')
            message: Message text (supports basic formatting)

        Returns:
            Dict with 'success', 'sid', 'error' keys
        """
        to_whatsapp = to_number if to_number.startswith('whatsapp:') else f'whatsapp:{to_number}'

        try:
            msg = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_whatsapp
            )
            logger.info(f"WhatsApp sent to {to_number}: SID={msg.sid}")
            return {'success': True, 'sid': msg.sid, 'error': None}
        except Exception as e:
            logger.error(f"WhatsApp failed to {to_number}: {e}")
            return {'success': False, 'sid': None, 'error': str(e)}

    def send_absence_alert(self, student_name: str, roll_no: str,
                           class_name: str, section_name: str,
                           date: dt.date, recipients: List[Dict]) -> List[Dict]:
        """
        Send absence alert to multiple recipients.

        Args:
            student_name: Name of absent student
            roll_no: Roll number
            class_name: Class name
            section_name: Section name
            date: Date of absence
            recipients: List of {'name': ..., 'phone': ..., 'role': ...}

        Returns:
            List of send results
        """
        message = (
            f"🚨 *Absence Alert*\n\n"
            f"📋 *Student:* {student_name}\n"
            f"🔢 *Roll No:* {roll_no}\n"
            f"🏫 *Class:* {class_name} - {section_name}\n"
            f"📅 *Date:* {date.strftime('%d %B %Y')}\n\n"
            f"The student was not detected in today's attendance.\n"
            f"_— AttendanceAI System_"
        )

        results = []
        for r in recipients:
            result = self.send_message(r['phone'], message)
            result['recipient'] = r['name']
            result['role'] = r['role']
            results.append(result)

        return results

    def send_daily_summary(self, summary_data: Dict, recipients: List[Dict]) -> List[Dict]:
        """
        Send daily attendance summary to dean/HOD/teachers.

        Args:
            summary_data: {
                'date': date, 'total_students': int, 'present_count': int,
                'absent_count': int, 'class_wise': [{'class': str, 'present': int, 'total': int}]
            }
            recipients: List of {'name': ..., 'phone': ..., 'role': ...}
        """
        date_str = summary_data['date'].strftime('%d %B %Y')
        total = summary_data['total_students']
        present = summary_data['present_count']
        absent = summary_data['absent_count']
        pct = round(present / max(total, 1) * 100, 1)

        message = (
            f"📊 *Daily Attendance Summary*\n"
            f"📅 {date_str}\n\n"
            f"👥 Total Students: {total}\n"
            f"✅ Present: {present} ({pct}%)\n"
            f"❌ Absent: {absent}\n\n"
        )

        # Class-wise breakdown
        if summary_data.get('class_wise'):
            message += "*Class-wise:*\n"
            for cw in summary_data['class_wise']:
                c_pct = round(cw['present'] / max(cw['total'], 1) * 100)
                message += f"  • {cw['class']}: {cw['present']}/{cw['total']} ({c_pct}%)\n"

        message += f"\n_— AttendanceAI System_"

        results = []
        for r in recipients:
            result = self.send_message(r['phone'], message)
            result['recipient'] = r['name']
            results.append(result)

        return results

    def send_engagement_alert(self, section_name: str, class_name: str,
                              period_name: str, engagement_score: float,
                              attentive_pct: float, recipients: List[Dict]) -> List[Dict]:
        """
        Alert teachers/HOD when engagement drops below threshold.
        """
        message = (
            f"⚠️ *Low Engagement Alert*\n\n"
            f"🏫 *Class:* {class_name} - {section_name}\n"
            f"📚 *Period:* {period_name}\n"
            f"📈 *Engagement Score:* {engagement_score:.0%}\n"
            f"👀 *Attentive:* {attentive_pct:.0f}%\n\n"
            f"Engagement has dropped below the threshold.\n"
            f"_— AttendanceAI System_"
        )

        results = []
        for r in recipients:
            result = self.send_message(r['phone'], message)
            result['recipient'] = r['name']
            results.append(result)

        return results

    def send_monthly_report(self, student_name: str, roll_no: str,
                            class_name: str, month_name: str,
                            total_days: int, present_days: int,
                            recipients: List[Dict]) -> List[Dict]:
        """Send monthly attendance summary to parents/students."""
        pct = round(present_days / max(total_days, 1) * 100, 1)
        status = "✅ Good" if pct >= 75 else "⚠️ Low" if pct >= 60 else "🚨 Critical"

        message = (
            f"📊 *Monthly Attendance Report*\n\n"
            f"📋 *Student:* {student_name}\n"
            f"🔢 *Roll No:* {roll_no}\n"
            f"🏫 *Class:* {class_name}\n"
            f"📅 *Month:* {month_name}\n\n"
            f"📈 *Attendance:* {present_days}/{total_days} days ({pct}%)\n"
            f"🏷️ *Status:* {status}\n\n"
            f"_— AttendanceAI System_"
        )

        results = []
        for r in recipients:
            result = self.send_message(r['phone'], message)
            result['recipient'] = r['name']
            results.append(result)

        return results


def check_and_send_absence_alerts(db_params: dict, whatsapp: WhatsAppAlerts,
                                  section_id: int, period_id: int):
    """
    After attendance is marked for a period, check who is absent
    and send WhatsApp alerts to their registered contacts.
    """
    import psycopg2

    try:
        conn = psycopg2.connect(**db_params)
        cur = conn.cursor()

        # Get all students in this section
        cur.execute("""
            SELECT st.std_id, st.name, st.roll_no, c.name as class_name, sec.name as sec_name
            FROM student st
            JOIN class c ON st.class_id=c.class_id
            JOIN section sec ON st.section_id=sec.section_id
            WHERE st.section_id=%s
        """, (section_id,))
        all_students = cur.fetchall()

        # Get who was marked present today for this period
        cur.execute("""
            SELECT student_id FROM attendance
            WHERE date=%s AND section_id=%s AND period_id=%s
        """, (dt.date.today(), section_id, period_id))
        present_ids = {r[0] for r in cur.fetchall()}

        # Find absent students
        absent_students = [s for s in all_students if s[0] not in present_ids]

        for student in absent_students:
            std_id, name, roll_no, class_name, sec_name = student

            # Get WhatsApp recipients for this student
            cur.execute("""
                SELECT name, phone, role FROM whatsapp_recipients
                WHERE student_id=%s OR (role IN ('dean', 'hod') AND class_id=%s)
                   OR (role='teacher' AND section_id=%s)
            """, (std_id, None, section_id))

            # Also get general recipients (dean, HOD)
            cur.execute("""
                SELECT name, phone, role FROM whatsapp_recipients
                WHERE student_id IS NULL AND role IN ('dean', 'hod')
            """)
            general_recipients = cur.fetchall()

            # Student-specific recipients (parents)
            cur.execute("""
                SELECT name, phone, role FROM whatsapp_recipients
                WHERE student_id=%s
            """, (std_id,))
            student_recipients = cur.fetchall()

            recipients = [{'name': r[0], 'phone': r[1], 'role': r[2]}
                         for r in student_recipients + general_recipients]

            if recipients:
                whatsapp.send_absence_alert(
                    student_name=name,
                    roll_no=roll_no or 'N/A',
                    class_name=class_name,
                    section_name=sec_name,
                    date=dt.date.today(),
                    recipients=recipients
                )

        cur.close()
        conn.close()
        logger.info(f"Absence alerts sent for {len(absent_students)} students")

    except Exception as e:
        logger.error(f"Error sending absence alerts: {e}")


def send_daily_summary_to_all(db_params: dict, whatsapp: WhatsAppAlerts):
    """
    End-of-day job: send summary to dean, HOD, and teachers.
    """
    import psycopg2

    try:
        conn = psycopg2.connect(**db_params)
        cur = conn.cursor()

        today = dt.date.today()

        # Get totals
        cur.execute('SELECT COUNT(*) FROM student')
        total_students = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(DISTINCT student_id) FROM attendance WHERE date=%s
        """, (today,))
        present_count = cur.fetchone()[0]

        # Class-wise breakdown
        cur.execute("""
            SELECT c.name, COUNT(DISTINCT a.student_id),
                   (SELECT COUNT(*) FROM student s2 WHERE s2.class_id=c.class_id)
            FROM attendance a
            JOIN student st ON a.student_id=st.std_id
            JOIN class c ON st.class_id=c.class_id
            WHERE a.date=%s
            GROUP BY c.class_id, c.name
        """, (today,))
        class_wise = [{'class': r[0], 'present': r[1], 'total': r[2]} for r in cur.fetchall()]

        summary = {
            'date': today,
            'total_students': total_students,
            'present_count': present_count,
            'absent_count': total_students - present_count,
            'class_wise': class_wise
        }

        # Get recipients: dean, HOD, teachers
        cur.execute("""
            SELECT name, phone, role FROM whatsapp_recipients
            WHERE student_id IS NULL AND role IN ('dean', 'hod', 'teacher')
        """)
        recipients = [{'name': r[0], 'phone': r[1], 'role': r[2]} for r in cur.fetchall()]

        cur.close()
        conn.close()

        if recipients:
            whatsapp.send_daily_summary(summary, recipients)
            logger.info(f"Daily summary sent to {len(recipients)} recipients")

    except Exception as e:
        logger.error(f"Error sending daily summary: {e}")
