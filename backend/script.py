"""
Motion4Good Exercise Detection Script
Uses MediaPipe to detect jumping jacks, squats, and high knees from webcam
Updated for MediaPipe 0.10.x API
"""

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import json
import os
import math
import time
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict

# ============================================================================
# CONFIGURATION
# ============================================================================

TESTING = True  # Show webcam window for testing

# File paths
REP_COUNTER_PATH = os.path.join(os.path.dirname(__file__), "rep_counter.json")
TARGET_EXERCISE_PATH = os.path.join(os.path.dirname(__file__), "target_exercise.json")

# MediaPipe Pose Landmark Indices (from MediaPipe Pose standard)
class PoseLandmark:
    NOSE = 0
    LEFT_EYE_INNER = 1
    LEFT_EYE = 2
    LEFT_EYE_OUTER = 3
    RIGHT_EYE_INNER = 4
    RIGHT_EYE = 5
    RIGHT_EYE_OUTER = 6
    LEFT_EAR = 7
    RIGHT_EAR = 8
    MOUTH_LEFT = 9
    MOUTH_RIGHT = 10
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_PINKY = 17
    RIGHT_PINKY = 18
    LEFT_INDEX = 19
    RIGHT_INDEX = 20
    LEFT_THUMB = 21
    RIGHT_THUMB = 22
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    LEFT_HEEL = 29
    RIGHT_HEEL = 30
    LEFT_FOOT_INDEX = 31
    RIGHT_FOOT_INDEX = 32

# ============================================================================
# EXERCISE STATES
# ============================================================================

class ExerciseType(Enum):
    JUMPING_JACK = "jumping_jacks"
    SQUAT = "squats"
    HIGH_KNEES = "high_knees"
    NONE = "none"

class JumpingJackState(Enum):
    NEUTRAL = "neutral"
    ARMS_UP = "arms_up"

class SquatState(Enum):
    STANDING = "standing"
    SQUATTING = "squatting"

# HighKneeState removed - now using boolean flags (left_knee_was_up, right_knee_was_up)

# ============================================================================
# ANGLE CALCULATION
# ============================================================================

def calculate_angle(point1, point2, point3):
    """Calculate angle between three points (in degrees)"""
    a = np.array([point1.x, point1.y])
    b = np.array([point2.x, point2.y])
    c = np.array([point3.x, point3.y])

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))

    return np.degrees(angle)

def calculate_distance(point1, point2):
    """Calculate normalized distance between two points"""
    return math.sqrt((point1.x - point2.x)**2 + (point1.y - point2.y)**2)

# ============================================================================
# DRAWING UTILITIES
# ============================================================================

def draw_landmarks(frame, landmarks):
    """Draw pose landmarks on the frame using OpenCV"""
    if not landmarks:
        return

    h, w = frame.shape[:2]

    # Define connections (MediaPipe Pose connections)
    POSE_CONNECTIONS = [
        (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
        (12, 14), (14, 16), (16, 18), (16, 20), (16, 22),
        (11, 23), (12, 24), (23, 24),
        (23, 25), (25, 27), (27, 29), (27, 31),
        (24, 26), (26, 28), (28, 30), (28, 32),
        (0, 1), (1, 2), (2, 3), (3, 7),
        (0, 4), (4, 5), (5, 6), (6, 8),
        (9, 10)
    ]

    # Draw connections (thicker and brighter)
    for connection in POSE_CONNECTIONS:
        start_idx, end_idx = connection
        if start_idx < len(landmarks) and end_idx < len(landmarks):
            start = landmarks[start_idx]
            end = landmarks[end_idx]
            start_point = (int(start.x * w), int(start.y * h))
            end_point = (int(end.x * w), int(end.y * h))
            cv2.line(frame, start_point, end_point, (0, 255, 255), 3)  # Cyan color, thicker

    # Draw landmarks (larger and brighter)
    for landmark in landmarks:
        x = int(landmark.x * w)
        y = int(landmark.y * h)
        cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)  # Bright green, larger
        cv2.circle(frame, (x, y), 6, (255, 255, 255), 1)  # White border

