import numpy as np
import pandas as pd
from deepface import DeepFace
import cv2
import matplotlib.pyplot as plt
import psycopg2
import os
from datetime import datetime

# Database connection parameters
from config import DB_PARAMS

def get_db_connection():
    return psycopg2.connect(**DB_PARAMS)

def identify_persons_in_group_photo(image_path, embeddings, names, is_path=True):
    try:
        if is_path:
            img = cv2.imread(image_path)
            faces = DeepFace.extract_faces(img_path=image_path, detector_backend='opencv')
        else:
            img = image_path  # already a numpy array
            faces = DeepFace.extract_faces(img_path=img, detector_backend='opencv', enforce_detection=False)

        identified_persons = []

        for face in faces:
            facial_area = face['facial_area']
            face_img = img[facial_area['y']:facial_area['y']+facial_area['h'], 
                           facial_area['x']:facial_area['x']+facial_area['w']]
            face_embedding = DeepFace.represent(img_path=face_img, model_name='Facenet512', enforce_detection=False)[0]["embedding"]
            
            distances = np.linalg.norm(embeddings - face_embedding, axis=1)
            best_match_idx = np.argmin(distances)
            best_match_distance = distances[best_match_idx]
            confidence_score = 1 / (1 + best_match_distance)

            # Facenet512 Euclidean threshold (~23 is the DeepFace default)
            THRESHOLD = 23.0
            if best_match_distance > THRESHOLD:
                continue  # face detected but doesn't match any registered student

            identified_persons.append({
                'name': names[best_match_idx],
                'distance': best_match_distance,
                'confidence_score': confidence_score,
                'facial_area': facial_area
            })

        return img, identified_persons

    except Exception as e:
        print(f"Could not process image {image_path}: {e}")
        return None, []

def get_subject_details(image_time):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT sub_id, name, faculty_id, from_time, to_time
        FROM subject
        WHERE %s::time BETWEEN from_time::time AND to_time::time
    """, (image_time,))
    
    result = cur.fetchone()
    cur.close()
    conn.close()
    
    if result:
        return {
            'sub_id': result[0],
            'name': result[1],
            'faculty_id': result[2],
            'from_time': result[3],
            'to_time': result[4]
        }
    else:
        return None

# def get_student_ids(names):
#     conn = get_db_connection()
#     cur = conn.cursor()
    
#     placeholders = ','.join(['%s'] * len(names))
#     cur.execute(f"SELECT std_id, name FROM student WHERE name IN ({placeholders})", names)
#     results = cur.fetchall()
    
#     cur.close()
#     conn.close()
    
#     return {name: std_id for std_id, name in results}
def get_student_ids(names):
    conn = get_db_connection()
    cur = conn.cursor()
    
    placeholders = ','.join(['%s'] * len(names))
    cur.execute(f"SELECT std_id, name FROM student WHERE name IN ({placeholders})", names)
    results = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return {name: std_id for std_id, name in results}

def mark_attendance(student_ids, subject_id, date, image_path):
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        for student_id in student_ids:
            # Check if the attendance record already exists
            cur.execute("""
                SELECT 1 FROM attendance 
                WHERE date = %s AND subject_id = %s AND student_id = %s
            """, (date, subject_id, student_id))
            
            if cur.fetchone() is None:
                # If the record doesn't exist, insert it
                cur.execute("""
                    INSERT INTO attendance (date, subject_id, student_id, image)
                    VALUES (%s, %s, %s, %s)
                """, (date, subject_id, student_id, image_path))

        conn.commit()
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Database error: {e}")
    finally:
        cur.close()
        conn.close()

# def mark_attendance(student_ids, subject_id, date, image_path):
#     conn = get_db_connection()
#     cur = conn.cursor()

#     for student_id in student_ids:
#         cur.execute("""
#             INSERT INTO attendance (date, subject_id, student_id, image)
#             VALUES (%s, %s, %s, %s)
#             ON CONFLICT (date, subject_id, student_id) DO NOTHING
#         """, (date, subject_id, student_id, image_path))

#     conn.commit()
#     cur.close()
#     conn.close()

