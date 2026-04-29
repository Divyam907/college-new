import numpy as np
import pandas as pd
from deepface import DeepFace

# Load the stored embeddings and names
embeddings_df = pd.read_csv('embeddings.csv')
names = embeddings_df['name'].values
embeddings = embeddings_df.drop(columns=['name']).values

# Function to identify the person in a new image
def identify_person(image_path, embeddings, names):
    try:
        embedding = DeepFace.represent(img_path=image_path, model_name='VGG-Face')[0]["embedding"]
        distances = np.linalg.norm(embeddings - embedding, axis=1)
        best_match_idx = np.argmin(distances)
        best_match_distance = distances[best_match_idx]
        confidence_score = 1 / (1 + best_match_distance)
        return names[best_match_idx], best_match_distance, confidence_score
    except Exception as e:
        print(f"Could not process image {image_path}: {e}")
        return None

# Test with a new image
new_image_path = r"C:\all\Internships\infosys springboard\Dataset\ant\ant_5.png"

# identified_person = identify_person(new_image_path, embeddings, names)
# print(f'The person in the image is: {identified_person}')
identified_person, distance, confidence_score = identify_person(new_image_path, embeddings, names)
if identified_person:
    print(f'The person in the image is: {identified_person}')
    print(f'Distance: {distance}')
    print(f'Confidence Score: {confidence_score}')
else:
    print('No person identified.')