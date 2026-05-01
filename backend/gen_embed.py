import os
import pandas as pd
from deepface import DeepFace

# Path to the dataset
dataset_path = 'dataset/'

# Function to get facial embeddings for a directory of images
def get_embeddings(directory):
    embeddings = []
    names = []
    for person_name in os.listdir(directory):
        person_path = os.path.join(directory, person_name)
        if os.path.isdir(person_path):
            for image_name in os.listdir(person_path):
                image_path = os.path.join(person_path, image_name)
                if os.path.isfile(image_path):
                    try:
                        embedding = DeepFace.represent(img_path=image_path, model_name='Facenet512', detector_backend='opencv')[0]["embedding"]
                        embeddings.append(embedding)
                        names.append(person_name)
                    except Exception as e:
                        print(f"Could not process image {image_path}: {e}")
    return embeddings, names

# Load the dataset and get embeddings
if __name__ == '__main__':
    embeddings, names = get_embeddings(dataset_path)

    # Save the embeddings and names to a CSV file
    embeddings_df = pd.DataFrame(embeddings)
    embeddings_df['name'] = names
    embeddings_df.to_csv('embeddings.csv', index=False)

    print("Embeddings generated and saved successfully.")
