from generate_report import *
from datetime import datetime
from config import faculty_emails,director_email
import os

from send_email import *
def send_daily_report(img):
    today = datetime.now().date()
    report,sb = generate_daily_report(today)
    report.to_excel(f"daily_report_{today}.xlsx")
    filepath=img
    prefix=str(sb+"_")
    directory = os.path.dirname(filepath)
    filename, extension = os.path.splitext(os.path.basename(filepath))
    
    # Construct the new filename with prefix (copy instead of rename to preserve original)
    new_filename = f"{prefix}_{filename}{extension}"
    new_filepath = os.path.join(directory, new_filename)
    import shutil
    shutil.copy2(filepath, new_filepath)
    img=new_filepath
    
    # faculty_emails = ["faculty1@example.com", "faculty2@example.com"]  # Add faculty emails
    # director_email = "director@example.com"
    
    for email in faculty_emails:
        try:
            send_email(email, f"Daily Attendance Report - {today}", 
                       "Please find attached the daily attendance report.", 
                       [f"daily_report_{today}.xlsx",img])
            print(f"Email sent to {email}")
        except Exception as e:
            print(f"Warning: Could not send email to {email}: {e}")
    
    try:
        send_email(director_email, f"Daily Attendance Report - {today}", 
                   "Please find attached the daily attendance report.", 
                   [f"daily_report_{today}.xlsx",img])
        print(f"Email sent to director")
    except Exception as e:
        print(f"Warning: Could not send email to director: {e}")

def send_weekly_report():
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    report = generate_weekly_report(start_of_week, end_of_week)
    report.to_excel(f"weekly_report_{start_of_week}_to_{end_of_week}.xlsx")
    
    # faculty_emails = ["faculty1@example.com", "faculty2@example.com"]  # Add faculty emails
    # director_email = "director@example.com"
    
    for email in faculty_emails:
        try:
            send_email(email, f"Weekly Attendance Report - {start_of_week} to {end_of_week}", 
                       "Please find attached the weekly attendance report.", 
                       [f"weekly_report_{start_of_week}_to_{end_of_week}.xlsx"])
        except Exception as e:
            print(f"Warning: Could not send weekly email to {email}: {e}")
    try:
        send_email(director_email, f"Weekly Attendance Report - {start_of_week} to {end_of_week}", 
                   "Please find attached the weekly attendance report.", 
                   [f"weekly_report_{start_of_week}_to_{end_of_week}.xlsx"])
    except Exception as e:
        print(f"Warning: Could not send weekly email to director: {e}")

def send_monthly_report():
    today = datetime.now().date()
    report = generate_monthly_report(today.year, today.month)
    report.to_excel(f"monthly_report_{today.year}_{today.month}.xlsx")
    
    # faculty_emails = ["faculty1@example.com", "faculty2@example.com"]  # Add faculty emails
    # director_email = "director@example.com"
    
    for email in faculty_emails:
        try:
            send_email(email, f"Monthly Attendance Report - {today.year}-{today.month}", 
                       "Please find attached the monthly attendance report.", 
                       [f"monthly_report_{today.year}_{today.month}.xlsx"])
        except Exception as e:
            print(f"Warning: Could not send monthly email to {email}: {e}")
    try:
        send_email(director_email, f"Monthly Attendance Report - {today.year}-{today.month}", 
                   "Please find attached the monthly attendance report.", 
                   [f"monthly_report_{today.year}_{today.month}.xlsx"])
    except Exception as e:
        print(f"Warning: Could not send monthly email to director: {e}")


# ── Portal-triggered helpers (accept explicit date/range args) ────────────────
def send_daily_report_by_date(date):
    """Send daily attendance report for any given date (no image attachment)."""
    report, subject_name = generate_daily_report(date)
    filepath = f"daily_report_{date}.xlsx"
    report.to_excel(filepath)
    subject_line = f"Daily Attendance Report – {date}"
    body = f"Please find attached the daily attendance report for {date}."
    recipients = list(faculty_emails) + [director_email]
    errors = []
    for email in dict.fromkeys(recipients):   # deduplicate
        try:
            send_email(email, subject_line, body, [filepath])
        except Exception as e:
            errors.append(f"{email}: {e}")
    if errors:
        raise Exception("Some emails failed:\n" + "\n".join(errors))


def send_weekly_report(start_date, end_date):
    """Send weekly attendance report for an explicit date range."""
    report = generate_weekly_report(start_date, end_date)
    filepath = f"weekly_report_{start_date}_to_{end_date}.xlsx"
    report.to_excel(filepath)
    subject_line = f"Weekly Attendance Report – {start_date} to {end_date}"
    body = f"Please find attached the weekly attendance report for {start_date} to {end_date}."
    recipients = list(faculty_emails) + [director_email]
    errors = []
    for email in dict.fromkeys(recipients):
        try:
            send_email(email, subject_line, body, [filepath])
        except Exception as e:
            errors.append(f"{email}: {e}")
    if errors:
        raise Exception("Some emails failed:\n" + "\n".join(errors))


