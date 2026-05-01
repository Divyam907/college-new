"""
Liveness Detection Module
Anti-spoofing to prevent photo/screen-based proxy attendance.
Uses:
  1. Eye Aspect Ratio (EAR) for blink detection
  2. Head movement detection (micro-movements)
  3. Texture/frequency analysis to detect screens/printed photos
"""

import cv2
import numpy as np
from scipy.spatial import distance as dist
from dataclasses import dataclass
from typing import Optional, Tuple, List

# OpenCV Haar cascades for face and eye detection
_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
_eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Eye landmark indices (used only if mediapipe tasks API is available)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Thresholds
EAR_THRESHOLD = 0.21          # Below this = eyes closed (blink)
BLINK_CONSEC_FRAMES = 2       # Min frames for a valid blink
TEXTURE_THRESHOLD = 50.0      # Laplacian variance threshold for real face
MOIRÉ_THRESHOLD = 0.3         # FFT high-freq energy ratio for screen detection
HEAD_MOVEMENT_THRESHOLD = 3.0  # Pixels of nose tip movement between frames


@dataclass
class LivenessResult:
    """Result of liveness check."""
    is_live: bool = False
    confidence: float = 0.0
    blink_detected: bool = False
    texture_pass: bool = False
    moiré_pass: bool = True
    movement_detected: bool = False
    reason: str = ""


class LivenessDetector:
    """
    Stateful liveness detector that tracks faces across frames.
    For single-image mode, use `check_single_frame()`.
    For video/multi-frame mode, use `check_frame()` repeatedly.
    """

    def __init__(self):
        self.blink_counter = 0
        self.blink_total = 0
        self.prev_ear = 0.3
        self.prev_nose_pos: Optional[Tuple[float, float]] = None
        self.movement_history: List[float] = []
        self.frame_count = 0

    def reset(self):
        """Reset state for a new liveness check session."""
        self.blink_counter = 0
        self.blink_total = 0
        self.prev_ear = 0.3
        self.prev_nose_pos = None
        self.movement_history = []
        self.frame_count = 0

    def check_single_frame(self, image: np.ndarray) -> LivenessResult:
        """
        Single-frame liveness check (texture + moiré analysis).
        Less reliable than multi-frame but works for one-shot capture.
        """
        result = LivenessResult()

        # 1. Texture analysis (blurriness of face indicates real vs flat photo)
        texture_pass, texture_score = _check_texture(image)
        result.texture_pass = texture_pass

        # 2. Moiré pattern detection (screens show moiré patterns in FFT)
        moiré_pass, moiré_score = _check_moiré(image)
        result.moiré_pass = moiré_pass

        # 3. Check for face presence and natural 3D depth cues
        depth_pass = _check_depth_cues(image)

        # Calculate confidence
        checks = [texture_pass, moiré_pass, depth_pass]
        result.confidence = sum(checks) / len(checks)
        result.is_live = result.confidence >= 0.66  # At least 2/3 checks pass

        if not result.is_live:
            reasons = []
            if not texture_pass:
                reasons.append("flat/blurry texture detected")
            if not moiré_pass:
                reasons.append("screen moiré pattern detected")
            if not depth_pass:
                reasons.append("no 3D depth cues")
            result.reason = "; ".join(reasons)

        return result

    def check_frame(self, image: np.ndarray) -> LivenessResult:
        """
        Multi-frame liveness check. Call repeatedly with video frames.
        Tracks blinks and head micro-movements using OpenCV.
        """
        self.frame_count += 1
        result = LivenessResult()
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Detect face
        faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.1,
                                                minNeighbors=5, minSize=(60, 60))

        if len(faces) == 0:
            result.reason = "no face detected"
            return result

        # Use largest face
        fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face_roi = gray[fy:fy+fh, fx:fx+fw]

        # 1. Eye detection for blink detection
        eyes = _eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1,
                                              minNeighbors=5, minSize=(15, 15))
        eyes_visible = len(eyes) >= 2

        # Blink = transition from eyes visible to not visible
        if not eyes_visible:
            self.blink_counter += 1
        else:
            if self.blink_counter >= BLINK_CONSEC_FRAMES:
                self.blink_total += 1
            self.blink_counter = 0

        result.blink_detected = self.blink_total > 0

        # 2. Head movement detection (track nose/face center position)
        nose_pos = (fx + fw / 2.0, fy + fh / 2.0)
        if self.prev_nose_pos is not None:
            movement = dist.euclidean(nose_pos, self.prev_nose_pos)
            self.movement_history.append(movement)
        self.prev_nose_pos = nose_pos

        if len(self.movement_history) > 5:
            avg_movement = np.mean(self.movement_history[-10:])
            result.movement_detected = avg_movement > HEAD_MOVEMENT_THRESHOLD

        # 3. Texture check
        texture_pass, _ = _check_texture(image)
        result.texture_pass = texture_pass

        # 4. Moiré check
        moiré_pass, _ = _check_moiré(image)
        result.moiré_pass = moiré_pass

        # Aggregate
        checks_passed = sum([
            result.blink_detected,
            result.movement_detected,
            result.texture_pass,
            result.moiré_pass
        ])
        result.confidence = checks_passed / 4.0
        result.is_live = checks_passed >= 2  # At least 2/4 indicators

        if not result.is_live:
            reasons = []
            if not result.blink_detected:
                reasons.append("no blink detected")
            if not result.movement_detected:
                reasons.append("no head movement")
            if not result.texture_pass:
                reasons.append("flat texture")
            if not result.moiré_pass:
                reasons.append("screen pattern")
            result.reason = "; ".join(reasons)

        return result


