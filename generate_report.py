import pandas as pd
from datetime import datetime, timedelta
import psycopg2
from connection import get_db_connection

def generate_daily_report(date):
    conn = get_db_connection()
    query = """
    SELECT sub.name as subject, s.name as student
    FROM attendance a
    JOIN student s ON a.student_id = s.std_id              
    JOIN subject sub ON a.subject_id = sub.sub_id
    WHERE a.date = %s
    ORDER BY sub.name, s.name
    """
    df = pd.read_sql_query(query, conn, params=(date,))
    # conn.close()
    subject_names = df['subject'].unique().tolist()[0]
    # Pivot the data to get the required format
    daily_report = df.pivot(columns='subject', values='student').reset_index(drop=True)
    return (daily_report,subject_names)

def generate_weekly_report(start_date, end_date):
    conn = get_db_connection()
    query = """
    SELECT s.name as student, sub.name as subject, COUNT(a.date) as days_present
    FROM attendance a
    JOIN student s ON a.student_id = s.std_id
    JOIN subject sub ON a.subject_id = sub.sub_id
    WHERE a.date BETWEEN %s AND %s
    GROUP BY s.name, sub.name
    ORDER BY s.name, sub.name
    """
    df = pd.read_sql_query(query, conn, params=(start_date, end_date))
    return df

def generate_monthly_report(year, month):
    conn = get_db_connection()
    query = """
    SELECT s.name as student, sub.name as subject, COUNT(a.date) as present
    FROM attendance a
    JOIN student s ON a.student_id = s.std_id
    JOIN subject sub ON a.subject_id = sub.sub_id
    WHERE EXTRACT(YEAR FROM a.date) = %s AND EXTRACT(MONTH FROM a.date) = %s
    GROUP BY s.name, sub.name
    ORDER BY s.name, sub.name
    """
    df = pd.read_sql_query(query, conn, params=(year, month))
    
    # Assuming there are 20 classes for each subject in a month
    df['total_classes'] = 20
    df['absent'] = df['total_classes'] - df['present']
    df['attendance_percentage'] = (df['present'] / df['total_classes']) * 100
    
    # Rearrange columns to match the required format
    monthly_report = df[['student', 'subject', 'total_classes', 'present', 'absent', 'attendance_percentage']]
    # conn.close()
    return monthly_report

# Example usage:
# daily_report = generate_daily_report('2023-07-01')
# monthly_report = generate_monthly_report(2023, 7)

# Save to CSV files
# daily_report.to_csv('daily_report.csv', index=False)
# monthly_report.to_csv('monthly_report.csv', index=False)




























# import pandas as pd
# from datetime import datetime, timedelta
# import psycopg2
# from connection import get_db_connection

# DB_PARAMS = {
#     "dbname": "autoattendance",
#     "user": "postgres",
#     "password": "Postgre",
#     "host": "localhost"
# }

# # def get_db_connection():
# #     return psycopg2.connect(**DB_PARAMS)

# def generate_daily_report(date):
#     conn = get_db_connection()
#     query = """
#     SELECT s.name, sub.name as subject, a.date
#     FROM attendance a
   
#     JOIN student s ON a.student_id = s.std_id              
#     JOIN subject sub ON a.subject_id = sub.sub_id
#     WHERE a.date = %s
#     ORDER BY sub.name, s.name
#     """
#     df = pd.read_sql_query(query, conn, params=(date,))
#     # conn.close()
#     return df

# def generate_weekly_report(start_date, end_date):
#     conn = get_db_connection()
#     query = """
#     SELECT s.name, sub.name as subject, COUNT(a.date) as days_present
#     FROM attendance a
#     JOIN student s ON a.student_id = s.std_id
#     JOIN subject sub ON a.subject_id = sub.sub_id
#     WHERE a.date BETWEEN %s AND %s
#     GROUP BY s.name, sub.name
#     ORDER BY sub.name, s.name
#     """
#     df = pd.read_sql_query(query, conn, params=(start_date, end_date))
#     # conn.close()
#     return df

# def generate_monthly_report(year, month):
#     conn = get_db_connection()
#     query = """
#     SELECT s.name, sub.name as subject, COUNT(a.date) as days_present
#     FROM attendance a
#     JOIN student s ON a.student_id = s.std_id
#     JOIN subject sub ON a.subject_id = sub.sub_id
#     WHERE EXTRACT(YEAR FROM a.date) = %s AND EXTRACT(MONTH FROM a.date) = %s
#     GROUP BY s.name, sub.name
#     ORDER BY sub.name, s.name
#     """
#     df = pd.read_sql_query(query, conn, params=(year, month))
#     # conn.close()
#     return df