def send_monthly_report(year, month):
    """Send monthly attendance report for explicit year/month."""
    report = generate_monthly_report(year, month)
    filepath = f"monthly_report_{year}_{month}.xlsx"
    report.to_excel(filepath)
    import calendar
    month_name = calendar.month_name[month]
    subject_line = f"Monthly Attendance Report – {month_name} {year}"
    body = f"Please find attached the monthly attendance report for {month_name} {year}."
    recipients = list(faculty_emails) + [director_email]
    errors = []
    for email in dict.fromkeys(recipients):
        try:
            send_email(email, subject_line, body, [filepath])
        except Exception as e:
            errors.append(f"{email}: {e}")
    if errors:
        raise Exception("Some emails failed:\n" + "\n".join(errors))


# ── Enhanced filtered report (called from admin portal) ───────────────────────
def send_filtered_report(report_type, date_obj, class_id=None, section_id=None, recipients=None):
    """
    Generate and send attendance report filtered by class/section.
    report_type: 'daily', 'weekly', or 'monthly'
    date_obj: datetime.date object
    class_id: optional class filter
    section_id: optional section filter
    recipients: list of email addresses
    """
    import psycopg2
    from config import DB_PARAMS
    from datetime import timedelta
    import pandas as pd

    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()

    # Build date range based on report type
    if report_type == 'weekly':
        start_date = date_obj - timedelta(days=date_obj.weekday())
        end_date = start_date + timedelta(days=6)
        date_filter = "a.date BETWEEN %s AND %s"
        date_params = [start_date, end_date]
        period_label = f"{start_date} to {end_date}"
    elif report_type == 'monthly':
        import calendar
        start_date = date_obj.replace(day=1)
        last_day = calendar.monthrange(date_obj.year, date_obj.month)[1]
        end_date = date_obj.replace(day=last_day)
        date_filter = "a.date BETWEEN %s AND %s"
        date_params = [start_date, end_date]
        period_label = f"{calendar.month_name[date_obj.month]} {date_obj.year}"
    else:  # daily
        date_filter = "a.date = %s"
        date_params = [date_obj]
        period_label = str(date_obj)

    # Build query with optional class/section filters
    query = f"""
        SELECT st.name, st.roll_no, c.name as class_name, sec.name as section_name,
               t.period_name, a.date
        FROM attendance a
        JOIN student st ON a.student_id=st.std_id
        LEFT JOIN class c ON st.class_id=c.class_id
        LEFT JOIN section sec ON a.section_id=sec.section_id
        LEFT JOIN timetable t ON a.period_id=t.tt_id
        WHERE {date_filter}
    """
    params = list(date_params)

    if class_id:
        query += " AND st.class_id=%s"
        params.append(class_id)
    if section_id:
        query += " AND a.section_id=%s"
        params.append(section_id)

    query += " ORDER BY a.date, c.name, sec.name, st.roll_no"
    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Build DataFrame
    df = pd.DataFrame(rows, columns=['Student', 'Roll No', 'Class', 'Section', 'Period', 'Date'])
    df['Date'] = df['Date'].astype(str)

    # Save to Excel
    filename = f"attendance_report_{report_type}_{date_obj}.xlsx"
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Attendance', index=False)

        # Add summary sheet
        if not df.empty:
            summary_data = []
            for (cls, sec, period), grp in df.groupby(['Class', 'Section', 'Period']):
                summary_data.append({
                    'Class': cls or '—',
                    'Section': sec or '—',
                    'Period': period or '—',
                    'Students Present': len(grp),
                    'Student Names': ', '.join(grp['Student'].unique())
                })
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

    # Build detailed email body
    subject_line = f"Attendance Report ({report_type.capitalize()}) – {period_label}"
    class_info = ""
    if class_id:
        class_info += f"\nClass filter applied."
    if section_id:
        class_info += f"\nSection filter applied."

    body = f"Attendance Report ({report_type.capitalize()}) – {period_label}\n"
    body += f"{'='*50}\n\n"
    body += f"Total Records: {len(df)}{class_info}\n\n"

    if not df.empty:
        # Group by section and period for readable summary
        for (cls, sec, period), grp in df.groupby(['Class', 'Section', 'Period']):
            body += f"📋 {cls or '—'} | Section: {sec or '—'} | Period: {period or '—'}\n"
            body += f"   Students Present ({len(grp)}):\n"
            for _, row in grp.iterrows():
                roll = f" (Roll: {row['Roll No']})" if row['Roll No'] else ""
                body += f"     • {row['Student']}{roll}\n"
            body += "\n"
    else:
        body += "No attendance records found for the selected criteria.\n"

    body += "\nDetailed data is attached as an Excel file."

    # Send to all recipients
    errors = []
    for email in recipients:
        try:
            send_email(email, subject_line, body, [filename])
        except Exception as e:
            errors.append(f"{email}: {e}")

    # Cleanup
    try:
        os.remove(filename)
    except:
        pass

    if errors:
        raise Exception("Some emails failed:\n" + "\n".join(errors))