def process_group_image(image_path):
    # Load the stored embeddings and names
    embeddings_df = pd.read_csv('embeddings.csv')
    names = embeddings_df['name'].values
    embeddings = embeddings_df.drop(columns=['name']).values

    # Extract time from image name (assuming format: HH-MM-SS.jpg)
    image_name = os.path.basename(image_path)
    time_str = image_name.split('.')[0]
    try:
        image_time = datetime.strptime(time_str, "%H-%M-%S").time()
        image_date = datetime.now().date()  # Assuming the image is from today
    except ValueError:
        return {"error": f"Invalid time format in image name: {image_name}. Expected format: HH-MM-SS.jpg"}

    # Get subject details
    subject_details = get_subject_details(image_time)
    if not subject_details:
        return {"error": f"No subject found for image: {image_name} at time: {image_time}"}

    # Identify persons in the group photo
    img, identified_persons = identify_persons_in_group_photo(image_path, embeddings, names)

    if img is None or not identified_persons:
        return {"error": "No persons identified in the group photo."}

    # Get student IDs from names
    identified_names = [person['name'] for person in identified_persons]
    student_id_map = get_student_ids(identified_names)
    identified_student_ids = [student_id_map[name] for name in identified_names if name in student_id_map]

    # Mark attendance
    mark_attendance(identified_student_ids, subject_details['sub_id'], image_date, image_path)

    # Get student details
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT std_id, name, email FROM student WHERE std_id = ANY(%s)", (identified_student_ids,))
    student_details = cur.fetchall()
    cur.close()
    conn.close()

    # Visualize the result
    # for person in identified_persons:
    #     facial_area = person['facial_area']
    #     cv2.rectangle(img, 
    #                   (facial_area['x'], facial_area['y']),
    #                   (facial_area['x']+facial_area['w'], facial_area['y']+facial_area['h']),
    #                   (0,255,0), 2)
        
    #     label = f"{person['name']} ({person['confidence_score']:.2f})"
    #     cv2.putText(img, label, (facial_area['x'], facial_area['y']-10), 
    #                 cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,0), 2)

    # plt.figure(figsize=(12,12))
    # plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    # plt.axis('off')
    # plt.show()

    return {
        "image_name": image_name,
        "image_time": image_time,
        "subject_id": subject_details['sub_id'],
        "subject_name": subject_details['name'],
        "faculty_id": subject_details['faculty_id'],
        "class_time": f"{subject_details['from_time']} - {subject_details['to_time']}",
        "students_present": [{"id": std_id, "name": name, "email": email} for std_id, name, email in student_details],
        "identified_persons": identified_persons
    }

def process_group_image_with_subject(image_path, subject_id):
    """Like process_group_image but uses a caller-supplied subject_id instead of
    guessing from the image filename time — so it works at any hour."""
    embeddings_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'embeddings.csv')
    if not os.path.exists(embeddings_csv):
        return {"error": "embeddings.csv not found. Please run gen_embed.py first."}

    embeddings_df = pd.read_csv(embeddings_csv)
    names      = embeddings_df['name'].values
    embeddings = embeddings_df.drop(columns=['name']).values

    # Look up subject details
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("SELECT sub_id,name,faculty_id,from_time,to_time FROM subject WHERE sub_id=%s",
                (subject_id,))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row:
        return {"error": f"Subject with id {subject_id} not found."}
    subject_details = {'sub_id': row[0], 'name': row[1], 'faculty_id': row[2],
                       'from_time': row[3], 'to_time': row[4]}

    img, identified_persons = identify_persons_in_group_photo(image_path, embeddings, names)
    if img is None:
        return {"error": "Could not read or process the image file."}

    identified_names      = [p['name'] for p in identified_persons]
    student_id_map        = get_student_ids(identified_names)
    identified_student_ids = [student_id_map[n] for n in identified_names if n in student_id_map]

    image_date = datetime.now().date()
    if identified_student_ids:
        mark_attendance(identified_student_ids, subject_details['sub_id'], image_date, image_path)

    conn = get_db_connection(); cur = conn.cursor()
    if identified_student_ids:
        cur.execute("SELECT std_id,name,email FROM student WHERE std_id = ANY(%s)",
                    (identified_student_ids,))
    student_details = cur.fetchall() if identified_student_ids else []
    cur.close(); conn.close()

    return {
        "image_name":     os.path.basename(image_path),
        "subject_id":     subject_details['sub_id'],
        "subject_name":   subject_details['name'],
        "faculty_id":     subject_details['faculty_id'],
        "class_time":     f"{subject_details['from_time']} - {subject_details['to_time']}",
        "students_present": [{"id": s[0], "name": s[1], "email": s[2]}
                              for s in student_details],
        "identified_persons": identified_persons,
    }


# Example usage
if __name__ == "__main__":
    image_path = r"C:\all\Internships\infosys springboard\11-30-00.jpeg"  # Replace with your actual image path
    result = process_group_image(image_path)
    
    if "error" in result:
        print(result["error"])
    else:
        print("Image Details:")
        print(f"Image Name: {result['image_name']}")
        print(f"Image Time: {result['image_time']}")
        print(f"Subject ID: {result['subject_id']}")
        print(f"Subject Name: {result['subject_name']}")
        print(f"Faculty ID: {result['faculty_id']}")
        print(f"Class Time: {result['class_time']}")
        print("\nStudents Present:")
        for student in result['students_present']:
            print(f"  - ID: {student['id']}, Name: {student['name']}, Email: {student['email']}")
        print("\nIdentified Persons:")
        for person in result['identified_persons']:
            print(f"  - Name: {person['name']}, Confidence Score: {person['confidence_score']:.2f}")