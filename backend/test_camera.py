"""
Simple camera test to help position yourself correctly
"""
import cv2
import time

print("="*60)
print("         CAMERA POSITIONING TEST")
print("="*60)
print("\nThis will show you what the camera sees.")
print("Position yourself so your ENTIRE body is visible.")
print("Press 'q' to quit when ready.\n")

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

time.sleep(2)

if not cap.isOpened():
    print("ERROR: Could not open camera!")
    exit(1)

print("Camera opened. Showing window...\n")

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    # Mirror the frame
    frame = cv2.flip(frame, 1)

    h, w = frame.shape[:2]

    # Draw guide lines and instructions
    # Draw center line
    cv2.line(frame, (w//2, 0), (w//2, h), (0, 255, 0), 1)
    cv2.line(frame, (0, h//2), (w, h//2), (0, 255, 0), 1)

    # Draw frame boundary guidance
    margin = 50
    cv2.rectangle(frame, (margin, margin), (w-margin, h-margin), (255, 255, 0), 2)

    # Instructions
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 140), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    cv2.putText(frame, "CAMERA POSITIONING TEST", (10, 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.putText(frame, "Can you see your full body (head to feet)?", (10, 60),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(frame, "Stay within the YELLOW box", (10, 85),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
    cv2.putText(frame, "Stand 6-10 feet back if too close", (10, 110),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(frame, "Press 'q' when ready", (10, h - 15),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

    cv2.imshow('Camera Test - Position Yourself', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

print("\nTest complete!")
print("If you could see your full body in the yellow box,")
print("the main script should work: python3 script.py")