# ============================================================================
# EXERCISE DETECTOR
# ============================================================================

@dataclass
class ExerciseDetector:
    """Manages exercise detection and rep counting"""

    # Target exercise to detect (loaded from JSON)
    target_exercise: ExerciseType = ExerciseType.NONE

    # State machines for each exercise
    jumping_jack_state: JumpingJackState = JumpingJackState.NEUTRAL
    squat_state: SquatState = SquatState.STANDING

    # Per-leg tracking for high knees (using boolean flags instead of state machine)
    left_knee_was_up: bool = False
    right_knee_was_up: bool = False

    # Rep counters
    rep_counts: Dict[str, int] = None

    # Cooldown to prevent double counting
    cooldown_frames: int = 0
    COOLDOWN_DURATION: int = 10

    # Target reload counter (check every 30 frames if target changed)
    reload_counter: int = 0
    RELOAD_INTERVAL: int = 30

    def __post_init__(self):
        if self.rep_counts is None:
            self.rep_counts = {
                "jumping_jacks": 0,
                "squats": 0,
                "high_knees": 0
            }
        self.load_target_exercise()

    def detect_jumping_jack(self, landmarks) -> bool:
        """Detect jumping jack and return True if rep completed"""
        # Get relevant landmarks
        left_shoulder = landmarks[PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[PoseLandmark.RIGHT_SHOULDER]
        left_elbow = landmarks[PoseLandmark.LEFT_ELBOW]
        right_elbow = landmarks[PoseLandmark.RIGHT_ELBOW]
        left_wrist = landmarks[PoseLandmark.LEFT_WRIST]
        right_wrist = landmarks[PoseLandmark.RIGHT_WRIST]
        left_hip = landmarks[PoseLandmark.LEFT_HIP]
        right_hip = landmarks[PoseLandmark.RIGHT_HIP]

        # Calculate arm angles (shoulder-elbow-wrist)
        left_arm_angle = calculate_angle(left_shoulder, left_elbow, left_wrist)
        right_arm_angle = calculate_angle(right_shoulder, right_elbow, right_wrist)

        # Calculate shoulder angle (how high arms are raised)
        left_shoulder_angle = calculate_angle(left_hip, left_shoulder, left_elbow)
        right_shoulder_angle = calculate_angle(right_hip, right_shoulder, right_elbow)

        # Arms are UP when shoulder angle is small (arms raised above horizontal)
        arms_up = left_shoulder_angle < 100 and right_shoulder_angle < 100

        # Arms are DOWN when shoulder angle is large (arms at sides)
        arms_down = left_shoulder_angle > 140 and right_shoulder_angle > 140

        rep_completed = False

        if self.jumping_jack_state == JumpingJackState.NEUTRAL and arms_up:
            self.jumping_jack_state = JumpingJackState.ARMS_UP
        elif self.jumping_jack_state == JumpingJackState.ARMS_UP and arms_down:
            self.jumping_jack_state = JumpingJackState.NEUTRAL
            rep_completed = True

        return rep_completed

    def detect_squat(self, landmarks) -> bool:
        """Detect squat and return True if rep completed"""
        # Get relevant landmarks
        left_hip = landmarks[PoseLandmark.LEFT_HIP]
        right_hip = landmarks[PoseLandmark.RIGHT_HIP]
        left_knee = landmarks[PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[PoseLandmark.RIGHT_KNEE]
        left_ankle = landmarks[PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[PoseLandmark.RIGHT_ANKLE]

        # Calculate knee angles
        left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)

        avg_knee_angle = (left_knee_angle + right_knee_angle) / 2

        # In a squat, knee angle is smaller (< 120 degrees)
        # Standing, knee angle is larger (> 160 degrees)
        is_squatting = avg_knee_angle < 120
        is_standing = avg_knee_angle > 160

        rep_completed = False

        if self.squat_state == SquatState.STANDING and is_squatting:
            self.squat_state = SquatState.SQUATTING
            print(f"[SQUAT DEBUG] Knee angle: {avg_knee_angle:.1f}° → Going DOWN")
        elif self.squat_state == SquatState.SQUATTING and is_standing:
            self.squat_state = SquatState.STANDING
            rep_completed = True
            print(f"[SQUAT DEBUG] Knee angle: {avg_knee_angle:.1f}° → Coming UP - REP COMPLETE!")

        return rep_completed

    def detect_high_knees(self, landmarks) -> bool:
        """Detect high knees with hysteresis and cycle completion"""
        # Get relevant landmarks
        left_hip = landmarks[PoseLandmark.LEFT_HIP]
        right_hip = landmarks[PoseLandmark.RIGHT_HIP]
        left_knee = landmarks[PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[PoseLandmark.RIGHT_KNEE]

        # Calculate hip-to-knee vertical distance (negative y means higher on screen)
        left_height = left_hip.y - left_knee.y
        right_height = right_hip.y - right_knee.y

        # HYSTERESIS THRESHOLDS - wide margin prevents flickering
        UP_THRESHOLD = 0.12      # Knee must be THIS high to register "up"
        DOWN_THRESHOLD = 0.06    # Knee must be THIS low to register "down"

        rep_completed = False

        # LEFT LEG: Check for complete cycle (up → down)
        if left_height > UP_THRESHOLD and not self.left_knee_was_up:
            # Knee just crossed UP threshold
            self.left_knee_was_up = True
            print(f"[HIGH KNEES] Left knee UP: {left_height:.3f}")

        elif left_height < DOWN_THRESHOLD and self.left_knee_was_up:
            # Knee just crossed DOWN threshold - CYCLE COMPLETE
            self.left_knee_was_up = False
            rep_completed = True
            print(f"[HIGH KNEES] Left knee DOWN: {left_height:.3f} → REP!")

        # RIGHT LEG: Check for complete cycle (up → down)
        # Note: Can check both legs in same frame, they're independent
        if right_height > UP_THRESHOLD and not self.right_knee_was_up:
            # Knee just crossed UP threshold
            self.right_knee_was_up = True
            print(f"[HIGH KNEES] Right knee UP: {right_height:.3f}")

        elif right_height < DOWN_THRESHOLD and self.right_knee_was_up:
            # Knee just crossed DOWN threshold - CYCLE COMPLETE
            self.right_knee_was_up = False
            rep_completed = True
            print(f"[HIGH KNEES] Right knee DOWN: {right_height:.3f} → REP!")

        return rep_completed

    def process_frame(self, landmarks):
        """Process a frame and detect exercise + reps (only for target exercise)"""
        if self.cooldown_frames > 0:
            self.cooldown_frames -= 1
            return

        # Periodically reload target exercise in case it changed
        self.reload_counter += 1
        if self.reload_counter >= self.RELOAD_INTERVAL:
            old_target = self.target_exercise
            self.load_target_exercise()
            if old_target != self.target_exercise:
                # Reset states when target changes
                self.jumping_jack_state = JumpingJackState.NEUTRAL
                self.squat_state = SquatState.STANDING
                self.left_knee_was_up = False
                self.right_knee_was_up = False
                print(f"[TARGET] Switched to: {self.target_exercise.value}")
            self.reload_counter = 0

        # Only detect the target exercise
        rep_completed = False

        if self.target_exercise == ExerciseType.JUMPING_JACK:
            rep_completed = self.detect_jumping_jack(landmarks)
        elif self.target_exercise == ExerciseType.SQUAT:
            rep_completed = self.detect_squat(landmarks)
        elif self.target_exercise == ExerciseType.HIGH_KNEES:
            rep_completed = self.detect_high_knees(landmarks)

        # Increment counter if rep completed
        if rep_completed:
            self.rep_counts[self.target_exercise.value] += 1

            # Use shorter cooldown for high knees (rapid alternating movement)
            if self.target_exercise == ExerciseType.HIGH_KNEES:
                self.cooldown_frames = 3  # ~100ms at 30fps
            else:
                self.cooldown_frames = self.COOLDOWN_DURATION  # 10 frames for others

            self.save_counts()
            print(f"✓ {self.target_exercise.value}: {self.rep_counts[self.target_exercise.value]} reps")

    def save_counts(self):
        """Save rep counts to JSON file"""
        try:
            # Ensure directory exists if there is one
            dir_path = os.path.dirname(REP_COUNTER_PATH)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)

            with open(REP_COUNTER_PATH, 'w') as f:
                json.dump(self.rep_counts, f, indent=2)
        except Exception as e:
            print(f"Error saving counts: {e}")

    def load_counts(self):
        """Load existing rep counts from JSON file"""
        try:
            if os.path.exists(REP_COUNTER_PATH):
                with open(REP_COUNTER_PATH, 'r') as f:
                    self.rep_counts = json.load(f)
            else:
                self.save_counts()  # Create file with default counts
        except Exception as e:
            print(f"Error loading counts: {e}")

    def load_target_exercise(self):
        """Load target exercise from JSON file"""
        try:
            if os.path.exists(TARGET_EXERCISE_PATH):
                with open(TARGET_EXERCISE_PATH, 'r') as f:
                    data = json.load(f)
                    target = data.get("target", "squats")
                    # Convert string to ExerciseType
                    if target == "jumping_jacks":
                        self.target_exercise = ExerciseType.JUMPING_JACK
                    elif target == "squats":
                        self.target_exercise = ExerciseType.SQUAT
                    elif target == "high_knees":
                        self.target_exercise = ExerciseType.HIGH_KNEES
                    else:
                        self.target_exercise = ExerciseType.SQUAT
                    print(f"[TARGET] Loaded target exercise: {self.target_exercise.value}")
            else:
                # Create default file
                self.target_exercise = ExerciseType.SQUAT
                with open(TARGET_EXERCISE_PATH, 'w') as f:
                    json.dump({"target": "squats"}, f, indent=2)
                print(f"[TARGET] Created default target exercise: squats")
        except Exception as e:
            print(f"Error loading target exercise: {e}")
            self.target_exercise = ExerciseType.SQUAT

# ============================================================================
# MAIN PROGRAM
# ============================================================================

def main():
    # Download model file if needed
    model_path = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")

    if not os.path.exists(model_path):
        print("Downloading pose detection model...")
        import urllib.request
        import ssl
        model_url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        try:
            # Create SSL context that doesn't verify certificates (needed on some systems)
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            # Download the file
            with urllib.request.urlopen(model_url, context=ssl_context) as response:
                with open(model_path, 'wb') as out_file:
                    out_file.write(response.read())
            print("Model downloaded successfully!")
        except Exception as e:
            print(f"Error downloading model: {e}")
            print("Please download manually from:")
            print(model_url)
            return

    # Initialize MediaPipe Pose Landmarker
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.1,  # Very low for maximum detection
        min_pose_presence_confidence=0.1,   # Very low for maximum detection
        min_tracking_confidence=0.1         # Very low for maximum detection
    )

    landmarker = vision.PoseLandmarker.create_from_options(options)

    # Initialize exercise detector
    detector = ExerciseDetector()
    detector.load_counts()

    # Initialize webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not open webcam")
        return

    # Set camera properties for better reliability
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    # Give camera time to warm up
    print("Initializing camera...")
    time.sleep(2)

    # Test read
    ret, test_frame = cap.read()
    if not ret or test_frame is None:
        print("Error: Camera opened but cannot read frames")
        print("Try:")
        print("  1. Closing other apps that might be using the camera")
        print("  2. Granting camera permissions to Terminal/Python")
        cap.release()
        return

    print("\n" + "="*60)
    print("     Motion4Good Exercise Detector - READY!")
    print("="*60)
    print("\nPOSITIONING TIPS:")
    print("  • Stand 5-8 feet away from your camera")
    print("  • Make sure your FULL BODY is visible in frame")
    print("  • Head to feet should be visible")
    print("  • Good lighting helps detection")
    print("\nSUPPORTED EXERCISES:")
    print("  • Jumping Jacks")
    print("  • Squats")
    print("  • High Knees")
    print("\nPress 'q' in the video window to quit")
    print("="*60 + "\n")

    frame_count = 0
    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10
    pose_detected_count = 0
    no_pose_count = 0

    while cap.isOpened():
        ret, frame = cap.read()

        if not ret or frame is None:
            consecutive_errors += 1
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                print("Error: Too many consecutive frame read failures")
                break
            continue

        consecutive_errors = 0

        # Flip frame horizontally for mirror view
        frame = cv2.flip(frame, 1)

        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Create MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Use frame count for timestamp (more reliable than CAP_PROP_POS_MSEC)
        timestamp_ms = frame_count * 33  # Assuming ~30 fps
        frame_count += 1

        # Process with MediaPipe
        try:
            results = landmarker.detect_for_video(mp_image, timestamp_ms)
        except Exception as e:
            print(f"Error processing frame: {e}")
            continue

        # Debug: Print detection status every 30 frames
        if frame_count % 30 == 0:
            if results.pose_landmarks and len(results.pose_landmarks) > 0:
                print(f"✓ Pose detected! (Frame {frame_count})")
                pose_detected_count += 1
            else:
                print(f"⚠ No pose detected (Frame {frame_count})")
                no_pose_count += 1

        # Draw UI elements if testing mode
        if TESTING:
            h, w = frame.shape[:2]

            if results.pose_landmarks and len(results.pose_landmarks) > 0:
                landmarks = results.pose_landmarks[0]

                # Process frame for exercise detection
                detector.process_frame(landmarks)

                # Draw landmarks
                draw_landmarks(frame, landmarks)

                # Draw semi-transparent background for text
                overlay = frame.copy()
                cv2.rectangle(overlay, (0, 0), (400, 150), (0, 0, 0), -1)
                cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

                # Display status - POSE DETECTED
                cv2.putText(frame, "POSE DETECTED", (10, 25),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                # Display target exercise and counts
                cv2.putText(frame, f"Target: {detector.target_exercise.value}",
                           (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                cv2.putText(frame, f"Jumping Jacks: {detector.rep_counts['jumping_jacks']}",
                           (10, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(frame, f"Squats: {detector.rep_counts['squats']}",
                           (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(frame, f"High Knees: {detector.rep_counts['high_knees']}",
                           (10, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

                # Debug info for squats
                if detector.target_exercise == ExerciseType.SQUAT:
                    # Calculate knee angle for debug display
                    left_knee_angle = calculate_angle(
                        landmarks[PoseLandmark.LEFT_HIP],
                        landmarks[PoseLandmark.LEFT_KNEE],
                        landmarks[PoseLandmark.LEFT_ANKLE]
                    )
                    right_knee_angle = calculate_angle(
                        landmarks[PoseLandmark.RIGHT_HIP],
                        landmarks[PoseLandmark.RIGHT_KNEE],
                        landmarks[PoseLandmark.RIGHT_ANKLE]
                    )
                    avg_knee = (left_knee_angle + right_knee_angle) / 2

                    # Show squat state and angle at bottom
                    debug_bg = frame.copy()
                    cv2.rectangle(debug_bg, (0, h-80), (400, h), (0, 0, 0), -1)
                    cv2.addWeighted(debug_bg, 0.6, frame, 0.4, 0, frame)

                    cv2.putText(frame, f"Squat State: {detector.squat_state.value}",
                               (10, h-50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)
                    cv2.putText(frame, f"Knee Angle: {avg_knee:.1f}° (down<120, up>160)",
                               (10, h-20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

                # Debug info for high knees
                elif detector.target_exercise == ExerciseType.HIGH_KNEES:
                    # Calculate knee heights
                    left_hip = landmarks[PoseLandmark.LEFT_HIP]
                    right_hip = landmarks[PoseLandmark.RIGHT_HIP]
                    left_knee = landmarks[PoseLandmark.LEFT_KNEE]
                    right_knee = landmarks[PoseLandmark.RIGHT_KNEE]

                    left_height = left_hip.y - left_knee.y
                    right_height = right_hip.y - right_knee.y

                    # Show high knee state and heights at bottom
                    debug_bg = frame.copy()
                    cv2.rectangle(debug_bg, (0, h-105), (500, h), (0, 0, 0), -1)
                    cv2.addWeighted(debug_bg, 0.6, frame, 0.4, 0, frame)

                    # Show per-leg state (boolean flags)
                    left_state = "UP" if detector.left_knee_was_up else "DOWN"
                    right_state = "UP" if detector.right_knee_was_up else "DOWN"
                    cv2.putText(frame, f"States: L={left_state} R={right_state}",
                               (10, h-75), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

                    # Color code knee heights based on hysteresis thresholds
                    # Green if > UP threshold (0.12), Yellow if in hysteresis zone, White if < DOWN threshold (0.06)
                    if left_height > 0.12:
                        left_color = (0, 255, 0)  # Green - UP
                    elif left_height > 0.06:
                        left_color = (0, 255, 255)  # Yellow - Hysteresis zone
                    else:
                        left_color = (255, 255, 255)  # White - DOWN

                    if right_height > 0.12:
                        right_color = (0, 255, 0)  # Green - UP
                    elif right_height > 0.06:
                        right_color = (0, 255, 255)  # Yellow - Hysteresis zone
                    else:
                        right_color = (255, 255, 255)  # White - DOWN

                    cv2.putText(frame, f"Left: {left_height:.3f} (up>0.12, down<0.06)",
                               (10, h-45), cv2.FONT_HERSHEY_SIMPLEX, 0.45, left_color, 1)
                    cv2.putText(frame, f"Right: {right_height:.3f} (up>0.12, down<0.06)",
                               (10, h-20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, right_color, 1)
            else:
                # No pose detected - still show camera feed with instructions
                # Draw semi-transparent background for text
                overlay = frame.copy()
                cv2.rectangle(overlay, (0, 0), (w, 180), (0, 0, 0), -1)
                cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

                # Display instructions
                cv2.putText(frame, "NO POSE DETECTED", (10, 35),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)
                cv2.putText(frame, "POSITIONING TIPS:", (10, 70),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(frame, "1. Stand further back (6-10 feet)", (10, 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
                cv2.putText(frame, "2. Show your FULL body (head to feet)", (10, 125),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
                cv2.putText(frame, "3. Face the camera directly", (10, 150),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

            # Add quit instruction at bottom
            cv2.putText(frame, "Press 'q' to quit", (10, h - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        else:
            # Not in testing mode - still process landmarks for counting
            if results.pose_landmarks and len(results.pose_landmarks) > 0:
                detector.process_frame(results.pose_landmarks[0])

        # Show frame if testing mode
        if TESTING:
            cv2.imshow('Motion4Good - Exercise Detector', frame)

        # Break on 'q' key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    landmarker.close()

    print("\nFinal counts:")
    print(f"Jumping Jacks: {detector.rep_counts['jumping_jacks']}")
    print(f"Squats: {detector.rep_counts['squats']}")
    print(f"High Knees: {detector.rep_counts['high_knees']}")

if __name__ == "__main__":
    main()
