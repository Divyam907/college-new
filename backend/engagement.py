"""
Engagement Analytics Module
Uses OpenCV face detection + DeepFace emotion recognition for engagement scoring.
Calculates real-time engagement scores for classrooms.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple

# OpenCV Haar cascade for face detection (bundled with OpenCV)
_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
_eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')


@dataclass
class FaceEngagement:
    """Engagement data for a single detected face."""
    bbox: Tuple[int, int, int, int] = (0, 0, 0, 0)
    gaze_direction: str = "center"  # center, left, right, down
    is_attentive: bool = True
    emotion: str = "neutral"
    engagement_score: float = 1.0  # 0.0 to 1.0
    eyes_detected: int = 0


@dataclass
class ClassEngagement:
    """Aggregated engagement data for the entire class."""
    total_faces: int = 0
    attentive_count: int = 0
    distracted_count: int = 0
    avg_engagement_score: float = 0.0
    attentive_pct: float = 0.0
    confused_pct: float = 0.0
    distracted_pct: float = 0.0
    emotion_distribution: dict = field(default_factory=dict)
    faces: List[FaceEngagement] = field(default_factory=list)


def _estimate_gaze_from_eyes(face_roi_gray, face_x, face_y, face_w, face_h):
    """
    Estimate gaze direction using eye position within face.
    Uses eye detection position relative to face center.
    """
    eyes = _eye_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.1,
                                          minNeighbors=5, minSize=(20, 20))

    if len(eyes) == 0:
        return "down", 0  # No eyes visible = likely looking down

    if len(eyes) >= 2:
        # Sort by x to get left/right eye
        eyes_sorted = sorted(eyes, key=lambda e: e[0])
        left_eye = eyes_sorted[0]
        right_eye = eyes_sorted[1]

        # Check eye symmetry - asymmetry suggests looking sideways
        left_center_x = left_eye[0] + left_eye[2] // 2
        right_center_x = right_eye[0] + right_eye[2] // 2
        face_center_x = face_w // 2

        # Midpoint of both eyes relative to face center
        eye_midpoint = (left_center_x + right_center_x) / 2
        deviation = (eye_midpoint - face_center_x) / face_w

        if deviation < -0.1:
            return "left", len(eyes)
        elif deviation > 0.1:
            return "right", len(eyes)
        return "center", len(eyes)

    # Single eye detected
    eye = eyes[0]
    eye_center_x = eye[0] + eye[2] // 2
    face_center_x = face_w // 2
    deviation = (eye_center_x - face_center_x) / face_w

    if abs(deviation) > 0.15:
        return "left" if deviation < 0 else "right", 1
    return "center", 1


def _get_face_orientation(face_roi_gray, face_w):
    """
    Detect if face is turned by checking gradient symmetry.
    """
    left_half = face_roi_gray[:, :face_w // 2]
    right_half = face_roi_gray[:, face_w // 2:]

    # Compare intensity/gradient of left vs right halves
    left_grad = cv2.Sobel(left_half, cv2.CV_64F, 1, 0).var()
    right_half_flipped = cv2.flip(right_half, 1)
    right_grad = cv2.Sobel(right_half_flipped, cv2.CV_64F, 1, 0).var()

    ratio = left_grad / max(right_grad, 1e-6)
    if ratio > 1.5:
        return "right"  # Left side more detailed = face turned right
    elif ratio < 0.67:
        return "left"
    return "center"


def _classify_engagement(gaze: str, emotion: str, eyes_count: int) -> Tuple[bool, float]:
    """Classify if a person is attentive and calculate engagement score."""
    attentive_gazes = {"center"}
    distracted_emotions = {"angry", "disgust", "sad"}
    confused_emotions = {"fear", "surprise"}

    score = 1.0
    is_attentive = gaze in attentive_gazes

    if not is_attentive:
        score -= 0.4

    if eyes_count == 0:
        score -= 0.3  # Eyes not visible = likely not paying attention
        is_attentive = False

    if emotion in distracted_emotions:
        score -= 0.2
        is_attentive = False
    elif emotion in confused_emotions:
        score -= 0.1  # confused but still engaged

    return is_attentive, max(0.0, min(1.0, score))


def analyze_engagement(image: np.ndarray) -> ClassEngagement:
    """
    Analyze a classroom image for engagement metrics.

    Args:
        image: BGR numpy array (from cv2.imread or camera frame)

    Returns:
        ClassEngagement with per-face and aggregate metrics
    """
    result = ClassEngagement()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces_rects = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
    )

    if len(faces_rects) == 0:
        return result

    # Get emotions via DeepFace
    emotions_map = {}
    try:
        from deepface import DeepFace
        analyses = DeepFace.analyze(
            image, actions=['emotion'],
            enforce_detection=False,
            detector_backend='opencv',
            silent=True
        )
        if isinstance(analyses, dict):
            analyses = [analyses]
        for i, a in enumerate(analyses):
            emotions_map[i] = a.get('dominant_emotion', 'neutral')
    except Exception:
        pass

    faces = []
    for idx, (x, y, w, h) in enumerate(faces_rects):
        face_roi_gray = gray[y:y+h, x:x+w]

        # Gaze estimation from eye positions
        gaze, eyes_count = _estimate_gaze_from_eyes(face_roi_gray, x, y, w, h)

        # Supplement with face orientation
        orientation = _get_face_orientation(face_roi_gray, w)
        if orientation != "center" and gaze == "center":
            gaze = orientation

        # Emotion
        emotion = emotions_map.get(idx, 'neutral')

        # Engagement classification
        is_attentive, score = _classify_engagement(gaze, emotion, eyes_count)

        face = FaceEngagement(
            bbox=(x, y, x + w, y + h),
            gaze_direction=gaze,
            is_attentive=is_attentive,
            emotion=emotion,
            engagement_score=score,
            eyes_detected=eyes_count
        )
        faces.append(face)

    # Aggregate
    result.total_faces = len(faces)
    result.faces = faces

    if faces:
        result.attentive_count = sum(1 for f in faces if f.is_attentive)
        result.distracted_count = result.total_faces - result.attentive_count
        result.avg_engagement_score = sum(f.engagement_score for f in faces) / len(faces)
        result.attentive_pct = round(result.attentive_count / len(faces) * 100, 1)

        emotions = [f.emotion for f in faces]
        confused_count = sum(1 for e in emotions if e in ('fear', 'surprise'))
        result.confused_pct = round(confused_count / len(faces) * 100, 1)
        result.distracted_pct = round(result.distracted_count / len(faces) * 100, 1)
        result.emotion_distribution = {}
        for e in set(emotions):
            result.emotion_distribution[e] = emotions.count(e)

    return result


def draw_engagement_overlay(image: np.ndarray, engagement: ClassEngagement) -> np.ndarray:
    """Draw engagement visualization on the image."""
    img = image.copy()

    for face in engagement.faces:
        x1, y1, x2, y2 = face.bbox
        color = (0, 200, 0) if face.is_attentive else (0, 0, 220)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        label = f"{face.gaze_direction} | {face.emotion} | {face.engagement_score:.0%}"
        cv2.putText(img, label, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

    # Aggregate bar at top
    bar_h = 40
    cv2.rectangle(img, (0, 0), (img.shape[1], bar_h), (40, 40, 40), -1)
    text = (f"Faces: {engagement.total_faces} | "
            f"Attentive: {engagement.attentive_pct:.0f}% | "
            f"Confused: {engagement.confused_pct:.0f}% | "
            f"Distracted: {engagement.distracted_pct:.0f}% | "
            f"Score: {engagement.avg_engagement_score:.0%}")
    cv2.putText(img, text, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    return img
