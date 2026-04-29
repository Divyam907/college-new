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