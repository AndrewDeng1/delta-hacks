#!/usr/bin/env python3
"""
Quick utility to change the target exercise
Usage: python3 set_target.py [squats|jumping_jacks|high_knees]
"""

import sys
import json
import os

if len(sys.argv) < 2:
    print("Usage: python3 set_target.py [squats|jumping_jacks|high_knees]")
    sys.exit(1)

target = sys.argv[1]

valid_exercises = ["squats", "jumping_jacks", "high_knees"]
if target not in valid_exercises:
    print(f"Error: Invalid target '{target}'")
    print(f"Valid options: {', '.join(valid_exercises)}")
    sys.exit(1)

# Write to target_exercise.json
target_file = os.path.join(os.path.dirname(__file__), "target_exercise.json")
with open(target_file, 'w') as f:
    json.dump({"target": target}, f, indent=2)

print(f"✓ Target exercise set to: {target}")
print(f"\nNow run: python3 backend/script.py")
