# Automated Attendance System

## Overview
This project implements an automated attendance system using facial recognition. It processes group images to identify students, marks attendance based on class schedules, and generates reports.

## Features
- Facial recognition for student identification
- Automatic attendance marking
- Daily, weekly, and monthly report generation
- Email notifications with attendance reports
- Scheduled processing of attendance data

## Setup and Installation
1. Install required dependencies:

2. Set up a PostgreSQL database for storing attendance records.

3. Update `config.py` with your database and email credentials.

4. Prepare a dataset of student images and generate embeddings:

5. Ensure `embeddings.csv` is in the same directory as the main scripts.

## Usage
Run the main scheduling script:

## Components
- `Attendance_update_db.py`: Processes group images and updates attendance records
- `send_report.py`: Generates and sends attendance reports
- `send_email.py`: Handles email functionality
- `schedule_jobs.py`: Schedules daily tasks
- `config.py`: Stores configuration settings

## Key Functions
- `process_group_image(image_path)`: Identifies students in a group photo and marks attendance
- `send_daily_report()`: Generates and sends daily attendance reports
- `send_weekly_report()`: Generates and sends weekly attendance reports
- `send_monthly_report()`: Generates and sends monthly attendance reports

## Configuration
- Adjust scheduling times in `schedule_jobs.py`
- Modify email templates and recipients in `send_report.py`
- Update database and email settings in `config.py`

## Notes
- Ensure system access to a camera or image directory
- Uses VGG-Face algorithm from DeepFace library
- Attendance marking based on stored class schedules

## Troubleshooting
- Check database connection settings for database-related errors
- Verify SMTP settings for email functionality
- Ensure correct image paths and formats

## Future Improvements
- Implement a user interface for manual attendance corrections
- Add support for multiple cameras or image sources
- Enhance facial recognition accuracy