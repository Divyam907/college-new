import schedule
import time
import os
from datetime import datetime, timedelta
from send_report import *
from Attendance_update_db import  * 

# Folder where class photos are placed (named as HH-MM-SS.jpg)
IMAGES_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")

def job():
    today = datetime.now().date()

    # Process all images in the images/ folder (only HH-MM-SS.ext format)
    if os.path.exists(IMAGES_FOLDER):
        import re
        for img_file in os.listdir(IMAGES_FOLDER):
            if not re.match(r'^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png)$', img_file, re.IGNORECASE):
                continue  # skip prefixed/renamed copies
            img_path = os.path.join(IMAGES_FOLDER, img_file)
            print(f"Processing image: {img_file}")
            result = process_group_image(img_path)
            print(f"Result: {result}")
            send_daily_report(img_path)
    else:
        print(f"Images folder not found: {IMAGES_FOLDER}")
        return

    if today.weekday() == 6:  # Sunday
        send_weekly_report()
    
    if today.day == 5:  # First day of the month
        send_monthly_report()
    print("Email sent successfully")

# Run once immediately on startup (useful for testing)
print("Running job immediately on startup...")
job()

# Schedule the job to run daily at these times
schedule.every().day.at("19:25").do(job)
schedule.every().day.at("19:24").do(job)
schedule.every().day.at("18:04").do(job)

print("Scheduler running. Press Ctrl+C to stop.")
while True:
    schedule.run_pending()
    time.sleep(10)