def _check_texture(image: np.ndarray) -> Tuple[bool, float]:
    """
    Check facial texture using Laplacian variance.
    Real faces have more texture detail than flat photos.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Focus on center region (likely the face)
    h, w = gray.shape
    cy, cx = h // 2, w // 2
    roi = gray[max(0, cy-100):cy+100, max(0, cx-80):cx+80]

    if roi.size == 0:
        return True, 100.0

    # Laplacian variance (higher = more texture = more likely real)
    laplacian = cv2.Laplacian(roi, cv2.CV_64F)
    variance = laplacian.var()

    return variance > TEXTURE_THRESHOLD, float(variance)


def _check_moiré(image: np.ndarray) -> Tuple[bool, float]:
    """
    Detect moiré patterns that appear when photographing a screen.
    Uses FFT to detect periodic high-frequency patterns.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Resize for consistent analysis
    gray = cv2.resize(gray, (256, 256))

    # FFT
    f = np.fft.fft2(gray.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude = np.log1p(np.abs(fshift))

    # Analyze high-frequency region (outer ring in frequency domain)
    h, w = magnitude.shape
    cy, cx = h // 2, w // 2
    radius_inner = min(h, w) // 4
    radius_outer = min(h, w) // 2

    # Create masks
    y, x = np.ogrid[:h, :w]
    dist_from_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)

    high_freq_mask = (dist_from_center > radius_inner) & (dist_from_center < radius_outer)
    low_freq_mask = dist_from_center <= radius_inner

    high_freq_energy = magnitude[high_freq_mask].mean()
    low_freq_energy = magnitude[low_freq_mask].mean()

    ratio = high_freq_energy / max(low_freq_energy, 1e-6)

    # High ratio of high-freq to low-freq suggests moiré (screen)
    is_clean = ratio < MOIRÉ_THRESHOLD
    return is_clean, float(ratio)


def _check_depth_cues(image: np.ndarray) -> bool:
    """
    Check for natural 3D depth cues using gradient analysis.
    Real faces have smooth gradients; flat photos have uniform lighting.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Sobel gradients
    grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

    # Gradient magnitude
    magnitude = np.sqrt(grad_x ** 2 + grad_y ** 2)

    # Real faces have varied gradient directions and magnitudes
    # Check standard deviation of gradient direction
    angle = np.arctan2(grad_y, grad_x)
    angle_std = np.std(angle[magnitude > 10])  # Only where gradient is significant

    # Real faces: diverse angles (high std), flat photos: uniform (low std)
    return float(angle_std) > 0.8


def quick_liveness_check(image: np.ndarray) -> LivenessResult:
    """
    Quick single-frame liveness check for use during attendance marking.
    Returns LivenessResult with is_live and confidence.
    """
    detector = LivenessDetector()
    return detector.check_single_frame(image)
