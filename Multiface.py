import cv2
import numpy as np
import psycopg2
from deepface import DeepFace
import os
from datetime import datetime

# Database connection parameters
DB_PARAMS = {
    "dbname": "autoattendance",
    "user": "postgres",
    "password": "Postgre",
    "host": "localhost"
}

def get_db_connection():
    return psycopg2.connect(**DB_PARAMS)

def get_student_embeddings():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT std_id, name FROM student")
    students = cur.fetchall()
    cur.close()
    conn.close()

    embeddings = {}
    for std_id, name in students:
        img_path = f"path/to/student/images/{name}.jpg"  # Adjust this path
        if os.path.exists(img_path):
            embedding = DeepFace.represent(img_path=img_path, model_name="VGG-Face", enforce_detection=False)
            embeddings[std_id] = embedding[0]["embedding"]
    
    return embeddings

def identify_students(image_path, embeddings):
    img = cv2.imread(image_path)
    faces = DeepFace.extract_faces(img_path=image_path, enforce_detection=False)
    
    identified_students = []
    for face in faces:
        face_img = face['face']
        face_embedding = DeepFace.represent(img_path=face_img, model_name="VGG-Face", enforce_detection=False)[0]["embedding"]
        
        min_distance = float('inf')
        identified_std_id = None
        for std_id, std_embedding in embeddings.items():
            distance = np.linalg.norm(np.array(face_embedding) - np.array(std_embedding))
            if distance < min_distance:
                min_distance = distance
                identified_std_id = std_id
        
        if identified_std_id and min_distance < 0.6:  # Adjust threshold as needed
            identified_students.append(identified_std_id)
    
    return identified_students

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

def mark_attendance(student_ids, subject_id, date, image_path):
    conn = get_db_connection()
    cur = conn.cursor()

    for student_id in student_ids:
        cur.execute("""
            INSERT INTO attendance (date, subject_id, student_id, image)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (date, subject_id, student_id) DO NOTHING
        """, (date, subject_id, student_id, image_path))

    conn.commit()
    cur.close()
    conn.close()

def process_group_image(image_path):
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

    # Get student embeddings
    student_embeddings = get_student_embeddings()

    # Identify students in the image
    identified_student_ids = identify_students(image_path, student_embeddings)

    # Mark attendance
    mark_attendance(identified_student_ids, subject_details['sub_id'], image_date, image_path)

    # Get student details
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT std_id, name, email FROM student WHERE std_id = ANY(%s)", (identified_student_ids,))
    student_details = cur.fetchall()
    cur.close()
    conn.close()

    return {
        "image_name": image_name,
        "image_time": image_time,
        "subject_id": subject_details['sub_id'],
        "subject_name": subject_details['name'],
        "faculty_id": subject_details['faculty_id'],
        "class_time": f"{subject_details['from_time']} - {subject_details['to_time']}",
        "students_present": [{"id": std_id, "name": name, "email": email} for std_id, name, email in student_details]
    }

# Example usage
if __name__ == "__main__":
    image_path = "10-30-00.jpeg"  # Replace with your actual image path
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

































# import numpy as np
# import pandas as pd
# from deepface import DeepFace
# import cv2
# import matplotlib.pyplot as plt

# # Load the stored embeddings and names
# embeddings_df = pd.read_csv('embeddings.csv')
# names = embeddings_df['name'].values
# embeddings = embeddings_df.drop(columns=['name']).values

# # Function to identify persons in a group photo
# def identify_persons_in_group_photo(image_path, embeddings, names):
#     try:
#         # Read the input image
#         img = cv2.imread(image_path)
        
#         # Detect faces
#         faces = DeepFace.extract_faces(img_path=image_path, detector_backend='mtcnn')

#         identified_persons = []

#         for face in faces:
#             facial_area = face['facial_area']
            
#             # Extract the face region
#             face_img = img[facial_area['y']:facial_area['y']+facial_area['h'], 
#                            facial_area['x']:facial_area['x']+facial_area['w']]
            
#             # Extract the embedding for the detected face
#             face_embedding = DeepFace.represent(img_path=face_img, model_name='VGG-Face', enforce_detection=False)[0]["embedding"]
            
#             distances = np.linalg.norm(embeddings - face_embedding, axis=1)
#             best_match_idx = np.argmin(distances)
#             best_match_distance = distances[best_match_idx]
#             confidence_score = 1 / (1 + best_match_distance)
            
#             identified_persons.append({
#                 'name': names[best_match_idx],
#                 'distance': best_match_distance,
#                 'confidence_score': confidence_score,
#                 'facial_area': facial_area
#             })

#         return img, identified_persons

#     except Exception as e:
#         print(f"Could not process image {image_path}: {e}")
#         return None, None

# # Test with a group photo
# group_photo_path = r"C:\all\Internships\infosys springboard\test.jpeg"
# img, identified_persons = identify_persons_in_group_photo(group_photo_path, embeddings, names)

# if img is not None and identified_persons:
#     for person in identified_persons:
#         facial_area = person['facial_area']
#         cv2.rectangle(img, 
#                       (facial_area['x'], facial_area['y']),
#                       (facial_area['x']+facial_area['w'], facial_area['y']+facial_area['h']),
#                       (0,255,0), 2)
        
#         # Add name and confidence score
#         label = f"{person['name']} ({person['confidence_score']:.2f})"
#         cv2.putText(img, label, (facial_area['x'], facial_area['y']-10), 
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,0), 2)

#     # Display the result
#     plt.figure(figsize=(12,12))
#     plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
#     plt.axis('off')
#     plt.show()

#     # Print details
#     for person in identified_persons:
#         print(f"Person: {person['name']}, Distance: {person['distance']}, Confidence Score: {person['confidence_score']}")
# else:
#     print('No persons identified in the group photo.')