import cv2
import time
import os
import mediapipe as mp

# Load API key from .env file (for future Presage integration)
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()

load_env()
API_KEY = os.getenv("PRESAGE_API_KEY")

# Initialize MediaPipe Pose for real-time motion tracking
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

cap = cv2.VideoCapture(0)

rep_count = 0
last_motion_peak = 0
prev_landmarks = None

def calculate_motion_energy(landmarks, prev_landmarks):
    """Calculate motion energy from pose landmark changes."""
    if prev_landmarks is None:
        return 0

    total_motion = 0
    for curr, prev in zip(landmarks.landmark, prev_landmarks.landmark):
        dx = curr.x - prev.x
        dy = curr.y - prev.y
        total_motion += (dx**2 + dy**2) ** 0.5

    return min(total_motion * 10, 1.0)  # Normalize to 0-1

print("Workout Tracker Started")
print("Press ESC to quit")
print("-" * 40)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Convert to RGB for MediaPipe
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose.process(rgb_frame)

    motion = 0
    if results.pose_landmarks:
        # Draw pose landmarks
        mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        # Calculate motion energy
        motion = calculate_motion_energy(results.pose_landmarks, prev_landmarks)
        prev_landmarks = results.pose_landmarks

        # Rep detection via motion peaks
        if motion > 0.15 and time.time() - last_motion_peak > 0.7:
            rep_count += 1
            last_motion_peak = time.time()
            print(f"Rep #{rep_count}")

    # Display stats on frame
    cv2.putText(frame, f"Reps: {rep_count}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Motion: {motion:.2f}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.imshow("Workout Tracker", frame)

    if cv2.waitKey(1) == 27:  # ESC key
        break

cap.release()
cv2.destroyAllWindows()
pose.close()
